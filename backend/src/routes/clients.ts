import express from 'express';
import { body, query, param } from 'express-validator';
import { validationResult } from 'express-validator';
import { authMiddleware } from '../middleware/auth.middleware';
import { getClientService } from '../services/clientService';
import { logError } from '../utils/loggerHelper';

const router = express.Router();

// Middleware de autenticação para todas as rotas
router.use(authMiddleware);

// Validações
const createClientValidator = [
  body('name').notEmpty().withMessage('Nome é obrigatório'),
  body('email').optional().isEmail().withMessage('Email inválido'),
  body('phone').optional().isString(),
  body('address').optional().isString(),
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
 * @route GET /api/clients
 * @desc Listar todos os clientes
 */
router.get('/', 
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('search').optional().isString(),
  validateRequest,
  async (req: any, res: any) => {
    try {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/966e3e3f-39d6-45ad-8c92-86d4ce51a1fc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'clients.ts:41',message:'GET /api/clients entry',data:{query:req.query,hasPlatformFilter:!!req.query.platform},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
      const { page = 1, limit = 10, search } = req.query;
      
      const result = await getClientService().getAllClients({
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        search: search as string,
      });
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/966e3e3f-39d6-45ad-8c92-86d4ce51a1fc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'clients.ts:52',message:'GET /api/clients response',data:{resultTotal:result.total,resultDataCount:result.data.length,resultData:result.data.map((c:any)=>({id:c.client_id,name:c.name}))},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
      
      return res.json(result);
    } catch (error) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/966e3e3f-39d6-45ad-8c92-86d4ce51a1fc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'clients.ts:58',message:'GET /api/clients error',data:{error:(error as any)?.message},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
      // #endregion
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
  async (req: any, res: any) => {
    try {
      const { id } = req.params;
      
      const client = await getClientService().getClientById(parseInt(id));
      
      if (!client) {
        return res.status(404).json({ error: 'Cliente não encontrado' });
      }

      return res.json(client);
    } catch (error) {
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
  async (req: any, res: any) => {
    try {
      const { name, email, phone, address } = req.body;
      
      const newClient = await getClientService().createClient({
        name,
        email,
        phone,
        address,
      });

      return res.status(201).json(newClient);
    } catch (error: any) {
      await logError('Erro ao criar cliente', error);
      return res.status(400).json({ error: error.message || 'Erro interno do servidor' });
    }
  }
);

/**
 * @route PUT /api/clients/:id
 * @desc Atualizar cliente
 */
router.put('/:id',
  param('id').isInt({ min: 1 }).withMessage('ID inválido'),
  body('name').optional().notEmpty().withMessage('Nome não pode ser vazio'),
  body('email').optional().isEmail().withMessage('Email inválido'),
  body('phone').optional().isString(),
  body('address').optional().isString(),
  validateRequest,
  async (req: any, res: any) => {
    try {
      const { id } = req.params;
      const { name, email, phone, address } = req.body;
      
      const updatedClient = await getClientService().updateClient(parseInt(id), {
        name,
        email,
        phone,
        address,
      });

      return res.json(updatedClient);
    } catch (error: any) {
      await logError('Erro ao atualizar cliente', error);
      return res.status(400).json({ error: error.message || 'Erro interno do servidor' });
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
  async (req: any, res: any) => {
    try {
      const { id } = req.params;
      
      await getClientService().deleteClient(parseInt(id));
      
      return res.status(204).send();
    } catch (error: any) {
      await logError('Erro ao excluir cliente', error);
      return res.status(400).json({ error: error.message || 'Erro interno do servidor' });
    }
  }
);

export default router;