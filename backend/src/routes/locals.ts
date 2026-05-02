/**
 * Local Routes - Smart Signage v2.1
 * Rotas para gerenciamento de locals (locais físicos dos publishers)
 */

import { Router, Response } from 'express';
import { getLocalService } from '../services/localService';
import { authMiddleware, AuthenticatedRequest, authorizeRole } from '../middleware/auth.middleware';
import { param, query, body, validationResult } from 'express-validator';
import { logError } from '../utils/loggerHelper';
import { errorResponse } from '../utils/apiResponse';
import { TOTEMDIGITAL_COMPACT } from '../config/featureFlags';

const router = Router();

// Middleware de autenticação para todas as rotas
router.use(authMiddleware);

const isAdminRole = (role?: string) =>
  [
    'admin',
    'admin_sql',
    'owner_system',
    'operador_tecnico',
    'operador_faturamento',
    'operador_comercial',
    'gerente_marketing',
  ].includes(role || '');

const getLocalsWriteRoles = () =>
  TOTEMDIGITAL_COMPACT
    ? [
        'admin',
        'admin_sql',
        'owner_system',
        'gerente_marketing',
        'operador_tecnico',
        'operador_faturamento',
        'operador_comercial',
      ]
    : ['admin', 'admin_sql', 'owner_system', 'operador_faturamento', 'operador_comercial'];

const getLocalsUpdateRoles = () =>
  TOTEMDIGITAL_COMPACT
    ? [
        'admin',
        'admin_sql',
        'owner_system',
        'publisher_user',
        'gerente_marketing',
        'operador_tecnico',
        'operador_faturamento',
        'operador_comercial',
      ]
    : ['admin', 'admin_sql', 'owner_system', 'operador_faturamento', 'operador_comercial'];

// Validações
const createLocalValidator = [
  // Em modo compacto o backend resolve publisher_id pelo owner.
  body('publisher_id').optional().isInt({ min: 1 }).withMessage('publisher_id inválido'),
  body('contract_id').optional().isInt({ min: 1 }).withMessage('Contract ID inválido (opcional, para rastreabilidade)'),
  body('name').notEmpty().isString().withMessage('Nome é obrigatório'),
  body('category_segment').optional().isString(),
  body('address').optional().isString(),
  body('city').optional().isString(),
  body('state').optional().isString(),
  body('zip_code').optional().isString(),
  body('country').optional().isString(),
  body('latitude').optional().isFloat(),
  body('longitude').optional().isFloat(),
  body('timezone').optional().isString(),
  body('description').optional().isString(),
];

const updateLocalValidator = [
  body('name').optional().isString(),
  body('category_segment').optional().isString(),
  body('address').optional().isString(),
  body('city').optional().isString(),
  body('state').optional().isString(),
  body('zip_code').optional().isString(),
  body('country').optional().isString(),
  body('latitude').optional().isFloat(),
  body('longitude').optional().isFloat(),
  body('timezone').optional().isString(),
  body('description').optional().isString(),
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
 * @route GET /api/locals
 * @desc Listar todos os locals
 * @access Private (Admin, Publisher)
 */
router.get('/',
  query('page').optional().isInt({ min: 1 }),
  // Frontend pode solicitar listagem completa (ex.: agrupamento por publisher)
  query('limit').optional().isInt({ min: 1, max: 10000 }),
  query('search').optional().isString(),
  query('publisherId').optional().isInt({ min: 1 }),
  query('active_only').optional().isBoolean(),
  validateRequest,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { page = 1, limit = 10, search, publisherId, active_only } = req.query;
      
      // Determinar publisherId do usuário (se não for admin)
      const isAdmin = isAdminRole(req.user?.role);
      const requestPublisherId = req.user?.publisherId || undefined;

      const result = await getLocalService().getAllLocals({
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        search: search as string,
        publisherId: publisherId ? parseInt(publisherId as string) : undefined,
        active_only: active_only === 'true' || active_only === undefined,
      }, requestPublisherId, isAdmin);
      
      return res.json(result);
    } catch (error: any) {
      await logError('Erro ao listar locals', error);
      if ((error?.message || '').includes('Acesso negado') || (error?.message || '').includes('Modo compacto')) {
        return res.status(403).json(errorResponse(error.message || 'Acesso negado'));
      }
      return res.status(500).json(errorResponse('Erro interno do servidor', error.message));
    }
  }
);

/**
 * @route GET /api/locals/stats
 * @desc Contagem de totens e Smart TVs por local (query: localIds=1,2,3)
 */
router.get('/stats',
  query('localIds').notEmpty().withMessage('localIds é obrigatório (ex: 1,2,3)'),
  validateRequest,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const localIdsStr = req.query.localIds as string;
      const localIds = localIdsStr.split(',').map((id) => parseInt(id.trim(), 10)).filter((n) => !isNaN(n));
      if (localIds.length === 0) return res.json({});
      const isAdmin = isAdminRole(req.user?.role);
      const requestPublisherId = req.user?.publisherId || undefined;
      const stats = await getLocalService().getLocalStats(localIds, requestPublisherId, isAdmin);
      return res.json(stats);
    } catch (error: any) {
      logError('Erro ao buscar stats dos locais', error);
      if ((error?.message || '').includes('Acesso negado') || (error?.message || '').includes('Modo compacto')) {
        return res.status(403).json(errorResponse(error.message || 'Acesso negado'));
      }
      return res.status(500).json(errorResponse('Erro ao buscar estatísticas', error.message));
    }
  }
);

/**
 * @route GET /api/locals/:id
 * @desc Obter local por ID
 * @access Private (Admin, Publisher)
 */
router.get('/:id',
  param('id').isInt({ min: 1 }),
  validateRequest,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      
      const isAdmin = isAdminRole(req.user?.role);
      const requestPublisherId = req.user?.publisherId || undefined;

      const local = await getLocalService().getLocalById(parseInt(id), requestPublisherId, isAdmin);
      
      if (!local) {
        return res.status(404).json(errorResponse('Local não encontrado'));
      }

      return res.json({ success: true, data: local });
    } catch (error: any) {
      await logError('Erro ao obter local', error);
      if (error.message.includes('Acesso negado')) {
        return res.status(403).json(errorResponse(error.message || 'Acesso negado'));
      }
      return res.status(500).json(errorResponse('Erro interno do servidor', error.message));
    }
  }
);

/**
 * @route POST /api/locals
 * @desc Criar novo local
 * @access Private (Apenas roles administrativos - baseado em contrato)
 */
router.post('/',
  authorizeRole(getLocalsWriteRoles()),
  createLocalValidator,
  validateRequest,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { publisher_id, contract_id, name, category_segment, address, city, state, zip_code, country, latitude, longitude, timezone, description } = req.body;
      
      // Fora do compacto, publisher_id é obrigatório.
      if (!TOTEMDIGITAL_COMPACT && !publisher_id) {
        return res.status(400).json({
          error: 'Dados inválidos',
          details: [{ msg: 'publisher_id é obrigatório. Locais pertencem apenas a publishers.' }]
        });
      }
      
      if (!req.user?.id) {
        return res.status(401).json(errorResponse('Usuário não autenticado'));
      }

      const isAdmin = isAdminRole(req.user?.role);
      const requestPublisherId = req.user?.publisherId || undefined;

      const newLocal = await getLocalService().createLocal({
        publisher_id,
        contract_id, // Opcional - para rastreabilidade
        name,
        category_segment,
        address,
        city,
        state,
        zip_code,
        country,
        latitude,
        longitude,
        timezone,
        description,
      }, req.user.id, requestPublisherId, isAdmin);
      
      return res.status(201).json({ success: true, data: newLocal });
    } catch (error: any) {
      await logError('Erro ao criar local', error);
      if (error.message.includes('Acesso negado')) {
        return res.status(403).json(errorResponse(error.message || 'Acesso negado'));
      }
      return res.status(400).json(errorResponse('Erro na operação', error.message));
    }
  }
);

/**
 * @route PUT /api/locals/:id
 * @desc Atualizar local
 * @access Private (Admin only)
 */
router.put('/:id',
  authorizeRole(getLocalsUpdateRoles()),
  param('id').isInt({ min: 1 }),
  updateLocalValidator,
  validateRequest,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { name, category_segment, address, city, state, zip_code, country, latitude, longitude, timezone, description, is_active } = req.body;
      
      if (!req.user?.id) {
        return res.status(401).json(errorResponse('Usuário não autenticado'));
      }

      const isAdmin = isAdminRole(req.user?.role);
      const requestPublisherId = req.user?.publisherId || undefined;

      const updatedLocal = await getLocalService().updateLocal(
        parseInt(id),
        {
          name,
          category_segment,
          address,
          city,
          state,
          zip_code,
          country,
          latitude,
          longitude,
          timezone,
          description,
          is_active,
        },
        req.user.id,
        requestPublisherId,
        isAdmin
      );
      
      return res.json({ success: true, data: updatedLocal });
    } catch (error: any) {
      await logError('Erro ao atualizar local', error);
      if (error.message.includes('Acesso negado')) {
        return res.status(403).json(errorResponse(error.message || 'Acesso negado'));
      }
      return res.status(400).json(errorResponse('Erro na operação', error.message));
    }
  }
);

/**
 * @route DELETE /api/locals/:id
 * @desc Deletar local (soft delete)
 * @access Private (Admin only)
 */
router.delete('/:id',
  authorizeRole(getLocalsWriteRoles()),
  param('id').isInt({ min: 1 }),
  validateRequest,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      
      if (!req.user?.id) {
        return res.status(401).json(errorResponse('Usuário não autenticado'));
      }

      const isAdmin = isAdminRole(req.user?.role);
      const requestPublisherId = req.user?.publisherId || undefined;

      await getLocalService().deleteLocal(parseInt(id), req.user.id, requestPublisherId, isAdmin);
      
      return res.json({ success: true, message: 'Local deletado com sucesso' });
    } catch (error: any) {
      await logError('Erro ao deletar local', error);
      if (error.message.includes('Acesso negado')) {
        return res.status(403).json(errorResponse(error.message || 'Acesso negado'));
      }
      return res.status(400).json(errorResponse('Erro na operação', error.message));
    }
  }
);

/**
 * @route GET /api/locals/:id/totems
 * @desc Listar totens de um local
 * @access Private (Admin, Publisher)
 */
router.get('/:id/totems',
  param('id').isInt({ min: 1 }),
  validateRequest,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      
      const isAdmin = isAdminRole(req.user?.role);
      const requestPublisherId = req.user?.publisherId || undefined;

      const totems = await getLocalService().getTotemsByLocal(parseInt(id), requestPublisherId, isAdmin);
      
      return res.json({ success: true, data: totems });
    } catch (error: any) {
      await logError('Erro ao listar totens do local', error);
      if (error.message.includes('Acesso negado')) {
        return res.status(403).json(errorResponse(error.message || 'Acesso negado'));
      }
      return res.status(500).json(errorResponse('Erro interno do servidor', error.message));
    }
  }
);

export default router;

