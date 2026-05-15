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
import { assertTenantClientParamAccess, resolvePublisherIdFromRequest } from '../utils/tenantClientAccess';
import { isAdminRole } from '../utils/tenantScope';
import { authorizeBillingManagement } from '../middleware/billingAuthorization.middleware';
import { TOTEMDIGITAL_COMPACT } from '../config/featureFlags';

const normRole = (r: string | undefined) => String(r || '').trim().toLowerCase();

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

      if (isAdminRole(req.user.role)) {
        finalPublisherId = publisherId ? parseInt(publisherId as string) : undefined;
      } else {
        const resolved = await resolvePublisherIdFromRequest(req);
        if (!resolved) {
          return res.status(403).json({
            success: false,
            error: 'Acesso negado',
            message: 'Publicador não identificado',
          });
        }
        finalPublisherId = resolved;
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
  authorizeRole(['admin', 'admin_sql', 'operador_faturamento', 'gerente_financeiro']),
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

      try {
        await assertTenantClientParamAccess(req, Number(billing.publisherId), {
          requestedIdIsPublisherScope: true,
        });
      } catch (e: any) {
        if (e?.statusCode === 403) {
          return res.status(403).json({
            success: false,
            error: 'Acesso negado',
            message: e.message || 'Você só pode visualizar faturas do seu escopo',
          });
        }
        throw e;
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
  authorizeBillingManagement,
  body('publisherId').isInt({ min: 1 }),
  body('billingType').isIn(['revenue_share', 'payout', 'subscription', 'platform_fee']),
  body('amount').isFloat({ min: 0.01 }),
  body('direction').isIn(['incoming', 'outgoing']),
  body('currency').optional({ nullable: true }).isString(),
  body('description').optional({ nullable: true }).isString(),
  validateRequest,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (TOTEMDIGITAL_COMPACT && normRole(req.user?.role) === 'publisher_user') {
        const resolved = await resolvePublisherIdFromRequest(req);
        if (!resolved || Number(req.body.publisherId) !== resolved) {
          return res.status(403).json({
            success: false,
            error: 'Acesso negado',
            message: 'No modo compacto só pode registar faturas do exibidor dono (publisherId do token).',
          });
        }
      }

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
  authorizeBillingManagement,
  param('id').isInt({ min: 1 }),
  validateRequest,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const billingId = parseInt(req.params.id);

      const existing = await getPublisherBillingService().getBillingById(billingId);
      if (!existing) {
        return res.status(404).json({
          success: false,
          error: 'Fatura não encontrada',
        });
      }

      if (TOTEMDIGITAL_COMPACT && normRole(req.user?.role) === 'publisher_user') {
        try {
          await assertTenantClientParamAccess(req, Number(existing.publisherId), {
            requestedIdIsPublisherScope: true,
          });
        } catch (e: any) {
          if (e?.statusCode === 403) {
            return res.status(403).json({
              success: false,
              error: 'Acesso negado',
              message: e.message || 'Sem permissão para alterar esta fatura',
            });
          }
          throw e;
        }
      }

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
  authorizeRole(['admin', 'admin_sql', 'operador_faturamento', 'gerente_financeiro']),
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
      
      // Validar que approvedBy é o usuário atual ou papel administrativo
      if (approvedBy !== req.user.id && !isAdminRole(req.user.role)) {
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

