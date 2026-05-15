/**
 * Administração financeira: emissão em lote, registro de pagamento, QR PIX.
 */

import { Router, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import { authMiddleware, authorizeRole, AuthenticatedRequest } from '../middleware/auth.middleware';
import { authorizeBillingManagement } from '../middleware/billingAuthorization.middleware';
import { getFinancialAdminService } from '../services/financialAdminService';
import { logError } from '../utils/loggerHelper';

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

export default router;
