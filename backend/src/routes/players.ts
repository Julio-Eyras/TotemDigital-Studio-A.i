

import express, { Request, Response } from 'express';
import { body, query, param } from 'express-validator';
import { validationResult } from 'express-validator';
import { authMiddleware, authorizeRole } from '../middleware/auth.middleware';
import { getTotemCreateRoles } from '../utils/totemCreateRoles';
import { getPlayerService } from '../services/playerService';
import { logError } from '../utils/loggerHelper';
import { assertTotemReadAccess } from '../utils/totemReadAccess';
import { normalizeError } from '../utils/errors';

const router = express.Router();

// Middleware de autenticação para todas as rotas
router.use(authMiddleware);

// Validações
const createPlayerValidator = [
  body('name').notEmpty().withMessage('Nome é obrigatório'),
  body('location').optional({ nullable: true }).isString(),
  body('clientId').optional({ nullable: true }).isInt({ min: 1 }),
];

const validateRequest = (req: Request, res: Response, next: express.NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({
      error: 'Dados inválidos',
      details: errors.array()
    });
    return;
  }
  return next();
};

function respondTotemAccessError(res: Response, e: ReturnType<typeof normalizeError>): boolean {
  if (e?.statusCode === 403) {
    res.status(403).json({ error: e.message || 'Acesso negado' });
    return true;
  }
  if (e?.statusCode === 404) {
    res.status(404).json({ error: e.message || 'Player não encontrado' });
    return true;
  }
  return false;
}

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
  async (req: express.Request, res: express.Response): Promise<express.Response | void> => {
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
} catch (error: unknown) {
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
  async (req: express.Request, res: express.Response): Promise<express.Response | void> => {
    try {
      const { id } = req.params;
      const totemId = parseInt(id, 10);
      try {
        await assertTotemReadAccess(req, totemId);
} catch (rawErr: unknown) {
        const e = normalizeError(rawErr);
        if (respondTotemAccessError(res, e)) return;
        throw e;
      }

      const player = await getPlayerService().getPlayerById(totemId);
      
      if (!player) {
        return res.status(404).json({ error: 'Player não encontrado' });
      }

      return res.json(player);
} catch (error: unknown) {
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
  authorizeRole(getTotemCreateRoles()),
  createPlayerValidator,
  validateRequest,
  async (req: express.Request, res: express.Response): Promise<express.Response | void> => {
    try {
      const { name, location, clientId } = req.body;
      
      const newPlayer = await getPlayerService().createPlayer(
        {
          name,
          location,
          clientId,
        },
        String(req.user?.role ?? '')
      );

      return res.status(201).json(newPlayer);} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('Erro ao criar player', e.error);
      if ((e.message || '').includes('Acesso negado')) {
        return res.status(403).json({ error: e.message });
    }
      return res.status(400).json({ error: e.message || 'Erro interno do servidor' });
    }
  }
);

/**
 * @route PUT /api/players/:id
 * @desc Atualizar player
 */
router.put('/:id',
  param('id').isInt({ min: 1 }).withMessage('ID inválido'),
  body('name').optional({ nullable: true }).notEmpty().withMessage('Nome não pode ser vazio'),
  body('location').optional({ nullable: true }).isString(),
  body('clientId').optional({ nullable: true }).isInt({ min: 1 }),
  validateRequest,
  async (req: express.Request, res: express.Response): Promise<express.Response | void> => {
    try {
      const { id } = req.params;
      const totemId = parseInt(id, 10);
      try {
        await assertTotemReadAccess(req, totemId);
} catch (rawErr: unknown) {
        const e = normalizeError(rawErr);
        if (respondTotemAccessError(res, e)) return;
        throw e;
      }
      const { name, location, clientId, isActive } = req.body;

      const updatedPlayer = await getPlayerService().updatePlayer(totemId, {
        name,
        location,
        clientId,
        isActive,
      });

      return res.json(updatedPlayer);} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('Erro ao atualizar player', e.error);
      return res.status(400).json({ error: e.message || 'Erro interno do servidor' });
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
  async (req: express.Request, res: express.Response): Promise<express.Response | void> => {
    try {
      const { id } = req.params;
      const totemId = parseInt(id, 10);
      try {
        await assertTotemReadAccess(req, totemId);
} catch (rawErr: unknown) {
        const e = normalizeError(rawErr);
        if (respondTotemAccessError(res, e)) return;
        throw e;
      }

      await getPlayerService().deletePlayer(totemId);
      
      return res.status(204).send();} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('Erro ao excluir player', e.error);
      return res.status(400).json({ error: e.message || 'Erro interno do servidor' });
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
  async (req: express.Request, res: express.Response): Promise<express.Response | void> => {
    try {
      const { id } = req.params;
      const totemId = parseInt(id, 10);
      try {
        await assertTotemReadAccess(req, totemId);
} catch (rawErr: unknown) {
        const e = normalizeError(rawErr);
        if (respondTotemAccessError(res, e)) return;
        throw e;
      }
      const { playlistId } = req.body;

      await getPlayerService().assignPlaylist(totemId, playlistId);
      
      return res.json({
        message: 'Playlist atribuída com sucesso' });} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('Erro ao atribuir playlist ao player', e.error);
      return res.status(400).json({ error: e.message || 'Erro interno do servidor' });
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
  async (req: express.Request, res: express.Response): Promise<express.Response | void> => {
    try {
      const { id } = req.params;
      const totemId = parseInt(id, 10);
      try {
        await assertTotemReadAccess(req, totemId);
} catch (rawErr: unknown) {
        const e = normalizeError(rawErr);
        if (respondTotemAccessError(res, e)) return;
        throw e;
      }

      const status = await getPlayerService().getPlayerStatus(totemId);
      
      return res.json(status);} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('Erro ao obter status do player', e.error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
);

export default router;
