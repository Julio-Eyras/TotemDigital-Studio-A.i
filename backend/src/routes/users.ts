import express from 'express';
import { body, query, param } from 'express-validator';
import { validationResult } from 'express-validator';
import { authMiddleware } from '../middleware/auth.middleware';

const router = express.Router();

// Middleware de autenticação para todas as rotas
router.use(authMiddleware);

// Validações
const createUserValidator = [
  body('username').notEmpty().withMessage('Nome de usuário é obrigatório'),
  body('email').optional().isEmail().withMessage('Email inválido'),
  body('password').notEmpty().withMessage('Senha é obrigatória'),
  body('name').notEmpty().withMessage('Nome é obrigatório'),
  body('role').isIn(['admin', 'user', 'client']).withMessage('Função inválida'),
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
 */
router.get('/', 
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('search').optional().isString(),
  query('role').optional().isIn(['admin', 'user', 'client']),
  query('clientId').optional().isInt({ min: 1 }),
  validateRequest,
  async (req: any, res: any) => {
    try {
      const { page = 1, limit = 10, search, role, clientId } = req.query;
      
      // Simular dados (substituir por chamada real ao banco)
      const users = [
        {
          user_id: 1,
          username: 'admin',
          email: 'admin@smart-signage.com',
          name: 'Administrator',
          role: 'admin',
          is_active: true,
          last_login: '2024-01-20T14:30:00Z',
          created_at: '2024-01-01T00:00:00Z',
        },
        {
          user_id: 2,
          username: 'joao.silva',
          email: 'joao@empresa.com',
          name: 'João Silva',
          role: 'user',
          client_id: 1,
          is_active: true,
          last_login: '2024-01-20T10:15:00Z',
          created_at: '2024-01-15T09:00:00Z',
        },
      ];

      res.json({
        data: users,
        total: users.length,
        page: parseInt(page),
        limit: parseInt(limit),
      });
    } catch (error) {
      console.error('Erro ao listar usuários:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
);

/**
 * @route GET /api/users/:id
 * @desc Obter usuário por ID
 */
router.get('/:id',
  param('id').isInt({ min: 1 }).withMessage('ID inválido'),
  validateRequest,
  async (req: any, res: any) => {
    try {
      const { id } = req.params;
      
      // Simular busca (substituir por chamada real ao banco)
      const user = {
        user_id: parseInt(id),
        username: 'admin',
        email: 'admin@smart-signage.com',
        name: 'Administrator',
        role: 'admin',
        is_active: true,
        last_login: '2024-01-20T14:30:00Z',
        created_at: '2024-01-01T00:00:00Z',
      };

      res.json(user);
    } catch (error) {
      console.error('Erro ao obter usuário:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
);

/**
 * @route POST /api/users
 * @desc Criar novo usuário
 */
router.post('/',
  createUserValidator,
  validateRequest,
  async (req: any, res: any) => {
    try {
      const { username, email, password, name, role, clientId } = req.body;
      
      // Simular criação (substituir por chamada real ao banco)
      const newUser = {
        user_id: Date.now(), // ID temporário
        username,
        email,
        name,
        role,
        client_id: clientId,
        is_active: true,
        created_at: new Date().toISOString(),
      };

      res.status(201).json(newUser);
    } catch (error) {
      console.error('Erro ao criar usuário:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
);

/**
 * @route PUT /api/users/:id
 * @desc Atualizar usuário
 */
router.put('/:id',
  param('id').isInt({ min: 1 }).withMessage('ID inválido'),
  body('username').optional().notEmpty().withMessage('Nome de usuário não pode ser vazio'),
  body('email').optional().isEmail().withMessage('Email inválido'),
  body('name').optional().notEmpty().withMessage('Nome não pode ser vazio'),
  body('role').optional().isIn(['admin', 'user', 'client']).withMessage('Função inválida'),
  body('clientId').optional().isInt({ min: 1 }),
  validateRequest,
  async (req: any, res: any) => {
    try {
      const { id } = req.params;
      const { username, email, name, role, clientId } = req.body;
      
      // Simular atualização (substituir por chamada real ao banco)
      const updatedUser = {
        user_id: parseInt(id),
        username: username || 'usuario',
        email,
        name: name || 'Usuário',
        role: role || 'user',
        client_id: clientId,
        is_active: true,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: new Date().toISOString(),
      };

      res.json(updatedUser);
    } catch (error) {
      console.error('Erro ao atualizar usuário:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
);

/**
 * @route DELETE /api/users/:id
 * @desc Excluir usuário
 */
router.delete('/:id',
  param('id').isInt({ min: 1 }).withMessage('ID inválido'),
  validateRequest,
  async (req: any, res: any) => {
    try {
      const { id } = req.params;
      
      // Simular exclusão (substituir por chamada real ao banco)
      res.status(204).send();
    } catch (error) {
      console.error('Erro ao excluir usuário:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
);

export default router;