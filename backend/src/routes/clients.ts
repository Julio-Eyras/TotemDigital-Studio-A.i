import { Router, Request, Response } from 'express';
import { ClientService } from '../services/clientService';
import { authMiddleware } from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/validation.middleware';
import { body, param, query } from 'express-validator';

const router = Router();

// Lazy initialization - só criar quando necessário
function getClientService(): ClientService {
  if (!(global as any).clientServiceInstance) {
    (global as any).clientServiceInstance = new ClientService();
  }
  return (global as any).clientServiceInstance;
}

// Middleware de autenticação para todas as rotas
router.use(authMiddleware);

/**
 * @route GET /api/clients
 * @desc Listar todos os clientes
 * @access Private
 */
router.get('/', 
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('search').optional().isString(),
  query('status').optional().isString(),
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const { page = 1, limit = 10, search, status } = req.query;
      const result = await getClientService().getAllClients({
        search: search as string,
        active: status === 'active'
      });
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: 'Erro ao listar clientes' });
    }
  }
);

/**
 * @route GET /api/clients/:id
 * @desc Obter cliente por ID
 * @access Private
 */
router.get('/:id',
  param('id').isInt({ min: 1 }),
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const clientId = parseInt(req.params.id);
      const client = await getClientService().getClientById(clientId);
      if (!client) {
        return res.status(404).json({ error: 'Cliente não encontrado' });
      }
      res.json(client);
    } catch (error) {
      res.status(500).json({ error: 'Erro ao obter cliente' });
    }
  }
);

/**
 * @route POST /api/clients
 * @desc Criar novo cliente
 * @access Private (Admin/Manager)
 */
router.post('/',
  body('name').isString().isLength({ min: 2, max: 100 }),
  body('email').isEmail(),
  body('phone').optional().isString(),
  body('address').optional().isString(),
  body('city').optional().isString(),
  body('state').optional().isString(),
  body('zipCode').optional().isString(),
  body('country').optional().isString(),
  body('contactPerson').optional().isString(),
  body('notes').optional().isString(),
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const clientData = req.body;
      const client = await getClientService().createClient(clientData, 1); // Default user
      res.status(201).json(client);
    } catch (error) {
      res.status(400).json({ error: 'Erro ao criar cliente' });
    }
  }
);

/**
 * @route PUT /api/clients/:id
 * @desc Atualizar cliente
 * @access Private (Admin/Manager)
 */
router.put('/:id',
  param('id').isInt({ min: 1 }),
  body('name').optional().isString().isLength({ min: 2, max: 100 }),
  body('email').optional().isEmail(),
  body('phone').optional().isString(),
  body('address').optional().isString(),
  body('city').optional().isString(),
  body('state').optional().isString(),
  body('zipCode').optional().isString(),
  body('country').optional().isString(),
  body('contactPerson').optional().isString(),
  body('notes').optional().isString(),
  body('isActive').optional().isBoolean(),
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const clientId = parseInt(req.params.id);
      const clientData = req.body;
      const client = await getClientService().updateClient(clientId, clientData, 1); // Default user
      if (!client) {
        return res.status(404).json({ error: 'Cliente não encontrado' });
      }
      res.json(client);
    } catch (error) {
      res.status(400).json({ error: 'Erro ao atualizar cliente' });
    }
  }
);

/**
 * @route DELETE /api/clients/:id
 * @desc Deletar cliente
 * @access Private (Admin)
 */
router.delete('/:id',
  param('id').isInt({ min: 1 }),
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const clientId = parseInt(req.params.id);
      await getClientService().deleteClient(clientId, 1); // Default user
      res.json({ message: 'Cliente deletado com sucesso' });
    } catch (error) {
      res.status(500).json({ error: 'Erro ao deletar cliente' });
    }
  }
);

/**
 * @route PUT /api/clients/:id/activate
 * @desc Ativar/desativar cliente
 * @access Private (Admin/Manager)
 */
router.put('/:id/activate',
  param('id').isInt({ min: 1 }),
  body('isActive').isBoolean(),
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const clientId = parseInt(req.params.id);
      const { isActive } = req.body;
      const client = await getClientService().activateClient(clientId, isActive);
      // if (!client) { // Removido - função void não retorna valor
      //   return res.status(404).json({ error: 'Cliente não encontrado' });
      // }
      res.json(client);
    } catch (error) {
      res.status(500).json({ error: 'Erro ao alterar status do cliente' });
    }
  }
);

/**
 * @route GET /api/clients/:id/totems
 * @desc Obter totems do cliente
 * @access Private
 */
router.get('/:id/totems',
  param('id').isInt({ min: 1 }),
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const clientId = parseInt(req.params.id);
      const totems = await getClientService().getClientTotems(clientId);
      res.json(totems);
    } catch (error) {
      res.status(500).json({ error: 'Erro ao obter totems do cliente' });
    }
  }
);

/**
 * @route GET /api/clients/:id/campaigns
 * @desc Obter campanhas do cliente
 * @access Private
 */
router.get('/:id/campaigns',
  param('id').isInt({ min: 1 }),
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const clientId = parseInt(req.params.id);
      const campaigns = await getClientService().getClientCampaigns(clientId);
      res.json(campaigns);
    } catch (error) {
      res.status(500).json({ error: 'Erro ao obter campanhas do cliente' });
    }
  }
);

/**
 * @route GET /api/clients/:id/analytics
 * @desc Obter analytics do cliente
 * @access Private
 */
router.get('/:id/analytics',
  param('id').isInt({ min: 1 }),
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601(),
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const clientId = parseInt(req.params.id);
      const { startDate, endDate } = req.query;
      const analytics = await getClientService().getClientAnalytics(clientId, {
        startDate: startDate as string,
        endDate: endDate as string
      });
      res.json(analytics);
    } catch (error) {
      res.status(500).json({ error: 'Erro ao obter analytics do cliente' });
    }
  }
);

/**
 * @route GET /api/clients/stats/overview
 * @desc Obter estatísticas de clientes
 * @access Private (Admin/Manager)
 */
router.get('/stats/overview', async (req: Request, res: Response) => {
  try {
    const stats = await getClientService().getClientStats(1); // Default client
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao obter estatísticas' });
  }
});

export default router;
