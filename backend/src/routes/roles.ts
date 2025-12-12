/**
 * Roles Routes - Smart Signage v2.1
 * Rotas CRUD para gerenciamento de roles (RBAC)
 * @access Private (Admin SQL apenas)
 */

import { Router, Response } from 'express';
import { body, query, param, validationResult } from 'express-validator';
import { authMiddleware } from '../middleware/auth.middleware';
import { requireAdminSql } from '../middleware/adminSql.middleware';
import { getRoleService } from '../services/roleService';
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
 * @route GET /api/roles
 * @desc Lista todas as roles com paginação e filtros
 * @access Private (Admin SQL apenas)
 */
router.get('/',
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('search').optional().isString(),
  query('isActive').optional().isBoolean(),
  validateRequest,
  async (req: any, res: Response) => {
    try {
      const { page, limit, search, isActive } = req.query;
      
      const result = await getRoleService().getAllRoles({
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
        search: search as string,
        isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined
      });

      return res.json({
        success: true,
        data: result
      });
    } catch (error: any) {
      await logError('Erro ao listar roles', error);
      return res.status(500).json({
        success: false,
        message: 'Erro interno do servidor',
        error: error.message
      });
    }
  }
);

/**
 * @route GET /api/roles/:id
 * @desc Busca role por ID
 * @access Private (Admin SQL apenas)
 */
router.get('/:id',
  param('id').isInt({ min: 1 }),
  validateRequest,
  async (req: any, res: Response) => {
    try {
      const roleId = parseInt(req.params.id);
      const role = await getRoleService().getRoleById(roleId);

      if (!role) {
        return res.status(404).json({
          success: false,
          message: 'Role não encontrada'
        });
      }

      // Buscar permissões da role
      const permissions = await getRoleService().getRolePermissions(roleId);

      return res.json({
        success: true,
        data: {
          ...role,
          permissions
        }
      });
    } catch (error: any) {
      await logError('Erro ao buscar role', error);
      return res.status(500).json({
        success: false,
        message: 'Erro interno do servidor',
        error: error.message
      });
    }
  }
);

/**
 * @route POST /api/roles
 * @desc Cria nova role
 * @access Private (Admin SQL apenas)
 */
router.post('/',
  body('name').notEmpty().withMessage('Nome é obrigatório').isString(),
  body('description').optional().isString(),
  body('is_active').optional().isBoolean(),
  validateRequest,
  async (req: any, res: Response) => {
    try {
      const { name, description, is_active } = req.body;

      const role = await getRoleService().createRole({
        name,
        description,
        is_active
      });

      return res.status(201).json({
        success: true,
        message: 'Role criada com sucesso',
        data: role
      });
    } catch (error: any) {
      await logError('Erro ao criar role', error);
      return res.status(400).json({
        success: false,
        message: error.message || 'Erro ao criar role',
        error: error.message
      });
    }
  }
);

/**
 * @route PUT /api/roles/:id
 * @desc Atualiza role
 * @access Private (Admin SQL apenas)
 */
router.put('/:id',
  param('id').isInt({ min: 1 }),
  body('name').optional().isString(),
  body('description').optional().isString(),
  body('is_active').optional().isBoolean(),
  validateRequest,
  async (req: any, res: Response) => {
    try {
      const roleId = parseInt(req.params.id);
      const { name, description, is_active } = req.body;

      const role = await getRoleService().updateRole(roleId, {
        name,
        description,
        is_active
      });

      return res.json({
        success: true,
        message: 'Role atualizada com sucesso',
        data: role
      });
    } catch (error: any) {
      await logError('Erro ao atualizar role', error);
      return res.status(400).json({
        success: false,
        message: error.message || 'Erro ao atualizar role',
        error: error.message
      });
    }
  }
);

/**
 * @route DELETE /api/roles/:id
 * @desc Deleta role
 * @access Private (Admin SQL apenas)
 */
router.delete('/:id',
  param('id').isInt({ min: 1 }),
  validateRequest,
  async (req: any, res: Response) => {
    try {
      const roleId = parseInt(req.params.id);
      await getRoleService().deleteRole(roleId);

      return res.json({
        success: true,
        message: 'Role deletada com sucesso'
      });
    } catch (error: any) {
      await logError('Erro ao deletar role', error);
      return res.status(400).json({
        success: false,
        message: error.message || 'Erro ao deletar role',
        error: error.message
      });
    }
  }
);

/**
 * @route GET /api/roles/:id/permissions
 * @desc Lista permissões de uma role
 * @access Private (Admin SQL apenas)
 */
router.get('/:id/permissions',
  param('id').isInt({ min: 1 }),
  validateRequest,
  async (req: any, res: Response) => {
    try {
      const roleId = parseInt(req.params.id);
      const permissions = await getRoleService().getRolePermissions(roleId);

      return res.json({
        success: true,
        data: permissions
      });
    } catch (error: any) {
      await logError('Erro ao listar permissões da role', error);
      return res.status(500).json({
        success: false,
        message: 'Erro interno do servidor',
        error: error.message
      });
    }
  }
);

/**
 * @route POST /api/roles/:id/permissions
 * @desc Atribui permissões a uma role (substitui todas as existentes)
 * @access Private (Admin SQL apenas)
 */
router.post('/:id/permissions',
  param('id').isInt({ min: 1 }),
  body('permissionIds').isArray().withMessage('permissionIds deve ser um array'),
  body('permissionIds.*').isInt({ min: 1 }).withMessage('Cada permissionId deve ser um número inteiro'),
  validateRequest,
  async (req: any, res: Response) => {
    try {
      const roleId = parseInt(req.params.id);
      const { permissionIds } = req.body;

      await getRoleService().setRolePermissions(roleId, permissionIds);

      const permissions = await getRoleService().getRolePermissions(roleId);

      return res.json({
        success: true,
        message: 'Permissões atribuídas com sucesso',
        data: permissions
      });
    } catch (error: any) {
      await logError('Erro ao atribuir permissões à role', error);
      return res.status(400).json({
        success: false,
        message: error.message || 'Erro ao atribuir permissões',
        error: error.message
      });
    }
  }
);

/**
 * @route POST /api/roles/:id/permissions/:permissionId
 * @desc Adiciona uma permissão específica a uma role
 * @access Private (Admin SQL apenas)
 */
router.post('/:id/permissions/:permissionId',
  param('id').isInt({ min: 1 }),
  param('permissionId').isInt({ min: 1 }),
  validateRequest,
  async (req: any, res: Response) => {
    try {
      const roleId = parseInt(req.params.id);
      const permissionId = parseInt(req.params.permissionId);

      await getRoleService().assignPermissionToRole(roleId, permissionId);

      return res.json({
        success: true,
        message: 'Permissão atribuída com sucesso'
      });
    } catch (error: any) {
      await logError('Erro ao atribuir permissão à role', error);
      return res.status(400).json({
        success: false,
        message: error.message || 'Erro ao atribuir permissão',
        error: error.message
      });
    }
  }
);

/**
 * @route DELETE /api/roles/:id/permissions/:permissionId
 * @desc Remove uma permissão de uma role
 * @access Private (Admin SQL apenas)
 */
router.delete('/:id/permissions/:permissionId',
  param('id').isInt({ min: 1 }),
  param('permissionId').isInt({ min: 1 }),
  validateRequest,
  async (req: any, res: Response) => {
    try {
      const roleId = parseInt(req.params.id);
      const permissionId = parseInt(req.params.permissionId);

      await getRoleService().removePermissionFromRole(roleId, permissionId);

      return res.json({
        success: true,
        message: 'Permissão removida com sucesso'
      });
    } catch (error: any) {
      await logError('Erro ao remover permissão da role', error);
      return res.status(400).json({
        success: false,
        message: error.message || 'Erro ao remover permissão',
        error: error.message
      });
    }
  }
);

export default router;

