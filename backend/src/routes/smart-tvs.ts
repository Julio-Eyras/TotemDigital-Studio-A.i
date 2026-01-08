/**
 * Smart TV Routes - Smart Signage v2.1
 * Rotas para gerenciamento de Smart TVs (controladas pelos totens)
 */

import { Router, Response } from 'express';
import { getSmartTvService } from '../services/smartTvService';
import { authMiddleware, AuthenticatedRequest, authorizeRole } from '../middleware/auth.middleware';
import { requireFlag } from '../middleware/flagAuth.middleware';
import { param, query, body, validationResult } from 'express-validator';
import { logError } from '../utils/loggerHelper';

const router = Router();

// Middleware de autenticação para todas as rotas
router.use(authMiddleware);

// Validações
const createSmartTvValidator = [
  body('totem_id').notEmpty().isInt({ min: 1 }).withMessage('totem_id é obrigatório'),
  body('contract_id').optional().isInt({ min: 1 }).withMessage('Contract ID inválido (opcional, para rastreabilidade)'),
  body('identifier').notEmpty().isString().withMessage('identifier é obrigatório'),
  body('device_id').optional().isString(),
  body('name').optional().isString(),
  body('brand').optional().isString(),
  body('model').optional().isString(),
  body('platform').optional().isString(),
  body('firmware_version').optional().isString(),
  body('resolution_width').optional().isInt({ min: 1 }),
  body('resolution_height').optional().isInt({ min: 1 }),
  body('orientation').optional().isIn(['landscape', 'portrait']),
  body('capabilities').optional(),
  body('settings').optional(),
];

const updateSmartTvValidator = [
  body('identifier').optional().isString(),
  body('device_id').optional().isString(),
  body('name').optional().isString(),
  body('brand').optional().isString(),
  body('model').optional().isString(),
  body('platform').optional().isString(),
  body('firmware_version').optional().isString(),
  body('resolution_width').optional().isInt({ min: 1 }),
  body('resolution_height').optional().isInt({ min: 1 }),
  body('orientation').optional().isIn(['landscape', 'portrait']),
  body('status').optional().isString(),
  body('capabilities').optional(),
  body('settings').optional(),
  body('is_active').optional().isBoolean(),
];

const validateRequest = (req: any, res: any, next: any) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Dados inválidos',
      details: errors.array()
    });
  }
  return next();
};

/**
 * @route GET /api/smart-tvs
 * @desc Listar todas as Smart TVs
 * @access Private 
 *   - Admins/Owners: Requer flag_smart_0
 *   - Publishers/Subscribers: Podem ver suas próprias Smart TVs sem flag obrigatória
 */
router.get('/',
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('search').optional().isString(),
  query('totemId').optional().isInt({ min: 1 }),
  query('publisherId').optional().isInt({ min: 1 }),
  query('active_only').optional().isBoolean(),
  validateRequest,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      // NOVO: Verificar permissões baseado em userType
      const userType = req.user?.userType;
      const userRole = req.user?.role;
      const isPublisher = userType === 'publisher_user' || userType === 'publisher_subscriber';
      const isSubscriber = userType === 'subscriber_user';
      const isOwnerOrAdminSql = userRole === 'owner_system' || userRole === 'admin_sql';
      const isAdmin = userRole === 'admin';
      
      // Publishers e subscribers podem acessar suas próprias Smart TVs sem flag
      // Owner_system e admin_sql têm acesso total (sem verificação de flag)
      // Admin comum precisa de flag_smart_0 para acesso técnico
      // Outros system users precisam de flag_smart_0
      if (!isPublisher && !isSubscriber && !isOwnerOrAdminSql) {
        // Verificar flag para admins comuns e outros system users
        if (!req.user?.flags?.flag_smart_0) {
          return res.status(403).json({
            error: 'Acesso negado: Requer flag_smart_0 para acesso técnico'
          });
        }
      }

      const { page = 1, limit = 10, search, totemId, publisherId, active_only } = req.query;
      
      // Determinar publisherId do usuário (se não for admin/owner)
      const requestPublisherId = req.user?.publisherId || undefined;

      const result = await getSmartTvService().getAllSmartTvs({
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        search: search as string,
        totemId: totemId ? parseInt(totemId as string) : undefined,
        publisherId: publisherId ? parseInt(publisherId as string) : undefined,
        active_only: active_only === 'true' || active_only === undefined,
      }, requestPublisherId, isAdmin);
      
      return res.json(result);
    } catch (error: any) {
      await logError('Erro ao listar Smart TVs', error);
      return res.status(500).json({ error: error.message || 'Erro interno do servidor' });
    }
  }
);

/**
 * @route GET /api/smart-tvs/totem/:totemId
 * @desc Listar Smart TVs de um totem (relação 1:N - um totem pode ter múltiplas TVs)
 * @access Private (requer flag_smart_0 - acesso técnico)
 */
router.get('/totem/:totemId',
  requireFlag('flag_smart_0'),
  param('totemId').isInt({ min: 1 }),
  validateRequest,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { totemId } = req.params;
      
      const isAdmin = req.user?.role === 'admin' || req.user?.role === 'owner_system' || req.user?.role === 'admin_sql';
      const requestPublisherId = req.user?.publisherId || undefined;

      const smartTvs = await getSmartTvService().getSmartTvsByTotem(parseInt(totemId), requestPublisherId, isAdmin);
      
      return res.json({ success: true, data: smartTvs });
    } catch (error: any) {
      await logError('Erro ao listar Smart TVs do totem', error);
      if (error.message.includes('Acesso negado')) {
        return res.status(403).json({ error: error.message });
      }
      return res.status(500).json({ error: error.message || 'Erro interno do servidor' });
    }
  }
);

/**
 * @route GET /api/smart-tvs/:id
 * @desc Obter Smart TV por ID
 * @access Private (requer flag_smart_0 - acesso técnico)
 */
router.get('/:id',
  requireFlag('flag_smart_0'),
  param('id').isInt({ min: 1 }),
  validateRequest,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      
      const isAdmin = req.user?.role === 'admin' || req.user?.role === 'owner_system' || req.user?.role === 'admin_sql';
      const requestPublisherId = req.user?.publisherId || undefined;

      const smartTv = await getSmartTvService().getSmartTvById(parseInt(id), requestPublisherId, isAdmin);
      
      if (!smartTv) {
        return res.status(404).json({ error: 'Smart TV não encontrada' });
      }

      return res.json({ success: true, data: smartTv });
    } catch (error: any) {
      await logError('Erro ao obter Smart TV', error);
      if (error.message.includes('Acesso negado')) {
        return res.status(403).json({ error: error.message });
      }
      return res.status(500).json({ error: error.message || 'Erro interno do servidor' });
    }
  }
);

/**
 * @route POST /api/smart-tvs
 * @desc Criar nova Smart TV (um totem pode ter múltiplas TVs - relação 1:N)
 * @access Private (Apenas roles administrativos - baseado em contrato)
 */
router.post('/',
  authorizeRole(['admin', 'admin_sql', 'owner_system', 'operador_faturamento', 'operador_comercial']),
  createSmartTvValidator,
  validateRequest,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { totem_id, contract_id, identifier, device_id, name, brand, model, platform, firmware_version, resolution_width, resolution_height, orientation, capabilities, settings } = req.body;
      
      if (!req.user?.id) {
        return res.status(401).json({ error: 'Usuário não autenticado' });
      }

      const isAdmin = req.user.role === 'admin' || req.user.role === 'owner_system' || req.user.role === 'admin_sql';
      const requestPublisherId = req.user?.publisherId || undefined;

      const newSmartTv = await getSmartTvService().createSmartTv({
        totem_id,
        contract_id, // Opcional - para rastreabilidade
        identifier,
        device_id,
        name,
        brand,
        model,
        platform,
        firmware_version,
        resolution_width,
        resolution_height,
        orientation,
        capabilities,
        settings,
      }, req.user.id, requestPublisherId, isAdmin);
      
      return res.status(201).json({ success: true, data: newSmartTv });
    } catch (error: any) {
      await logError('Erro ao criar Smart TV', error);
      if (error.message.includes('Acesso negado')) {
        return res.status(403).json({ error: error.message });
      }
      return res.status(400).json({ error: error.message || 'Erro interno do servidor' });
    }
  }
);

/**
 * @route PUT /api/smart-tvs/:id
 * @desc Atualizar Smart TV
 * @access Private (Admin, Owner System - requer flag_smart_0)
 */
router.put('/:id',
  requireFlag('flag_smart_0'),
  authorizeRole(['admin', 'owner_system', 'admin_sql']),
  param('id').isInt({ min: 1 }),
  updateSmartTvValidator,
  validateRequest,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { identifier, device_id, name, brand, model, platform, firmware_version, resolution_width, resolution_height, orientation, status, capabilities, settings, is_active } = req.body;
      
      if (!req.user?.id) {
        return res.status(401).json({ error: 'Usuário não autenticado' });
      }

      const isAdmin = req.user.role === 'admin' || req.user.role === 'owner_system' || req.user.role === 'admin_sql';
      const requestPublisherId = req.user?.publisherId || undefined;

      const updatedSmartTv = await getSmartTvService().updateSmartTv(
        parseInt(id),
        {
          identifier,
          device_id,
          name,
          brand,
          model,
          platform,
          firmware_version,
          resolution_width,
          resolution_height,
          orientation,
          status,
          capabilities,
          settings,
          is_active,
        },
        req.user.id,
        requestPublisherId,
        isAdmin
      );
      
      return res.json({ success: true, data: updatedSmartTv });
    } catch (error: any) {
      await logError('Erro ao atualizar Smart TV', error);
      if (error.message.includes('Acesso negado')) {
        return res.status(403).json({ error: error.message });
      }
      return res.status(400).json({ error: error.message || 'Erro interno do servidor' });
    }
  }
);

/**
 * @route DELETE /api/smart-tvs/:id
 * @desc Deletar Smart TV (soft delete)
 * @access Private (Admin, Owner System - requer flag_smart_0)
 */
router.delete('/:id',
  requireFlag('flag_smart_0'),
  authorizeRole(['admin', 'owner_system', 'admin_sql']),
  param('id').isInt({ min: 1 }),
  validateRequest,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      
      if (!req.user?.id) {
        return res.status(401).json({ error: 'Usuário não autenticado' });
      }

      const isAdmin = req.user.role === 'admin' || req.user.role === 'owner_system' || req.user.role === 'admin_sql';
      const requestPublisherId = req.user?.publisherId || undefined;

      await getSmartTvService().deleteSmartTv(parseInt(id), req.user.id, requestPublisherId, isAdmin);
      
      return res.json({ success: true, message: 'Smart TV deletada com sucesso' });
    } catch (error: any) {
      await logError('Erro ao deletar Smart TV', error);
      if (error.message.includes('Acesso negado')) {
        return res.status(403).json({ error: error.message });
      }
      return res.status(400).json({ error: error.message || 'Erro interno do servidor' });
    }
  }
);

export default router;

