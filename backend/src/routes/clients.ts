

import express from 'express';
import { body, query, param } from 'express-validator';
import { validationResult } from 'express-validator';
import { authMiddleware } from '../middleware/auth.middleware';
import { getClientService } from '../services/clientService';
import { logError } from '../utils/loggerHelper';
import { assertTenantClientParamAccess } from '../utils/tenantClientAccess';
import { normalizeError } from '../utils/errors';

const router = express.Router();

// Middleware de autenticação para todas as rotas
router.use(authMiddleware);

// Validações
const createClientValidator = [
  body('name').notEmpty().withMessage('Nome é obrigatório'),
  body('email').optional({ nullable: true }).isEmail().withMessage('Email inválido'),
  body('phone').optional({ nullable: true }).isString(),
  body('address').optional({ nullable: true }).isString(),
];

const validateRequest = (req: express.Request, res: express.Response, next: express.NextFunction): express.Response | void => {
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
 * @route GET /api/clients
 * @desc Listar todos os clientes
 */
router.get('/', 
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 10000 }),
  query('search').optional().isString(),
  validateRequest,
  async (req: express.Request, res: express.Response): Promise<express.Response | void> => {
    try {
      const { page = 1, limit = 10, search } = req.query;
      
      const result = await getClientService().getAllClients({
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        search: search as string,
      });
      
      return res.json(result);
} catch (error: unknown) {
      await logError('Erro ao listar clientes', error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
);

/**
 * @route GET /api/clients/:id
 * @desc Obter cliente por ID
 */
router.get('/:id',
  param('id').isInt({ min: 1 }).withMessage('ID inválido'),
  validateRequest,
  async (req: express.Request, res: express.Response): Promise<express.Response | void> => {
    try {
      const { id } = req.params;
      const sid = parseInt(id, 10);
      try {
        await assertTenantClientParamAccess(req, sid);
} catch (rawErr: unknown) {
  const e = normalizeError(rawErr);
        if (e?.statusCode === 403) {
          return res.status(403).json({ error: e.message || 'Acesso negado' });
        }
        throw e;
      }

      const client = await getClientService().getClientById(sid);
      
      if (!client) {
        return res.status(404).json({ error: 'Cliente não encontrado' });
      }

      return res.json(client);
} catch (error: unknown) {
      await logError('Erro ao obter cliente', error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
);

/**
 * @route POST /api/clients
 * @desc Criar novo cliente
 */
router.post('/',
  createClientValidator,
  validateRequest,
  async (req: express.Request, res: express.Response): Promise<express.Response | void> => {
    try {
      const { name, email, phone, address } = req.body;
      
      const newClient = await getClientService().createClient({
        name,
        email,
        phone,
        address,
      });

      return res.status(201).json(newClient);} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('Erro ao criar cliente', e.error);
      return res.status(400).json({ error: e.message || 'Erro interno do servidor' });
    }
  }
);

/**
 * @route PUT /api/clients/:id
 * @desc Atualizar cliente
 */
router.put('/:id',
  param('id').isInt({ min: 1 }).withMessage('ID inválido'),
  body('name').optional({ nullable: true }).notEmpty().withMessage('Nome não pode ser vazio'),
  body('email').optional({ nullable: true }).isEmail().withMessage('Email inválido'),
  body('phone').optional({ nullable: true }).isString(),
  body('address').optional({ nullable: true }).isString(),
  validateRequest,
  async (req: express.Request, res: express.Response): Promise<express.Response | void> => {
    try {
      const { id } = req.params;
      const sid = parseInt(id, 10);
      try {
        await assertTenantClientParamAccess(req, sid);
} catch (rawErr: unknown) {
  const e = normalizeError(rawErr);
        if (e?.statusCode === 403) {
          return res.status(403).json({ error: e.message || 'Acesso negado' });
        }
        throw e;
      }
      const { name, email, phone, address } = req.body;

      const updatedClient = await getClientService().updateClient(sid, {
        name,
        email,
        phone,
        address,
      });

      return res.json(updatedClient);} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('Erro ao atualizar cliente', e.error);
      return res.status(400).json({ error: e.message || 'Erro interno do servidor' });
    }
  }
);

/**
 * @route DELETE /api/clients/:id
 * @desc Excluir cliente
 */
router.delete('/:id',
  param('id').isInt({ min: 1 }).withMessage('ID inválido'),
  validateRequest,
  async (req: express.Request, res: express.Response): Promise<express.Response | void> => {
    try {
      const { id } = req.params;
      const sid = parseInt(id, 10);
      try {
        await assertTenantClientParamAccess(req, sid);
} catch (rawErr: unknown) {
  const e = normalizeError(rawErr);
        if (e?.statusCode === 403) {
          return res.status(403).json({ error: e.message || 'Acesso negado' });
        }
        throw e;
      }

      await getClientService().deleteClient(sid);
      
      return res.status(204).send();} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('Erro ao excluir cliente', e.error);
      return res.status(400).json({ error: e.message || 'Erro interno do servidor' });
    }
  }
);

export default router;