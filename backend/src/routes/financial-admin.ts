/**
 * Administração financeira: emissão em lote, registro de pagamento, QR PIX.
 */

import { Router, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import { authMiddleware, authorizeRole, AuthenticatedRequest } from '../middleware/auth.middleware';
import {
  authorizeBillingManagement,
  authorizeBillingManagementOrPublisherSelf,
  authorizeBillingManagementOrSubscriberSelf,
} from '../middleware/billingAuthorization.middleware';
import { getFinancialAdminService } from '../services/financialAdminService';
import { logError } from '../utils/loggerHelper';
import { StripeService } from '../services/stripeService';

const router = Router();
router.use(authMiddleware);

const validateRequest = (req: AuthenticatedRequest, res: Response, next: () => void) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ success: false, error: 'Dados inválidos', details: errors.array() });
    return;
  }
  next();
};

/**
 * @route POST /api/financial-admin/issue-invoices
 * @desc Emite faturas do período atual para contratos ativos com plano
 */
router.post(
  '/issue-invoices',
  authorizeRole(['owner_system', 'admin', 'admin_sql', 'operador_faturamento', 'gerente_financeiro']),
  body('subscriberId').optional().isInt({ min: 1 }),
  body('contractId').optional().isInt({ min: 1 }),
  body('dueInDays').optional().isInt({ min: 1, max: 90 }),
  validateRequest,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const data = await getFinancialAdminService().issueContractInvoices({
        subscriberId: req.body.subscriberId,
        contractId: req.body.contractId,
        dueInDays: req.body.dueInDays,
      });
      return res.json({ success: true, data });
    } catch (error: any) {
      await logError('Erro ao emitir faturas', error);
      return res.status(500).json({ success: false, message: error.message || 'Erro interno' });
    }
  }
);

/**
 * @route POST /api/financial-admin/subscriber-billing/:id/record-payment
 */
router.post(
  '/subscriber-billing/:id/record-payment',
  authorizeBillingManagement,
  param('id').isInt({ min: 1 }),
  body('amount').optional().isFloat({ min: 0 }),
  body('paymentMethod').optional().isString(),
  body('paymentReference').optional().isString(),
  body('notes').optional().isString(),
  validateRequest,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const billingId = parseInt(req.params.id, 10);
      const updated = await getFinancialAdminService().recordSubscriberPayment(billingId, req.body);
      return res.json({ success: true, data: updated, message: 'Pagamento registado' });
    } catch (error: any) {
      return res.status(400).json({ success: false, message: error.message || 'Erro ao registar pagamento' });
    }
  }
);

/**
 * @route GET /api/financial-admin/subscriber-billing/:id/payment-qr
 */
router.get(
  '/subscriber-billing/:id/payment-qr',
  authorizeRole([
    'owner_system',
    'admin',
    'admin_sql',
    'operador_faturamento',
    'gerente_financeiro',
    'subscriber_user',
    'publisher_user',
  ]),
  param('id').isInt({ min: 1 }),
  validateRequest,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const billingId = parseInt(req.params.id, 10);
      const data = await getFinancialAdminService().getSubscriberPaymentQr(billingId);
      return res.json({ success: true, data });
    } catch (error: any) {
      return res.status(400).json({ success: false, message: error.message || 'Erro ao gerar QR' });
    }
  }
);

/**
 * @route POST /api/financial-admin/subscriber-billing/:id/send-payment-email
 */
router.post(
  '/subscriber-billing/:id/send-payment-email',
  authorizeBillingManagement,
  param('id').isInt({ min: 1 }),
  validateRequest,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const billingId = parseInt(req.params.id, 10);
      const result = await getFinancialAdminService().sendInvoicePaymentEmail(billingId);
      return res.json({ success: result.sent, data: result });
    } catch (error: any) {
      return res.status(400).json({ success: false, message: error.message });
    }
  }
);

/**
 * @route POST /api/financial-admin/subscriber-billing/:id/stripe-checkout
 */
router.post(
  '/subscriber-billing/:id/stripe-checkout',
  param('id').isInt({ min: 1 }),
  validateRequest,
  authorizeBillingManagementOrSubscriberSelf,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const billingId = parseInt(req.params.id, 10);
      const data = await getFinancialAdminService().createStripeCheckoutForBilling(billingId);
      return res.json({ success: true, data });
    } catch (error: any) {
      return res.status(400).json({ success: false, message: error.message });
    }
  }
);

/**
 * Confirma pagamento Stripe após redirect (session_id na URL de sucesso).
 */
router.post(
  '/stripe/complete-session',
  authorizeRole([
    'owner_system',
    'admin',
    'admin_sql',
    'operador_faturamento',
    'gerente_financeiro',
    'subscriber_user',
    'publisher_user',
  ]),
  body('sessionId').isString().notEmpty(),
  validateRequest,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const stripe = new StripeService();
      if (!stripe.isEnabled()) {
        return res.status(400).json({ success: false, message: 'Stripe desabilitado' });
      }
      const session = await stripe.getStripeInstance()!.checkout.sessions.retrieve(req.body.sessionId);
      if (session.payment_status !== 'paid') {
        return res.json({ success: false, message: 'Pagamento ainda não confirmado no Stripe' });
      }
      const meta = (session.metadata || {}) as Record<string, string>;
      await getFinancialAdminService().handleStripeCheckoutCompleted({
        ...meta,
        sessionId: session.id,
      });
      return res.json({ success: true, billingId: meta.billingId });
    } catch (error: any) {
      return res.status(400).json({ success: false, message: error.message });
    }
  }
);

/** --- Exibidor (publisher_billing incoming) --- */

router.post(
  '/publisher-billing/:id/record-payment',
  authorizeBillingManagement,
  param('id').isInt({ min: 1 }),
  body('amount').optional().isFloat({ min: 0 }),
  body('paymentMethod').optional().isString(),
  body('paymentReference').optional().isString(),
  validateRequest,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const billingId = parseInt(req.params.id, 10);
      const updated = await getFinancialAdminService().recordPublisherPayment(billingId, req.body);
      return res.json({ success: true, data: updated, message: 'Pagamento registado' });
    } catch (error: any) {
      return res.status(400).json({ success: false, message: error.message || 'Erro ao registar pagamento' });
    }
  }
);

router.get(
  '/publisher-billing/:id/payment-qr',
  authorizeRole([
    'owner_system',
    'admin',
    'admin_sql',
    'operador_faturamento',
    'gerente_financeiro',
    'publisher_user',
    'subscriber_user',
  ]),
  param('id').isInt({ min: 1 }),
  validateRequest,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const billingId = parseInt(req.params.id, 10);
      const role = String(req.user?.role || '').toLowerCase();
      if (role === 'publisher_user') {
        const publisherId = req.user?.publisherId ?? (req.user as { publisher_id?: number })?.publisher_id;
        const { PublisherBillingService } = require('../services/publisherBillingService');
        const row = await new PublisherBillingService().getBillingById(billingId);
        if (!row || row.publisherId !== publisherId) {
          return res.status(403).json({ success: false, message: 'Acesso negado' });
        }
      }
      const data = await getFinancialAdminService().getPublisherPaymentQr(billingId);
      return res.json({ success: true, data });
    } catch (error: any) {
      return res.status(400).json({ success: false, message: error.message || 'Erro ao gerar QR' });
    }
  }
);

router.post(
  '/publisher-billing/:id/send-payment-email',
  authorizeBillingManagement,
  param('id').isInt({ min: 1 }),
  validateRequest,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const billingId = parseInt(req.params.id, 10);
      const result = await getFinancialAdminService().sendPublisherPaymentEmail(billingId);
      return res.json({ success: result.sent, data: result });
    } catch (error: any) {
      return res.status(400).json({ success: false, message: error.message });
    }
  }
);

router.post(
  '/publisher-billing/:id/stripe-checkout',
  param('id').isInt({ min: 1 }),
  validateRequest,
  authorizeBillingManagementOrPublisherSelf,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const billingId = parseInt(req.params.id, 10);
      const data = await getFinancialAdminService().createStripeCheckoutForPublisherBilling(billingId);
      return res.json({ success: true, data });
    } catch (error: any) {
      return res.status(400).json({ success: false, message: error.message });
    }
  }
);

export default router;
