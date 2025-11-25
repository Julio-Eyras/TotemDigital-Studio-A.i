import express from 'express';
import { body, query, param, validationResult } from 'express-validator';
import { authMiddleware } from '../middleware/auth.middleware';
import { getPlaylistService } from '../services/playlistService';
import { logError } from '../utils/loggerHelper';

const router = express.Router();

// Middleware de autenticação para todas as rotas
router.use(authMiddleware);

// Validações
const createPlaylistValidator = [
  body('name').notEmpty().withMessage('Nome é obrigatório'),
  body('description').optional({ nullable: true, checkFalsy: true }).isString(),
  body('clientId').optional({ nullable: true, checkFalsy: true }).isInt({ min: 1 }).withMessage('clientId deve ser um número inteiro maior que 0'),
];

const updatePlaylistValidator = [
  param('id').isInt({ min: 1 }).withMessage('ID inválido'),
  body('name').optional().notEmpty().withMessage('Nome não pode ser vazio'),
  body('description').optional().isString(),
  body('clientId').optional().isInt({ min: 1 }),
];

const validateRequest = (req: any, res: any, next: any) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    logError('Erro de validação ao criar playlist', undefined, {
      errors: errors.array(),
      body: req.body
    }).catch(() => {});
    return res.status(400).json({
      error: 'Dados inválidos',
      message: 'Verifique os dados enviados',
      details: errors.array()
    });
  }
  next();
};

/**
 * @route GET /api/playlists
 * @desc Listar todas as playlists
 */
router.get('/', 
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('search').optional().isString(),
  query('clientId').optional().isInt({ min: 1 }),
  validateRequest,
  async (req: any, res: any) => {
    try {
      const { page = 1, limit = 10, search, clientId } = req.query;
      
      const result = await getPlaylistService().getAllPlaylists({
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        search: search as string,
        clientId: clientId ? parseInt(clientId as string) : undefined,
      });
      
      res.json(result);
    } catch (error) {
      await logError('Erro ao listar playlists', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
);

/**
 * @route GET /api/playlists/:id
 * @desc Obter playlist por ID
 */
router.get('/:id',
  param('id').isInt({ min: 1 }).withMessage('ID inválido'),
  validateRequest,
  async (req: any, res: any) => {
    try {
      const { id } = req.params;
      
      const playlist = await getPlaylistService().getPlaylistById(parseInt(id));
      
      if (!playlist) {
        return res.status(404).json({ error: 'Playlist não encontrada' });
      }

      res.json(playlist);
    } catch (error) {
      await logError('Erro ao obter playlist', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
);

/**
 * @route POST /api/playlists
 * @desc Criar nova playlist
 */
router.post('/',
  createPlaylistValidator,
  validateRequest,
  async (req: any, res: any) => {
    try {
      const { name, description, clientId } = req.body;
      
      const newPlaylist = await getPlaylistService().createPlaylist({
        name,
        description,
        clientId,
      });

      res.status(201).json(newPlaylist);
    } catch (error: any) {
      await logError('Erro ao criar playlist', error);
      res.status(400).json({ error: error.message || 'Erro interno do servidor' });
    }
  }
);

/**
 * @route PUT /api/playlists/:id
 * @desc Atualizar playlist
 */
router.put('/:id',
  updatePlaylistValidator,
  validateRequest,
  async (req: any, res: any) => {
    try {
      const { id } = req.params;
      const { name, description, clientId, isActive } = req.body;
      
      const updatedPlaylist = await getPlaylistService().updatePlaylist(parseInt(id), {
        name,
        description,
        clientId,
        isActive,
      });

      res.json(updatedPlaylist);
    } catch (error: any) {
      await logError('Erro ao atualizar playlist', error);
      res.status(400).json({ error: error.message || 'Erro interno do servidor' });
    }
  }
);

/**
 * @route DELETE /api/playlists/:id
 * @desc Excluir playlist
 */
router.delete('/:id',
  param('id').isInt({ min: 1 }).withMessage('ID inválido'),
  validateRequest,
  async (req: any, res: any) => {
    try {
      const { id } = req.params;
      
      await getPlaylistService().deletePlaylist(parseInt(id));
      
      res.status(204).send();
    } catch (error: any) {
      await logError('Erro ao excluir playlist', error);
      res.status(400).json({ error: error.message || 'Erro interno do servidor' });
    }
  }
);

/**
 * @route GET /api/playlists/:id/media
 * @desc Obter mídia da playlist
 */
router.get('/:id/media',
  param('id').isInt({ min: 1 }).withMessage('ID inválido'),
  validateRequest,
  async (req: any, res: any) => {
    try {
      const { id } = req.params;
      
      const playlistMedia = await getPlaylistService().getPlaylistMedia(parseInt(id));

      res.json(playlistMedia);
    } catch (error) {
      await logError('Erro ao obter mídia da playlist', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
);

/**
 * @route POST /api/playlists/:id/media
 * @desc Adicionar mídia à playlist
 */
router.post('/:id/media',
  param('id').isInt({ min: 1 }).withMessage('ID inválido'),
  body('mediaId').isInt({ min: 1 }).withMessage('ID da mídia é obrigatório'),
  body('orderIndex').optional().isInt({ min: 0 }),
  body('duration').optional().isInt({ min: 1000 }),
  validateRequest,
  async (req: any, res: any) => {
    try {
      const { id } = req.params;
      const { mediaId, orderIndex, duration } = req.body;
      
      await getPlaylistService().addMediaToPlaylist(parseInt(id), mediaId, orderIndex, duration);
      
      res.status(201).json({
        message: 'Mídia adicionada à playlist com sucesso'
      });
    } catch (error: any) {
      await logError('Erro ao adicionar mídia à playlist', error);
      res.status(400).json({ error: error.message || 'Erro interno do servidor' });
    }
  }
);

/**
 * @route DELETE /api/playlists/:id/media/:itemId
 * @desc Remover mídia da playlist
 */
router.delete('/:id/media/:itemId',
  param('id').isInt({ min: 1 }).withMessage('ID da playlist inválido'),
  param('itemId').isInt({ min: 1 }).withMessage('ID do item inválido'),
  validateRequest,
  async (req: any, res: any) => {
    try {
      const { id, itemId } = req.params;
      
      await getPlaylistService().removeMediaFromPlaylist(parseInt(id), parseInt(itemId));
      
      res.status(204).send();
    } catch (error: any) {
      await logError('Erro ao remover mídia da playlist', error);
      res.status(400).json({ error: error.message || 'Erro interno do servidor' });
    }
  }
);

export default router;