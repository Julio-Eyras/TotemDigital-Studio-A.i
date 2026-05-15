/**
 * Stripe Service - Smart Signage v2.1
 * Serviço para integração com Stripe
 */

import Stripe from 'stripe';
import { config } from '../config/env';
import { logError, logInfo } from '../utils/loggerHelper';

export class StripeService {
  private stripe: Stripe | null = null;

  constructor() {
    if (config.stripe.enabled && config.stripe.secretKey) {
      try {
        this.stripe = new Stripe(config.stripe.secretKey, {
          apiVersion: config.stripe.apiVersion as any,
        });
        logInfo('Stripe inicializado com sucesso', {});
      } catch (error: any) {
        logError('Erro ao inicializar Stripe', error);
      }
    }
  }

  /**
   * Verifica se Stripe está habilitado e configurado
   */
  isEnabled(): boolean {
    return config.stripe.enabled && !!this.stripe;
  }

  /**
   * Cria ou busca customer no Stripe
   */
  async createOrGetCustomer(clientId: number, email: string, name?: string): Promise<Stripe.Customer> {
    if (!this.isEnabled()) {
      throw new Error('Stripe não está habilitado');
    }

    try {
      // Buscar customer existente por metadata
      const existingCustomers = await this.stripe!.customers.list({
        email,
        limit: 1,
      });

      if (existingCustomers.data.length > 0) {
        return existingCustomers.data[0];
      }

      // Criar novo customer
      const customer = await this.stripe!.customers.create({
        email,
        name,
        metadata: {
          clientId: clientId.toString(),
        },
      });

      await logInfo('Customer criado no Stripe', { customerId: customer.id, clientId });
      return customer;

    } catch (error: any) {
      await logError('Erro ao criar/buscar customer no Stripe', error, { clientId, email });
      throw error;
    }
  }

  /**
   * Cria subscription no Stripe
   */
  async createSubscription(
    customerId: string,
    priceId: string,
    metadata?: Record<string, string>
  ): Promise<Stripe.Subscription> {
    if (!this.isEnabled()) {
      throw new Error('Stripe não está habilitado');
    }

    try {
      const subscription = await this.stripe!.subscriptions.create({
        customer: customerId,
        items: [{ price: priceId }],
        metadata: metadata || {},
        payment_behavior: 'default_incomplete',
        payment_settings: { save_default_payment_method: 'on_subscription' },
        expand: ['latest_invoice.payment_intent'],
      });

      await logInfo('Subscription criada no Stripe', { subscriptionId: subscription.id, customerId });
      return subscription;

    } catch (error: any) {
      await logError('Erro ao criar subscription no Stripe', error, { customerId, priceId });
      throw error;
    }
  }

  /**
   * Cancela subscription no Stripe
   */
  async cancelSubscription(subscriptionId: string, cancelAtPeriodEnd: boolean = true): Promise<Stripe.Subscription> {
    if (!this.isEnabled()) {
      throw new Error('Stripe não está habilitado');
    }

    try {
      const subscription = await this.stripe!.subscriptions.update(subscriptionId, {
        cancel_at_period_end: cancelAtPeriodEnd,
      });

      await logInfo('Subscription cancelada no Stripe', { subscriptionId, cancelAtPeriodEnd });
      return subscription;

    } catch (error: any) {
      await logError('Erro ao cancelar subscription no Stripe', error, { subscriptionId });
      throw error;
    }
  }

  /**
   * Retoma subscription cancelada
   */
  async resumeSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    if (!this.isEnabled()) {
      throw new Error('Stripe não está habilitado');
    }

    try {
      const subscription = await this.stripe!.subscriptions.update(subscriptionId, {
        cancel_at_period_end: false,
      });

      await logInfo('Subscription retomada no Stripe', { subscriptionId });
      return subscription;

    } catch (error: any) {
      await logError('Erro ao retomar subscription no Stripe', error, { subscriptionId });
      throw error;
    }
  }

  /**
   * Busca subscription no Stripe
   */
  async getSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    if (!this.isEnabled()) {
      throw new Error('Stripe não está habilitado');
    }

    try {
      const subscription = await this.stripe!.subscriptions.retrieve(subscriptionId);
      return subscription;

    } catch (error: any) {
      await logError('Erro ao buscar subscription no Stripe', error, { subscriptionId });
      throw error;
    }
  }

  /**
   * Cria payment intent para pagamento único
   */
  async createPaymentIntent(
    amount: number,
    currency: string,
    customerId?: string,
    metadata?: Record<string, string>
  ): Promise<Stripe.PaymentIntent> {
    if (!this.isEnabled()) {
      throw new Error('Stripe não está habilitado');
    }

    try {
      const paymentIntent = await this.stripe!.paymentIntents.create({
        amount: Math.round(amount * 100), // Converter para centavos
        currency: currency.toLowerCase(),
        customer: customerId,
        metadata: metadata || {},
        automatic_payment_methods: {
          enabled: true,
        },
      });

      await logInfo('Payment intent criado no Stripe', { paymentIntentId: paymentIntent.id, amount });
      return paymentIntent;

    } catch (error: any) {
      await logError('Erro ao criar payment intent no Stripe', error, { amount, currency });
      throw error;
    }
  }

  /**
   * Busca invoice no Stripe
   */
  async getInvoice(invoiceId: string): Promise<Stripe.Invoice> {
    if (!this.isEnabled()) {
      throw new Error('Stripe não está habilitado');
    }

    try {
      const invoice = await this.stripe!.invoices.retrieve(invoiceId);
      return invoice;

    } catch (error: any) {
      await logError('Erro ao buscar invoice no Stripe', error, { invoiceId });
      throw error;
    }
  }

  /**
   * Cria checkout session
   */
  async createCheckoutSession(
    priceId: string,
    customerId: string,
    successUrl: string,
    cancelUrl: string,
    metadata?: Record<string, string>
  ): Promise<Stripe.Checkout.Session> {
    if (!this.isEnabled()) {
      throw new Error('Stripe não está habilitado');
    }

    try {
      const session = await this.stripe!.checkout.sessions.create({
        customer: customerId,
        payment_method_types: ['card'],
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        mode: 'subscription',
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: metadata || {},
      });

      await logInfo('Checkout session criada no Stripe', { sessionId: session.id });
      return session;

    } catch (error: any) {
      await logError('Erro ao criar checkout session no Stripe', error, { priceId });
      throw error;
    }
  }

  /**
   * Checkout único (pagamento de fatura avulsa)
   */
  async createOneTimePaymentSession(params: {
    amount: number;
    currency: string;
    description: string;
    successUrl: string;
    cancelUrl: string;
    metadata?: Record<string, string>;
  }): Promise<Stripe.Checkout.Session> {
    if (!this.isEnabled()) {
      throw new Error('Stripe não está habilitado');
    }

    const unitAmount = Math.round(params.amount * 100);
    if (unitAmount < 1) {
      throw new Error('Valor inválido para pagamento Stripe');
    }

    const session = await this.stripe!.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: (params.currency || 'brl').toLowerCase(),
            product_data: { name: params.description.slice(0, 120) },
            unit_amount: unitAmount,
          },
          quantity: 1,
        },
      ],
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      metadata: params.metadata || {},
    });

    await logInfo('Checkout pagamento único criado', { sessionId: session.id });
    return session;
  }

  /**
   * Verifica webhook signature
   */
  async verifyWebhookSignature(payload: string | Buffer, signature: string): Promise<Stripe.Event> {
    if (!this.isEnabled()) {
      throw new Error('Stripe não está habilitado');
    }

    try {
      const event = this.stripe!.webhooks.constructEvent(
        payload,
        signature,
        config.stripe.webhookSecret
      );
      return event;

    } catch (error: any) {
      await logError('Erro ao verificar webhook signature', error);
      throw new Error('Webhook signature inválida');
    }
  }

  /**
   * Retorna instância do Stripe (para uso avançado)
   */
  getStripeInstance(): Stripe | null {
    return this.stripe;
  }
}

