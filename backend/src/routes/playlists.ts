import { Router, Request, Response } from 'express';
import { PlaylistService } from '../services/playlistService';
import { authMiddleware } from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/validation.middleware';
import { body, param, query } from 'express-validator';

const router = Router();

// Lazy initialization - só criar quando necessário
function getPlaylistService(): PlaylistService {
  if (!(global as any).playlistServiceInstance) {
    (global as any).playlistServiceInstance = new PlaylistService();
  }
  return (global as any).playlistServiceInstance;
}

// Middleware de autenticação para todas as rotas
router.use(authMiddleware);

/**
 * @route GET /api/playlists
 * @desc Listar todas as playlists
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
      const result = await getPlaylistService().getAllPlaylists({
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        search: search as string,
        status: status as string,
        clientId: clientId ? parseInt(clientId as string) : undefined
      });
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: 'Erro ao listar playlists' });
    }
  }
);

/**
 * @route GET /api/playlists/:id
 * @desc Obter playlist por ID
 * @access Private
 */
router.get('/:id',
  param('id').isInt({ min: 1 }),
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const playlistId = parseInt(req.params.id);
      const playlist = await getPlaylistService().getPlaylistById(playlistId);
      if (!playlist) {
        return res.status(404).json({ error: 'Playlist não encontrada' });
      }
      res.json(playlist);
    } catch (error) {
      res.status(500).json({ error: 'Erro ao obter playlist' });
    }
  }
);

/**
 * @route POST /api/playlists
 * @desc Criar nova playlist
 * @access Private
 */
router.post('/',
  body('name').isString().isLength({ min: 2, max: 100 }),
  body('description').optional().isString(),
  body('clientId').isInt({ min: 1 }),
  body('isActive').optional().isBoolean(),
  body('items').optional().isArray(),
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const playlistData = req.body;
      const playlist = await getPlaylistService().createPlaylist(playlistData, 1); // Default user
      res.status(201).json(playlist);
    } catch (error) {
      res.status(400).json({ error: 'Erro ao criar playlist' });
    }
  }
);

/**
 * @route PUT /api/playlists/:id
 * @desc Atualizar playlist
 * @access Private
 */
router.put('/:id',
  param('id').isInt({ min: 1 }),
  body('name').optional().isString().isLength({ min: 2, max: 100 }),
  body('description').optional().isString(),
  body('isActive').optional().isBoolean(),
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const playlistId = parseInt(req.params.id);
      const playlistData = req.body;
      const playlist = await getPlaylistService().updatePlaylist(playlistId, playlistData, 1); // Default user
      if (!playlist) {
        return res.status(404).json({ error: 'Playlist não encontrada' });
      }
      res.json(playlist);
    } catch (error) {
      res.status(400).json({ error: 'Erro ao atualizar playlist' });
    }
  }
);

/**
 * @route DELETE /api/playlists/:id
 * @desc Deletar playlist
 * @access Private
 */
router.delete('/:id',
  param('id').isInt({ min: 1 }),
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const playlistId = parseInt(req.params.id);
      await getPlaylistService().deletePlaylist(playlistId, 1); // Default user
      res.json({ message: 'Playlist deletada com sucesso' });
    } catch (error) {
      res.status(500).json({ error: 'Erro ao deletar playlist' });
    }
  }
);

/**
 * @route PUT /api/playlists/:id/activate
 * @desc Ativar/desativar playlist
 * @access Private
 */
router.put('/:id/activate',
  param('id').isInt({ min: 1 }),
  body('isActive').isBoolean(),
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const playlistId = parseInt(req.params.id);
      const { isActive } = req.body;
      const playlist = await getPlaylistService().activatePlaylist(playlistId, isActive);
      // if (!playlist) { // Removido - função void não retorna valor
      //   return res.status(404).json({ error: 'Playlist não encontrada' });
      // }
      res.json(playlist);
    } catch (error) {
      res.status(500).json({ error: 'Erro ao alterar status da playlist' });
    }
  }
);

/**
 * @route GET /api/playlists/:id/items
 * @desc Obter itens da playlist
 * @access Private
 */
router.get('/:id/items',
  param('id').isInt({ min: 1 }),
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const playlistId = parseInt(req.params.id);
      const items = await getPlaylistService().getPlaylistItems(playlistId);
      res.json(items);
    } catch (error) {
      res.status(500).json({ error: 'Erro ao obter itens da playlist' });
    }
  }
);

/**
 * @route POST /api/playlists/:id/items
 * @desc Adicionar item à playlist
 * @access Private
 */
router.post('/:id/items',
  param('id').isInt({ min: 1 }),
  body('mediaId').isInt({ min: 1 }),
  body('duration').optional().isInt({ min: 1 }),
  body('order').optional().isInt({ min: 0 }),
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const playlistId = parseInt(req.params.id);
      const itemData = req.body;
      const item = await getPlaylistService().addPlaylistItem(playlistId, itemData);
      res.status(201).json(item);
    } catch (error) {
      res.status(400).json({ error: 'Erro ao adicionar item à playlist' });
    }
  }
);

/**
 * @route PUT /api/playlists/:id/items/:itemId
 * @desc Atualizar item da playlist
 * @access Private
 */
router.put('/:id/items/:itemId',
  param('id').isInt({ min: 1 }),
  param('itemId').isInt({ min: 1 }),
  body('duration').optional().isInt({ min: 1 }),
  body('order').optional().isInt({ min: 0 }),
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const playlistId = parseInt(req.params.id);
      const itemId = parseInt(req.params.itemId);
      const itemData = req.body;
      const item = await getPlaylistService().updatePlaylistItem(playlistId, itemId, itemData);
      if (!item) {
        return res.status(404).json({ error: 'Item não encontrado' });
      }
      res.json(item);
    } catch (error) {
      res.status(400).json({ error: 'Erro ao atualizar item da playlist' });
    }
  }
);

/**
 * @route DELETE /api/playlists/:id/items/:itemId
 * @desc Remover item da playlist
 * @access Private
 */
router.delete('/:id/items/:itemId',
  param('id').isInt({ min: 1 }),
  param('itemId').isInt({ min: 1 }),
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const playlistId = parseInt(req.params.id);
      const itemId = parseInt(req.params.itemId);
      const success = await getPlaylistService().removePlaylistItem(playlistId, itemId);
      if (!success) {
        return res.status(404).json({ error: 'Item não encontrado' });
      }
      res.json({ message: 'Item removido da playlist com sucesso' });
    } catch (error) {
      res.status(500).json({ error: 'Erro ao remover item da playlist' });
    }
  }
);

/**
 * @route PUT /api/playlists/:id/items/reorder
 * @desc Reordenar itens da playlist
 * @access Private
 */
router.put('/:id/items/reorder',
  param('id').isInt({ min: 1 }),
  body('items').isArray(),
  body('items.*.id').isInt({ min: 1 }),
  body('items.*.order').isInt({ min: 0 }),
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const playlistId = parseInt(req.params.id);
      const { items } = req.body;
      const result = await getPlaylistService().reorderPlaylistItems(playlistId, items);
      res.json(result);
    } catch (error) {
      res.status(400).json({ error: 'Erro ao reordenar itens da playlist' });
    }
  }
);

/**
 * @route POST /api/playlists/:id/duplicate
 * @desc Duplicar playlist
 * @access Private
 */
router.post('/:id/duplicate',
  param('id').isInt({ min: 1 }),
  body('name').optional().isString().isLength({ min: 2, max: 100 }),
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const playlistId = parseInt(req.params.id);
      const { name } = req.body;
      const playlist = await getPlaylistService().duplicatePlaylist(playlistId, name);
      res.status(201).json(playlist);
    } catch (error) {
      res.status(400).json({ error: 'Erro ao duplicar playlist' });
    }
  }
);

/**
 * @route GET /api/playlists/:id/duration
 * @desc Obter duração total da playlist
 * @access Private
 */
router.get('/:id/duration',
  param('id').isInt({ min: 1 }),
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const playlistId = parseInt(req.params.id);
      const duration = await getPlaylistService().getPlaylistDuration(playlistId);
      res.json({ duration });
    } catch (error) {
      res.status(500).json({ error: 'Erro ao calcular duração da playlist' });
    }
  }
);

/**
 * @route GET /api/playlists/stats/overview
 * @desc Obter estatísticas de playlists
 * @access Private
 */
router.get('/stats/overview', async (req: Request, res: Response) => {
  try {
    const stats = await getPlaylistService().getPlaylistStats(1); // Default playlist
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao obter estatísticas' });
  }
});

export default router;
