import { Router, Request, Response } from 'express';
import { UserService } from '../services/userService';
import { authMiddleware } from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/validation.middleware';
import { body, param, query } from 'express-validator';

const router = Router();

// Lazy initialization - só criar quando necessário
function getUserService(): UserService {
  if (!(global as any).userServiceInstance) {
    (global as any).userServiceInstance = new UserService();
  }
  return (global as any).userServiceInstance;
}

// Middleware de autenticação para todas as rotas
router.use(authMiddleware);

/**
 * @route GET /api/users
 * @desc Listar todos os usuários
 * @access Private (Admin)
 */
router.get('/', 
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('search').optional().isString(),
  query('role').optional().isString(),
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const { page = 1, limit = 10, search, role } = req.query;
      const result = await getUserService().getAllUsers({
        search: search as string,
        role: role as string
      });
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: 'Erro ao listar usuários' });
    }
  }
);

/**
 * @route GET /api/users/:id
 * @desc Obter usuário por ID
 * @access Private
 */
router.get('/:id',
  param('id').isInt({ min: 1 }),
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const userId = parseInt(req.params.id);
      const user = await getUserService().getUserById(userId);
      // if (!user) { // Removido - função void não retorna valor
      //   return res.status(404).json({ error: 'Usuário não encontrado' });
      // }
      res.json(user);
    } catch (error) {
      res.status(500).json({ error: 'Erro ao obter usuário' });
    }
  }
);

/**
 * @route POST /api/users
 * @desc Criar novo usuário
 * @access Private (Admin)
 */
router.post('/',
  body('name').isString().isLength({ min: 2, max: 100 }),
  body('email').isEmail(),
  body('password').isString().isLength({ min: 6 }),
  body('role').isString().isIn(['admin', 'manager', 'operator']),
  body('clientId').optional().isInt({ min: 1 }),
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const userData = req.body;
      const user = await getUserService().createUser(userData, 1); // Default user
      res.status(201).json(user);
    } catch (error) {
      res.status(400).json({ error: 'Erro ao criar usuário' });
    }
  }
);

/**
 * @route PUT /api/users/:id
 * @desc Atualizar usuário
 * @access Private
 */
router.put('/:id',
  param('id').isInt({ min: 1 }),
  body('name').optional().isString().isLength({ min: 2, max: 100 }),
  body('email').optional().isEmail(),
  body('role').optional().isString().isIn(['admin', 'manager', 'operator']),
  body('isActive').optional().isBoolean(),
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const userId = parseInt(req.params.id);
      const userData = req.body;
      const user = await getUserService().updateUser(userId, userData, 1); // Default user
      // if (!user) { // Removido - função void não retorna valor
      //   return res.status(404).json({ error: 'Usuário não encontrado' });
      // }
      res.json(user);
    } catch (error) {
      res.status(400).json({ error: 'Erro ao atualizar usuário' });
    }
  }
);

/**
 * @route DELETE /api/users/:id
 * @desc Deletar usuário
 * @access Private (Admin)
 */
router.delete('/:id',
  param('id').isInt({ min: 1 }),
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const userId = parseInt(req.params.id);
      await getUserService().deleteUser(userId, 1); // Default user
      res.json({ message: 'Usuário deletado com sucesso' });
    } catch (error) {
      res.status(500).json({ error: 'Erro ao deletar usuário' });
    }
  }
);

/**
 * @route PUT /api/users/:id/password
 * @desc Alterar senha do usuário
 * @access Private
 */
router.put('/:id/password',
  param('id').isInt({ min: 1 }),
  body('currentPassword').isString(),
  body('newPassword').isString().isLength({ min: 6 }),
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const userId = parseInt(req.params.id);
      const { currentPassword, newPassword } = req.body;
      const success = await getUserService().changePassword(userId, currentPassword, newPassword);
      // if (!success) { // Removido - função void não retorna valor
      //   return res.status(400).json({ error: 'Senha atual incorreta' });
      // }
      res.json({ message: 'Senha alterada com sucesso' });
    } catch (error) {
      res.status(500).json({ error: 'Erro ao alterar senha' });
    }
  }
);

/**
 * @route PUT /api/users/:id/activate
 * @desc Ativar/desativar usuário
 * @access Private (Admin)
 */
router.put('/:id/activate',
  param('id').isInt({ min: 1 }),
  body('isActive').isBoolean(),
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const userId = parseInt(req.params.id);
      const { isActive } = req.body;
      const user = await getUserService().activateUser(userId, isActive);
      // if (!user) { // Removido - função void não retorna valor
      //   return res.status(404).json({ error: 'Usuário não encontrado' });
      // }
      res.json(user);
    } catch (error) {
      res.status(500).json({ error: 'Erro ao alterar status do usuário' });
    }
  }
);

/**
 * @route GET /api/users/stats/overview
 * @desc Obter estatísticas de usuários
 * @access Private (Admin)
 */
router.get('/stats/overview', async (req: Request, res: Response) => {
  try {
    const stats = await getUserService().getUserStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao obter estatísticas' });
  }
});

export default router;
