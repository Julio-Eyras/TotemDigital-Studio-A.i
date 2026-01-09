/**
 * Subscription Service - Smart Signage v2.1
 * Serviço para gerenciar assinaturas
 */

import { getDatabase } from '../config/database';
import { StripeService } from './stripeService';
import { PlanService } from './planService';
import { logError, logInfo } from '../utils/loggerHelper';

export interface Subscription {
  subscriptionId: number;
  publisherId: number; // NOVO: FK para publishers
  subscriberId?: number; // clientId deprecated, usar subscriberId
  planId: number;
  stripeSubscriptionId?: string;
  stripeCustomerId?: string;
  status: string;
  billingInterval: string;
  currentPeriodStart?: string;
  currentPeriodEnd?: string;
  cancelAtPeriodEnd: boolean;
  canceledAt?: string;
  trialStart?: string;
  trialEnd?: string;
  metadata: any;
  createdAt: string;
  updatedAt: string;
  plan?: any;
  publisher?: any; // NOVO: Dados do publisher
  client?: any; // DEPRECADO: Mantido para compatibilidade
}

export interface CreateSubscriptionRequest {
  publisherId: number; // NOVO: FK para publishers
  subscriberId?: number; // clientId deprecated, usar subscriberId
  planId: number;
  billingInterval?: 'month' | 'year';
  trialDays?: number;
}

export interface UpdateSubscriptionRequest {
  planId?: number;
  status?: string;
  cancelAtPeriodEnd?: boolean;
}

export class SubscriptionService {
  private get db() {
    return getDatabase();
  }

  private stripeService: StripeService;
  private planService: PlanService;

  constructor() {
    this.stripeService = new StripeService();
    this.planService = new PlanService();
  }

  /**
   * Lista assinaturas
   */
  async getSubscriptions(
    filters: {
      publisherId?: number; // NOVO
      subscriberId?: number; // clientId deprecated, usar subscriberId
      planId?: number;
      status?: string;
    } = {}
  ): Promise<Subscription[]> {
    try {
      let whereClause = 'WHERE 1=1';
      const params: any[] = [];

      // NOVO: Filtrar por publisher_id
      if (filters.publisherId !== undefined) {
        whereClause += ' AND s.publisher_id = $' + (params.length + 1);
        params.push(filters.publisherId);
      }

      // DEPRECADO: Filtrar por client_id (compatibilidade - mapear para publisher_id)
      if (filters.clientId !== undefined && filters.publisherId === undefined) {
        whereClause += ' AND s.publisher_id = $' + (params.length + 1);
        params.push(filters.clientId);
      }

      if (filters.planId) {
        whereClause += ' AND s.plan_id = $' + (params.length + 1);
        params.push(filters.planId);
      }

      if (filters.status) {
        whereClause += ' AND s.status = $' + (params.length + 1);
        params.push(filters.status);
      }

      const subscriptions = await this.db.findMany(`
        SELECT 
          s.subscription_id as "subscriptionId",
          s.publisher_id as "publisherId",
          s.publisher_id as "clientId", -- Mantido para compatibilidade
          s.plan_id as "planId",
          s.stripe_subscription_id as "stripeSubscriptionId",
          s.stripe_customer_id as "stripeCustomerId",
          s.status,
          s.billing_interval as "billingInterval",
          s.current_period_start as "currentPeriodStart",
          s.current_period_end as "currentPeriodEnd",
          s.cancel_at_period_end as "cancelAtPeriodEnd",
          s.canceled_at as "canceledAt",
          s.trial_start as "trialStart",
          s.trial_end as "trialEnd",
          s.metadata,
          s.created_at as "createdAt",
          s.updated_at as "updatedAt",
          p.name as "publisher_name"
        FROM subscriptions s
        LEFT JOIN publishers p ON s.publisher_id = p.publisher_id
        ${whereClause}
        ORDER BY s.created_at DESC
      `, params);

      // Adicionar informações do plano
      const subscriptionsWithPlan = await Promise.all(
        subscriptions.map(async (sub) => {
          const plan = await this.planService.getPlanById(sub.planId);
          return { 
            ...sub, 
            plan,
            publisher: sub.publisher_name ? { name: sub.publisher_name } : undefined,
            client: sub.publisher_name ? { name: sub.publisher_name } : undefined // Compatibilidade
          };
        })
      );

      return subscriptionsWithPlan;

    } catch (error: any) {
      await logError('Erro ao buscar assinaturas', error, { filters });
      throw new Error('Erro interno do servidor');
    }
  }

  /**
   * Busca assinatura por ID
   */
  async getSubscriptionById(subscriptionId: number): Promise<Subscription | null> {
    try {
      const subscription = await this.db.findFirst(`
        SELECT 
          s.subscription_id as "subscriptionId",
          s.publisher_id as "publisherId",
          s.publisher_id as "clientId", -- Mantido para compatibilidade
          s.plan_id as "planId",
          s.stripe_subscription_id as "stripeSubscriptionId",
          s.stripe_customer_id as "stripeCustomerId",
          s.status,
          s.billing_interval as "billingInterval",
          s.current_period_start as "currentPeriodStart",
          s.current_period_end as "currentPeriodEnd",
          s.cancel_at_period_end as "cancelAtPeriodEnd",
          s.canceled_at as "canceledAt",
          s.trial_start as "trialStart",
          s.trial_end as "trialEnd",
          s.metadata,
          s.created_at as "createdAt",
          s.updated_at as "updatedAt",
          p.name as "publisher_name"
        FROM subscriptions s
        LEFT JOIN publishers p ON s.publisher_id = p.publisher_id
        WHERE s.subscription_id = $1
      `, [subscriptionId]);

      if (!subscription) {
        return null;
      }

      const plan = await this.planService.getPlanById(subscription.planId);
      return { 
        ...subscription, 
        plan,
        publisher: subscription.publisher_name ? { name: subscription.publisher_name } : undefined,
        client: subscription.publisher_name ? { name: subscription.publisher_name } : undefined // Compatibilidade
      };

    } catch (error: any) {
      await logError('Erro ao buscar assinatura', error, { subscriptionId });
      throw new Error('Erro interno do servidor');
    }
  }

  /**
   * Busca assinatura por publisher
   */
  async getSubscriptionByPublisher(publisherId: number): Promise<Subscription | null> {
    try {
      const subscription = await this.db.findFirst(`
        SELECT 
          s.subscription_id as "subscriptionId",
          s.publisher_id as "publisherId",
          s.publisher_id as "clientId", -- Mantido para compatibilidade
          s.plan_id as "planId",
          s.stripe_subscription_id as "stripeSubscriptionId",
          s.stripe_customer_id as "stripeCustomerId",
          s.status,
          s.billing_interval as "billingInterval",
          s.current_period_start as "currentPeriodStart",
          s.current_period_end as "currentPeriodEnd",
          s.cancel_at_period_end as "cancelAtPeriodEnd",
          s.canceled_at as "canceledAt",
          s.trial_start as "trialStart",
          s.trial_end as "trialEnd",
          s.metadata,
          s.created_at as "createdAt",
          s.updated_at as "updatedAt",
          p.name as "publisher_name"
        FROM subscriptions s
        LEFT JOIN publishers p ON s.publisher_id = p.publisher_id
        WHERE s.publisher_id = $1 AND s.status = 'active'
        ORDER BY s.created_at DESC
        LIMIT 1
      `, [publisherId]);

      if (!subscription) {
        return null;
      }

      const plan = await this.planService.getPlanById(subscription.planId);
      return { 
        ...subscription, 
        plan,
        publisher: subscription.publisher_name ? { name: subscription.publisher_name } : undefined,
        client: subscription.publisher_name ? { name: subscription.publisher_name } : undefined // Compatibilidade
      };

    } catch (error: any) {
      await logError('Erro ao buscar assinatura do publisher', error, { publisherId });
      throw new Error('Erro interno do servidor');
    }
  }

  /**
   * Busca assinatura por cliente (DEPRECADO - usar getSubscriptionByPublisher)
   */
  async getSubscriptionByClient(clientId: number): Promise<Subscription | null> {
    // Mapear clientId para publisherId (compatibilidade)
    return this.getSubscriptionByPublisher(clientId);
  }

  /**
   * Cria nova assinatura
   */
  async createSubscription(data: CreateSubscriptionRequest): Promise<Subscription> {
    try {
      // Usar publisherId se fornecido, senão usar clientId (compatibilidade)
      const publisherId = data.publisherId || data.clientId;
      if (!publisherId) {
        throw new Error('publisherId é obrigatório');
      }

      const { planId, billingInterval = 'month', trialDays } = data;

      // Validar publisher
      const publisher = await this.db.findFirst(`
        SELECT publisher_id, name, email FROM publishers 
        WHERE publisher_id = $1 AND COALESCE(active, true) = true
      `, [publisherId]);

      if (!publisher) {
        throw new Error('Publisher não encontrado ou inativo');
      }

      // Verificar se já existe assinatura ativa
      const existingSubscription = await this.getSubscriptionByPublisher(publisherId);
      if (existingSubscription && existingSubscription.status === 'active') {
        throw new Error('Publisher já possui uma assinatura ativa');
      }

      // Buscar plano
      const plan = await this.planService.getPlanById(planId);
      if (!plan) {
        throw new Error('Plano não encontrado');
      }

      let stripeSubscriptionId: string | undefined;
      let stripeCustomerId: string | undefined;
      let currentPeriodStart: Date | undefined;
      let currentPeriodEnd: Date | undefined;
      let trialStart: Date | undefined;
      let trialEnd: Date | undefined;

      // Criar no Stripe se habilitado
      if (this.stripeService.isEnabled() && plan.stripeProductId) {
        try {
          // Criar ou buscar customer
          const customer = await this.stripeService.createOrGetCustomer(
            publisherId,
            publisher.email || `${publisher.publisher_id}@smartsignage.com`,
            publisher.name || undefined
          );
          stripeCustomerId = customer.id;

          // Salvar customer ID (usar publisher_id)
          // TODO: Atualizar tabela stripe_customers para usar publisher_id
          await this.db.executeRaw(`
            INSERT INTO stripe_customers (client_id, stripe_customer_id, email)
            VALUES ($1, $2, $3)
            ON CONFLICT (client_id) DO UPDATE
            SET stripe_customer_id = EXCLUDED.stripe_customer_id,
                email = EXCLUDED.email,
                updated_at = CURRENT_TIMESTAMP
          `, [publisherId, customer.id, publisher.email || null]);

          // Selecionar price ID baseado no intervalo
          const priceId = billingInterval === 'year' && plan.stripePriceIdYearly
            ? plan.stripePriceIdYearly
            : plan.stripePriceIdMonthly;

          if (priceId) {
            // Criar subscription no Stripe
            const stripeSubscription = await this.stripeService.createSubscription(
              customer.id,
              priceId,
              {
                publisherId: publisherId.toString(),
                planId: planId.toString(),
              }
            );

            stripeSubscriptionId = stripeSubscription.id;
            currentPeriodStart = new Date((stripeSubscription as any).current_period_start * 1000);
            currentPeriodEnd = new Date((stripeSubscription as any).current_period_end * 1000);

            if (stripeSubscription.trial_start && stripeSubscription.trial_end) {
              trialStart = new Date(stripeSubscription.trial_start * 1000);
              trialEnd = new Date(stripeSubscription.trial_end * 1000);
            }
          }
        } catch (error: any) {
          await logError('Erro ao criar subscription no Stripe (continuando sem Stripe)', error, { publisherId, planId });
          // Continuar sem Stripe se falhar
        }
      }

      // Calcular períodos se não vier do Stripe
      if (!currentPeriodStart) {
        currentPeriodStart = new Date();
        const months = billingInterval === 'year' ? 12 : 1;
        currentPeriodEnd = new Date(currentPeriodStart);
        currentPeriodEnd.setMonth(currentPeriodEnd.getMonth() + months);
      }

      // Calcular trial se especificado
      if (trialDays && !trialStart) {
        trialStart = new Date();
        trialEnd = new Date(trialStart);
        trialEnd.setDate(trialEnd.getDate() + trialDays);
      }

      // Criar assinatura no banco
      const result = await this.db.executeRaw(`
        INSERT INTO subscriptions (
          publisher_id, plan_id, stripe_subscription_id, stripe_customer_id,
          status, billing_interval, current_period_start, current_period_end,
          trial_start, trial_end, metadata
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING subscription_id
      `, [
        publisherId,
        planId,
        stripeSubscriptionId,
        stripeCustomerId,
        trialStart ? 'trialing' : 'active',
        billingInterval,
        currentPeriodStart,
        currentPeriodEnd,
        trialStart,
        trialEnd,
        JSON.stringify({ createdBy: 'system' })
      ]);

      const subscriptionRow = result.rows?.[0];
      if (!subscriptionRow || !subscriptionRow.subscription_id) {
        throw new Error('Erro ao criar assinatura');
      }

      const newSubscription = await this.getSubscriptionById(subscriptionRow.subscription_id);
      if (!newSubscription) {
        throw new Error('Erro ao buscar assinatura criada');
      }

      await logInfo('Assinatura criada com sucesso', { subscriptionId: newSubscription.subscriptionId, publisherId, planId });

      return newSubscription;

    } catch (error: any) {
      await logError('Erro ao criar assinatura', error, { publisherId: data.publisherId || data.clientId, planId: data.planId });
      throw error;
    }
  }

  /**
   * Atualiza assinatura
   */
  async updateSubscription(subscriptionId: number, data: UpdateSubscriptionRequest): Promise<Subscription> {
    try {
      const existingSubscription = await this.getSubscriptionById(subscriptionId);
      if (!existingSubscription) {
        throw new Error('Assinatura não encontrada');
      }

      const updates: string[] = [];
      const params: any[] = [];

      if (data.planId !== undefined) {
        // Upgrade/downgrade de plano
        const plan = await this.planService.getPlanById(data.planId);
        if (!plan) {
          throw new Error('Plano não encontrado');
        }

        updates.push('plan_id = ?');
        params.push(data.planId);

        // Atualizar no Stripe se houver
        if (this.stripeService.isEnabled() && existingSubscription.stripeSubscriptionId) {
          try {
            const priceId = existingSubscription.billingInterval === 'year' && plan.stripePriceIdYearly
              ? plan.stripePriceIdYearly
              : plan.stripePriceIdMonthly;

            if (priceId) {
              await this.stripeService.getStripeInstance()?.subscriptions.update(
                existingSubscription.stripeSubscriptionId,
                {
                  items: [{
                    id: (await this.stripeService.getSubscription(existingSubscription.stripeSubscriptionId)).items.data[0].id,
                    price: priceId,
                  }],
                  proration_behavior: 'always_invoice',
                }
              );
            }
          } catch (error: any) {
            await logError('Erro ao atualizar subscription no Stripe', error, { subscriptionId });
          }
        }
      }

      if (data.status !== undefined) {
        updates.push('status = ?');
        params.push(data.status);
      }

      if (data.cancelAtPeriodEnd !== undefined) {
        updates.push('cancel_at_period_end = ?');
        params.push(data.cancelAtPeriodEnd);

        // Atualizar no Stripe
        if (this.stripeService.isEnabled() && existingSubscription.stripeSubscriptionId) {
          try {
            if (data.cancelAtPeriodEnd) {
              await this.stripeService.cancelSubscription(existingSubscription.stripeSubscriptionId, true);
            } else {
              await this.stripeService.resumeSubscription(existingSubscription.stripeSubscriptionId);
            }
          } catch (error: any) {
            await logError('Erro ao atualizar cancelamento no Stripe', error, { subscriptionId });
          }
        }
      }

      if (updates.length === 0) {
        return existingSubscription;
      }

      updates.push('updated_at = CURRENT_TIMESTAMP');
      params.push(subscriptionId);

      await this.db.executeRaw(`
        UPDATE subscriptions 
        SET ${updates.join(', ')}
        WHERE subscription_id = ?
      `, params);

      const updatedSubscription = await this.getSubscriptionById(subscriptionId);
      if (!updatedSubscription) {
        throw new Error('Erro ao buscar assinatura atualizada');
      }

      await logInfo('Assinatura atualizada com sucesso', { subscriptionId });

      return updatedSubscription;

    } catch (error: any) {
      await logError('Erro ao atualizar assinatura', error, { subscriptionId });
      throw error;
    }
  }

  /**
   * Cancela assinatura
   */
  async cancelSubscription(subscriptionId: number, cancelAtPeriodEnd: boolean = true): Promise<Subscription> {
    try {
      const subscription = await this.getSubscriptionById(subscriptionId);
      if (!subscription) {
        throw new Error('Assinatura não encontrada');
      }

      // Cancelar no Stripe
      if (this.stripeService.isEnabled() && subscription.stripeSubscriptionId) {
        try {
          await this.stripeService.cancelSubscription(subscription.stripeSubscriptionId, cancelAtPeriodEnd);
        } catch (error: any) {
          await logError('Erro ao cancelar subscription no Stripe', error, { subscriptionId });
        }
      }

      // Atualizar no banco
      const canceledAt = cancelAtPeriodEnd ? null : new Date();

      await this.db.executeRaw(`
        UPDATE subscriptions 
        SET cancel_at_period_end = ?,
            canceled_at = ?,
            status = CASE WHEN ? THEN status ELSE 'canceled' END,
            updated_at = CURRENT_TIMESTAMP
        WHERE subscription_id = ?
      `, [cancelAtPeriodEnd, canceledAt, cancelAtPeriodEnd, subscriptionId]);

      const updatedSubscription = await this.getSubscriptionById(subscriptionId);
      if (!updatedSubscription) {
        throw new Error('Erro ao buscar assinatura atualizada');
      }

      await logInfo('Assinatura cancelada com sucesso', { subscriptionId, cancelAtPeriodEnd });

      return updatedSubscription;

    } catch (error: any) {
      await logError('Erro ao cancelar assinatura', error, { subscriptionId });
      throw error;
    }
  }

  /**
   * Processa webhook do Stripe
   */
  async processStripeWebhook(event: any): Promise<void> {
    try {
      switch (event.type) {
        case 'customer.subscription.created':
        case 'customer.subscription.updated':
          await this.syncSubscriptionFromStripe(event.data.object);
          break;

        case 'customer.subscription.deleted':
          await this.handleSubscriptionDeleted(event.data.object);
          break;

        case 'invoice.paid':
          await this.handleInvoicePaid(event.data.object);
          break;

        case 'invoice.payment_failed':
          await this.handleInvoicePaymentFailed(event.data.object);
          break;

        default:
          await logInfo('Webhook do Stripe não processado', { type: event.type });
      }
    } catch (error: any) {
      await logError('Erro ao processar webhook do Stripe', error, { eventType: event.type });
      throw error;
    }
  }

  /**
   * Sincroniza subscription do Stripe
   */
  private async syncSubscriptionFromStripe(stripeSubscription: any): Promise<void> {
    try {
      const subscription = await this.db.findFirst(`
        SELECT subscription_id FROM subscriptions 
        WHERE stripe_subscription_id = ?
      `, [stripeSubscription.id]);

      if (!subscription) {
        await logInfo('Subscription do Stripe não encontrada localmente', { stripeSubscriptionId: stripeSubscription.id });
        return;
      }

      await this.db.executeRaw(`
        UPDATE subscriptions 
        SET status = ?,
            current_period_start = ?,
            current_period_end = ?,
            cancel_at_period_end = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE subscription_id = ?
      `, [
        stripeSubscription.status,
        new Date(stripeSubscription.current_period_start * 1000),
        new Date(stripeSubscription.current_period_end * 1000),
        stripeSubscription.cancel_at_period_end || false,
        subscription.subscription_id
      ]);

      await logInfo('Subscription sincronizada do Stripe', { subscriptionId: subscription.subscription_id });

    } catch (error: any) {
      await logError('Erro ao sincronizar subscription do Stripe', error);
      throw error;
    }
  }

  /**
   * Handle subscription deleted
   */
  private async handleSubscriptionDeleted(stripeSubscription: any): Promise<void> {
    try {
      await this.db.executeRaw(`
        UPDATE subscriptions 
        SET status = 'canceled',
            canceled_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE stripe_subscription_id = ?
      `, [stripeSubscription.id]);

      await logInfo('Subscription cancelada via webhook', { stripeSubscriptionId: stripeSubscription.id });

    } catch (error: any) {
      await logError('Erro ao processar subscription deletada', error);
      throw error;
    }
  }

  /**
   * Handle invoice paid
   */
  private async handleInvoicePaid(invoice: any): Promise<void> {
    try {
      // Buscar billing relacionado
      const billing = await this.db.findFirst(`
        SELECT billing_id FROM billing 
        WHERE stripe_invoice_id = ?
      `, [invoice.id]);

      if (billing) {
        await this.db.executeRaw(`
          UPDATE billing 
          SET status = 'paid',
              paid_at = CURRENT_TIMESTAMP,
              updated_at = CURRENT_TIMESTAMP
          WHERE billing_id = ?
        `, [billing.billing_id]);

        await logInfo('Billing atualizado via webhook', { billingId: billing.billing_id, invoiceId: invoice.id });
      }

    } catch (error: any) {
      await logError('Erro ao processar invoice pago', error);
      throw error;
    }
  }

  /**
   * Handle invoice payment failed
   */
  private async handleInvoicePaymentFailed(invoice: any): Promise<void> {
    try {
      const billing = await this.db.findFirst(`
        SELECT billing_id FROM billing 
        WHERE stripe_invoice_id = ?
      `, [invoice.id]);

      if (billing) {
        await this.db.executeRaw(`
          UPDATE billing 
          SET status = 'overdue',
              updated_at = CURRENT_TIMESTAMP
          WHERE billing_id = ?
        `, [billing.billing_id]);

        await logInfo('Billing marcado como overdue via webhook', { billingId: billing.billing_id, invoiceId: invoice.id });
      }

    } catch (error: any) {
      await logError('Erro ao processar falha de pagamento', error);
      throw error;
    }
  }
}

