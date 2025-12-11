import express from 'express';
import { body, query, param } from 'express-validator';
import { validationResult } from 'express-validator';
import { authMiddleware, authorizeRole } from '../middleware/auth.middleware';
import { getUserService } from '../services/userService';
import { logError } from '../utils/loggerHelper';

const router = express.Router();

// Middleware de autenticação para todas as rotas
router.use(authMiddleware);

// Validações
const createUserValidator = [
  body('username').notEmpty().withMessage('Nome de usuário é obrigatório'),
  body('email').optional().isEmail().withMessage('Email inválido'),
  body('password').notEmpty().withMessage('Senha é obrigatória'),
  body('name').notEmpty().withMessage('Nome é obrigatório'),
  body('role').isIn(['admin', 'gerente_marketing', 'editoracao', 'visualizador', 'user', 'client']).withMessage('Função inválida'),
  body('clientId').optional().isInt({ min: 1 }),
];

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
 * @route GET /api/users
 * @desc Listar todos os usuários
 * @access Private (Admin apenas - gerenciamento de usuários é restrito)
 */
router.get('/', 
  authorizeRole(['admin', 'admin_sql']),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('search').optional().isString(),
  query('role').optional().isIn(['admin', 'gerente_marketing', 'editoracao', 'visualizador', 'user', 'client']),
  query('clientId').optional().isInt({ min: 1 }),
  validateRequest,
  async (req: any, res: any) => {
    try {
      const { page = 1, limit = 10, search, role, clientId } = req.query;
      
      const result = await getUserService().getAllUsers({
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        search: search as string,
        role: role as string,
        clientId: clientId ? parseInt(clientId as string) : undefined,
      });
      
      res.json(result);
    } catch (error) {
      await logError('Erro ao listar usuários', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
);

/**
 * @route GET /api/users/:id
 * @desc Obter usuário por ID
 * @access Private (Admin apenas - gerenciamento de usuários é restrito)
 */
router.get('/:id',
  authorizeRole(['admin', 'admin_sql']),
  param('id').isInt({ min: 1 }).withMessage('ID inválido'),
  validateRequest,
  async (req: any, res: any) => {
    try {
      const { id } = req.params;
      
      const user = await getUserService().getUserById(parseInt(id));
      
      if (!user) {
        return res.status(404).json({ error: 'Usuário não encontrado' });
      }

      res.json(user);
    } catch (error) {
      await logError('Erro ao obter usuário', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
);

/**
 * @route POST /api/users
 * @desc Criar novo usuário
 * @access Private (Admin apenas - gerenciamento de usuários é restrito)
 */
router.post('/',
  authorizeRole(['admin', 'admin_sql']),
  createUserValidator,
  validateRequest,
  async (req: any, res: any) => {
    try {
      const { username, email, password, name, role, clientId } = req.body;
      
      const newUser = await getUserService().createUser({
        username,
        email,
        password,
        name,
        role,
        clientId,
      });

      res.status(201).json(newUser);
    } catch (error) {
      await logError('Erro ao criar usuário', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
);

/**
 * @route PUT /api/users/:id
 * @desc Atualizar usuário
 * @access Private (Admin apenas - gerenciamento de usuários é restrito)
 */
router.put('/:id',
  authorizeRole(['admin', 'admin_sql']),
  param('id').isInt({ min: 1 }).withMessage('ID inválido'),
  body('username').optional().notEmpty().withMessage('Nome de usuário não pode ser vazio'),
  body('email').optional().isEmail().withMessage('Email inválido'),
  body('name').optional().notEmpty().withMessage('Nome não pode ser vazio'),
  body('role').optional().isIn(['admin', 'gerente_marketing', 'editoracao', 'visualizador', 'user', 'client']).withMessage('Função inválida'),
  body('clientId').optional().isInt({ min: 1 }),
  validateRequest,
  async (req: any, res: any) => {
    try {
      const { id } = req.params;
      const { username, email, password, name, role, clientId, isActive } = req.body;

      const updatedUser = await getUserService().updateUser(parseInt(id), {
        username,
        email,
        password,
        name,
        role,
        clientId,
        isActive,
      });

      res.json(updatedUser);
    } catch (error) {
      await logError('Erro ao atualizar usuário', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
);

/**
 * @route DELETE /api/users/:id
 * @desc Excluir usuário
 * @access Private (Admin apenas - gerenciamento de usuários é restrito)
 */
router.delete('/:id',
  authorizeRole(['admin', 'admin_sql']),
  param('id').isInt({ min: 1 }).withMessage('ID inválido'),
  validateRequest,
  async (req: any, res: any) => {
    try {
      const { id } = req.params;
      await getUserService().deleteUser(parseInt(id));
      res.status(204).send();
    } catch (error) {
      await logError('Erro ao excluir usuário', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
);

/**
 * @route GET /api/users/:id/roles
 * @desc Lista roles de um usuário
 * @access Private (Admin apenas)
 */
router.get('/:id/roles',
  authorizeRole(['admin', 'admin_sql']),
  param('id').isInt({ min: 1 }).withMessage('ID inválido'),
  validateRequest,
  async (req: any, res: any) => {
    try {
      const { id } = req.params;
      const roles = await getUserService().getUserRoles(parseInt(id));

      res.json({
        success: true,
        data: roles
      });
    } catch (error) {
      await logError('Erro ao listar roles do usuário', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
);

/**
 * @route POST /api/users/:id/roles
 * @desc Define roles de um usuário (substitui todas as existentes)
 * @access Private (Admin SQL apenas)
 */
router.post('/:id/roles',
  authorizeRole(['admin_sql']),
  param('id').isInt({ min: 1 }).withMessage('ID inválido'),
  body('roleIds').isArray().withMessage('roleIds deve ser um array'),
  body('roleIds.*').isInt({ min: 1 }).withMessage('Cada roleId deve ser um número inteiro'),
  validateRequest,
  async (req: any, res: any) => {
    try {
      const { id } = req.params;
      const { roleIds } = req.body;

      await getUserService().setUserRoles(parseInt(id), roleIds, req.user.id);

      const roles = await getUserService().getUserRoles(parseInt(id));

      res.json({
        success: true,
        message: 'Roles atribuídas com sucesso',
        data: roles
      });
    } catch (error: any) {
      await logError('Erro ao atribuir roles ao usuário', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Erro ao atribuir roles',
        error: error.message
      });
    }
  }
);

/**
 * @route POST /api/users/:id/roles/:roleId
 * @desc Adiciona uma role específica a um usuário
 * @access Private (Admin SQL apenas)
 */
router.post('/:id/roles/:roleId',
  authorizeRole(['admin_sql']),
  param('id').isInt({ min: 1 }).withMessage('ID inválido'),
  param('roleId').isInt({ min: 1 }).withMessage('Role ID inválido'),
  validateRequest,
  async (req: any, res: any) => {
    try {
      const { id, roleId } = req.params;

      await getUserService().assignRoleToUser(parseInt(id), parseInt(roleId), req.user.id);

      res.json({
        success: true,
        message: 'Role atribuída com sucesso'
      });
    } catch (error: any) {
      await logError('Erro ao atribuir role ao usuário', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Erro ao atribuir role',
        error: error.message
      });
    }
  }
);

/**
 * @route DELETE /api/users/:id/roles/:roleId
 * @desc Remove uma role de um usuário
 * @access Private (Admin SQL apenas)
 */
router.delete('/:id/roles/:roleId',
  authorizeRole(['admin_sql']),
  param('id').isInt({ min: 1 }).withMessage('ID inválido'),
  param('roleId').isInt({ min: 1 }).withMessage('Role ID inválido'),
  validateRequest,
  async (req: any, res: any) => {
    try {
      const { id, roleId } = req.params;

      await getUserService().removeRoleFromUser(parseInt(id), parseInt(roleId));

      res.json({
        success: true,
        message: 'Role removida com sucesso'
      });
    } catch (error: any) {
      await logError('Erro ao remover role do usuário', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Erro ao remover role',
        error: error.message
      });
    }
  }
);

export default router;