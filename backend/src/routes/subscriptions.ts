/**
 * Subscriptions Routes - Smart Signage v2.1
 * Rotas para gerenciamento de assinaturas
 */

import { Router } from 'express';
import { SubscriptionService } from '../services/subscriptionService';
import { StripeService } from '../services/stripeService';
import { authenticateToken, authorizeRole } from '../middleware/auth.middleware';
import { logError } from '../utils/loggerHelper';

const router = Router();

// Lazy initialization
function getSubscriptionService(): SubscriptionService {
  if (!(global as any).subscriptionServiceInstance) {
    (global as any).subscriptionServiceInstance = new SubscriptionService();
  }
  return (global as any).subscriptionServiceInstance;
}

function getStripeService(): StripeService {
  if (!(global as any).stripeServiceInstance) {
    (global as any).stripeServiceInstance = new StripeService();
  }
  return (global as any).stripeServiceInstance;
}

// Middleware de autenticação para todas as rotas
router.use(authenticateToken);

/**
 * @route GET /api/subscriptions
 * @desc Lista assinaturas
 * @access Private (Admin, Manager, Client)
 */
router.get('/', async (req: any, res) => {
  try {
    const filters: any = {};

    // Clientes só veem suas próprias assinaturas
    if (req.user.role === 'client') {
      filters.clientId = req.user.clientId;
    } else {
      const { clientId, planId, status } = req.query;
      if (clientId) filters.clientId = parseInt(clientId as string);
      if (planId) filters.planId = parseInt(planId as string);
      if (status) filters.status = status as string;
    }

    const subscriptions = await getSubscriptionService().getSubscriptions(filters);

    res.json({
      success: true,
      data: subscriptions
    });

  } catch (error: any) {
    await logError('Erro ao listar assinaturas', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
});

/**
 * @route GET /api/subscriptions/my-subscription
 * @desc Busca assinatura do usuário atual
 * @access Private (Client)
 */
router.get('/my-subscription', async (req: any, res) => {
  try {
    if (req.user.role !== 'client' || !req.user.clientId) {
      return res.status(403).json({
        success: false,
        message: 'Acesso negado'
      });
    }

    const subscription = await getSubscriptionService().getSubscriptionByClient(req.user.clientId);

    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: 'Nenhuma assinatura encontrada'
      });
    }

    return res.json({
      success: true,
      data: subscription
    });

  } catch (error: any) {
    await logError('Erro ao buscar assinatura do usuário', error);
    return res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
});

/**
 * @route GET /api/subscriptions/:id
 * @desc Busca assinatura por ID
 * @access Private (Admin, Manager, Client)
 */
router.get('/:id', async (req: any, res) => {
  try {
    const { id } = req.params;
    const subscription = await getSubscriptionService().getSubscriptionById(parseInt(id));

    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: 'Assinatura não encontrada'
      });
    }

    // Verificar permissão
    if (req.user.role === 'client' && req.user.clientId !== subscription.clientId) {
      return res.status(403).json({
        success: false,
        message: 'Acesso negado: Você só pode ver suas próprias assinaturas'
      });
    }

    return res.json({
      success: true,
      data: subscription
    });

  } catch (error: any) {
    await logError('Erro ao buscar assinatura', error);
    return res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
});

/**
 * @route POST /api/subscriptions
 * @desc Cria nova assinatura
 * @access Private (Admin, Manager, Client)
 */
router.post('/', async (req: any, res) => {
  try {
    const { clientId, planId, billingInterval, trialDays } = req.body;

    // Determinar clientId
    let finalClientId = clientId;
    if (req.user.role === 'client') {
      finalClientId = req.user.clientId;
    } else if (!finalClientId) {
      return res.status(400).json({
        success: false,
        message: 'clientId é obrigatório'
      });
    }

    const subscription = await getSubscriptionService().createSubscription({
      publisherId: finalClientId, // subscriptions pertencem a publishers
      planId,
      billingInterval: billingInterval || 'month',
      trialDays,
    });

    return res.status(201).json({
      success: true,
      message: 'Assinatura criada com sucesso',
      data: subscription
    });

  } catch (error: any) {
    await logError('Erro ao criar assinatura', error);
    return res.status(400).json({
      success: false,
      message: error.message || 'Erro ao criar assinatura',
      error: error.message
    });
  }
});

/**
 * @route PUT /api/subscriptions/:id
 * @desc Atualiza assinatura
 * @access Private (Admin, Manager)
 */
router.put('/:id', authorizeRole(['admin', 'admin_sql']), async (req: any, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const subscription = await getSubscriptionService().updateSubscription(parseInt(id), updateData);

    res.json({
      success: true,
      message: 'Assinatura atualizada com sucesso',
      data: subscription
    });

  } catch (error: any) {
    await logError('Erro ao atualizar assinatura', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Erro ao atualizar assinatura',
      error: error.message
    });
  }
});

/**
 * @route POST /api/subscriptions/:id/cancel
 * @desc Cancela assinatura
 * @access Private (Admin, Manager, Client)
 */
router.post('/:id/cancel', async (req: any, res) => {
  try {
    const { id } = req.params;
    const { cancelAtPeriodEnd = true } = req.body;

    const subscription = await getSubscriptionService().getSubscriptionById(parseInt(id));
    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: 'Assinatura não encontrada'
      });
    }

    // Verificar permissão
    if (req.user.role === 'client' && req.user.clientId !== subscription.clientId) {
      return res.status(403).json({
        success: false,
        message: 'Acesso negado: Você só pode cancelar suas próprias assinaturas'
      });
    }

    const canceledSubscription = await getSubscriptionService().cancelSubscription(
      parseInt(id),
      cancelAtPeriodEnd
    );

    return res.json({
      success: true,
      message: cancelAtPeriodEnd
        ? 'Assinatura será cancelada ao final do período'
        : 'Assinatura cancelada imediatamente',
      data: canceledSubscription
    });

  } catch (error: any) {
    await logError('Erro ao cancelar assinatura', error);
    return res.status(400).json({
      success: false,
      message: error.message || 'Erro ao cancelar assinatura',
      error: error.message
    });
  }
});

/**
 * @route POST /api/subscriptions/:id/resume
 * @desc Retoma assinatura cancelada
 * @access Private (Admin, Manager, Client)
 */
router.post('/:id/resume', async (req: any, res) => {
  try {
    const { id } = req.params;

    const subscription = await getSubscriptionService().getSubscriptionById(parseInt(id));
    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: 'Assinatura não encontrada'
      });
    }

    // Verificar permissão
    if (req.user.role === 'client' && req.user.clientId !== subscription.clientId) {
      return res.status(403).json({
        success: false,
        message: 'Acesso negado'
      });
    }

    const resumedSubscription = await getSubscriptionService().updateSubscription(parseInt(id), {
      cancelAtPeriodEnd: false,
    });

    return res.json({
      success: true,
      message: 'Assinatura retomada com sucesso',
      data: resumedSubscription
    });

  } catch (error: any) {
    await logError('Erro ao retomar assinatura', error);
    return res.status(400).json({
      success: false,
      message: error.message || 'Erro ao retomar assinatura',
      error: error.message
    });
  }
});

/**
 * @route POST /api/subscriptions/checkout
 * @desc Cria checkout session do Stripe
 * @access Private (Client)
 */
router.post('/checkout', async (req: any, res) => {
  try {
    if (req.user.role !== 'client' || !req.user.clientId) {
      return res.status(403).json({
        success: false,
        message: 'Acesso negado'
      });
    }

    const { planId, billingInterval = 'month' } = req.body;

    if (!planId) {
      return res.status(400).json({
        success: false,
        message: 'planId é obrigatório'
      });
    }

    const stripeService = getStripeService();
    if (!stripeService.isEnabled()) {
      return res.status(400).json({
        success: false,
        message: 'Stripe não está habilitado'
      });
    }

    // Buscar plano
    const { PlanService } = await import('../services/planService');
    const planService = new PlanService();
    const plan = await planService.getPlanById(planId);

    if (!plan) {
      return res.status(404).json({
        success: false,
        message: 'Plano não encontrado'
      });
    }

    // Buscar cliente
    const client = await (await import('../config/database')).getDatabase().findFirst(`
      SELECT client_id, name, email FROM clients WHERE client_id = ?
    `, [req.user.clientId]);

    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Cliente não encontrado'
      });
    }

    // Criar ou buscar customer
    const customer = await stripeService.createOrGetCustomer(
      req.user.clientId,
      client.email || `${client.client_id}@smartsignage.com`,
      client.name || undefined
    );

    // Selecionar price ID
    const priceId = billingInterval === 'year' && plan.stripePriceIdYearly
      ? plan.stripePriceIdYearly
      : plan.stripePriceIdMonthly;

    if (!priceId) {
      return res.status(400).json({
        success: false,
        message: 'Plano não possui configuração Stripe'
      });
    }

    // Criar checkout session
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
    const session = await stripeService.createCheckoutSession(
      priceId,
      customer.id,
      `${frontendUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      `${frontendUrl}/billing/cancel`,
      {
        clientId: req.user.clientId.toString(),
        planId: planId.toString(),
        billingInterval,
      }
    );

    return res.json({
      success: true,
      data: {
        sessionId: session.id,
        url: session.url,
      }
    });

  } catch (error: any) {
    await logError('Erro ao criar checkout session', error);
    return res.status(400).json({
      success: false,
      message: error.message || 'Erro ao criar checkout session',
      error: error.message
    });
  }
});

/**
 * @route POST /api/subscriptions/webhook
 * @desc Webhook do Stripe
 * @access Public (Stripe)
 */
router.post('/webhook', async (req, res) => {
  try {
    const stripeService = getStripeService();
    if (!stripeService.isEnabled()) {
      return res.status(400).json({
        success: false,
        message: 'Stripe não está habilitado'
      });
    }

    const signature = req.headers['stripe-signature'] as string;
    if (!signature) {
      return res.status(400).json({
        success: false,
        message: 'Stripe signature não encontrada'
      });
    }

    // Verificar signature
    const event = stripeService.verifyWebhookSignature(req.body, signature);

    // Processar webhook
    const subscriptionService = getSubscriptionService();
    await subscriptionService.processStripeWebhook(event);

    return res.json({ received: true });

  } catch (error: any) {
    await logError('Erro ao processar webhook do Stripe', error);
    return res.status(400).json({
      success: false,
      message: error.message || 'Erro ao processar webhook',
      error: error.message
    });
  }
});

export default router;

