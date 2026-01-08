/**
 * Local Routes - Smart Signage v2.1
 * Rotas para gerenciamento de locals (locais físicos dos publishers)
 */

import { Router, Response } from 'express';
import { getLocalService } from '../services/localService';
import { authMiddleware, AuthenticatedRequest, authorizeRole } from '../middleware/auth.middleware';
import { param, query, body, validationResult } from 'express-validator';
import { logError } from '../utils/loggerHelper';

const router = Router();

// Middleware de autenticação para todas as rotas
router.use(authMiddleware);

// Validações
const createLocalValidator = [
  // publisher_id é obrigatório - locais pertencem apenas a publishers
  body('publisher_id').notEmpty().isInt({ min: 1 }).withMessage('publisher_id é obrigatório'),
  body('contract_id').optional().isInt({ min: 1 }).withMessage('Contract ID inválido (opcional, para rastreabilidade)'),
  body('name').notEmpty().isString().withMessage('Nome é obrigatório'),
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
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('search').optional().isString(),
  query('publisherId').optional().isInt({ min: 1 }),
  query('active_only').optional().isBoolean(),
  validateRequest,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { page = 1, limit = 10, search, publisherId, active_only } = req.query;
      
      // Determinar publisherId do usuário (se não for admin)
      const isAdmin = req.user?.role === 'admin';
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
      return res.status(500).json({ error: error.message || 'Erro interno do servidor' });
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
      
      const isAdmin = req.user?.role === 'admin';
      const requestPublisherId = req.user?.publisherId || undefined;

      const local = await getLocalService().getLocalById(parseInt(id), requestPublisherId, isAdmin);
      
      if (!local) {
        return res.status(404).json({ error: 'Local não encontrado' });
      }

      return res.json({ success: true, data: local });
    } catch (error: any) {
      await logError('Erro ao obter local', error);
      if (error.message.includes('Acesso negado')) {
        return res.status(403).json({ error: error.message });
      }
      return res.status(500).json({ error: error.message || 'Erro interno do servidor' });
    }
  }
);

/**
 * @route POST /api/locals
 * @desc Criar novo local
 * @access Private (Apenas roles administrativos - baseado em contrato)
 */
router.post('/',
  authorizeRole(['admin', 'admin_sql', 'owner_system', 'operador_faturamento', 'operador_comercial']),
  createLocalValidator,
  validateRequest,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { publisher_id, contract_id, name, address, city, state, zip_code, country, latitude, longitude, timezone, description } = req.body;
      
      // publisher_id é obrigatório - locais pertencem apenas a publishers
      if (!publisher_id) {
        return res.status(400).json({
          error: 'Dados inválidos',
          details: [{ msg: 'publisher_id é obrigatório. Locais pertencem apenas a publishers.' }]
        });
      }
      
      if (!req.user?.id) {
        return res.status(401).json({ error: 'Usuário não autenticado' });
      }

      const isAdmin = req.user.role === 'admin';
      const requestPublisherId = req.user?.publisherId || undefined;

      const newLocal = await getLocalService().createLocal({
        publisher_id,
        contract_id, // Opcional - para rastreabilidade
        name,
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
        return res.status(403).json({ error: error.message });
      }
      return res.status(400).json({ error: error.message || 'Erro interno do servidor' });
    }
  }
);

/**
 * @route PUT /api/locals/:id
 * @desc Atualizar local
 * @access Private (Admin only)
 */
router.put('/:id',
  authorizeRole(['admin']),
  param('id').isInt({ min: 1 }),
  updateLocalValidator,
  validateRequest,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { name, address, city, state, zip_code, country, latitude, longitude, timezone, description, is_active } = req.body;
      
      if (!req.user?.id) {
        return res.status(401).json({ error: 'Usuário não autenticado' });
      }

      const isAdmin = req.user.role === 'admin';
      const requestPublisherId = req.user?.publisherId || undefined;

      const updatedLocal = await getLocalService().updateLocal(
        parseInt(id),
        {
          name,
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
        return res.status(403).json({ error: error.message });
      }
      return res.status(400).json({ error: error.message || 'Erro interno do servidor' });
    }
  }
);

/**
 * @route DELETE /api/locals/:id
 * @desc Deletar local (soft delete)
 * @access Private (Admin only)
 */
router.delete('/:id',
  authorizeRole(['admin']),
  param('id').isInt({ min: 1 }),
  validateRequest,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      
      if (!req.user?.id) {
        return res.status(401).json({ error: 'Usuário não autenticado' });
      }

      const isAdmin = req.user.role === 'admin';
      const requestPublisherId = req.user?.publisherId || undefined;

      await getLocalService().deleteLocal(parseInt(id), req.user.id, requestPublisherId, isAdmin);
      
      return res.json({ success: true, message: 'Local deletado com sucesso' });
    } catch (error: any) {
      await logError('Erro ao deletar local', error);
      if (error.message.includes('Acesso negado')) {
        return res.status(403).json({ error: error.message });
      }
      return res.status(400).json({ error: error.message || 'Erro interno do servidor' });
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
      
      const isAdmin = req.user?.role === 'admin';
      const requestPublisherId = req.user?.publisherId || undefined;

      const totems = await getLocalService().getTotemsByLocal(parseInt(id), requestPublisherId, isAdmin);
      
      return res.json({ success: true, data: totems });
    } catch (error: any) {
      await logError('Erro ao listar totens do local', error);
      if (error.message.includes('Acesso negado')) {
        return res.status(403).json({ error: error.message });
      }
      return res.status(500).json({ error: error.message || 'Erro interno do servidor' });
    }
  }
);

export default router;

