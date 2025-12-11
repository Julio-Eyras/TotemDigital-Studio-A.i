/**
 * Invoice Service - Smart Signage v2.1
 * Serviço para gerar faturas automáticas
 */

import { getDatabase } from '../config/database';
import { BillingService } from './billingService';
import { SubscriptionService } from './subscriptionService';
import { StripeService } from './stripeService';
import { logError, logInfo } from '../utils/loggerHelper';

export class InvoiceService {
  private get db() {
    return getDatabase();
  }

  private billingService: BillingService;
  private subscriptionService: SubscriptionService;
  private stripeService: StripeService;

  constructor() {
    this.billingService = new BillingService();
    this.subscriptionService = new SubscriptionService();
    this.stripeService = new StripeService();
  }

  /**
   * Gera faturas mensais para todas as assinaturas ativas
   */
  async generateMonthlyInvoices(): Promise<{ created: number; errors: number }> {
    try {
      const activeSubscriptions = await this.subscriptionService.getSubscriptions({
        status: 'active',
      });

      let created = 0;
      let errors = 0;

      for (const subscription of activeSubscriptions) {
        try {
          // Verificar se já existe fatura para este período
          const existingInvoice = await this.db.findFirst(`
            SELECT billing_id FROM billing
            WHERE subscription_id = ?
              AND billing_type = 'subscription'
              AND status IN ('pending', 'paid')
              AND DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_TIMESTAMP)
          `, [subscription.subscriptionId]);

          if (existingInvoice) {
            await logInfo('Fatura já existe para este período', {
              subscriptionId: subscription.subscriptionId,
              billingId: existingInvoice.billing_id,
            });
            continue;
          }

          // Verificar se está no período de cobrança
          if (subscription.currentPeriodEnd) {
            const periodEnd = new Date(subscription.currentPeriodEnd);
            const now = new Date();

            // Só gerar se estiver próximo do fim do período (últimos 3 dias)
            const daysUntilEnd = Math.floor((periodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

            if (daysUntilEnd > 3) {
              continue;
            }
          }

          // Buscar plano
          const plan = subscription.plan;
          if (!plan) {
            await logError('Plano não encontrado para assinatura', new Error('Plan not found'), {
              subscriptionId: subscription.subscriptionId,
            });
            errors++;
            continue;
          }

          // Calcular valor
          const amount = subscription.billingInterval === 'year' && plan.priceYearly
            ? plan.priceYearly / 12 // Dividir por 12 para mensal
            : plan.priceMonthly;

          // Data de vencimento (7 dias após geração)
          const dueDate = new Date();
          dueDate.setDate(dueDate.getDate() + 7);

          // Criar fatura
          const billing = await this.billingService.createBilling(
            {
              clientId: subscription.clientId,
              billingType: 'subscription',
              amount,
              currency: plan.currency || 'BRL',
              description: `Assinatura ${plan.name} - ${subscription.billingInterval === 'year' ? 'Anual' : 'Mensal'}`,
              dueDate: dueDate.toISOString().split('T')[0],
              status: 'pending',
              metadata: {
                subscriptionId: subscription.subscriptionId,
                planId: plan.planId,
                billingInterval: subscription.billingInterval,
              },
            },
            1 // System user
          );

          // Atualizar billing com subscription_id
          await this.db.executeRaw(`
            UPDATE billing 
            SET subscription_id = ?
            WHERE billing_id = ?
          `, [subscription.subscriptionId, billing.id]);

          // Criar invoice no Stripe se habilitado
          if (this.stripeService.isEnabled() && subscription.stripeCustomerId && subscription.stripeSubscriptionId) {
            try {
              const stripeSubscription = await this.stripeService.getSubscription(subscription.stripeSubscriptionId);
              
              // O Stripe cria invoices automaticamente, apenas sincronizar
              if (stripeSubscription.latest_invoice) {
                const invoice = typeof stripeSubscription.latest_invoice === 'string'
                  ? await this.stripeService.getInvoice(stripeSubscription.latest_invoice)
                  : stripeSubscription.latest_invoice;

                await this.db.executeRaw(`
                  UPDATE billing 
                  SET stripe_invoice_id = ?,
                      stripe_payment_intent_id = ?
                  WHERE billing_id = ?
                `, [
                  invoice.id,
                  typeof (invoice as any).payment_intent === 'string' ? (invoice as any).payment_intent : (invoice as any).payment_intent?.id,
                  billing.id,
                ]);
              }
            } catch (error: any) {
              await logError('Erro ao sincronizar invoice do Stripe', error, {
                billingId: billing.id,
                subscriptionId: subscription.subscriptionId,
              });
              // Continuar mesmo se falhar
            }
          }

          created++;
          await logInfo('Fatura mensal gerada com sucesso', {
            billingId: billing.id,
            subscriptionId: subscription.subscriptionId,
            amount,
          });

        } catch (error: any) {
          errors++;
          await logError('Erro ao gerar fatura para assinatura', error, {
            subscriptionId: subscription.subscriptionId,
          });
        }
      }

      await logInfo('Geração de faturas mensais concluída', { created, errors, total: activeSubscriptions.length });

      return { created, errors };

    } catch (error: any) {
      await logError('Erro ao gerar faturas mensais', error);
      throw error;
    }
  }

  /**
   * Marca faturas vencidas como overdue
   */
  async markOverdueInvoices(): Promise<number> {
    try {
      const result = await this.billingService.markOverdueBillings();
      await logInfo('Faturas vencidas marcadas', { count: result });
      return result;
    } catch (error: any) {
      await logError('Erro ao marcar faturas vencidas', error);
      throw error;
    }
  }

  /**
   * Envia notificações de faturas pendentes
   */
  async sendInvoiceNotifications(): Promise<number> {
    try {
      // Buscar faturas pendentes próximas do vencimento (3 dias)
      const pendingInvoices = await this.db.findMany(`
        SELECT 
          b.billing_id,
          b.client_id,
          b.amount,
          b.due_date,
          c.name as client_name,
          c.email as client_email
        FROM billing b
        JOIN clients c ON b.client_id = c.client_id
        WHERE b.status = 'pending'
          AND b.due_date <= CURRENT_DATE + INTERVAL '3 days'
          AND b.due_date >= CURRENT_DATE
          AND c.email IS NOT NULL
      `);

      let sent = 0;

      for (const invoice of pendingInvoices) {
        try {
          // Aqui você pode integrar com o EmailService para enviar notificações
          // Por enquanto, apenas logar
          await logInfo('Notificação de fatura pendente (email não enviado - EmailService não integrado)', {
            billingId: invoice.billing_id,
            clientId: invoice.client_id,
            email: invoice.client_email,
          });
          sent++;
        } catch (error: any) {
          await logError('Erro ao enviar notificação de fatura', error, {
            billingId: invoice.billing_id,
          });
        }
      }

      return sent;

    } catch (error: any) {
      await logError('Erro ao enviar notificações de faturas', error);
      throw error;
    }
  }
}

