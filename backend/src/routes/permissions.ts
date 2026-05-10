/**
 * Permissions Routes - Smart Signage v2.1
 * Rotas CRUD para gerenciamento de permissions (RBAC)
 * @access Private (Admin SQL apenas)
 */

import { Router, Response } from 'express';
import { body, query, param, validationResult } from 'express-validator';
import { authMiddleware } from '../middleware/auth.middleware';
import { requireAdminSql } from '../middleware/adminSql.middleware';
import { getPermissionService } from '../services/permissionService';
import { logError } from '../utils/loggerHelper';

const router = Router();

// Middleware de autenticação para todas as rotas
router.use(authMiddleware);

// Todas as rotas requerem ADMIN_SQL
router.use(requireAdminSql);

const validateRequest = (req: any, res: any, next: any) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Dados inválidos',
      details: errors.array()
    });
  }
  next();
};

/**
 * @route GET /api/permissions
 * @desc Lista todas as permissions com paginação e filtros
 * @access Private (Admin SQL apenas)
 */
router.get('/',
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('search').optional().isString(),
  query('resource').optional().isString(),
  query('action').optional().isString(),
  validateRequest,
  async (req: any, res: Response) => {
    try {
      const { page, limit, search, resource, action } = req.query;
      
      const result = await getPermissionService().getAllPermissions({
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
        search: search as string,
        resource: resource as string,
        action: action as string
      });

      return res.json({
        success: true,
        data: result
      });
    } catch (error: any) {
      await logError('Erro ao listar permissions', error);
      return res.status(500).json({
        success: false,
        message: 'Erro interno do servidor',
        error: error.message
      });
    }
  }
);

/**
 * @route GET /api/permissions/resources
 * @desc Lista todos os recursos únicos
 * @access Private (Admin SQL apenas)
 */
router.get('/resources', async (_req: any, res: Response) => {
  try {
    const resources = await getPermissionService().getResources();

    return res.json({
      success: true,
      data: resources
    });
  } catch (error: any) {
    await logError('Erro ao listar recursos', error);
    return res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
});

/**
 * @route GET /api/permissions/actions
 * @desc Lista todas as ações únicas
 * @access Private (Admin SQL apenas)
 */
router.get('/actions', async (_req: any, res: Response) => {
  try {
    const actions = await getPermissionService().getActions();

    return res.json({
      success: true,
      data: actions
    });
  } catch (error: any) {
    await logError('Erro ao listar ações', error);
    return res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
});

/**
 * @route GET /api/permissions/:id
 * @desc Busca permission por ID
 * @access Private (Admin SQL apenas)
 */
router.get('/:id',
  param('id').isInt({ min: 1 }),
  validateRequest,
  async (req: any, res: Response) => {
    try {
      const permissionId = parseInt(req.params.id);
      const permission = await getPermissionService().getPermissionById(permissionId);

      if (!permission) {
        return res.status(404).json({
          success: false,
          message: 'Permission não encontrada'
        });
      }

      return res.json({
        success: true,
        data: permission
      });
    } catch (error: any) {
      await logError('Erro ao buscar permission', error);
      return res.status(500).json({
        success: false,
        message: 'Erro interno do servidor',
        error: error.message
      });
    }
  }
);

/**
 * @route POST /api/permissions
 * @desc Cria nova permission
 * @access Private (Admin SQL apenas)
 */
router.post('/',
  body('name').notEmpty().withMessage('Nome é obrigatório').isString(),
  body('resource').notEmpty().withMessage('Resource é obrigatório').isString(),
  body('action').notEmpty().withMessage('Action é obrigatório').isString(),
  body('description').optional({ nullable: true }).isString(),
  validateRequest,
  async (req: any, res: Response) => {
    try {
      const { name, resource, action, description } = req.body;

      const permission = await getPermissionService().createPermission({
        name,
        resource,
        action,
        description
      });

      return res.status(201).json({
        success: true,
        message: 'Permission criada com sucesso',
        data: permission
      });
    } catch (error: any) {
      await logError('Erro ao criar permission', error);
      return res.status(400).json({
        success: false,
        message: error.message || 'Erro ao criar permission',
        error: error.message
      });
    }
  }
);

/**
 * @route PUT /api/permissions/:id
 * @desc Atualiza permission
 * @access Private (Admin SQL apenas)
 */
router.put('/:id',
  param('id').isInt({ min: 1 }),
  body('name').optional({ nullable: true }).isString(),
  body('resource').optional({ nullable: true }).isString(),
  body('action').optional({ nullable: true }).isString(),
  body('description').optional({ nullable: true }).isString(),
  validateRequest,
  async (req: any, res: Response) => {
    try {
      const permissionId = parseInt(req.params.id);
      const { name, resource, action, description } = req.body;

      const permission = await getPermissionService().updatePermission(permissionId, {
        name,
        resource,
        action,
        description
      });

      return res.json({
        success: true,
        message: 'Permission atualizada com sucesso',
        data: permission
      });
    } catch (error: any) {
      await logError('Erro ao atualizar permission', error);
      return res.status(400).json({
        success: false,
        message: error.message || 'Erro ao atualizar permission',
        error: error.message
      });
    }
  }
);

/**
 * @route DELETE /api/permissions/:id
 * @desc Deleta permission
 * @access Private (Admin SQL apenas)
 */
router.delete('/:id',
  param('id').isInt({ min: 1 }),
  validateRequest,
  async (req: any, res: Response) => {
    try {
      const permissionId = parseInt(req.params.id);
      await getPermissionService().deletePermission(permissionId);

      return res.json({
        success: true,
        message: 'Permission deletada com sucesso'
      });
    } catch (error: any) {
      await logError('Erro ao deletar permission', error);
      return res.status(400).json({
        success: false,
        message: error.message || 'Erro ao deletar permission',
        error: error.message
      });
    }
  }
);

export default router;

