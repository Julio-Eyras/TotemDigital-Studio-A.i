/**
 * Administração financeira unificada: emissão de faturas por contrato/plano,
 * registro de pagamentos e QR PIX.
 */

import QRCode from 'qrcode';
import { getDatabase } from '../config/database';
import { logError, logInfo } from '../utils/loggerHelper';
import { buildPixCopyPaste } from '../utils/pixEmv';
import { financialConfig, stripeConfig } from '../config/env';
import { StripeService } from './stripeService';
import { getFinancialNotificationService } from './financialNotificationService';
function getSubscriberBillingServiceInstance() {
  if (!(global as any).subscriberBillingServiceInstance) {
    const { SubscriberBillingService } = require('./subscriberBillingService');
    (global as any).subscriberBillingServiceInstance = new SubscriberBillingService();
  }
  return (global as any).subscriberBillingServiceInstance;
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

  private periodBounds(interval: string, ref: Date = new Date()): { start: string; end: string; label: string } {
    const y = ref.getFullYear();
    const m = ref.getMonth();
    if (interval === 'year') {
      return {
        start: `${y}-01-01`,
        end: `${y}-12-31`,
        label: String(y),
      };
    }
    const start = new Date(y, m, 1);
    const end = new Date(y, m + 1, 0);
    const pad = (n: number) => String(n).padStart(2, '0');
    return {
      start: `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`,
      end: `${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(end.getDate())}`,
      label: `${y}-${pad(m + 1)}`,
    };
  }

  private computeDueDate(daysFromNow = 7): string {
    const d = new Date();
    d.setDate(d.getDate() + daysFromNow);
    return d.toISOString().split('T')[0];
  }

  private invoiceNumberFor(contractId: number, subscriberId: number, periodLabel: string): string {
    return `SUB-${subscriberId}-C${contractId}-${periodLabel}`.slice(0, 60);
  }

  /**
   * Emite faturas pendentes para contratos ativos com plano (mensal ou anual).
   */
  async issueContractInvoices(options?: {
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
          sc.total_amount,
          sc.currency,
          p.plan_id,
          p.name AS plan_name,
          p.price_monthly,
          p.price_yearly,
          COALESCE(p.billing_interval, 'month') AS billing_interval
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
          const interval = String(row.billing_interval || 'month');
          const period = this.periodBounds(interval);

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
            const monthly = parseFloat(row.price_monthly || '0');
            const yearly = parseFloat(row.price_yearly || '0');
            amount = interval === 'year' ? yearly || monthly * 12 : monthly;
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

      await logInfo('Emissão de faturas por contrato concluída', {
        created: result.created,
        skipped: result.skipped,
        errors: result.errors.length,
      });

      return result;
    } catch (error: any) {
      await logError('Erro na emissão de faturas por contrato', error);
      throw error;
    }
  }

  async recordSubscriberPayment(billingId: number, data: RecordPaymentRequest) {
    const billing = await getSubscriberBillingServiceInstance().getBillingById(billingId);
    if (!billing) {
      throw new Error('Fatura não encontrada');
    }
    if (billing.status === 'paid') {
      throw new Error('Fatura já está paga');
    }

    return getSubscriberBillingServiceInstance().updateBilling(billingId, {
      status: 'paid',
      paymentMethod: data.paymentMethod || 'pix',
      paymentReference: data.paymentReference,
      notes: data.notes,
    });
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
    days_until_contract_end?: number | null;
  }): { level: FinancialAlertLevel; label: string; tooltip: string } {
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

  /**
   * Webhook PIX (banco/PSP): confirma pagamento por billingId ou txid F{id}.
   */
  async processPixWebhook(payload: {
    billingId?: number;
    txid?: string;
    paymentReference?: string;
    amount?: number;
  }): Promise<{ billingId: number; alreadyPaid: boolean }> {
    let billingId = payload.billingId;
    if (!billingId && payload.txid) {
      const m = String(payload.txid).match(/^F(\d+)$/i);
      if (m) billingId = parseInt(m[1], 10);
    }
    if (!billingId || !Number.isFinite(billingId)) {
      throw new Error('billingId ou txid (F{id}) obrigatório');
    }

    const billing = await getSubscriberBillingServiceInstance().getBillingById(billingId);
    if (!billing) {
      throw new Error('Fatura não encontrada');
    }
    if (billing.status === 'paid') {
      return { billingId, alreadyPaid: true };
    }

    if (payload.amount != null && Math.abs(Number(payload.amount) - Number(billing.amount)) > 0.02) {
      throw new Error('Valor do webhook não confere com a fatura');
    }

    await this.recordSubscriberPayment(billingId, {
      paymentMethod: 'pix',
      paymentReference: payload.paymentReference || payload.txid || `pix-webhook-${Date.now()}`,
      notes: 'Confirmado automaticamente via webhook PIX',
    });

    return { billingId, alreadyPaid: false };
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
