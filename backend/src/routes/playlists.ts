import express from 'express';
import { body, query, param, validationResult } from 'express-validator';
import { authMiddleware, authorizeRole } from '../middleware/auth.middleware';
import { blockClientDataAccess } from '../middleware/operatorProtection.middleware';
import { subscriberIsolationMiddleware } from '../middleware/subscriberIsolation.middleware';
import { getPlaylistService } from '../services/playlistService';
import { getSubscriberService } from '../services/subscriberService';
import { logError } from '../utils/loggerHelper';

const router = express.Router();

// Middleware de autenticação para todas as rotas
router.use(authMiddleware);

// Aplicar bloqueio de dados de clientes para OPERATOR
router.use(blockClientDataAccess);

// Aplicar isolamento de dados por subscriber
router.use(subscriberIsolationMiddleware);

// Validações
const createPlaylistValidator = [
  body('name').notEmpty().withMessage('Nome é obrigatório'),
  body('description').optional({ nullable: true, checkFalsy: true }).isString(),
  body('subscriberId').optional({ nullable: true, checkFalsy: true }).isInt({ min: 1 }).withMessage('subscriberId deve ser um número inteiro maior que 0'),
  body('clientId').optional({ nullable: true, checkFalsy: true }).isInt({ min: 1 }).withMessage('clientId (deprecated) deve ser um número inteiro maior que 0'),
];

const updatePlaylistValidator = [
  param('id').isInt({ min: 1 }).withMessage('ID inválido'),
  body('name').optional().notEmpty().withMessage('Nome não pode ser vazio'),
  body('description').optional().isString(),
  body('subscriberId').optional().isInt({ min: 1 }),
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
  query('subscriberId').optional().isInt({ min: 1 }),
  query('clientId').optional().isInt({ min: 1 }), // Deprecated, mantido para compatibilidade
  validateRequest,
  async (req: any, res: any) => {
    try {
      const { page = 1, limit = 10, search, subscriberId, clientId } = req.query;
      const userSubscriberId = req.user?.subscriberId || req.user?.clientId;
      const isAdmin = req.user?.role === 'admin' || req.user?.role === 'admin_sql';
      
      const result = await getPlaylistService().getAllPlaylists({
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        search: search as string,
        subscriberId: subscriberId ? parseInt(subscriberId as string) : undefined,
        clientId: clientId ? parseInt(clientId as string) : undefined, // Deprecated
      }, userSubscriberId, isAdmin);
      
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
      const userSubscriberId = req.user?.subscriberId || req.user?.clientId;
      const isAdmin = req.user?.role === 'admin' || req.user?.role === 'admin_sql';
      
      const playlist = await getPlaylistService().getPlaylistById(parseInt(id), userSubscriberId, isAdmin);
      
      if (!playlist) {
        return res.status(404).json({ error: 'Playlist não encontrada' });
      }

      res.json(playlist);
    } catch (error: any) {
      await logError('Erro ao obter playlist', error);
      if (error.message?.includes('Acesso negado')) {
        return res.status(403).json({ error: error.message });
      }
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
);

/**
 * @route GET /api/playlists/:id/preview
 * @desc Obter preview da playlist (lista de mídias com URLs)
 */
router.get('/:id/preview',
  param('id').isInt({ min: 1 }).withMessage('ID inválido'),
  validateRequest,
  async (req: any, res: any) => {
    try {
      const { id } = req.params;
      const userSubscriberId = req.user?.subscriberId || req.user?.clientId;
      const isAdmin = req.user?.role === 'admin' || req.user?.role === 'admin_sql';
      
      const playlist = await getPlaylistService().getPlaylistById(parseInt(id), userSubscriberId, isAdmin);
      
      if (!playlist) {
        return res.status(404).json({ error: 'Playlist não encontrada' });
      }

      // Obter mídia da playlist
      const items = await getPlaylistService().getPlaylistMedia(parseInt(id));
      
      // Formatar resposta com URLs de download
      const preview = {
        playlistId: playlist.playlist_id,
        playlistName: playlist.name,
        playlistDescription: playlist.description,
        mediaCount: items.length,
        items: items.map((item: any) => ({
          itemId: item.item_id,
          orderIndex: item.order_index,
          displaySeconds: item.duration,
          media: item.media ? {
            id: item.media.media_id,
            name: item.media.name,
            type: item.media.media_type,
            durationSeconds: item.media.duration_seconds,
            sizeBytes: item.media.size_bytes,
            mimeType: item.media.mime_type,
            downloadUrl: `/api/media/${item.media.media_id}/download`,
            thumbnailUrl: `/api/media/${item.media.media_id}/thumbnail`
          } : null
        }))
      };

      res.json(preview);
    } catch (error) {
      await logError('Erro ao obter preview da playlist', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
);

/**
 * @route POST /api/playlists
 * @desc Criar nova playlist
 * @access Private (Admin, Gerente Marketing)
 */
router.post('/',
  authorizeRole(['admin', 'gerente_marketing', 'subscriber']), // Adicionado 'subscriber'
  createPlaylistValidator,
  validateRequest,
  async (req: any, res: any) => {
    try {
      const { name, description, subscriberId, clientId } = req.body; // Aceita subscriberId e clientId (deprecated)
      const userSubscriberId = req.user?.subscriberId || req.user?.clientId;
      const isAdmin = req.user?.role === 'admin' || req.user?.role === 'admin_sql';
      const finalSubscriberId = subscriberId || clientId;
      
      // Validar limites do plano antes de criar playlist
      if (finalSubscriberId) {
        try {
          const subscriberService = getSubscriberService();
          await subscriberService.validatePlanLimits(finalSubscriberId, 'playlist');
        } catch (limitError: any) {
          return res.status(400).json({
            error: 'Limite do plano excedido',
            message: limitError.message || 'Limite de playlists do plano foi excedido'
          });
        }
      }
      
      const newPlaylist = await getPlaylistService().createPlaylist({
        name,
        description,
        subscriberId: finalSubscriberId, // Priorizar subscriberId
        clientId, // Deprecated, mantido para compatibilidade
      }, userSubscriberId, isAdmin);

      res.status(201).json(newPlaylist);
    } catch (error: any) {
      await logError('Erro ao criar playlist', error);
      if (error.message?.includes('Acesso negado')) {
        return res.status(403).json({ error: error.message });
      }
      res.status(400).json({ error: error.message || 'Erro interno do servidor' });
    }
  }
);

/**
 * @route PUT /api/playlists/:id
 * @desc Atualizar playlist
 * @access Private (Admin, Gerente Marketing)
 */
router.put('/:id',
  authorizeRole(['admin', 'gerente_marketing', 'subscriber']), // Adicionado 'subscriber'
  updatePlaylistValidator,
  validateRequest,
  async (req: any, res: any) => {
    try {
      const { id } = req.params;
      const { name, description, subscriberId, clientId, isActive } = req.body;
      const userSubscriberId = req.user?.subscriberId || req.user?.clientId;
      const isAdmin = req.user?.role === 'admin' || req.user?.role === 'admin_sql';
      
      const updatedPlaylist = await getPlaylistService().updatePlaylist(parseInt(id), {
        name,
        description,
        subscriberId: subscriberId || clientId, // Priorizar subscriberId
        clientId, // Deprecated
        isActive,
      }, userSubscriberId, isAdmin);

      res.json(updatedPlaylist);
    } catch (error: any) {
      await logError('Erro ao atualizar playlist', error);
      if (error.message?.includes('Acesso negado')) {
        return res.status(403).json({ error: error.message });
      }
      res.status(400).json({ error: error.message || 'Erro interno do servidor' });
    }
  }
);

/**
 * @route DELETE /api/playlists/:id
 * @desc Excluir playlist
 * @access Private (Admin, Gerente Marketing)
 */
router.delete('/:id',
  authorizeRole(['admin', 'gerente_marketing', 'subscriber']), // Adicionado 'subscriber'
  param('id').isInt({ min: 1 }).withMessage('ID inválido'),
  validateRequest,
  async (req: any, res: any) => {
    try {
      const { id } = req.params;
      const userSubscriberId = req.user?.subscriberId || req.user?.clientId;
      const isAdmin = req.user?.role === 'admin' || req.user?.role === 'admin_sql';
      
      await getPlaylistService().deletePlaylist(parseInt(id), userSubscriberId, isAdmin);
      
      res.status(204).send();
    } catch (error: any) {
      await logError('Erro ao excluir playlist', error);
      if (error.message?.includes('Acesso negado')) {
        return res.status(403).json({ error: error.message });
      }
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
      const userSubscriberId = req.user?.subscriberId || req.user?.clientId;
      const isAdmin = req.user?.role === 'admin' || req.user?.role === 'admin_sql';
      
      await getPlaylistService().addMediaToPlaylist(
        parseInt(id), 
        mediaId, 
        orderIndex, 
        duration,
        userSubscriberId,
        isAdmin
      );
      
      res.status(201).json({
        message: 'Mídia adicionada à playlist com sucesso'
      });
    } catch (error: any) {
      await logError('Erro ao adicionar mídia à playlist', error);
      if (error.message?.includes('Acesso negado') || error.message?.includes('pertence a outro subscriber')) {
        return res.status(403).json({ error: error.message });
      }
      res.status(400).json({ error: error.message || 'Erro interno do servidor' });
    }
  }
);

/**
 * @route PATCH /api/playlists/:id/media/:itemId
 * @desc Atualizar duração de um item da playlist
 */
router.patch('/:id/media/:itemId',
  param('id').isInt({ min: 1 }).withMessage('ID da playlist inválido'),
  param('itemId').isInt({ min: 1 }).withMessage('ID do item inválido'),
  body('duration').isInt({ min: 1000, max: 300000 }).withMessage('Duração deve estar entre 1000ms (1s) e 300000ms (300s)'),
  validateRequest,
  async (req: any, res: any) => {
    try {
      const { id, itemId } = req.params;
      const { duration } = req.body;
      const userSubscriberId = req.user?.subscriberId || req.user?.clientId;
      const isAdmin = req.user?.role === 'admin' || req.user?.role === 'admin_sql';
      
      await getPlaylistService().updatePlaylistItemDuration(parseInt(id), parseInt(itemId), duration, userSubscriberId, isAdmin);
      
      res.json({ message: 'Duração do item atualizada com sucesso' });
    } catch (error: any) {
      await logError('Erro ao atualizar duração do item da playlist', error);
      if (error.message?.includes('Acesso negado')) {
        return res.status(403).json({ error: error.message });
      }
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
      const userSubscriberId = req.user?.subscriberId || req.user?.clientId;
      const isAdmin = req.user?.role === 'admin' || req.user?.role === 'admin_sql';
      
      await getPlaylistService().removeMediaFromPlaylist(parseInt(id), parseInt(itemId), userSubscriberId, isAdmin);
      
      res.status(204).send();
    } catch (error: any) {
      await logError('Erro ao remover mídia da playlist', error);
      if (error.message?.includes('Acesso negado')) {
        return res.status(403).json({ error: error.message });
      }
      res.status(400).json({ error: error.message || 'Erro interno do servidor' });
    }
  }
);

export default router;