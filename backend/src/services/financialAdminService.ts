/**
 * Administração financeira unificada: emissão de faturas por contrato/plano,
 * registro de pagamentos e QR PIX.
 */

import QRCode from 'qrcode';
import { getDatabase } from '../config/database';
import { logError, logInfo } from '../utils/loggerHelper';
import { buildPixCopyPaste } from '../utils/pixEmv';
import { financialConfig, stripeConfig } from '../config/env';
import {
  getPlanPriceForInterval,
  normalizeBillingInterval,
  resolveInvoicePeriodBounds,
} from '../utils/billingIntervals';
import { addCalendarDaysYmd } from '../utils/businessDate';
import { StripeService } from './stripeService';
import { getFinancialNotificationService } from './financialNotificationService';
function getSubscriberBillingServiceInstance() {
  if (!(global as any).subscriberBillingServiceInstance) {
    const { SubscriberBillingService } = require('./subscriberBillingService');
    (global as any).subscriberBillingServiceInstance = new SubscriberBillingService();
  }
  return (global as any).subscriberBillingServiceInstance;
}

function getPublisherBillingServiceInstance() {
  if (!(global as any).publisherBillingServiceInstance) {
    const { PublisherBillingService } = require('./publisherBillingService');
    (global as any).publisherBillingServiceInstance = new PublisherBillingService();
  }
  return (global as any).publisherBillingServiceInstance;
}

export type FinancialAlertLevel = 'error' | 'warning' | 'success' | 'neutral';

export interface IssueInvoicesResult {
  created: number;
  skipped: number;
  errors: Array<{ contractId: number; message: string }>;
  invoices: Array<{ billingId: number; contractId: number; invoiceNumber: string }>;
}

export interface RecordPaymentRequest {
  amount?: number;
  paymentMethod?: string;
  paymentReference?: string;
  notes?: string;
  paidAt?: string;
}

export interface PaymentQrResponse {
  copyPaste: string;
  qrDataUrl: string;
  amount: number;
  currency: string;
  invoiceNumber?: string;
  dueDate?: string;
  pixConfigured: boolean;
}

export class FinancialAdminService {
  private get db() {
    return getDatabase();
  }

  private computeDueDate(daysFromNow = 7): string {
    return addCalendarDaysYmd(new Date(), daysFromNow);
  }

  private invoiceNumberFor(contractId: number, subscriberId: number, periodLabel: string): string {
    return `SUB-${subscriberId}-C${contractId}-${periodLabel}`.slice(0, 60);
  }

  private publisherInvoiceNumberFor(
    publisherId: number,
    contractId: number,
    periodLabel: string
  ): string {
    return `PUB-${publisherId}-C${contractId}-${periodLabel}`.slice(0, 60);
  }

  private mergeIssueResults(a: IssueInvoicesResult, b: IssueInvoicesResult): IssueInvoicesResult {
    return {
      created: a.created + b.created,
      skipped: a.skipped + b.skipped,
      errors: [...a.errors, ...b.errors],
      invoices: [...a.invoices, ...b.invoices],
    };
  }

  /**
   * Emite faturas de anunciantes e organizações (contratos ativos).
   */
  async issueContractInvoices(options?: {
    subscriberId?: number;
    contractId?: number;
    publisherId?: number;
    publisherContractId?: number;
    dueInDays?: number;
    includeRevenueSharePayouts?: boolean;
    revenueShareSinceDays?: number;
  }): Promise<IssueInvoicesResult> {
    const subscriber = await this.issueSubscriberContractInvoices(options);
    const publisher = await this.issuePublisherContractInvoices(options);
    let merged = this.mergeIssueResults(subscriber, publisher);
    if (options?.includeRevenueSharePayouts) {
      const repasse = await this.issueRevenueSharePayouts({
        publisherId: options.publisherId,
        sinceDays: options.revenueShareSinceDays,
      });
      merged = this.mergeIssueResults(merged, repasse);
    }
    await logInfo('Emissão financeira consolidada (anunciante + organização)', {
      created: merged.created,
      skipped: merged.skipped,
      errors: merged.errors.length,
    });
    return merged;
  }

  /** Faturas recorrentes de contratos de anunciante (subscriber_contracts + plano). */
  async issueSubscriberContractInvoices(options?: {
    subscriberId?: number;
    contractId?: number;
    dueInDays?: number;
  }): Promise<IssueInvoicesResult> {
    const dueInDays = options?.dueInDays ?? financialConfig.invoiceDueDays;
    const result: IssueInvoicesResult = { created: 0, skipped: 0, errors: [], invoices: [] };

    try {
      let where = `
        WHERE sc.status = 'active'
          AND sc.subscriber_id IS NOT NULL
          AND (sc.end_date IS NULL OR sc.end_date >= CURRENT_DATE)
          AND (sc.start_date IS NULL OR sc.start_date <= CURRENT_DATE)
      `;
      const params: number[] = [];
      if (options?.subscriberId) {
        params.push(options.subscriberId);
        where += ` AND sc.subscriber_id = $${params.length}`;
      }
      if (options?.contractId) {
        params.push(options.contractId);
        where += ` AND sc.contract_id = $${params.length}`;
      }

      const contracts = await this.db.findMany(
        `
        SELECT
          sc.contract_id,
          sc.subscriber_id,
          sc.title,
          sc.start_date,
          sc.total_amount,
          sc.currency,
          COALESCE(sc.billing_interval, p.billing_interval, 'month') AS billing_interval,
          p.plan_id,
          p.name AS plan_name,
          p.price_monthly,
          p.price_four_month,
          p.price_semester,
          p.price_yearly
        FROM subscriber_contracts sc
        LEFT JOIN plans p ON p.plan_id = sc.plan_id
        ${where}
        ORDER BY sc.contract_id
      `,
        params
      );

      const billingService = getSubscriberBillingServiceInstance();

      for (const row of contracts) {
        const contractId = Number(row.contract_id);
        const subscriberId = Number(row.subscriber_id);
        try {
          const interval = normalizeBillingInterval(String(row.billing_interval || 'month'));
          const contractStart = row.start_date
            ? String(row.start_date).split('T')[0]
            : undefined;
          const period = resolveInvoicePeriodBounds(interval, contractStart, new Date());

          const existing = await this.db.findFirst(
            `
            SELECT billing_id FROM subscriber_billing
            WHERE contract_id = $1
              AND period_start = $2::date
              AND period_end = $3::date
              AND payment_status NOT IN ('cancelled', 'refunded')
            LIMIT 1
          `,
            [contractId, period.start, period.end]
          );

          if (existing?.billing_id) {
            result.skipped++;
            continue;
          }

          let amount = parseFloat(row.total_amount || '0');
          if (!amount || amount <= 0) {
            const fromPlan = getPlanPriceForInterval(
              {
                price_monthly: row.price_monthly,
                price_four_month: row.price_four_month,
                price_semester: row.price_semester,
                price_yearly: row.price_yearly,
              },
              interval
            );
            amount = fromPlan ?? 0;
          }
          if (!amount || amount <= 0) {
            result.errors.push({ contractId, message: 'Valor do contrato/plano não definido' });
            continue;
          }

          const invoiceNumber = this.invoiceNumberFor(contractId, subscriberId, period.label);
          const description = `Fatura ${period.label} — ${row.title || row.plan_name || 'Contrato'}`;

          const billing = await billingService.createBilling({
            subscriberId,
            contractId,
            periodStart: period.start,
            periodEnd: period.end,
            invoiceNumber,
            billingType: 'subscription',
            amount,
            currency: row.currency || 'BRL',
            description,
            dueDate: this.computeDueDate(dueInDays),
            status: 'pending',
            metadata: {
              contractId,
              planId: row.plan_id,
              billingInterval: interval,
              periodStart: period.start,
              periodEnd: period.end,
              invoiceNumber,
            },
          });

          result.created++;
          result.invoices.push({
            billingId: billing.billingId,
            contractId,
            invoiceNumber,
          });
        } catch (e: any) {
          result.errors.push({ contractId, message: e?.message || 'Erro ao emitir fatura' });
        }
      }

      await logInfo('Emissão de faturas por contrato (anunciante) concluída', {
        created: result.created,
        skipped: result.skipped,
        errors: result.errors.length,
      });

      return result;
    } catch (error: any) {
      await logError('Erro na emissão de faturas por contrato (anunciante)', error);
      throw error;
    }
  }

  /** Faturas de assinatura de contratos da organização (publisher_contracts, direction incoming). */
  async issuePublisherContractInvoices(options?: {
    publisherId?: number;
    publisherContractId?: number;
    dueInDays?: number;
  }): Promise<IssueInvoicesResult> {
    const dueInDays = options?.dueInDays ?? financialConfig.invoiceDueDays;
    const result: IssueInvoicesResult = { created: 0, skipped: 0, errors: [], invoices: [] };

    try {
      let where = `
        WHERE pc.status = 'active'
          AND pc.contract_type IN ('subscription', 'hybrid')
          AND COALESCE(pc.subscription_amount, 0) > 0
          AND (pc.end_date IS NULL OR pc.end_date >= CURRENT_DATE)
          AND (pc.start_date IS NULL OR pc.start_date <= CURRENT_DATE)
      `;
      const params: number[] = [];
      if (options?.publisherId) {
        params.push(options.publisherId);
        where += ` AND pc.publisher_id = $${params.length}`;
      }
      if (options?.publisherContractId) {
        params.push(options.publisherContractId);
        where += ` AND pc.contract_id = $${params.length}`;
      }

      const contracts = await this.db.findMany(
        `
        SELECT
          pc.contract_id,
          pc.publisher_id,
          pc.title,
          pc.start_date,
          pc.subscription_amount,
          pc.currency,
          COALESCE(pc.billing_interval, pc.subscription_interval, 'month') AS billing_interval
        FROM publisher_contracts pc
        ${where}
        ORDER BY pc.contract_id
      `,
        params
      );

      const billingService = getPublisherBillingServiceInstance();

      for (const row of contracts) {
        const contractId = Number(row.contract_id);
        const publisherId = Number(row.publisher_id);
        try {
          const interval = normalizeBillingInterval(String(row.billing_interval || 'month'));
          const contractStart = row.start_date
            ? String(row.start_date).split('T')[0]
            : undefined;
          const period = resolveInvoicePeriodBounds(interval, contractStart, new Date());

          const existing = await this.db.findFirst(
            `
            SELECT billing_id FROM publisher_billing
            WHERE contract_id = $1
              AND period_start = $2::date
              AND period_end = $3::date
              AND payment_status NOT IN ('cancelled', 'refunded')
            LIMIT 1
          `,
            [contractId, period.start, period.end]
          );

          if (existing?.billing_id) {
            result.skipped++;
            continue;
          }

          const amount = parseFloat(row.subscription_amount || '0');
          if (!amount || amount <= 0) {
            result.errors.push({
              contractId,
              message: 'Valor de assinatura do contrato da organização não definido',
            });
            continue;
          }

          const invoiceNumber = this.publisherInvoiceNumberFor(
            publisherId,
            contractId,
            period.label
          );
          const description = `Assinatura ${period.label} — ${row.title || 'Contrato da organização'}`;

          const billing = await billingService.createBilling({
            publisherId,
            contractId,
            periodStart: period.start,
            periodEnd: period.end,
            billingType: 'subscription',
            amount,
            currency: row.currency || 'BRL',
            direction: 'incoming',
            description,
            dueDate: this.computeDueDate(dueInDays),
            paymentStatus: 'pending',
            metadata: {
              contractId,
              billingInterval: interval,
              periodStart: period.start,
              periodEnd: period.end,
              invoiceNumber,
            },
          });

          result.created++;
          result.invoices.push({
            billingId: billing.billingId,
            contractId,
            invoiceNumber,
          });
        } catch (e: any) {
          result.errors.push({ contractId, message: e?.message || 'Erro ao emitir fatura da organização' });
        }
      }

      await logInfo('Emissão de faturas por contrato (organização) concluída', {
        created: result.created,
        skipped: result.skipped,
        errors: result.errors.length,
      });

      return result;
    } catch (error: any) {
      await logError('Erro na emissão de faturas por contrato (organização)', error);
      throw error;
    }
  }

  /**
   * Gera repasses (outgoing) para a organização com base em faturas de campanha já pagas pelo anunciante.
   * Usa % de campaign_publishers ou do contrato da organização (revenue_share / hybrid).
   */
  async issueRevenueSharePayouts(options?: {
    publisherId?: number;
    sinceDays?: number;
  }): Promise<IssueInvoicesResult> {
    const sinceDays = options?.sinceDays ?? 90;
    const result: IssueInvoicesResult = { created: 0, skipped: 0, errors: [], invoices: [] };
    const billingService = getPublisherBillingServiceInstance();

    try {
      const params: number[] = [sinceDays];
      let publisherFilter = '';
      if (options?.publisherId) {
        params.push(options.publisherId);
        publisherFilter = ` AND cp.publisher_id = $${params.length}`;
      }

      const rows = await this.db.findMany(
        `
        SELECT
          sb.billing_id,
          sb.campaign_id,
          sb.amount::numeric AS campaign_amount,
          sb.payment_date,
          cp.publisher_id,
          pc.contract_id,
          COALESCE(cp.revenue_share_percentage, pc.revenue_share_percentage) AS share_pct,
          pc.minimum_payout_amount,
          c.title AS campaign_title
        FROM subscriber_billing sb
        INNER JOIN campaigns c ON c.campaign_id = sb.campaign_id
        INNER JOIN campaign_publishers cp ON cp.campaign_id = sb.campaign_id AND cp.is_active = true
        INNER JOIN publisher_contracts pc ON pc.publisher_id = cp.publisher_id
          AND pc.status = 'active'
          AND pc.contract_type IN ('revenue_share', 'hybrid')
          AND (pc.end_date IS NULL OR pc.end_date >= CURRENT_DATE)
          AND (pc.start_date IS NULL OR pc.start_date <= CURRENT_DATE)
        WHERE sb.payment_status = 'paid'
          AND sb.campaign_id IS NOT NULL
          AND sb.payment_date IS NOT NULL
          AND sb.payment_date >= CURRENT_DATE - ($1::int * INTERVAL '1 day')
          AND COALESCE(cp.revenue_share_percentage, pc.revenue_share_percentage, 0) > 0
          ${publisherFilter}
        ORDER BY sb.billing_id
      `,
        params
      );

      for (const row of rows) {
        const sourceBillingId = Number(row.billing_id);
        const publisherId = Number(row.publisher_id);
        const contractId = Number(row.contract_id);
        const campaignId = Number(row.campaign_id);
        const pct = parseFloat(String(row.share_pct || '0'));
        const original = parseFloat(String(row.campaign_amount || '0'));

        if (!pct || pct <= 0 || !original || original <= 0) {
          result.skipped++;
          continue;
        }

        const publisherShare = Math.round(((original * pct) / 100) * 100) / 100;
        const platformFee = Math.round((original - publisherShare) * 100) / 100;
        const minPayout = parseFloat(String(row.minimum_payout_amount || '0'));
        if (minPayout > 0 && publisherShare < minPayout) {
          result.skipped++;
          continue;
        }

        const existing = await this.db.findFirst(
          `
          SELECT billing_id FROM publisher_billing
          WHERE publisher_id = $1
            AND billing_type = 'revenue_share'
            AND metadata->>'sourceSubscriberBillingId' = $2
          LIMIT 1
        `,
          [publisherId, String(sourceBillingId)]
        );
        if (existing?.billing_id) {
          result.skipped++;
          continue;
        }

        try {
          const invoiceNumber = `REP-${publisherId}-SB${sourceBillingId}`.slice(0, 60);
          const billing = await billingService.createBilling({
            publisherId,
            contractId,
            campaignId,
            billingType: 'revenue_share',
            amount: publisherShare,
            currency: 'BRL',
            direction: 'outgoing',
            revenueSharePercentage: pct,
            originalCampaignAmount: original,
            platformFeeAmount: platformFee,
            publisherShareAmount: publisherShare,
            description: `Repasse ${pct}% — ${row.campaign_title || 'Campanha'}`,
            dueDate: this.computeDueDate(14),
            paymentStatus: 'pending_payout',
            metadata: {
              sourceSubscriberBillingId: sourceBillingId,
              paidAt: row.payment_date,
              invoiceNumber,
            },
          });

          result.created++;
          result.invoices.push({
            billingId: billing.billingId,
            contractId,
            invoiceNumber,
          });

          if (financialConfig.notifyRevenueSharePayouts) {
            await getFinancialNotificationService()
              .sendPublisherRevenueSharePayoutEmail(billing.billingId)
              .catch(() => undefined);
          }
        } catch (e: any) {
          result.errors.push({
            contractId,
            message: e?.message || `Erro repasse campanha ${campaignId}`,
          });
        }
      }

      await logInfo('Emissão de repasses revenue share concluída', {
        created: result.created,
        skipped: result.skipped,
        errors: result.errors.length,
      });

      return result;
    } catch (error: any) {
      await logError('Erro na emissão de repasses revenue share', error);
      throw error;
    }
  }

  async recordSubscriberPayment(
    billingId: number,
    data: RecordPaymentRequest & { triggerRevenueShare?: boolean }
  ): Promise<{
    billing: NonNullable<
      Awaited<ReturnType<ReturnType<typeof getSubscriberBillingServiceInstance>['getBillingById']>>
    >;
    revenueSharePayout?: IssueInvoicesResult;
  }> {
    const billing = await getSubscriberBillingServiceInstance().getBillingById(billingId);
    if (!billing) {
      throw new Error('Fatura não encontrada');
    }
    if (billing.status === 'paid') {
      throw new Error('Fatura já está paga');
    }

    const campaignId = billing.campaignId ?? null;

    const updated = await getSubscriberBillingServiceInstance().updateBilling(billingId, {
      status: 'paid',
      paymentMethod: data.paymentMethod || 'pix',
      paymentReference: data.paymentReference,
      notes: data.notes,
    });

    const shouldTrigger =
      data.triggerRevenueShare ?? financialConfig.autoRevenueSharePayouts;
    let revenueSharePayout: IssueInvoicesResult | undefined;

    if (shouldTrigger && campaignId) {
      try {
        const publishers = await this.db.findMany(
          `
          SELECT DISTINCT cp.publisher_id
          FROM campaign_publishers cp
          WHERE cp.campaign_id = $1 AND cp.is_active = true
        `,
          [campaignId]
        );
        let merged: IssueInvoicesResult = {
          created: 0,
          skipped: 0,
          errors: [],
          invoices: [],
        };
        for (const row of publishers) {
          const pid = Number(row.publisher_id);
          if (!pid) continue;
          const part = await this.issueRevenueSharePayouts({
            publisherId: pid,
            sinceDays: financialConfig.revenueShareSinceDays,
          });
          merged = this.mergeIssueResults(merged, part);
        }
        if (merged.created > 0 || merged.errors.length > 0) {
          revenueSharePayout = merged;
        }
      } catch (error: any) {
        await logError('Repasse revenue share após pagamento de campanha', error, {
          billingId,
          campaignId,
        });
      }
    }

    return { billing: updated, revenueSharePayout };
  }

  async getSubscriberPaymentQr(billingId: number): Promise<PaymentQrResponse> {
    const billing = await getSubscriberBillingServiceInstance().getBillingById(billingId);
    if (!billing) {
      throw new Error('Fatura não encontrada');
    }

    const pixConfigured = Boolean(financialConfig.pixKey?.trim());
    let copyPaste = '';
    let qrDataUrl = '';

    if (pixConfigured) {
      const txid = `F${billingId}`;
      copyPaste = buildPixCopyPaste({
        pixKey: financialConfig.pixKey,
        merchantName: financialConfig.pixMerchantName,
        merchantCity: financialConfig.pixMerchantCity,
        amount: Number(billing.amount),
        txid,
      });
      qrDataUrl = await QRCode.toDataURL(copyPaste, { margin: 2, width: 280 });
    }

    return {
      copyPaste,
      qrDataUrl,
      amount: Number(billing.amount),
      currency: billing.currency || 'BRL',
      invoiceNumber: (billing as any).invoiceNumber,
      dueDate: billing.dueDate,
      pixConfigured,
    };
  }

  /** Nível de alerta financeiro agregado por anunciante (contrato + cobranças). */
  resolveSubscriberFinancialAlert(row: {
    contract_alert_level?: string;
    has_billing_overdue?: boolean;
    has_billing_due_soon?: boolean;
    has_billing_publish_blocked?: boolean;
    days_until_contract_end?: number | null;
  }): { level: FinancialAlertLevel; label: string; tooltip: string } {
    if (row.has_billing_publish_blocked) {
      return {
        level: 'error',
        label: 'Publicação bloqueada',
        tooltip: 'Prestações vencidas além da tolerância configurada — publicação e campanhas suspensas.',
      };
    }
    if (row.has_billing_overdue) {
      return {
        level: 'error',
        label: 'Pagamento vencido',
        tooltip: 'Existe fatura de anunciante vencida e não paga.',
      };
    }
    if (String(row.contract_alert_level).toLowerCase() === 'error') {
      return {
        level: 'error',
        label: 'Contrato vencido',
        tooltip: 'Contrato vencido ou encerrado.',
      };
    }
    if (row.has_billing_due_soon) {
      return {
        level: 'warning',
        label: 'Pagamento a vencer',
        tooltip: 'Fatura com vencimento nos próximos dias.',
      };
    }
    if (String(row.contract_alert_level).toLowerCase() === 'warning') {
      const d = row.days_until_contract_end;
      return {
        level: 'warning',
        label: 'Contrato a vencer',
        tooltip:
          d != null && d >= 0 ? `Contrato termina em ${d} dia(s).` : 'Contrato próximo do fim da vigência.',
      };
    }
    if (String(row.contract_alert_level).toLowerCase() === 'success') {
      return { level: 'success', label: 'Em dia', tooltip: 'Contratos e pagamentos em dia.' };
    }
    return { level: 'neutral', label: 'Sem contrato', tooltip: 'Sem contrato ativo registado.' };
  }

  private assertPublisherIncomingPayable(billing: {
    direction: string;
    paymentStatus: string;
  }): void {
    if (billing.direction !== 'incoming') {
      throw new Error('Apenas faturas de entrada (organização paga) aceitam pagamento PIX/Stripe');
    }
    if (!['pending', 'overdue'].includes(billing.paymentStatus)) {
      throw new Error('Fatura não está pendente de pagamento');
    }
  }

  async recordPublisherPayment(billingId: number, data: RecordPaymentRequest) {
    const billing = await getPublisherBillingServiceInstance().getBillingById(billingId);
    if (!billing) throw new Error('Fatura não encontrada');
    if (billing.paymentStatus === 'paid') throw new Error('Fatura já está paga');
    this.assertPublisherIncomingPayable(billing);

    return getPublisherBillingServiceInstance().updateBilling(billingId, {
      paymentStatus: 'paid',
      paymentMethod: data.paymentMethod || 'pix',
      paymentReference: data.paymentReference,
    });
  }

  async getPublisherPaymentQr(billingId: number): Promise<PaymentQrResponse> {
    const billing = await getPublisherBillingServiceInstance().getBillingById(billingId);
    if (!billing) throw new Error('Fatura não encontrada');
    this.assertPublisherIncomingPayable(billing);

    const pixConfigured = Boolean(financialConfig.pixKey?.trim());
    let copyPaste = '';
    let qrDataUrl = '';

    if (pixConfigured) {
      const txid = `P${billingId}`;
      copyPaste = buildPixCopyPaste({
        pixKey: financialConfig.pixKey,
        merchantName: financialConfig.pixMerchantName,
        merchantCity: financialConfig.pixMerchantCity,
        amount: Number(billing.amount),
        txid,
      });
      qrDataUrl = await QRCode.toDataURL(copyPaste, { margin: 2, width: 280 });
    }

    return {
      copyPaste,
      qrDataUrl,
      amount: Number(billing.amount),
      currency: billing.currency || 'BRL',
      invoiceNumber: billing.invoiceNumber,
      dueDate: billing.dueDate,
      pixConfigured,
    };
  }

  async sendPublisherPaymentEmail(billingId: number) {
    return getFinancialNotificationService().sendPublisherPaymentEmail(billingId);
  }

  async sendPublisherRevenueSharePayoutEmail(billingId: number) {
    return getFinancialNotificationService().sendPublisherRevenueSharePayoutEmail(billingId);
  }

  async createStripeCheckoutForPublisherBilling(
    billingId: number
  ): Promise<{ url: string; sessionId: string }> {
    if (!stripeConfig.enabled) throw new Error('Stripe não está habilitado');

    const billing = await getPublisherBillingServiceInstance().getBillingById(billingId);
    if (!billing) throw new Error('Fatura não encontrada');
    if (billing.paymentStatus === 'paid') throw new Error('Fatura já paga');
    this.assertPublisherIncomingPayable(billing);

    const stripe = new StripeService();
    const base = financialConfig.publicAppUrl.replace(/\/$/, '');
    const session = await stripe.createOneTimePaymentSession({
      amount: Number(billing.amount),
      currency: billing.currency || 'BRL',
      description: billing.description || `Fatura organização #${billingId}`,
      successUrl: `${base}/billing?type=publisher&paid=${billingId}&session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${base}/billing?type=publisher&invoice=${billingId}`,
      metadata: {
        billingId: String(billingId),
        source: 'publisher_billing',
      },
    });

    if (!session.url) throw new Error('Stripe não retornou URL de checkout');
    return { url: session.url, sessionId: session.id };
  }

  /**
   * Webhook PIX: confirma por billingId, publisherBillingId ou txid F{id}/P{id}.
   */
  async processPixWebhook(payload: {
    billingId?: number;
    publisherBillingId?: number;
    scope?: 'subscriber' | 'publisher';
    txid?: string;
    paymentReference?: string;
    amount?: number;
  }): Promise<{ billingId: number; scope: 'subscriber' | 'publisher'; alreadyPaid: boolean }> {
    let scope: 'subscriber' | 'publisher' = payload.scope || 'subscriber';
    let billingId = payload.billingId;

    if (payload.publisherBillingId) {
      scope = 'publisher';
      billingId = payload.publisherBillingId;
    }

    if (!billingId && payload.txid) {
      const sub = String(payload.txid).match(/^F(\d+)$/i);
      const pub = String(payload.txid).match(/^P(\d+)$/i);
      if (sub) {
        scope = 'subscriber';
        billingId = parseInt(sub[1], 10);
      } else if (pub) {
        scope = 'publisher';
        billingId = parseInt(pub[1], 10);
      }
    }

    if (!billingId || !Number.isFinite(billingId)) {
      throw new Error('billingId, publisherBillingId ou txid (F{id}/P{id}) obrigatório');
    }

    if (scope === 'publisher') {
      const billing = await getPublisherBillingServiceInstance().getBillingById(billingId);
      if (!billing) throw new Error('Fatura da organização não encontrada');
      if (billing.paymentStatus === 'paid') {
        return { billingId, scope, alreadyPaid: true };
      }
      if (payload.amount != null && Math.abs(Number(payload.amount) - Number(billing.amount)) > 0.02) {
        throw new Error('Valor do webhook não confere com a fatura');
      }
      await this.recordPublisherPayment(billingId, {
        paymentMethod: 'pix',
        paymentReference: payload.paymentReference || payload.txid || `pix-webhook-${Date.now()}`,
      });
      return { billingId, scope, alreadyPaid: false };
    }

    const billing = await getSubscriberBillingServiceInstance().getBillingById(billingId);
    if (!billing) throw new Error('Fatura não encontrada');
    if (billing.status === 'paid') {
      return { billingId, scope: 'subscriber', alreadyPaid: true };
    }

    if (payload.amount != null && Math.abs(Number(payload.amount) - Number(billing.amount)) > 0.02) {
      throw new Error('Valor do webhook não confere com a fatura');
    }

    await this.recordSubscriberPayment(billingId, {
      paymentMethod: 'pix',
      paymentReference: payload.paymentReference || payload.txid || `pix-webhook-${Date.now()}`,
      notes: 'Confirmado automaticamente via webhook PIX',
    });

    return { billingId, scope: 'subscriber', alreadyPaid: false };
  }

  async sendInvoicePaymentEmail(billingId: number) {
    return getFinancialNotificationService().sendInvoicePaymentEmail(billingId);
  }

  async createStripeCheckoutForBilling(billingId: number): Promise<{ url: string; sessionId: string }> {
    if (!stripeConfig.enabled) {
      throw new Error('Stripe não está habilitado');
    }

    const billing = await getSubscriberBillingServiceInstance().getBillingById(billingId);
    if (!billing) throw new Error('Fatura não encontrada');
    if (billing.status === 'paid') throw new Error('Fatura já paga');

    const stripe = new StripeService();
    const base = financialConfig.publicAppUrl.replace(/\/$/, '');
    const session = await stripe.createOneTimePaymentSession({
      amount: Number(billing.amount),
      currency: billing.currency || 'BRL',
      description: billing.description || `Fatura #${billingId}`,
      successUrl: `${base}/billing?type=subscriber&paid=${billingId}&session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${base}/billing?type=subscriber&invoice=${billingId}`,
      metadata: {
        billingId: String(billingId),
        source: 'subscriber_billing',
      },
    });

    if (!session.url) {
      throw new Error('Stripe não retornou URL de checkout');
    }

    return { url: session.url, sessionId: session.id };
  }

  /** Processa evento Stripe checkout.session.completed para fatura avulsa. */
  async handleStripeCheckoutCompleted(metadata: Record<string, string | undefined>): Promise<boolean> {
    const billingId = metadata?.billingId ? parseInt(metadata.billingId, 10) : NaN;
    if (!Number.isFinite(billingId)) return false;

    if (metadata.source === 'publisher_billing') {
      const billing = await getPublisherBillingServiceInstance().getBillingById(billingId);
      if (!billing || billing.paymentStatus === 'paid') return true;
      await this.recordPublisherPayment(billingId, {
        paymentMethod: 'stripe',
        paymentReference: metadata?.sessionId || 'stripe-checkout',
      });
      return true;
    }

    const billing = await getSubscriberBillingServiceInstance().getBillingById(billingId);
    if (!billing || billing.status === 'paid') return true;

    await this.recordSubscriberPayment(billingId, {
      paymentMethod: 'stripe',
      paymentReference: metadata?.sessionId || 'stripe-checkout',
      notes: 'Pago via Stripe Checkout',
    });
    return true;
  }
}

let instance: FinancialAdminService | null = null;

export function getFinancialAdminService(): FinancialAdminService {
  if (!instance) instance = new FinancialAdminService();
  return instance;
}
