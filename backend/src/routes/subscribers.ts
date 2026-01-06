import express from 'express';
import { body, query, param } from 'express-validator';
import { validationResult } from 'express-validator';
import { authMiddleware } from '../middleware/auth.middleware';
import { getSubscriberService } from '../services/subscriberService';
import { logError } from '../utils/loggerHelper';

const router = express.Router();

// Middleware de autenticação para todas as rotas
router.use(authMiddleware);

// Validações
const createSubscriberValidator = [
  body('name').notEmpty().withMessage('Nome é obrigatório'),
  body('contact_name').optional().isString(),
  body('email').optional().isEmail().withMessage('Email inválido'),
  body('phone').optional().isString(),
  body('whatsapp').optional().isString(),
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
 * @route GET /api/subscribers
 * @desc Listar todos os subscribers (anunciantes)
 */
router.get('/', 
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('search').optional().isString(),
  validateRequest,
  async (req: any, res: any) => {
    try {
      const { page = 1, limit = 10, search } = req.query;
      
      const result = await getSubscriberService().getAllSubscribers({
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        search: search as string,
      });
      
      return res.json(result);
    } catch (error) {
      await logError('Erro ao listar subscribers', error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
);

/**
 * @route GET /api/subscribers/:id
 * @desc Obter subscriber por ID
 */
router.get('/:id',
  param('id').isInt({ min: 1 }).withMessage('ID inválido'),
  validateRequest,
  async (req: any, res: any) => {
    try {
      const { id } = req.params;
      
      const subscriber = await getSubscriberService().getSubscriberById(parseInt(id));
      
      if (!subscriber) {
        return res.status(404).json({ error: 'Subscriber não encontrado' });
      }

      return res.json(subscriber);
    } catch (error) {
      await logError('Erro ao obter subscriber', error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
);

/**
 * @route POST /api/subscribers
 * @desc Criar novo subscriber (anunciante)
 */
router.post('/',
  createSubscriberValidator,
  validateRequest,
    async (req: any, res: any) => {
      try {
        const { name, contact_name, email, phone, whatsapp, address, description } = req.body;
        
        const newSubscriber = await getSubscriberService().createSubscriber({
          name,
          contact_name,
          email,
          phone,
          whatsapp,
          address,
          description,
        });

      return res.status(201).json(newSubscriber);
    } catch (error: any) {
      await logError('Erro ao criar subscriber', error);
      return res.status(400).json({ error: error.message || 'Erro interno do servidor' });
    }
  }
);

/**
 * @route PUT /api/subscribers/:id
 * @desc Atualizar subscriber
 */
router.put('/:id',
  param('id').isInt({ min: 1 }).withMessage('ID inválido'),
  body('name').optional().notEmpty().withMessage('Nome não pode ser vazio'),
  body('contact_name').optional().isString(),
  body('email').optional().isEmail().withMessage('Email inválido'),
  body('phone').optional().isString(),
  body('whatsapp').optional().isString(),
  body('address').optional().isString(),
  validateRequest,
  async (req: any, res: any) => {
    try {
      const { id } = req.params;
      const { name, contact_name, email, phone, whatsapp, address, description } = req.body;
      
      const updatedSubscriber = await getSubscriberService().updateSubscriber(parseInt(id), {
        name,
        contact_name,
        email,
        phone,
        whatsapp,
        address,
        description,
      });

      return res.json(updatedSubscriber);
    } catch (error: any) {
      await logError('Erro ao atualizar subscriber', error);
      return res.status(400).json({ error: error.message || 'Erro interno do servidor' });
    }
  }
);

/**
 * @route DELETE /api/subscribers/:id
 * @desc Excluir subscriber (soft delete)
 */
router.delete('/:id',
  param('id').isInt({ min: 1 }).withMessage('ID inválido'),
  validateRequest,
  async (req: any, res: any) => {
    try {
      const { id } = req.params;
      
      await getSubscriberService().deleteSubscriber(parseInt(id));
      
      return res.status(204).send();
    } catch (error: any) {
      await logError('Erro ao excluir subscriber', error);
      return res.status(400).json({ error: error.message || 'Erro interno do servidor' });
    }
  }
);

/**
 * @route GET /api/subscribers/:id/locals
 * @desc Listar locals de um subscriber
 */
router.get('/:id/locals',
  param('id').isInt({ min: 1 }),
  validateRequest,
  async (req: any, res: any) => {
    try {
      const { id } = req.params;
      const locals = await getSubscriberService().getLocalsBySubscriber(parseInt(id));
      return res.json({ success: true, data: locals });
    } catch (error: any) {
      await logError('Erro ao listar locals do subscriber', error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
);

/**
 * @route GET /api/subscribers/:id/totems
 * @desc Listar totems de um subscriber
 */
router.get('/:id/totems',
  param('id').isInt({ min: 1 }),
  validateRequest,
  async (req: any, res: any) => {
    try {
      const { id } = req.params;
      const totems = await getSubscriberService().getTotemsBySubscriber(parseInt(id));
      return res.json({ success: true, data: totems });
    } catch (error: any) {
      await logError('Erro ao listar totems do subscriber', error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
);

/**
 * @route GET /api/subscribers/:id/smart-tvs
 * @desc Listar smart TVs de um subscriber
 */
router.get('/:id/smart-tvs',
  param('id').isInt({ min: 1 }),
  validateRequest,
  async (req: any, res: any) => {
    try {
      const { id } = req.params;
      const smartTvs = await getSubscriberService().getSmartTvsBySubscriber(parseInt(id));
      return res.json({ success: true, data: smartTvs });
    } catch (error: any) {
      await logError('Erro ao listar smart TVs do subscriber', error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
);

/**
 * @route GET /api/subscribers/:id/stats
 * @desc Obter estatísticas de um subscriber
 */
router.get('/:id/stats',
  param('id').isInt({ min: 1 }),
  validateRequest,
  async (req: any, res: any) => {
    try {
      const { id } = req.params;
      const stats = await getSubscriberService().getSubscriberStats(parseInt(id));
      return res.json({ success: true, data: stats });
    } catch (error: any) {
      await logError('Erro ao obter estatísticas do subscriber', error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
);

export default router;

