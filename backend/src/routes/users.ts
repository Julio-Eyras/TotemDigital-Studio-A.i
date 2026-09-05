

import express from 'express';
import { body, query, param } from 'express-validator';
import { validationResult } from 'express-validator';
import { authMiddleware, authorizeRole } from '../middleware/auth.middleware';
import { getUserService } from '../services/userService';
import { logError } from '../utils/loggerHelper';
import { normalizeError } from '../utils/errors';

const router = express.Router();

// Middleware de autenticação para todas as rotas
router.use(authMiddleware);

// Validações
const VALID_ROLES = [
  'owner_system',
  'admin_sql',
  'admin',
  'operador_tecnico',
  'operador_faturamento',
  'operador_comercial',
  'gerente_marketing',
  'editoracao',
  'visualizador',
  'user',
  'publisher_user',
  'subscriber_user',
];

const VALID_USER_TYPES = [
  'system_user',
  'subscriber_user',
  'publisher_user',
];

const VALID_FLAGS = [
  'flag_smart_0',
  'flag_smart_1',
  'flag_smart_2',
  'flag_smart_3',
  'flag_smart_4',
  'flag_smart_5',
  'flag_smart_6',
  'flag_smart_7',
  'flag_smart_8',
  'flag_smart_9'
];

const createUserValidator = [
  body('username').notEmpty().withMessage('Nome de usuário é obrigatório'),
  body('email').optional({ nullable: true }).isEmail().withMessage('Email inválido'),
  body('password').notEmpty().withMessage('Senha é obrigatória'),
  body('name').notEmpty().withMessage('Nome é obrigatório'),
  body('role').isIn(VALID_ROLES).withMessage('Função inválida'),
  body('userType').optional({ nullable: true }).isIn(VALID_USER_TYPES).withMessage('Tipo de usuário inválido'),
  body('publisherId').optional({ nullable: true }).isInt({ min: 1 }),
  body('subscriberId').optional({ nullable: true }).isInt({ min: 1 }),
  body('isTenantUser').optional({ nullable: true }).isBoolean(),
  body('flags').optional({ nullable: true }).isObject(),
];

const validateRequest = (req: express.Request, res: express.Response, next: express.NextFunction): express.Response | void => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({
      error: 'Dados inválidos',
      details: errors.array()
    });
    return;
  }
  next();
};

/**
 * @route GET /api/users
 * @desc Listar todos os usuários
 * @access Private (Admin apenas - gerenciamento de usuários é restrito)
 */
router.get('/', 
  authorizeRole(['admin', 'admin_sql', 'owner_system']),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('search').optional().isString(),
  query('role').optional().isIn(VALID_ROLES),
  query('userType').optional().isIn(VALID_USER_TYPES),
  query('publisherId').optional().isInt({ min: 1 }),
  query('subscriberId').optional().isInt({ min: 1 }),
  validateRequest,
  async (req: express.Request, res: express.Response): Promise<express.Response | void> => {
    try {
      const { page = 1, limit = 10, search, role, userType, publisherId, subscriberId } = req.query;
      
      const result = await getUserService().getAllUsers({
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        search: search as string,
        role: role as string,
        userType: userType as any,
        publisherId: publisherId ? parseInt(publisherId as string) : undefined,
        subscriberId: subscriberId ? parseInt(subscriberId as string) : undefined,
      });
      
      res.json(result);
} catch (error: unknown) {
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
  authorizeRole(['admin', 'admin_sql', 'owner_system']),
  param('id').isInt({ min: 1 }).withMessage('ID inválido'),
  validateRequest,
  async (req: express.Request, res: express.Response): Promise<express.Response | void> => {
    try {
      const { id } = req.params;
      
      const user = await getUserService().getUserById(parseInt(id));
      
      if (!user) {
        return res.status(404).json({ error: 'Usuário não encontrado' });
      }

      res.json(user);
} catch (error: unknown) {
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
  authorizeRole(['admin', 'admin_sql', 'owner_system']),
  createUserValidator,
  validateRequest,
  async (req: express.Request, res: express.Response): Promise<express.Response | void> => {
    try {
      const { 
        username, 
        email, 
        password, 
        name, 
        role, 
        userType,
        publisherId,
        subscriberId,
        isTenantUser,
        flags
      } = req.body;
      
      const newUser = await getUserService().createUser({
        username,
        email,
        password,
        name,
        role,
        userType,
        publisherId,
        subscriberId,
        isTenantUser,
        flags,
      });

      res.status(201).json(newUser);} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('Erro ao criar usuário', e.error);
      const msg = e.message || '';
      const isValidation = msg.includes('obrigatório') || msg.includes('já existe') || msg.includes('inválido') || msg.includes('não encontrado') || msg.includes('requer ');
      res.status(isValidation ? 400 : 500).json({ error: msg || 'Erro interno do servidor' });
    }
  }
);

/**
 * @route PUT /api/users/:id
 * @desc Atualizar usuário
 * @access Private (Admin apenas - gerenciamento de usuários é restrito)
 */
router.put('/:id',
  authorizeRole(['admin', 'admin_sql', 'owner_system']),
  param('id').isInt({ min: 1 }).withMessage('ID inválido'),
  body('username').optional({ nullable: true }).notEmpty().withMessage('Nome de usuário não pode ser vazio'),
  body('email').optional({ nullable: true }).isEmail().withMessage('Email inválido'),
  body('name').optional({ nullable: true }).notEmpty().withMessage('Nome não pode ser vazio'),
  body('role').optional({ nullable: true }).isIn(VALID_ROLES).withMessage('Função inválida'),
  body('userType').optional({ nullable: true }).isIn(VALID_USER_TYPES).withMessage('Tipo de usuário inválido'),
  body('publisherId').optional({ nullable: true }).isInt({ min: 1 }),
  body('subscriberId').optional({ nullable: true }).isInt({ min: 1 }),
  body('isTenantUser').optional({ nullable: true }).isBoolean(),
  body('isActive').optional({ nullable: true }).isBoolean(),
  body('flags').optional({ nullable: true }).isObject(),
  validateRequest,
  async (req: express.Request, res: express.Response): Promise<express.Response | void> => {
    try {
      const { id } = req.params;
      const { 
        username, 
        email, 
        password, 
        name, 
        role, 
        userType,
        publisherId,
        subscriberId,
        isTenantUser,
        isActive,
        flags
      } = req.body;

      const updatedUser = await getUserService().updateUser(parseInt(id), {
        username,
        email,
        password,
        name,
        role,
        userType,
        publisherId,
        subscriberId,
        isTenantUser,
        isActive,
        flags,
      });

      res.json(updatedUser);} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('Erro ao atualizar usuário', e.error);
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
  authorizeRole(['admin', 'admin_sql', 'owner_system']),
  param('id').isInt({ min: 1 }).withMessage('ID inválido'),
  validateRequest,
  async (req: express.Request, res: express.Response): Promise<express.Response | void> => {
    try {
      const { id } = req.params;
      await getUserService().deleteUser(parseInt(id));
      res.status(204).send();} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('Erro ao excluir usuário', e.error);
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
  authorizeRole(['admin', 'admin_sql', 'owner_system']),
  param('id').isInt({ min: 1 }).withMessage('ID inválido'),
  validateRequest,
  async (req: express.Request, res: express.Response): Promise<express.Response | void> => {
    try {
      const { id } = req.params;
      const roles = await getUserService().getUserRoles(parseInt(id));

      res.json({
        success: true,
        data: roles
      });} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('Erro ao listar roles do usuário', e.error);
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
  authorizeRole(['admin_sql', 'owner_system']),
  param('id').isInt({ min: 1 }).withMessage('ID inválido'),
  body('roleIds').isArray().withMessage('roleIds deve ser um array'),
  body('roleIds.*').isInt({ min: 1 }).withMessage('Cada roleId deve ser um número inteiro'),
  validateRequest,
  async (req: express.Request, res: express.Response): Promise<express.Response | void> => {
    try {
      const { id } = req.params;
      const { roleIds } = req.body;

      await getUserService().setUserRoles(parseInt(id), roleIds, req.user!.id);

      const roles = await getUserService().getUserRoles(parseInt(id));

      res.json({
        success: true,
        message: 'Roles atribuídas com sucesso',
        data: roles
      });} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('Erro ao atribuir roles ao usuário', e.error);
      res.status(400).json({
        success: false,
        message: e.message || 'Erro ao atribuir roles',
        error: e.message
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
  authorizeRole(['admin_sql', 'owner_system']),
  param('id').isInt({ min: 1 }).withMessage('ID inválido'),
  param('roleId').isInt({ min: 1 }).withMessage('Role ID inválido'),
  validateRequest,
  async (req: express.Request, res: express.Response): Promise<express.Response | void> => {
    try {
      const { id, roleId } = req.params;

      await getUserService().assignRoleToUser(parseInt(id), parseInt(roleId), req.user!.id);

      res.json({
        success: true,
        message: 'Role atribuída com sucesso'
      });} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('Erro ao atribuir role ao usuário', e.error);
      res.status(400).json({
        success: false,
        message: e.message || 'Erro ao atribuir role',
        error: e.message
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
  authorizeRole(['admin_sql', 'owner_system']),
  param('id').isInt({ min: 1 }).withMessage('ID inválido'),
  param('roleId').isInt({ min: 1 }).withMessage('Role ID inválido'),
  validateRequest,
  async (req: express.Request, res: express.Response): Promise<express.Response | void> => {
    try {
      const { id, roleId } = req.params;

      await getUserService().removeRoleFromUser(parseInt(id), parseInt(roleId));

      res.json({
        success: true,
        message: 'Role removida com sucesso'
      });} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('Erro ao remover role do usuário', e.error);
      res.status(400).json({
        success: false,
        message: e.message || 'Erro ao remover role',
        error: e.message
      });
    }
  }
);

/**
 * @route GET /api/users/:id/flags
 * @desc Obter flags de um usuário
 * @access Private (Admin, Admin SQL, Owner System)
 */
router.get('/:id/flags',
  authorizeRole(['admin', 'admin_sql', 'owner_system']),
  param('id').isInt({ min: 1 }).withMessage('ID inválido'),
  validateRequest,
  async (req: express.Request, res: express.Response): Promise<express.Response | void> => {
    try {
      const { id } = req.params;
      const flags = await getUserService().getUserFlags(parseInt(id));

      res.json({
        success: true,
        data: flags
      });} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('Erro ao obter flags do usuário', e.error);
      res.status(500).json({
        success: false,
        message: e.message || 'Erro interno do servidor',
        error: e.message
      });
    }
  }
);

/**
 * @route PUT /api/users/:id/flags
 * @desc Atualizar flags de um usuário
 * @access Private (Admin, Admin SQL, Owner System)
 */
router.put('/:id/flags',
  authorizeRole(['admin', 'admin_sql', 'owner_system']),
  param('id').isInt({ min: 1 }).withMessage('ID inválido'),
  body('flags').isObject().withMessage('Flags deve ser um objeto'),
  validateRequest,
  async (req: express.Request, res: express.Response): Promise<express.Response | void> => {
    try {
      const { id } = req.params;
      const { flags } = req.body;

      await getUserService().updateUserFlags(parseInt(id), flags, req.user!.id);

      const updatedFlags = await getUserService().getUserFlags(parseInt(id));

      res.json({
        success: true,
        message: 'Flags atualizadas com sucesso',
        data: updatedFlags
      });} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('Erro ao atualizar flags do usuário', e.error);
      res.status(400).json({
        success: false,
        message: e.message || 'Erro ao atualizar flags',
        error: e.message
      });
    }
  }
);

/**
 * @route POST /api/users/:id/flags/:flagName
 * @desc Ativar flag específica de um usuário
 * @access Private (Admin, Admin SQL, Owner System)
 */
router.post('/:id/flags/:flagName',
  authorizeRole(['admin', 'admin_sql', 'owner_system']),
  param('id').isInt({ min: 1 }).withMessage('ID inválido'),
  param('flagName').isIn(VALID_FLAGS).withMessage('Flag inválida'),
  validateRequest,
  async (req: express.Request, res: express.Response): Promise<express.Response | void> => {
    try {
      const { id, flagName } = req.params;

      await getUserService().setUserFlag(parseInt(id), flagName as any, true, req.user!.id);

      res.json({
        success: true,
        message: `Flag ${flagName} ativada com sucesso`
      });} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('Erro ao ativar flag do usuário', e.error);
      res.status(400).json({
        success: false,
        message: e.message || 'Erro ao ativar flag',
        error: e.message
      });
    }
  }
);

/**
 * @route DELETE /api/users/:id/flags/:flagName
 * @desc Desativar flag específica de um usuário
 * @access Private (Admin, Admin SQL, Owner System)
 */
router.delete('/:id/flags/:flagName',
  authorizeRole(['admin', 'admin_sql', 'owner_system']),
  param('id').isInt({ min: 1 }).withMessage('ID inválido'),
  param('flagName').isIn(VALID_FLAGS).withMessage('Flag inválida'),
  validateRequest,
  async (req: express.Request, res: express.Response): Promise<express.Response | void> => {
    try {
      const { id, flagName } = req.params;

      await getUserService().setUserFlag(parseInt(id), flagName as any, false, req.user!.id);

      res.json({
        success: true,
        message: `Flag ${flagName} desativada com sucesso`
      });} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('Erro ao desativar flag do usuário', e.error);
      res.status(400).json({
        success: false,
        message: e.message || 'Erro ao desativar flag',
        error: e.message
      });
    }
  }
);

export default router;