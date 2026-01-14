/**
 * Subscriber Billing Routes - Smart Signage v2.1
 * Rotas para gerenciamento de billing de subscribers (anunciantes)
 */

import { Router, Response } from 'express';
import { SubscriberBillingService } from '../services/subscriberBillingService';
import { authMiddleware, AuthenticatedRequest, authorizeRole } from '../middleware/auth.middleware';
import { subscriberIsolationMiddleware } from '../middleware/subscriberIsolation.middleware';
import { validateRequest } from '../middleware/validation.middleware';
import { body, param, query } from 'express-validator';
import { logError } from '../utils/loggerHelper';

const router = Router();

// Middleware de autenticação para todas as rotas
router.use(authMiddleware);

// Aplicar isolamento de dados por subscriber
router.use(subscriberIsolationMiddleware);

// Lazy initialization
function getSubscriberBillingService(): SubscriberBillingService {
  if (!(global as any).subscriberBillingServiceInstance) {
    (global as any).subscriberBillingServiceInstance = new SubscriberBillingService();
  }
  return (global as any).subscriberBillingServiceInstance;
}

/**
 * @route GET /api/subscriber-billing
 * @desc Lista faturas de subscribers
 */
router.get('/',
  query('page').optional({ checkFalsy: true }).isInt({ min: 1 }),
  query('limit').optional({ checkFalsy: true }).isInt({ min: 1, max: 100 }),
  query('subscriberId').optional({ checkFalsy: true }).isInt({ min: 1 }),
  query('campaignId').optional({ checkFalsy: true }).isInt({ min: 1 }),
  // Frontend envia billingType/status como string vazia (billingType=&status=). checkFalsy evita 400.
  query('billingType').optional({ checkFalsy: true }).isIn(['advertisement', 'campaign', 'media_upload', 'exhibition_lot', 'totem_quantity', 'time_based', 'custom']),
  query('status').optional({ checkFalsy: true }).isIn(['pending', 'paid', 'overdue', 'cancelled']),
  validateRequest,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { page = 1, limit = 20, subscriberId, campaignId, billingType, status, startDate, endDate, search } = req.query;
      
      if (!req.user) {
        return res.status(401).json({ success: false, error: 'Não autenticado' });
      }
      
      // Se usuário é subscriber, só pode ver suas próprias faturas
      let finalSubscriberId: number | undefined;
      if (req.user.role === 'subscriber' || req.user.role === 'client') {
        finalSubscriberId = req.subscriberId || req.user.subscriberId;
        if (!finalSubscriberId) {
          return res.status(403).json({
            success: false,
            error: 'Acesso negado',
            message: 'Subscriber ID não identificado'
          });
        }
      } else {
        finalSubscriberId = subscriberId ? parseInt(subscriberId as string) : undefined;
      }
      
      const result = await getSubscriberBillingService().getBillings(
        parseInt(page as string),
        parseInt(limit as string),
        {
          subscriberId: finalSubscriberId,
          campaignId: campaignId ? parseInt(campaignId as string) : undefined,
          billingType: billingType as string,
          status: status as string,
          startDate: startDate as string,
          endDate: endDate as string,
          search: search as string
        }
      );

      // Mapear camelCase (service) -> snake_case (frontend)
      const mapped = {
        billings: (result.billings || []).map((b: any) => ({
          billing_id: b.billingId,
          subscriber_id: b.subscriberId,
          subscriber_name: b.subscriberName,
          campaign_id: b.campaignId,
          campaign_title: b.campaignTitle,
          billing_type: b.billingType,
          amount: b.amount,
          currency: b.currency,
          status: b.status,
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
      await logError('Erro ao listar faturas de subscribers', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao listar faturas',
        message: error.message || 'Erro interno do servidor'
      });
    }
  }
);

/**
 * @route GET /api/subscriber-billing/stats
 * @desc Obter estatísticas de billing de subscribers
 */
router.get('/stats',
  authorizeRole(['admin', 'gerente_financeiro']),
  query('subscriberId').optional().isInt({ min: 1 }),
  validateRequest,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { subscriberId, startDate, endDate } = req.query;
      
      const stats = await getSubscriberBillingService().getBillingStats({
        subscriberId: subscriberId ? parseInt(subscriberId as string) : undefined,
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
 * @route GET /api/subscriber-billing/:id
 * @desc Obter fatura por ID
 */
router.get('/:id',
  param('id').isInt({ min: 1 }),
  validateRequest,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const billingId = parseInt(req.params.id);
      
      const billing = await getSubscriberBillingService().getBillingById(billingId);
      
      if (!billing) {
        return res.status(404).json({
          success: false,
          error: 'Fatura não encontrada'
        });
      }
      
      if (!req.user) {
        return res.status(401).json({ success: false, error: 'Não autenticado' });
      }
      
      // Validar acesso: subscriber só pode ver suas próprias faturas
      if ((req.user.role === 'subscriber' || req.user.role === 'client') && billing.subscriberId !== req.subscriberId) {
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
 * @route POST /api/subscriber-billing
 * @desc Criar nova fatura para subscriber
 */
router.post('/',
  authorizeRole(['admin', 'gerente_financeiro']),
  body('subscriberId').isInt({ min: 1 }),
  body('billingType').isIn(['advertisement', 'campaign', 'media_upload', 'exhibition_lot', 'totem_quantity', 'time_based', 'custom']),
  body('amount').isFloat({ min: 0.01 }),
  body('currency').optional().isString(),
  body('description').optional().isString(),
  validateRequest,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const billing = await getSubscriberBillingService().createBilling(req.body);
      
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
 * @route PUT /api/subscriber-billing/:id
 * @desc Atualizar fatura
 */
router.put('/:id',
  authorizeRole(['admin', 'gerente_financeiro']),
  param('id').isInt({ min: 1 }),
  validateRequest,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const billingId = parseInt(req.params.id);
      
      const billing = await getSubscriberBillingService().updateBilling(billingId, req.body);
      
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

export default router;

