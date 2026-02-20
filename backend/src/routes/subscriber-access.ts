/**
 * Subscriber Access Routes - Smart Signage v2.0
 * Rotas para gerenciar acesso de subscribers a publishers
 */

import { Router, Response } from 'express';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth.middleware';
import { authorizeRole } from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/validation.middleware';
import { param, query, body } from 'express-validator';
import { getSubscriberAccessServiceInstance } from '../services/subscriberAccessService';
import { logError, logInfo } from '../utils/loggerHelper';
import { getReconcileService } from '../services/reconcileService';

const router = Router();

// Middleware de autenticação para todas as rotas
router.use(authMiddleware);

/**
 * @route GET /api/subscriber-access
 * @desc Lista todos os acessos subscriber → publisher (admin only)
 * @access Private (Admin)
 */
router.get('/',
  authorizeRole(['admin', 'admin_sql']),
  query('subscriberId').optional().isInt({ min: 1 }),
  query('publisherId').optional().isInt({ min: 1 }),
  query('contractId').optional().isInt({ min: 1 }),
  query('planId').optional().isInt({ min: 1 }),
  query('isActive').optional().isBoolean(),
  validateRequest,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const accessService = getSubscriberAccessServiceInstance();
      const access = await accessService.getAllSubscriberPublisherAccess({
        subscriberId: req.query.subscriberId ? parseInt(req.query.subscriberId as string) : undefined,
        publisherId: req.query.publisherId ? parseInt(req.query.publisherId as string) : undefined,
        contractId: req.query.contractId ? parseInt(req.query.contractId as string) : undefined,
        planId: req.query.planId ? parseInt(req.query.planId as string) : undefined,
        isActive: req.query.isActive === 'true' ? true : req.query.isActive === 'false' ? false : undefined
      });

      return res.json({
        success: true,
        data: access
      });
    } catch (error: any) {
      await logError('Erro ao listar acessos', error);
      return res.status(500).json({
        success: false,
        error: 'Erro interno do servidor'
      });
    }
  }
);

/**
 * @route GET /api/subscriber-access/plan-publisher
 * @desc Lista configurações de plan_publisher_access (admin only)
 * @access Private (Admin)
 */
router.get('/plan-publisher',
  authorizeRole(['admin', 'admin_sql']),
  query('planId').optional().isInt({ min: 1 }),
  query('publisherId').optional().isInt({ min: 1 }),
  validateRequest,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const accessService = getSubscriberAccessServiceInstance();
      const access = await accessService.getPlanPublisherAccess({
        planId: req.query.planId ? parseInt(req.query.planId as string) : undefined,
        publisherId: req.query.publisherId ? parseInt(req.query.publisherId as string) : undefined
      });

      return res.json({
        success: true,
        data: access
      });
    } catch (error: any) {
      await logError('Erro ao listar acesso plano → publisher', error);
      return res.status(500).json({
        success: false,
        error: 'Erro interno do servidor'
      });
    }
  }
);

/**
 * @route POST /api/subscriber-access/reconcile
 * @desc Endpoint admin para disparar reconciliação global ou por plan (body: { planId?: number })
 * @access Private (Admin)
 */
router.post('/reconcile',
  authorizeRole(['admin', 'admin_sql']),
  body('planId').optional().isInt({ min: 1 }),
  validateRequest,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const planId = req.body.planId ? parseInt(req.body.planId as any) : undefined;
      const reconcileService = getReconcileService();
      if (planId) {
        await reconcileService.reconcilePlan(planId);
        return res.json({ success: true, message: `Reconciliação executada para plan_id=${planId}` });
      } else {
        await reconcileService.reconcileAll();
        return res.json({ success: true, message: 'Reconciliação global executada' });
      }
    } catch (error: any) {
      await logError('Erro ao executar reconciliação via endpoint', error);
      return res.status(500).json({ success: false, error: error.message || 'Erro interno' });
    }
  }
);

/**
 * @route POST /api/subscriber-access/plan-publisher
 * @desc Configura acesso de plano a publisher (admin only)
 * @access Private (Admin)
 */
router.post('/plan-publisher',
  authorizeRole(['admin', 'admin_sql']),
  body('planId').isInt({ min: 1 }),
  body('publisherId').isInt({ min: 1 }),
  body('isAllowed').isBoolean(),
  body('restrictions').optional().isObject(),
  body('notes').optional().isString(),
  validateRequest,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { planId, publisherId, isAllowed, restrictions, notes } = req.body;
      const accessService = getSubscriberAccessServiceInstance();
      
      await accessService.setPlanPublisherAccess(planId, publisherId, isAllowed, restrictions);
      
      // Enfileirar reconcile para aplicar mudanças imediatamente
      try {
        await accessService.enqueueReconcile(planId, publisherId);
      } catch (_e) {
        // log only, don't fail request
        await logError('Falha ao enfileirar reconcile (não crítico)', _e);
      }
      
      // Atualizar notes se fornecido
      if (notes !== undefined) {
        await accessService.updatePlanPublisherAccessNotes(planId, publisherId, notes);
      }

      // Disparar reconciliação para o plano alterado (sincrono; é rápido se a função for eficiente)
      try {
        const { getReconcileService } = require('../services/reconcileService');
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const reconcileService = getReconcileService();
        await reconcileService.reconcilePlan(planId);
      } catch (reconcileErr: any) {
        // Log e continuar — não falhar a requisição por causa da reconciliação
        await logInfo('Reconciliação do plan_publisher_access falhou (registrado)', { planId, error: reconcileErr?.message || reconcileErr });
      }

      await logInfo('Acesso plano → publisher configurado', {
        planId,
        publisherId,
        isAllowed,
        configuredBy: req.user?.id
      });

      return res.json({
        success: true,
        message: 'Acesso configurado com sucesso'
      });
    } catch (error: any) {
      await logError('Erro ao configurar acesso plano → publisher', error, req.body);
      return res.status(400).json({
        success: false,
        error: error.message || 'Erro ao configurar acesso'
      });
    }
  }
);

/**
 * @route POST /api/subscriber-access/plan-publisher/reconcile
 * @desc Dispara processamento imediato dos jobs de reconciliação (admin only)
 * @access Private (Admin)
 */
router.post('/plan-publisher/reconcile',
  authorizeRole(['admin', 'admin_sql']),
  validateRequest,
  async (_req: AuthenticatedRequest, res: Response) => {
    try {
      const reconcileService = require('../services/reconcileService').getReconcileService();
      const results = await reconcileService.processNow(100);
      return res.json({
        success: true,
        message: 'Reconciliação iniciada',
        results
      });
    } catch (error: any) {
      await logError('Erro ao iniciar reconciliação', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Erro ao iniciar reconciliação'
      });
    }
  }
);

/**
 * @route DELETE /api/subscriber-access/plan-publisher/:planId/:publisherId
 * @desc Remove acesso de plano a publisher (admin only)
 * @access Private (Admin)
 */
router.delete('/plan-publisher/:planId/:publisherId',
  authorizeRole(['admin', 'admin_sql']),
  param('planId').isInt({ min: 1 }),
  param('publisherId').isInt({ min: 1 }),
  validateRequest,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const planId = parseInt(req.params.planId);
      const publisherId = parseInt(req.params.publisherId);
      const accessService = getSubscriberAccessServiceInstance();
      
      await accessService.removePlanPublisherAccess(planId, publisherId);

      await logInfo('Acesso plano → publisher removido', {
        planId,
        publisherId,
        removedBy: req.user?.id
      });
      // Disparar reconciliação para o plano alterado
      try {
        const { getReconcileService } = require('../services/reconcileService');
        const reconcileService = getReconcileService();
        await reconcileService.reconcilePlan(planId);
      } catch (reconcileErr: any) {
        await logInfo('Reconciliação do plan_publisher_access falhou (registrado)', { planId, error: reconcileErr?.message || reconcileErr });
      }

      return res.json({
        success: true,
        message: 'Acesso removido com sucesso'
      });
    } catch (error: any) {
      await logError('Erro ao remover acesso plano → publisher', error, {
        planId: req.params.planId,
        publisherId: req.params.publisherId
      });
      return res.status(400).json({
        success: false,
        error: error.message || 'Erro ao remover acesso'
      });
    }
  }
);

/**
 * @route GET /api/subscriber-access/:subscriberId/publishers
 * @desc Lista publishers acessíveis por um subscriber
 * @access Private
 */
router.get('/:subscriberId/publishers',
  param('subscriberId').isInt({ min: 1 }),
  validateRequest,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const subscriberId = parseInt(req.params.subscriberId);
      const userRole = req.user?.role;
      const userSubscriberId = req.user?.subscriberId;
      const isAdmin = userRole === 'admin' || userRole === 'admin_sql';

      // Validar acesso: subscriber só pode ver seus próprios publishers
      if (!isAdmin && userSubscriberId !== subscriberId) {
        return res.status(403).json({
          success: false,
          error: 'Acesso negado: Você só pode ver publishers do seu próprio subscriber'
        });
      }

      const accessService = getSubscriberAccessServiceInstance();
      const publishers = await accessService.getAccessiblePublishersWithDetails(subscriberId);

      return res.json({
        success: true,
        data: publishers
      });
    } catch (error: any) {
      await logError('Erro ao buscar publishers acessíveis', error, {
        subscriberId: req.params.subscriberId
      });
      return res.status(500).json({
        success: false,
        error: 'Erro interno do servidor'
      });
    }
  }
);

/**
 * @route GET /api/subscriber-access/:subscriberId/publishers/:publisherId/check
 * @desc Verifica se subscriber tem acesso a um publisher
 * @access Private
 */
router.get('/:subscriberId/publishers/:publisherId/check',
  param('subscriberId').isInt({ min: 1 }),
  param('publisherId').isInt({ min: 1 }),
  validateRequest,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const subscriberId = parseInt(req.params.subscriberId);
      const publisherId = parseInt(req.params.publisherId);
      const userRole = req.user?.role;
      const userSubscriberId = req.user?.subscriberId;
      const isAdmin = userRole === 'admin' || userRole === 'admin_sql';

      // Validar acesso
      if (!isAdmin && userSubscriberId !== subscriberId) {
        return res.status(403).json({
          success: false,
          error: 'Acesso negado'
        });
      }

      const accessService = getSubscriberAccessServiceInstance();
      const hasAccess = await accessService.hasAccess(subscriberId, publisherId);

      return res.json({
        success: true,
        hasAccess
      });
    } catch (error: any) {
      await logError('Erro ao verificar acesso', error, {
        subscriberId: req.params.subscriberId,
        publisherId: req.params.publisherId
      });
      return res.status(500).json({
        success: false,
        error: 'Erro interno do servidor'
      });
    }
  }
);

/**
 * @route POST /api/subscriber-access/grant
 * @desc Concede acesso de subscriber a publisher (admin only)
 * @access Private (Admin)
 */
router.post('/grant',
  authorizeRole(['admin', 'admin_sql']),
  body('subscriberId').isInt({ min: 1 }),
  body('publisherId').isInt({ min: 1 }),
  body('contractId').isInt({ min: 1 }),
  body('expiresAt').optional().isISO8601(),
  body('notes').optional().isString(),
  validateRequest,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { subscriberId, publisherId, contractId, expiresAt, notes } = req.body;
      const grantedBy = req.user?.id;

      if (!grantedBy) {
        return res.status(401).json({
          success: false,
          error: 'Usuário não autenticado'
        });
      }

      const accessService = getSubscriberAccessServiceInstance();
      const access = await accessService.grantAccess(
        subscriberId,
        publisherId,
        contractId,
        grantedBy,
        expiresAt ? new Date(expiresAt) : undefined,
        notes
      );

      await logInfo('Acesso subscriber → publisher concedido', {
        subscriberId,
        publisherId,
        contractId,
        grantedBy
      });

      return res.json({
        success: true,
        data: access
      });
    } catch (error: any) {
      await logError('Erro ao conceder acesso', error, req.body);
      return res.status(400).json({
        success: false,
        error: error.message || 'Erro ao conceder acesso'
      });
    }
  }
);

/**
 * @route POST /api/subscriber-access/:subscriberId/publishers/:publisherId/revoke
 * @desc Revoga acesso de subscriber a publisher (admin only)
 * @access Private (Admin)
 */
router.post('/:subscriberId/publishers/:publisherId/revoke',
  authorizeRole(['admin', 'admin_sql']),
  param('subscriberId').isInt({ min: 1 }),
  param('publisherId').isInt({ min: 1 }),
  body('reason').optional().isString(),
  validateRequest,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const subscriberId = parseInt(req.params.subscriberId);
      const publisherId = parseInt(req.params.publisherId);
      const reason = req.body.reason;
      const revokedBy = req.user?.id;

      if (!revokedBy) {
        return res.status(401).json({
          success: false,
          error: 'Usuário não autenticado'
        });
      }

      const accessService = getSubscriberAccessServiceInstance();
      await accessService.revokeAccess(subscriberId, publisherId, revokedBy, reason);

      await logInfo('Acesso subscriber → publisher revogado', {
        subscriberId,
        publisherId,
        revokedBy,
        reason
      });

      return res.json({
        success: true,
        message: 'Acesso revogado com sucesso'
      });
    } catch (error: any) {
      await logError('Erro ao revogar acesso', error, {
        subscriberId: req.params.subscriberId,
        publisherId: req.params.publisherId
      });
      return res.status(400).json({
        success: false,
        error: error.message || 'Erro ao revogar acesso'
      });
    }
  }
);

/**
 * @route GET /api/subscriber-access/expiring
 * @desc Lista acessos expirando (admin only)
 * @access Private (Admin)
 */
router.get('/expiring',
  authorizeRole(['admin', 'admin_sql']),
  query('days').optional().isInt({ min: 1, max: 365 }),
  validateRequest,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const days = req.query.days ? parseInt(req.query.days as string) : 30;
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() + days);

      const accessService = getSubscriberAccessServiceInstance();
      const expiringAccess = await accessService.getAllSubscriberPublisherAccess({
        isActive: true,
      });

      // Filtrar apenas os que expiram no período especificado
      const filtered = expiringAccess.filter((access: any) => {
        if (!access.expires_at) return false;
        const expiryDate = new Date(access.expires_at);
        const now = new Date();
        const daysUntilExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        return expiryDate > now && daysUntilExpiry <= days;
      });

      // Ordenar por data de expiração
      filtered.sort((a: any, b: any) => {
        const dateA = new Date(a.expires_at).getTime();
        const dateB = new Date(b.expires_at).getTime();
        return dateA - dateB;
      });

      return res.json({
        success: true,
        data: filtered,
        summary: {
          total: filtered.length,
          expiringIn7Days: filtered.filter((a: any) => {
            const daysUntil = Math.ceil((new Date(a.expires_at).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
            return daysUntil <= 7;
          }).length,
          expiringIn15Days: filtered.filter((a: any) => {
            const daysUntil = Math.ceil((new Date(a.expires_at).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
            return daysUntil <= 15 && daysUntil > 7;
          }).length,
          expiringIn30Days: filtered.filter((a: any) => {
            const daysUntil = Math.ceil((new Date(a.expires_at).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
            return daysUntil <= 30 && daysUntil > 15;
          }).length,
        },
      });
    } catch (error: any) {
      await logError('Erro ao listar acessos expirando', error);
      return res.status(500).json({
        success: false,
        error: 'Erro interno do servidor',
      });
    }
  }
);

export default router;

