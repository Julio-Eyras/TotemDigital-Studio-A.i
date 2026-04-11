import express from 'express';
import { body, query, param } from 'express-validator';
import { validationResult } from 'express-validator';
import { authMiddleware } from '../middleware/auth.middleware';
import { getPlayerService } from '../services/playerService';
import { logError } from '../utils/loggerHelper';

const router = express.Router();

// Middleware de autenticação para todas as rotas
router.use(authMiddleware);

// Validações
const createPlayerValidator = [
  body('name').notEmpty().withMessage('Nome é obrigatório'),
  body('location').optional().isString(),
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
  return next();
};

/**
 * @route GET /api/players
 * @desc Listar todos os players
 */
router.get('/', 
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 10000 }),
  query('search').optional().isString(),
  query('clientId').optional().isInt({ min: 1 }),
  query('status').optional().isString(),
  validateRequest,
  async (req: any, res: any) => {
    try {
      const { page = 1, limit = 10, search, clientId, status } = req.query;
      
      const result = await getPlayerService().getAllPlayers({
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        search: search as string,
        clientId: clientId ? parseInt(clientId as string) : undefined,
        status: status as string,
      });
      
      return res.json(result);
    } catch (error) {
      await logError('Erro ao listar players', error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
);

/**
 * @route GET /api/players/:id
 * @desc Obter player por ID
 */
router.get('/:id',
  param('id').isInt({ min: 1 }).withMessage('ID inválido'),
  validateRequest,
  async (req: any, res: any) => {
    try {
      const { id } = req.params;
      
      const player = await getPlayerService().getPlayerById(parseInt(id));
      
      if (!player) {
        return res.status(404).json({ error: 'Player não encontrado' });
      }

      return res.json(player);
    } catch (error) {
      await logError('Erro ao obter player', error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
);

/**
 * @route POST /api/players
 * @desc Criar novo player
 */
router.post('/',
  createPlayerValidator,
  validateRequest,
  async (req: any, res: any) => {
    try {
      const { name, location, clientId } = req.body;
      
      const newPlayer = await getPlayerService().createPlayer({
        name,
        location,
        clientId,
      });

      return res.status(201).json(newPlayer);
    } catch (error: any) {
      await logError('Erro ao criar player', error);
      return res.status(400).json({ error: error.message || 'Erro interno do servidor' });
    }
  }
);

/**
 * @route PUT /api/players/:id
 * @desc Atualizar player
 */
router.put('/:id',
  param('id').isInt({ min: 1 }).withMessage('ID inválido'),
  body('name').optional().notEmpty().withMessage('Nome não pode ser vazio'),
  body('location').optional().isString(),
  body('clientId').optional().isInt({ min: 1 }),
  validateRequest,
  async (req: any, res: any) => {
    try {
      const { id } = req.params;
      const { name, location, clientId, isActive } = req.body;
      
      const updatedPlayer = await getPlayerService().updatePlayer(parseInt(id), {
        name,
        location,
        clientId,
        isActive,
      });

      return res.json(updatedPlayer);
    } catch (error: any) {
      await logError('Erro ao atualizar player', error);
      return res.status(400).json({ error: error.message || 'Erro interno do servidor' });
    }
  }
);

/**
 * @route DELETE /api/players/:id
 * @desc Excluir player
 */
router.delete('/:id',
  param('id').isInt({ min: 1 }).withMessage('ID inválido'),
  validateRequest,
  async (req: any, res: any) => {
    try {
      const { id } = req.params;
      
      await getPlayerService().deletePlayer(parseInt(id));
      
      return res.status(204).send();
    } catch (error: any) {
      await logError('Erro ao excluir player', error);
      return res.status(400).json({ error: error.message || 'Erro interno do servidor' });
    }
  }
);

/**
 * @route POST /api/players/:id/playlist
 * @desc Atribuir playlist ao player
 */
router.post('/:id/playlist',
  param('id').isInt({ min: 1 }).withMessage('ID inválido'),
  body('playlistId').isInt({ min: 1 }).withMessage('ID da playlist é obrigatório'),
  validateRequest,
  async (req: any, res: any) => {
    try {
      const { id } = req.params;
      const { playlistId } = req.body;
      
      await getPlayerService().assignPlaylist(parseInt(id), playlistId);
      
      return res.json({ message: 'Playlist atribuída com sucesso' });
    } catch (error: any) {
      await logError('Erro ao atribuir playlist ao player', error);
      return res.status(400).json({ error: error.message || 'Erro interno do servidor' });
    }
  }
);

/**
 * @route GET /api/players/:id/status
 * @desc Obter status do player
 */
router.get('/:id/status',
  param('id').isInt({ min: 1 }).withMessage('ID inválido'),
  validateRequest,
  async (req: any, res: any) => {
    try {
      const { id } = req.params;
      
      const status = await getPlayerService().getPlayerStatus(parseInt(id));
      
      return res.json(status);
    } catch (error: any) {
      await logError('Erro ao obter status do player', error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
);

export default router;
