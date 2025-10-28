import express from 'express';
import { body, query, param } from 'express-validator';
import { validationResult } from 'express-validator';
import { authMiddleware } from '../middleware/auth.middleware';
import { playlistApi, PlaylistItem, CreatePlaylistRequest } from '../services/api';

const router = express.Router();

// Middleware de autenticação para todas as rotas
router.use(authMiddleware);

// Validações
const createPlaylistValidator = [
  body('name').notEmpty().withMessage('Nome é obrigatório'),
  body('description').optional().isString(),
  body('clientId').optional().isInt({ min: 1 }),
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
    return res.status(400).json({
      error: 'Dados inválidos',
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
      
      // Simular dados (substituir por chamada real ao banco)
      const playlists: PlaylistItem[] = [
        {
          playlist_id: 1,
          name: 'Horário Comercial',
          description: 'Playlist para horário comercial da loja',
          is_active: true,
          created_at: '2024-01-15T00:00:00Z',
          updated_at: '2024-01-20T14:30:00Z',
        },
        {
          playlist_id: 2,
          name: 'Promoções',
          description: 'Conteúdo promocional e ofertas',
          is_active: true,
          created_at: '2024-01-14T00:00:00Z',
          updated_at: '2024-01-19T16:45:00Z',
        },
      ];

      res.json({
        data: playlists,
        total: playlists.length,
        page: parseInt(page),
        limit: parseInt(limit),
      });
    } catch (error) {
      console.error('Erro ao listar playlists:', error);
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
      
      // Simular busca (substituir por chamada real ao banco)
      const playlist: PlaylistItem = {
        playlist_id: parseInt(id),
        name: 'Horário Comercial',
        description: 'Playlist para horário comercial da loja',
        is_active: true,
        created_at: '2024-01-15T00:00:00Z',
        updated_at: '2024-01-20T14:30:00Z',
      };

      res.json(playlist);
    } catch (error) {
      console.error('Erro ao obter playlist:', error);
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
      
      // Simular criação (substituir por chamada real ao banco)
      const newPlaylist: PlaylistItem = {
        playlist_id: Date.now(), // ID temporário
        name,
        description,
        client_id: clientId,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      res.status(201).json(newPlaylist);
    } catch (error) {
      console.error('Erro ao criar playlist:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
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
      const { name, description, clientId } = req.body;
      
      // Simular atualização (substituir por chamada real ao banco)
      const updatedPlaylist: PlaylistItem = {
        playlist_id: parseInt(id),
        name: name || 'Playlist Atualizada',
        description,
        client_id: clientId,
        is_active: true,
        created_at: '2024-01-15T00:00:00Z',
        updated_at: new Date().toISOString(),
      };

      res.json(updatedPlaylist);
    } catch (error) {
      console.error('Erro ao atualizar playlist:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
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
      
      // Simular exclusão (substituir por chamada real ao banco)
      res.status(204).send();
    } catch (error) {
      console.error('Erro ao excluir playlist:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
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
      
      // Simular mídia da playlist
      const playlistMedia = [
        {
          item_id: 1,
          playlist_id: parseInt(id),
          media_id: 1,
          order_index: 1,
          duration: 5000,
          media: {
            media_id: 1,
            name: 'Logo Empresa',
            media_type: 'image',
            file_path: '/uploads/logo.png',
            mime_type: 'image/png',
          }
        }
      ];

      res.json(playlistMedia);
    } catch (error) {
      console.error('Erro ao obter mídia da playlist:', error);
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
      
      // Simular adição de mídia
      res.status(201).json({
        message: 'Mídia adicionada à playlist com sucesso'
      });
    } catch (error) {
      console.error('Erro ao adicionar mídia à playlist:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
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
      
      // Simular remoção de mídia
      res.status(204).send();
    } catch (error) {
      console.error('Erro ao remover mídia da playlist:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
);

export default router;