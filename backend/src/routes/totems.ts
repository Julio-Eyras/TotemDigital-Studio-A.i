import { Router, Request, Response } from 'express';
import { TotemService } from '../services/totemService';
import { authMiddleware } from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/validation.middleware';
import { body, param, query } from 'express-validator';

const router = Router();

// Lazy initialization - só criar quando necessário
function getTotemService(): TotemService {
  if (!(global as any).totemServiceInstance) {
    (global as any).totemServiceInstance = new TotemService();
  }
  return (global as any).totemServiceInstance;
}

// Middleware de autenticação para todas as rotas
router.use(authMiddleware);

/**
 * @route GET /api/totems
 * @desc Listar todos os totems
 * @access Private
 */
router.get('/', 
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('search').optional().isString(),
  query('status').optional().isString(),
  query('clientId').optional().isInt({ min: 1 }),
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const { page = 1, limit = 10, search, status, clientId } = req.query;
      const result = await getTotemService().getAllTotems({
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        search: search as string,
        status: status as string,
        clientId: clientId ? parseInt(clientId as string) : undefined
      });
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: 'Erro ao listar totems' });
    }
  }
);

/**
 * @route GET /api/totems/:id
 * @desc Obter totem por ID
 * @access Private
 */
router.get('/:id',
  param('id').isInt({ min: 1 }),
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const totemId = parseInt(req.params.id);
      const totem = await getTotemService().getTotemById(totemId);
      if (!totem) {
        return res.status(404).json({ error: 'Totem não encontrado' });
      }
      res.json(totem);
    } catch (error) {
      res.status(500).json({ error: 'Erro ao obter totem' });
    }
  }
);

/**
 * @route GET /api/totems/uin/:uin
 * @desc Obter totem por UIN
 * @access Private
 */
router.get('/uin/:uin',
  param('uin').isString().isLength({ min: 10, max: 50 }),
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const uin = req.params.uin;
      const totem = await getTotemService().getTotemByUin(uin);
      if (!totem) {
        return res.status(404).json({ error: 'Totem não encontrado' });
      }
      res.json(totem);
    } catch (error) {
      res.status(500).json({ error: 'Erro ao obter totem' });
    }
  }
);

/**
 * @route POST /api/totems
 * @desc Criar novo totem
 * @access Private (Admin/Manager)
 */
router.post('/',
  body('name').isString().isLength({ min: 2, max: 100 }),
  body('clientId').isInt({ min: 1 }),
  body('location').isString().isLength({ min: 2, max: 200 }),
  body('description').optional().isString(),
  body('ipAddress').optional().isIP(),
  body('macAddress').optional().isMACAddress(),
  body('model').optional().isString(),
  body('serialNumber').optional().isString(),
  body('resolution').optional().isString(),
  body('orientation').optional().isString().isIn(['portrait', 'landscape']),
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const totemData = req.body;
      const totem = await getTotemService().createTotem(totemData, 1); // Default user
      res.status(201).json(totem);
    } catch (error) {
      res.status(400).json({ error: 'Erro ao criar totem' });
    }
  }
);

/**
 * @route PUT /api/totems/:id
 * @desc Atualizar totem
 * @access Private (Admin/Manager)
 */
router.put('/:id',
  param('id').isInt({ min: 1 }),
  body('name').optional().isString().isLength({ min: 2, max: 100 }),
  body('clientId').optional().isInt({ min: 1 }),
  body('location').optional().isString().isLength({ min: 2, max: 200 }),
  body('description').optional().isString(),
  body('ipAddress').optional().isIP(),
  body('macAddress').optional().isMACAddress(),
  body('model').optional().isString(),
  body('serialNumber').optional().isString(),
  body('resolution').optional().isString(),
  body('orientation').optional().isString().isIn(['portrait', 'landscape']),
  body('isActive').optional().isBoolean(),
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const totemId = parseInt(req.params.id);
      const totemData = req.body;
      const totem = await getTotemService().updateTotem(totemId, totemData, 1); // Default user
      if (!totem) {
        return res.status(404).json({ error: 'Totem não encontrado' });
      }
      res.json(totem);
    } catch (error) {
      res.status(400).json({ error: 'Erro ao atualizar totem' });
    }
  }
);

/**
 * @route DELETE /api/totems/:id
 * @desc Deletar totem
 * @access Private (Admin)
 */
router.delete('/:id',
  param('id').isInt({ min: 1 }),
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const totemId = parseInt(req.params.id);
      await getTotemService().deleteTotem(totemId, 1); // Default user
      res.json({ message: 'Totem deletado com sucesso' });
    } catch (error) {
      res.status(500).json({ error: 'Erro ao deletar totem' });
    }
  }
);

/**
 * @route PUT /api/totems/:id/activate
 * @desc Ativar/desativar totem
 * @access Private (Admin/Manager)
 */
router.put('/:id/activate',
  param('id').isInt({ min: 1 }),
  body('isActive').isBoolean(),
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const totemId = parseInt(req.params.id);
      const { isActive } = req.body;
      if (isActive) {
        await getTotemService().activateTotem(totemId, 1);
      } else {
        await getTotemService().deactivateTotem(totemId, 1);
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Erro ao alterar status do totem' });
    }
  }
);

/**
 * @route POST /api/totems/:id/heartbeat
 * @desc Registrar heartbeat do totem
 * @access Private (Totem)
 */
router.post('/:id/heartbeat',
  param('id').isInt({ min: 1 }),
  body('status').isString().isIn(['online', 'offline', 'error']),
  body('uptime').optional().isInt({ min: 0 }),
  body('memoryUsage').optional().isFloat({ min: 0, max: 100 }),
  body('cpuUsage').optional().isFloat({ min: 0, max: 100 }),
  body('diskUsage').optional().isFloat({ min: 0, max: 100 }),
  body('temperature').optional().isFloat(),
  body('lastPlaylistUpdate').optional().isISO8601(),
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const totemId = parseInt(req.params.id);
      const heartbeatData = req.body;
      const heartbeat = await getTotemService().registerHeartbeat(totemId, heartbeatData);
      res.json(heartbeat);
    } catch (error) {
      res.status(400).json({ error: 'Erro ao registrar heartbeat' });
    }
  }
);

/**
 * @route GET /api/totems/:id/heartbeat
 * @desc Obter histórico de heartbeats
 * @access Private
 */
router.get('/:id/heartbeat',
  param('id').isInt({ min: 1 }),
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601(),
  query('limit').optional().isInt({ min: 1, max: 1000 }),
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const totemId = parseInt(req.params.id);
      const { startDate, endDate, limit = 100 } = req.query;
      const heartbeats = await getTotemService().getHeartbeatHistory(totemId, {
        startDate: startDate as string,
        endDate: endDate as string,
        limit: Number(limit)
      });
      res.json(heartbeats);
    } catch (error) {
      res.status(500).json({ error: 'Erro ao obter histórico de heartbeats' });
    }
  }
);

/**
 * @route GET /api/totems/:id/playlist
 * @desc Obter playlist atual do totem
 * @access Private
 */
router.get('/:id/playlist',
  param('id').isInt({ min: 1 }),
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const totemId = parseInt(req.params.id);
      const playlist = await getTotemService().getCurrentPlaylist(totemId);
      res.json(playlist);
    } catch (error) {
      res.status(500).json({ error: 'Erro ao obter playlist do totem' });
    }
  }
);

/**
 * @route GET /api/totems/:id/analytics
 * @desc Obter analytics do totem
 * @access Private
 */
router.get('/:id/analytics',
  param('id').isInt({ min: 1 }),
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601(),
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const totemId = parseInt(req.params.id);
      const { startDate, endDate } = req.query;
      const analytics = await getTotemService().getTotemAnalytics(totemId, {
        startDate: startDate as string,
        endDate: endDate as string
      });
      res.json(analytics);
    } catch (error) {
      res.status(500).json({ error: 'Erro ao obter analytics do totem' });
    }
  }
);

/**
 * @route GET /api/totems/stats/overview
 * @desc Obter estatísticas de totems
 * @access Private (Admin/Manager)
 */
router.get('/stats/overview', async (req: Request, res: Response) => {
  try {
    const stats = await getTotemService().getTotemStats(1); // Default totem
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao obter estatísticas' });
  }
});

/**
 * @route GET /api/totems/stats/offline
 * @desc Obter totems offline
 * @access Private (Admin/Manager)
 */
router.get('/stats/offline', async (req: Request, res: Response) => {
  try {
    const offlineTotems = await getTotemService().getOfflineTotems();
    res.json(offlineTotems);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao obter totems offline' });
  }
});

export default router;
