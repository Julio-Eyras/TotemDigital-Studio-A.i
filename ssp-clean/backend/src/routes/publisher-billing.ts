/**
 * Publisher Billing Routes - Smart Signage v2.1
 * Rotas para gerenciamento de billing de publishers (publicadores)
 * 
 * Publishers podem receber revenue share (outgoing) ou pagar subscription (incoming)
 */

import { Router, Response } from 'express';
import { PublisherBillingService } from '../services/publisherBillingService';
import { authMiddleware, AuthenticatedRequest, authorizeRole } from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/validation.middleware';
import { body, param, query } from 'express-validator';
import { logError } from '../utils/loggerHelper';

const router = Router();

// Middleware de autenticação para todas as rotas
router.use(authMiddleware);

// Lazy initialization
function getPublisherBillingService(): PublisherBillingService {
  if (!(global as any).publisherBillingServiceInstance) {
    (global as any).publisherBillingServiceInstance = new PublisherBillingService();
  }
  return (global as any).publisherBillingServiceInstance;
}

/**
 * @route GET /api/publisher-billing
 * @desc Lista faturas de publishers
 */
router.get('/',
  query('page').optional({ checkFalsy: true }).isInt({ min: 1 }),
  query('limit').optional({ checkFalsy: true }).isInt({ min: 1, max: 100 }),
  query('publisherId').optional({ checkFalsy: true }).isInt({ min: 1 }),
  query('campaignId').optional({ checkFalsy: true }).isInt({ min: 1 }),
  // Frontend envia billingType/paymentStatus como string vazia. checkFalsy evita 400.
  query('billingType').optional({ checkFalsy: true }).isIn(['revenue_share', 'payout', 'subscription', 'platform_fee']),
  query('direction').optional({ checkFalsy: true }).isIn(['incoming', 'outgoing']),
  query('paymentStatus').optional({ checkFalsy: true }).isIn(['pending', 'pending_payout', 'paid', 'failed', 'refunded', 'cancelled']),
  validateRequest,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { page = 1, limit = 20, publisherId, campaignId, totemId, billingType, direction, paymentStatus, startDate, endDate, search } = req.query;
      
      // Validar acesso: publisher só pode ver suas próprias faturas
      if (!req.user) {
        return res.status(401).json({ success: false, error: 'Não autenticado' });
      }
      
      let finalPublisherId: number | undefined;
      if (req.user.role === 'publisher' && req.user.publisherId) {
        finalPublisherId = req.user.publisherId;
      } else if (req.user.role === 'admin') {
        finalPublisherId = publisherId ? parseInt(publisherId as string) : undefined;
      } else {
        return res.status(403).json({
          success: false,
          error: 'Acesso negado',
          message: 'Apenas admins e publishers podem visualizar faturas'
        });
      }
      
      const result = await getPublisherBillingService().getBillings(
        parseInt(page as string),
        parseInt(limit as string),
        {
          publisherId: finalPublisherId,
          campaignId: campaignId ? parseInt(campaignId as string) : undefined,
          totemId: totemId ? parseInt(totemId as string) : undefined,
          billingType: billingType as string,
          direction: direction as 'incoming' | 'outgoing' | undefined,
          paymentStatus: paymentStatus as string,
          startDate: startDate as string,
          endDate: endDate as string,
          search: search as string
        }
      );

      // Mapear camelCase (service) -> snake_case (frontend)
      const mapped = {
        billings: (result.billings || []).map((b: any) => ({
          billing_id: b.billingId,
          publisher_id: b.publisherId,
          publisher_name: b.publisherName,
          campaign_id: b.campaignId,
          campaign_title: b.campaignTitle,
          totem_id: b.totemId,
          billing_type: b.billingType,
          direction: b.direction,
          amount: b.amount,
          currency: b.currency,
          payment_status: b.paymentStatus,
          due_date: b.dueDate,
          paid_at: b.paidAt,
          created_at: b.createdAt,
          updated_at: b.updatedAt,
          description: b.description,
          metadata: b.metadata
        })),
        total: result.total || 0,
        page: result.page || parseInt(page as string) || 1,
        limit: result.limit || parseInt(limit as string) || 20
      };

      return res.json({ success: true, data: mapped });
    } catch (error: any) {
      await logError('Erro ao listar faturas de publishers', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao listar faturas',
        message: error.message || 'Erro interno do servidor'
      });
    }
  }
);

/**
 * @route GET /api/publisher-billing/stats
 * @desc Obter estatísticas de billing de publishers
 */
router.get('/stats',
  authorizeRole(['admin', 'gerente_financeiro']),
  query('publisherId').optional().isInt({ min: 1 }),
  validateRequest,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { publisherId, startDate, endDate } = req.query;
      
      const stats = await getPublisherBillingService().getBillingStats({
        publisherId: publisherId ? parseInt(publisherId as string) : undefined,
        startDate: startDate as string,
        endDate: endDate as string
      });
      
      return res.json({
        success: true,
        data: stats
      });
    } catch (error: any) {
      await logError('Erro ao obter estatísticas de billing', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao obter estatísticas',
        message: error.message || 'Erro interno do servidor'
      });
    }
  }
);

/**
 * @route GET /api/publisher-billing/:id
 * @desc Obter fatura por ID
 */
router.get('/:id',
  param('id').isInt({ min: 1 }),
  validateRequest,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const billingId = parseInt(req.params.id);
      
      const billing = await getPublisherBillingService().getBillingById(billingId);
      
      if (!billing) {
        return res.status(404).json({
          success: false,
          error: 'Fatura não encontrada'
        });
      }
      
      if (!req.user) {
        return res.status(401).json({ success: false, error: 'Não autenticado' });
      }
      
      // Validar acesso: publisher só pode ver suas próprias faturas
      if (req.user.role === 'publisher' && billing.publisherId !== req.user.publisherId) {
        return res.status(403).json({
          success: false,
          error: 'Acesso negado',
          message: 'Você só pode visualizar suas próprias faturas'
        });
      }
      
      return res.json({
        success: true,
        data: billing
      });
    } catch (error: any) {
      await logError('Erro ao obter fatura', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao obter fatura',
        message: error.message || 'Erro interno do servidor'
      });
    }
  }
);

/**
 * @route POST /api/publisher-billing
 * @desc Criar nova fatura para publisher
 */
router.post('/',
  authorizeRole(['admin', 'gerente_financeiro']),
  body('publisherId').isInt({ min: 1 }),
  body('billingType').isIn(['revenue_share', 'payout', 'subscription', 'platform_fee']),
  body('amount').isFloat({ min: 0.01 }),
  body('direction').isIn(['incoming', 'outgoing']),
  body('currency').optional().isString(),
  body('description').optional().isString(),
  validateRequest,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const billing = await getPublisherBillingService().createBilling(req.body);
      
      return res.status(201).json({
        success: true,
        data: billing,
        message: 'Fatura criada com sucesso'
      });
    } catch (error: any) {
      await logError('Erro ao criar fatura', error);
      return res.status(400).json({
        success: false,
        error: 'Erro ao criar fatura',
        message: error.message || 'Erro interno do servidor'
      });
    }
  }
);

/**
 * @route PUT /api/publisher-billing/:id
 * @desc Atualizar fatura
 */
router.put('/:id',
  authorizeRole(['admin', 'gerente_financeiro']),
  param('id').isInt({ min: 1 }),
  validateRequest,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const billingId = parseInt(req.params.id);
      
      const billing = await getPublisherBillingService().updateBilling(billingId, req.body);
      
      return res.json({
        success: true,
        data: billing,
        message: 'Fatura atualizada com sucesso'
      });
    } catch (error: any) {
      await logError('Erro ao atualizar fatura', error);
      return res.status(400).json({
        success: false,
        error: 'Erro ao atualizar fatura',
        message: error.message || 'Erro interno do servidor'
      });
    }
  }
);

/**
 * @route POST /api/publisher-billing/:id/approve-payout
 * @desc Aprovar payout (apenas tenant users)
 */
router.post('/:id/approve-payout',
  authorizeRole(['admin', 'gerente_financeiro']),
  param('id').isInt({ min: 1 }),
  body('approvedBy').isInt({ min: 1 }),
  validateRequest,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const billingId = parseInt(req.params.id);
      const { approvedBy } = req.body;
      
      if (!req.user) {
        return res.status(401).json({ success: false, error: 'Não autenticado' });
      }
      
      // Validar que approvedBy é o usuário atual ou admin
      if (approvedBy !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          error: 'Acesso negado',
          message: 'Você só pode aprovar payouts como você mesmo'
        });
      }
      
      const billing = await getPublisherBillingService().approvePayout(billingId, approvedBy);
      
      return res.json({
        success: true,
        data: billing,
        message: 'Payout aprovado com sucesso'
      });
    } catch (error: any) {
      await logError('Erro ao aprovar payout', error);
      return res.status(400).json({
        success: false,
        error: 'Erro ao aprovar payout',
        message: error.message || 'Erro interno do servidor'
      });
    }
  }
);

export default router;

