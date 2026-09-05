/**
 * Invoice Service - Smart Signage v2.1
 * Faturas automáticas de assinaturas de publishers (ciclos por intervalo do plano).
 */

import { getDatabase } from '../config/database';
import { SubscriptionService } from './subscriptionService';
import { StripeService } from './stripeService';
import { logError, logInfo } from '../utils/loggerHelper';
import { getFinancialNotificationService } from './financialNotificationService';
import {

  billingIntervalLabel,
  getPlanPriceForInterval,
  normalizeBillingInterval,
  resolveInvoicePeriodBounds,
} from '../utils/billingIntervals';
import { dateToYmd } from '../utils/businessDate';
import { normalizeError } from '../utils/errors';

export class InvoiceService {
  private get db() {
    return getDatabase();
  }

  private subscriptionService: SubscriptionService;
  private stripeService: StripeService;

  constructor() {
    this.subscriptionService = new SubscriptionService();
    this.stripeService = new StripeService();
  }

  /**
   * Gera faturas para assinaturas ativas no fim do período de cobrança.
   * @deprecated Nome legado; preferir generateSubscriptionInvoices.
   */
  async generateMonthlyInvoices(): Promise<{ created: number; errors: number }> {
    return this.generateSubscriptionInvoices();
  }

  /**
   * Gera faturas de subscription (publisher) respeitando intervalo mensal/quadrimestral/semestral/anual.
   */
  async generateSubscriptionInvoices(): Promise<{ created: number; errors: number }> {
    try {
      const activeSubscriptions = await this.subscriptionService.getSubscriptions({
        status: 'active',
      });

      let created = 0;
      let errors = 0;

      for (const subscription of activeSubscriptions) {
        try {
          const subId = subscription.subscriptionId ?? (subscription as unknown as Record<string, unknown>).subscription_id;
          const publisherId = subscription.publisherId ?? (subscription as unknown as Record<string, unknown>).publisher_id;

          if (subscription.stripeSubscriptionId && this.stripeService.isEnabled()) {
            await logInfo('Assinatura com Stripe ativo: fatura recorrente tratada pelo Stripe', {
              subscriptionId: subId,
            });
            continue;
          }

          const interval = normalizeBillingInterval(
            subscription.billingInterval ?? (subscription as unknown as Record<string, unknown>).billing_interval ?? 'month'
          );

          const periodAnchor =
            subscription.currentPeriodStart ??
            (subscription as unknown as Record<string, unknown>).current_period_start ??
            (subscription as unknown as Record<string, unknown>).start_date;

          const period = resolveInvoicePeriodBounds(
            interval,
            periodAnchor ? String(periodAnchor).split('T')[0] : null,
            new Date()
          );

          const existingInvoice = await this.db.findFirst(
            `
            SELECT billing_id FROM publisher_billing
            WHERE subscription_id = $1
              AND billing_type = 'subscription'
              AND payment_status NOT IN ('cancelled', 'refunded')
              AND metadata->>'periodStart' = $2
              AND metadata->>'periodEnd' = $3
            LIMIT 1
          `,
            [subId, period.start, period.end]
          );

          if (existingInvoice) {
            await logInfo('Fatura já existe para este período', {
              subscriptionId: subId,
              billingId: existingInvoice.billing_id,
              period,
            });
            continue;
          }

          if (subscription.currentPeriodEnd) {
            const periodEnd = new Date(subscription.currentPeriodEnd);
            const now = new Date();
            const daysUntilEnd = Math.floor(
              (periodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
            );
            if (daysUntilEnd > 3) {
              continue;
            }
          }

          const plan = subscription.plan;
          if (!plan) {
            await logError('Plano não encontrado para assinatura', new Error('Plan not found'), {
              subscriptionId: subId,
            });
            errors++;
            continue;
          }

          const planRec = plan as unknown as Record<string, unknown>;
          const amount =
            getPlanPriceForInterval(
              {
                price_monthly: (planRec.priceMonthly ?? planRec.price_monthly) as number | null | undefined,
                price_four_month: (planRec.priceFourMonth ?? planRec.price_four_month) as number | null | undefined,
                price_semester: (planRec.priceSemester ?? planRec.price_semester) as number | null | undefined,
                price_yearly: (planRec.priceYearly ?? planRec.price_yearly) as number | null | undefined,
              },
              interval
            ) ?? 0;

          if (!amount || amount <= 0) {
            await logError('Valor do plano indefinido para intervalo', new Error('Invalid amount'), {
              subscriptionId: subId,
              interval,
            });
            errors++;
            continue;
          }

          const dueDate = new Date();
          dueDate.setDate(dueDate.getDate() + 7);

          const { PublisherBillingService } = require('./publisherBillingService');
          const publisherBillingService = new PublisherBillingService();

          const billing = await publisherBillingService.createBilling(
            {
              publisherId,
              subscriptionId: subId,
              billingType: 'subscription',
              amount,
              currency: plan.currency || 'BRL',
              description: `Assinatura ${plan.name} — ${billingIntervalLabel(interval)} (${period.label})`,
              dueDate: dateToYmd(dueDate),
              paymentStatus: 'pending',
              direction: 'incoming',
              metadata: {
                subscriptionId: subId,
                planId: plan.planId ?? plan.plan_id,
                billingInterval: interval,
                periodStart: period.start,
                periodEnd: period.end,
                periodLabel: period.label,
              },
            },
            1
          );

          if (billing.billingId) {
            await this.db
              .executeRaw(
                `
              UPDATE publisher_billing 
              SET subscription_id = $1, updated_at = CURRENT_TIMESTAMP
              WHERE billing_id = $2
            `,
                [subId, billing.billingId]
              )
              .catch(() => undefined);
          }

          created++;
          await logInfo('Fatura de assinatura gerada', {
            billingId: billing.billingId,
            subscriptionId: subId,
            amount,
            interval,
            period,
          });} catch (error: unknown) {
      const e = normalizeError(error);
          errors++;
          await logError('Erro ao gerar fatura para assinatura', e.error, {
            subscriptionId: subscription.subscriptionId,
          });
        }
      }

      await logInfo('Geração de faturas de assinatura concluída', {
        created,
        errors,
        total: activeSubscriptions.length,
      });

      return {
        created, errors };} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('Erro ao gerar faturas de assinatura', e.error);
      throw e.error;
    }
  }

  /**
   * Marca faturas vencidas como overdue
   */
  async markOverdueInvoices(): Promise<number> {
    try {
      const subscriberResult = await this.db.executeRaw(`
        UPDATE subscriber_billing 
        SET payment_status = 'overdue', updated_at = CURRENT_TIMESTAMP
        WHERE payment_status = 'pending' AND due_date < CURRENT_TIMESTAMP
      `);

      const publisherResult = await this.db.executeRaw(`
        UPDATE publisher_billing 
        SET payment_status = 'overdue', updated_at = CURRENT_TIMESTAMP
        WHERE payment_status = 'pending' 
          AND direction = 'incoming' 
          AND due_date < CURRENT_TIMESTAMP
      `);

      const total = (subscriberResult.rowCount || 0) + (publisherResult.rowCount || 0);
      await logInfo('Faturas vencidas marcadas', { count: total });
      return total;} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('Erro ao marcar faturas vencidas', e.error);
      throw e.error;
    }
  }

  /**
   * Envia lembretes de faturas pendentes (anunciante + organização) via SMTP/PIX.
   * Delega a FinancialNotificationService — mesma lógica do FinancialBillingWorker.
   */
  async sendInvoiceNotifications(): Promise<number> {
    try {
      const result = await getFinancialNotificationService().sendPendingInvoiceReminders();
      await logInfo('Lembretes de fatura enviados', result);
      return result.sent;} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('Erro ao enviar notificações de faturas', e.error);
      throw e.error;
    }
  }
}
