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

    // NOVO: Usuários só veem suas próprias assinaturas baseado em subscriberId/publisherId
    const userSubscriberId = req.user.subscriberId;
    const userPublisherId = req.user.publisherId;
    const userType = req.user.userType;

    if (userType === 'subscriber_user' && userSubscriberId) {
      // Subscribers veem assinaturas do seu publisher
      filters.publisherId = userPublisherId || userSubscriberId;
    } else if (userType === 'publisher_user' || userType === 'publisher_subscriber') {
      if (userPublisherId) {
        filters.publisherId = userPublisherId;
      }
    } else if ((req.user.role === 'client' || req.user.role === 'subscriber') && req.user.subscriberId) {
      filters.subscriberId = req.user.subscriberId;
    } else {
      // Admins podem filtrar
      const { subscriberId, publisherId, planId, status } = req.query;
      if (publisherId) {
        filters.publisherId = parseInt(publisherId as string);
      } else if (subscriberId) {
        filters.subscriberId = parseInt(subscriberId as string);
      }
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
    // NOVO: Suportar subscriberId/publisherId além de clientId
    const userSubscriberId = req.user.subscriberId;
    const userPublisherId = req.user.publisherId;
    const userType = req.user.userType;
    const clientId = req.user.clientId; // DEPRECADO: Compatibilidade

    let publisherId: number | undefined;

    if (userType === 'subscriber_user' && userSubscriberId) {
      // Subscribers veem assinatura do seu publisher
      publisherId = userPublisherId || userSubscriberId;
    } else if (userType === 'publisher_user' || userType === 'publisher_subscriber') {
      publisherId = userPublisherId;
    } else if (req.user.role === 'client' && clientId) {
      // DEPRECADO: Compatibilidade
      publisherId = clientId;
    }

    if (!publisherId) {
      return res.status(403).json({
        success: false,
        message: 'Acesso negado: Usuário não possui publisherId/subscriberId'
      });
    }

    const subscription = await getSubscriptionService().getSubscriptionByPublisher(publisherId);

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

    // NOVO: Verificar permissão baseado em userType
    const userType = req.user.userType;
    const userPublisherId = req.user.publisherId;
    const userSubscriberId = req.user.subscriberId;
    const clientId = req.user.clientId; // DEPRECADO

    let hasAccess = false;

    if (userType === 'publisher_user' || userType === 'publisher_subscriber') {
      hasAccess = userPublisherId === subscription.publisherId;
    } else if (userType === 'subscriber_user' && userSubscriberId) {
      // Subscribers veem assinaturas do seu publisher
      hasAccess = userPublisherId === subscription.publisherId;
    } else if (req.user.role === 'client' && clientId) {
      // DEPRECADO: Compatibilidade
      hasAccess = clientId === subscription.subscriberId || clientId === subscription.publisherId;
    } else {
      // Admins têm acesso
      hasAccess = ['admin', 'admin_sql', 'owner_system'].includes(req.user.role);
    }

    if (!hasAccess) {
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
    const { clientId, publisherId, planId, billingInterval, trialDays } = req.body;

    // NOVO: Determinar publisherId baseado em userType
    let finalPublisherId: number | undefined;
    const userType = req.user.userType;
    const userPublisherId = req.user.publisherId;
    const userSubscriberId = req.user.subscriberId;

    if (userType === 'publisher_user' || userType === 'publisher_subscriber') {
      // Publishers criam assinaturas para si mesmos
      finalPublisherId = userPublisherId;
    } else if (userType === 'subscriber_user' && userSubscriberId) {
      // Subscribers criam assinaturas para seu publisher
      finalPublisherId = userPublisherId || userSubscriberId;
    } else if (req.user.role === 'client' && req.user.clientId) {
      // DEPRECADO: Compatibilidade
      finalPublisherId = req.user.clientId;
    } else {
      // Admins podem especificar publisherId
      finalPublisherId = publisherId || clientId; // clientId para compatibilidade
    }

    if (!finalPublisherId) {
      return res.status(400).json({
        success: false,
        message: 'publisherId é obrigatório'
      });
    }

    const subscription = await getSubscriptionService().createSubscription({
      publisherId: finalPublisherId,
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

    // NOVO: Verificar permissão baseado em userType
    const userType = req.user.userType;
    const userPublisherId = req.user.publisherId;
    const userSubscriberId = req.user.subscriberId;
    const clientId = req.user.clientId; // DEPRECADO

    let hasAccess = false;

    if (userType === 'publisher_user' || userType === 'publisher_subscriber') {
      hasAccess = userPublisherId === subscription.publisherId;
    } else if (userType === 'subscriber_user' && userSubscriberId) {
      hasAccess = userPublisherId === subscription.publisherId;
    } else if (req.user.role === 'client' && clientId) {
      hasAccess = clientId === subscription.subscriberId || clientId === subscription.publisherId;
    } else {
      hasAccess = ['admin', 'admin_sql', 'owner_system'].includes(req.user.role);
    }

    if (!hasAccess) {
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

    // NOVO: Verificar permissão baseado em userType
    const userType = req.user.userType;
    const userPublisherId = req.user.publisherId;
    const userSubscriberId = req.user.subscriberId;
    const clientId = req.user.clientId; // DEPRECADO

    let hasAccess = false;

    if (userType === 'publisher_user' || userType === 'publisher_subscriber') {
      hasAccess = userPublisherId === subscription.publisherId;
    } else if (userType === 'subscriber_user' && userSubscriberId) {
      hasAccess = userPublisherId === subscription.publisherId;
    } else if (req.user.role === 'client' && clientId) {
      hasAccess = clientId === subscription.subscriberId || clientId === subscription.publisherId;
    } else {
      hasAccess = ['admin', 'admin_sql', 'owner_system'].includes(req.user.role);
    }

    if (!hasAccess) {
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
    // NOVO: Suportar subscriberId/publisherId além de clientId
    const userType = req.user.userType;
    const userPublisherId = req.user.publisherId;
    const userSubscriberId = req.user.subscriberId;
    const clientId = req.user.clientId; // DEPRECADO

    let publisherId: number | undefined;

    if (userType === 'publisher_user' || userType === 'publisher_subscriber') {
      publisherId = userPublisherId;
    } else if (userType === 'subscriber_user' && userSubscriberId) {
      publisherId = userPublisherId || userSubscriberId;
    } else if (req.user.role === 'client' && clientId) {
      publisherId = clientId;
    }

    if (!publisherId) {
      return res.status(403).json({
        success: false,
        message: 'Acesso negado: Usuário não possui publisherId/subscriberId'
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

    // NOVO: Buscar publisher (substitui subscriber)
    const db = (await import('../config/database')).getDatabase();
    let publisher: any = null;
    let subscriber: any = null;

    // Tentar buscar publisher primeiro
    publisher = await db.findFirst(`
      SELECT publisher_id, name, email FROM publishers WHERE publisher_id = $1
    `, [publisherId]);

    // Se não encontrar publisher, tentar subscriber (compatibilidade)
    if (!publisher) {
      subscriber = await db.findFirst(`
        SELECT subscriber_id, name, email FROM subscribers WHERE subscriber_id = $1
      `, [publisherId]);
    }

    if (!publisher && !subscriber) {
      return res.status(404).json({
        success: false,
        message: 'Publisher/Subscriber não encontrado'
      });
    }

    // Determinar email e nome
    const clientEmail = publisher?.email || subscriber?.email || `${publisherId}@smartsignage.com`;
    const clientName = publisher?.name || subscriber?.name || undefined;

    // Criar ou buscar customer
    const customer = await stripeService.createOrGetCustomer(
      publisherId,
      clientEmail,
      clientName
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
        publisherId: publisherId.toString(),
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

