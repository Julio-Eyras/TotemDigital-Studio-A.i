/**
 * Smart Playlist Routes - Smart Signage v2.0
 * Rotas para playlist inteligente
 */

import { Router } from 'express';
import { SmartPlaylistService } from '../services/smartPlaylistService';
import { authenticateToken, authorizeRole } from '../middleware/auth.middleware';

const router = Router();

// Lazy initialization - só criar quando necessário
function getSmartPlaylistService(): SmartPlaylistService {
  if (!(global as any).smartPlaylistServiceInstance) {
    (global as any).smartPlaylistServiceInstance = new SmartPlaylistService();
  }
  return (global as any).smartPlaylistServiceInstance;
}

// Middleware de autenticação para todas as rotas
router.use(authenticateToken);

/**
 * @route GET /api/smart-playlist
 * @desc Lista smart playlists com paginação e filtros
 * @access Private (Admin, Manager, Client)
 */
router.get('/', async (req: any, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      clientId,
      campaignId,
      totemId,
      status,
      aiEnabled,
      search
    } = req.query;

    // Aplicar filtro de cliente se for Client
    const filters: any = {
      clientId: req.user.role === 'client' ? req.user.clientId : (clientId ? parseInt(clientId as string) : undefined),
      campaignId: campaignId ? parseInt(campaignId as string) : undefined,
      totemId: totemId ? parseInt(totemId as string) : undefined,
      status: status as string,
      aiEnabled: aiEnabled !== undefined ? aiEnabled === 'true' : undefined,
      search: search as string
    };

    const result = await getSmartPlaylistService().getSmartPlaylists(
      parseInt(page as string),
      parseInt(limit as string),
      filters
    );

    res.json({
      success: true,
      data: result
    });

  } catch (error: any) {
    console.error('❌ Erro ao listar smart playlists:', error.message);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
});

/**
 * @route GET /api/smart-playlist/stats
 * @desc Busca estatísticas de smart playlists
 * @access Private (Admin, Manager)
 */
router.get('/stats', authorizeRole(['admin', 'manager']), async (req, res) => {
  try {
    const stats = await getSmartPlaylistService().getSmartPlaylistStats();

    res.json({
      success: true,
      data: stats
    });

  } catch (error: any) {
    console.error('❌ Erro ao buscar estatísticas:', error.message);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
});

/**
 * @route GET /api/smart-playlist/:id
 * @desc Busca smart playlist por ID
 * @access Private (Admin, Manager, Client)
 */
router.get('/:id', async (req: any, res) => {
  try {
    const { id } = req.params;

    const playlist = await getSmartPlaylistService().getSmartPlaylistById(parseInt(id));

    if (!playlist) {
      return res.status(404).json({
        success: false,
        message: 'Smart playlist não encontrada'
      });
    }

    // Verificar permissão
    if (req.user.role === 'client' && req.user.clientId !== playlist.clientId) {
      return res.status(403).json({
        success: false,
        message: 'Acesso negado: Você só pode ver suas próprias smart playlists'
      });
    }

    res.json({
      success: true,
      data: playlist
    });

  } catch (error: any) {
    console.error('❌ Erro ao buscar smart playlist:', error.message);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
});

/**
 * @route POST /api/smart-playlist
 * @desc Cria nova smart playlist
 * @access Private (Admin, Manager, Client)
 */
router.post('/', async (req: any, res) => {
  try {
    const playlistData = req.body;

    // Verificar permissão
    if (req.user.role === 'client' && req.user.clientId !== playlistData.clientId) {
      return res.status(403).json({
        success: false,
        message: 'Acesso negado: Você só pode criar smart playlists para seu próprio cliente'
      });
    }

    const playlist = await getSmartPlaylistService().createSmartPlaylist(playlistData, req.user.userId);

    res.status(201).json({
      success: true,
      message: 'Smart playlist criada com sucesso',
      data: playlist
    });

  } catch (error: any) {
    console.error('❌ Erro ao criar smart playlist:', error.message);
    res.status(400).json({
      success: false,
      message: error.message || 'Erro ao criar smart playlist',
      error: error.message
    });
  }
});

/**
 * @route PUT /api/smart-playlist/:id
 * @desc Atualiza smart playlist
 * @access Private (Admin, Manager, Client)
 */
router.put('/:id', async (req: any, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Verificar se smart playlist existe e permissão
    const existingPlaylist = await getSmartPlaylistService().getSmartPlaylistById(parseInt(id));
    if (!existingPlaylist) {
      return res.status(404).json({
        success: false,
        message: 'Smart playlist não encontrada'
      });
    }

    if (req.user.role === 'client' && req.user.clientId !== existingPlaylist.clientId) {
      return res.status(403).json({
        success: false,
        message: 'Acesso negado: Você só pode editar suas próprias smart playlists'
      });
    }

    const playlist = await getSmartPlaylistService().updateSmartPlaylist(
      parseInt(id),
      updateData,
      req.user.userId
    );

    res.json({
      success: true,
      message: 'Smart playlist atualizada com sucesso',
      data: playlist
    });

  } catch (error: any) {
    console.error('❌ Erro ao atualizar smart playlist:', error.message);
    res.status(400).json({
      success: false,
      message: error.message || 'Erro ao atualizar smart playlist',
      error: error.message
    });
  }
});

/**
 * @route DELETE /api/smart-playlist/:id
 * @desc Remove smart playlist
 * @access Private (Admin, Manager)
 */
router.delete('/:id', authorizeRole(['admin', 'manager']), async (req: any, res) => {
  try {
    const { id } = req.params;

    await getSmartPlaylistService().deleteSmartPlaylist(parseInt(id), req.user.userId);

    res.json({
      success: true,
      message: 'Smart playlist removida com sucesso'
    });

  } catch (error: any) {
    console.error('❌ Erro ao remover smart playlist:', error.message);
    res.status(400).json({
      success: false,
      message: error.message || 'Erro ao remover smart playlist',
      error: error.message
    });
  }
});

/**
 * @route POST /api/smart-playlist/:id/generate
 * @desc Gera playlist inteligente
 * @access Private (Admin, Manager, Client)
 */
router.post('/:id/generate', async (req: any, res) => {
  try {
    const { id } = req.params;

    // Verificar se smart playlist existe e permissão
    const playlist = await getSmartPlaylistService().getSmartPlaylistById(parseInt(id));
    if (!playlist) {
      return res.status(404).json({
        success: false,
        message: 'Smart playlist não encontrada'
      });
    }

    if (req.user.role === 'client' && req.user.clientId !== playlist.clientId) {
      return res.status(403).json({
        success: false,
        message: 'Acesso negado: Você só pode gerar suas próprias smart playlists'
      });
    }

    const result = await getSmartPlaylistService().generateSmartPlaylist(parseInt(id), req.user.userId);

    res.json({
      success: true,
      message: 'Smart playlist gerada com sucesso',
      data: result
    });

  } catch (error: any) {
    console.error('❌ Erro ao gerar smart playlist:', error.message);
    res.status(400).json({
      success: false,
      message: error.message || 'Erro ao gerar smart playlist',
      error: error.message
    });
  }
});

/**
 * @route POST /api/smart-playlist/:id/activate
 * @desc Ativa smart playlist
 * @access Private (Admin, Manager, Client)
 */
router.post('/:id/activate', async (req: any, res) => {
  try {
    const { id } = req.params;

    // Verificar se smart playlist existe e permissão
    const playlist = await getSmartPlaylistService().getSmartPlaylistById(parseInt(id));
    if (!playlist) {
      return res.status(404).json({
        success: false,
        message: 'Smart playlist não encontrada'
      });
    }

    if (req.user.role === 'client' && req.user.clientId !== playlist.clientId) {
      return res.status(403).json({
        success: false,
        message: 'Acesso negado: Você só pode ativar suas próprias smart playlists'
      });
    }

    await getSmartPlaylistService().updateSmartPlaylist(parseInt(id), { isActive: true } as any, req.user.id);

    res.json({
      success: true,
      message: 'Smart playlist ativada com sucesso'
    });

  } catch (error: any) {
    console.error('❌ Erro ao ativar smart playlist:', error.message);
    res.status(400).json({
      success: false,
      message: error.message || 'Erro ao ativar smart playlist',
      error: error.message
    });
  }
});

/**
 * @route POST /api/smart-playlist/:id/deactivate
 * @desc Desativa smart playlist
 * @access Private (Admin, Manager, Client)
 */
router.post('/:id/deactivate', async (req: any, res) => {
  try {
    const { id } = req.params;

    // Verificar se smart playlist existe e permissão
    const playlist = await getSmartPlaylistService().getSmartPlaylistById(parseInt(id));
    if (!playlist) {
      return res.status(404).json({
        success: false,
        message: 'Smart playlist não encontrada'
      });
    }

    if (req.user.role === 'client' && req.user.clientId !== playlist.clientId) {
      return res.status(403).json({
        success: false,
        message: 'Acesso negado: Você só pode desativar suas próprias smart playlists'
      });
    }

    await getSmartPlaylistService().updateSmartPlaylist(parseInt(id), { isActive: false } as any, req.user.id);

    res.json({
      success: true,
      message: 'Smart playlist desativada com sucesso'
    });

  } catch (error: any) {
    console.error('❌ Erro ao desativar smart playlist:', error.message);
    res.status(400).json({
      success: false,
      message: error.message || 'Erro ao desativar smart playlist',
      error: error.message
    });
  }
});

/**
 * @route GET /api/smart-playlist/client/:clientId
 * @desc Lista smart playlists de um cliente específico
 * @access Private (Admin, Manager, Client)
 */
router.get('/client/:clientId', async (req: any, res) => {
  try {
    const { clientId } = req.params;
    const { limit = 50 } = req.query;

    // Verificar permissão
    if (req.user.role === 'client' && req.user.clientId !== parseInt(clientId)) {
      return res.status(403).json({
        success: false,
        message: 'Acesso negado: Você só pode ver suas próprias smart playlists'
      });
    }

    const result = await getSmartPlaylistService().getSmartPlaylists(
      1,
      parseInt(limit as string),
      { clientId: parseInt(clientId) }
    );

    res.json({
      success: true,
      data: result.playlists
    });

  } catch (error: any) {
    console.error('❌ Erro ao buscar smart playlists do cliente:', error.message);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
});

/**
 * @route GET /api/smart-playlist/campaign/:campaignId
 * @desc Lista smart playlists de uma campanha específica
 * @access Private (Admin, Manager, Client)
 */
router.get('/campaign/:campaignId', async (req: any, res) => {
  try {
    const { campaignId } = req.params;
    const { limit = 50 } = req.query;

    const result = await getSmartPlaylistService().getSmartPlaylists(
      1,
      parseInt(limit as string),
      { campaignId: parseInt(campaignId) }
    );

    res.json({
      success: true,
      data: result.playlists
    });

  } catch (error: any) {
    console.error('❌ Erro ao buscar smart playlists da campanha:', error.message);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
});

/**
 * @route GET /api/smart-playlist/totem/:totemId
 * @desc Lista smart playlists de um totem específico
 * @access Private (Admin, Manager, Client)
 */
router.get('/totem/:totemId', async (req: any, res) => {
  try {
    const { totemId } = req.params;
    const { limit = 50 } = req.query;

    const result = await getSmartPlaylistService().getSmartPlaylists(
      1,
      parseInt(limit as string),
      { totemId: parseInt(totemId) }
    );

    res.json({
      success: true,
      data: result.playlists
    });

  } catch (error: any) {
    console.error('❌ Erro ao buscar smart playlists do totem:', error.message);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
});

/**
 * @route POST /api/smart-playlist/:id/test
 * @desc Testa geração de smart playlist
 * @access Private (Admin, Manager, Client)
 */
router.post('/:id/test', async (req: any, res) => {
  try {
    const { id } = req.params;

    // Verificar se smart playlist existe e permissão
    const playlist = await getSmartPlaylistService().getSmartPlaylistById(parseInt(id));
    if (!playlist) {
      return res.status(404).json({
        success: false,
        message: 'Smart playlist não encontrada'
      });
    }

    if (req.user.role === 'client' && req.user.clientId !== playlist.clientId) {
      return res.status(403).json({
        success: false,
        message: 'Acesso negado: Você só pode testar suas próprias smart playlists'
      });
    }

    // Gerar playlist em modo de teste (não salva no banco)
    const result = await getSmartPlaylistService().generateSmartPlaylist(parseInt(id), req.user.userId);

    res.json({
      success: true,
      message: 'Teste de geração realizado com sucesso',
      data: result
    });

  } catch (error: any) {
    console.error('❌ Erro ao testar smart playlist:', error.message);
    res.status(400).json({
      success: false,
      message: error.message || 'Erro ao testar smart playlist',
      error: error.message
    });
  }
});

/**
 * @route POST /api/smart-playlist/bulk-generate
 * @desc Gera múltiplas smart playlists
 * @access Private (Admin, Manager)
 */
router.post('/bulk-generate', authorizeRole(['admin', 'manager']), async (req, res) => {
  try {
    const { playlistIds } = req.body;

    if (!playlistIds || !Array.isArray(playlistIds)) {
      return res.status(400).json({
        success: false,
        message: 'Lista de IDs de smart playlists é obrigatória'
      });
    }

    const results = [];
    const errors = [];

    for (const playlistId of playlistIds) {
      try {
        const result = await getSmartPlaylistService().generateSmartPlaylist(playlistId, req.user.id);
        results.push({ playlistId, success: true, result });
      } catch (error: any) {
        errors.push({ playlistId, success: false, error: error.message });
      }
    }

    res.json({
      success: true,
      message: `Processamento concluído: ${results.length} sucessos, ${errors.length} erros`,
      data: {
        results,
        errors,
        summary: {
          total: playlistIds.length,
          successful: results.length,
          failed: errors.length
        }
      }
    });

  } catch (error: any) {
    console.error('❌ Erro ao gerar smart playlists em lote:', error.message);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
});

export default router;
