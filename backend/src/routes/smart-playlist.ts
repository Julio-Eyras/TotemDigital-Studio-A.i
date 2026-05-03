/**
 * Smart Playlist Routes - Smart Signage v2.0
 * Rotas para playlist inteligente
 */

import { Router } from 'express';
import { getSmartPlaylistService } from '../services/smartPlaylistService';
import { authenticateToken, authorizeRole } from '../middleware/auth.middleware';
import { blockClientDataAccess } from '../middleware/operatorProtection.middleware';
import { logError, logDebug } from '../utils/loggerHelper';
import { assertTenantClientParamAccess } from '../utils/tenantClientAccess';
import { assertCampaignReadAccess } from '../utils/campaignReadAccess';
import { assertTotemReadAccess } from '../utils/totemReadAccess';
import { isAdminRole } from '../utils/tenantScope';

const router = Router();

// Middleware de autenticação para todas as rotas
router.use(authenticateToken);

// Aplicar bloqueio de dados de clientes para OPERATOR
router.use(blockClientDataAccess);

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
      subscriberId,
      campaignId,
      totemId,
      status,
      aiEnabled,
      search
    } = req.query;

    // Aplicar filtro de cliente se for Client
    const filters: any = {
      subscriberId: req.user.role === 'client' || req.user.role === 'subscriber' ? (req.user.subscriberId || req.subscriberId) : (subscriberId ? parseInt(subscriberId as string) : undefined),
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

    return res.json({
      success: true,
      data: result
    });

  } catch (error: any) {
    await logError('Erro ao listar smart playlists', error);
    return res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message || 'Erro desconhecido'
    });
  }
});

/**
 * @route GET /api/smart-playlist/stats
 * @desc Busca estatísticas de smart playlists
 * @access Private (Admin, Manager)
 */
router.get('/stats', authorizeRole(['admin', 'gerente_marketing']), async (_req, res) => {
  try {
    const stats = await getSmartPlaylistService().getSmartPlaylistStats();

    return res.json({
      success: true,
      data: stats
    });

  } catch (error: any) {
    await logError('Erro ao buscar estatísticas de smart playlists', error);
    return res.status(500).json({
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

    const playlist = await getSmartPlaylistService().getSmartPlaylistById(parseInt(id, 10));

    if (!playlist) {
      return res.status(404).json({
        success: false,
        message: 'Smart playlist não encontrada'
      });
    }

    const sid = playlist.subscriberId != null ? Number(playlist.subscriberId) : NaN;
    if (!Number.isFinite(sid) || sid < 1) {
      return res.status(400).json({
        success: false,
        message: 'Smart playlist sem assinante associado'
      });
    }

    if (!isAdminRole(req.user?.role)) {
      try {
        await assertTenantClientParamAccess(req, sid);
      } catch (e: any) {
        if (e?.statusCode === 403) {
          return res.status(403).json({
            success: false,
            message: e.message || 'Acesso negado'
          });
        }
        throw e;
      }
    }

    return res.json({
      success: true,
      data: playlist
    });

  } catch (error: any) {
    await logError('Erro ao buscar smart playlist', error);
    return res.status(500).json({
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

    // Log para debug
    await logDebug('[Smart Playlist] Dados recebidos', { playlistData });
    await logDebug('[Smart Playlist] Usuário', { userId: req.user?.userId, role: req.user?.role, subscriberId: req.user?.subscriberId });

    // Validar campos obrigatórios básicos
    if (!playlistData.name || (typeof playlistData.name === 'string' && playlistData.name.trim() === '')) {
      return res.status(400).json({
        success: false,
        message: 'name é obrigatório e não pode estar vazio'
      });
    }

    // Remover campos undefined
    Object.keys(playlistData).forEach(key => {
      if (playlistData[key] === undefined) {
        delete playlistData[key];
      }
    });

    // Se subscriberId não foi fornecido, usar o do usuário autenticado ou buscar primeiro subscriber
    if (!playlistData.subscriberId) {
      if (req.user.role === 'client' && req.user.subscriberId) {
        playlistData.subscriberId = req.user.subscriberId;
        await logDebug('[Smart Playlist] Usando subscriberId do usuário', { subscriberId: playlistData.subscriberId });
      } else if (req.user.role === 'admin' || req.user.role === 'admin_sql' || req.user.role === 'gerente_marketing') {
        // Para admin/manager, buscar primeiro cliente ativo se não fornecido
        try {
          await logDebug('[Smart Playlist] Buscando primeiro cliente ativo');
          const firstSubscriber = await getSmartPlaylistService().getFirstActiveClient();
          if (firstSubscriber) {
            playlistData.subscriberId = firstSubscriber.subscriber_id;
            await logDebug('[Smart Playlist] Subscriber encontrado', { subscriberId: playlistData.subscriberId });
          } else {
            await logError('[Smart Playlist] Nenhum cliente ativo encontrado');
            return res.status(400).json({
              success: false,
              message: 'Nenhum cliente encontrado. É necessário criar um cliente antes de criar smart playlists.'
            });
          }
        } catch (error: any) {
          await logError('[Smart Playlist] Erro ao buscar primeiro cliente', error);
          return res.status(400).json({
            success: false,
            message: 'clientId é obrigatório para criar smart playlist'
          });
        }
      } else {
        await logError('[Smart Playlist] Role inválido ou sem clientId', undefined, { role: req.user.role });
        return res.status(400).json({
          success: false,
          message: 'clientId é obrigatório'
        });
      }
    }

    // Verificar permissão
    if (req.user.role === 'client' && req.user.subscriberId !== playlistData.subscriberId) {
      return res.status(403).json({
        success: false,
        message: 'Acesso negado: Você só pode criar smart playlists para seu próprio cliente'
      });
    }

    await logDebug('[Smart Playlist] Dados finais antes de criar', { playlistData });

    const playlist = await getSmartPlaylistService().createSmartPlaylist(playlistData, req.user.userId);

    return res.status(201).json({
      success: true,
      message: 'Smart playlist criada com sucesso',
      data: playlist
    });

  } catch (error: any) {
    await logError('Erro ao criar smart playlist', error);
    return res.status(400).json({
      success: false,
      message: error.message || 'Erro ao criar smart playlist',
      error: error.message || 'Erro desconhecido'
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

    if (req.user.role === 'client' && req.user.subscriberId !== existingPlaylist.subscriberId) {
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

    return res.json({
      success: true,
      message: 'Smart playlist atualizada com sucesso',
      data: playlist
    });

  } catch (error: any) {
    await logError('Erro ao atualizar smart playlist', error);
    return res.status(400).json({
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
router.delete('/:id', authorizeRole(['admin', 'gerente_marketing']), async (req: any, res) => {
  try {
    const { id } = req.params;

    await getSmartPlaylistService().deleteSmartPlaylist(parseInt(id), req.user.userId);

    return res.json({
      success: true,
      message: 'Smart playlist removida com sucesso'
    });

  } catch (error: any) {
    await logError('Erro ao remover smart playlist', error);
    return res.status(400).json({
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

    if (req.user.role === 'client' && req.user.subscriberId !== playlist.subscriberId) {
      return res.status(403).json({
        success: false,
        message: 'Acesso negado: Você só pode gerar suas próprias smart playlists'
      });
    }

    const result = await getSmartPlaylistService().generateSmartPlaylist(parseInt(id), req.user.userId);

    return res.json({
      success: true,
      message: 'Smart playlist gerada com sucesso',
      data: result
    });

  } catch (error: any) {
    await logError('Erro ao gerar smart playlist manualmente', error);
    return res.status(400).json({
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

    if (req.user.role === 'client' && req.user.subscriberId !== playlist.subscriberId) {
      return res.status(403).json({
        success: false,
        message: 'Acesso negado: Você só pode ativar suas próprias smart playlists'
      });
    }

    await getSmartPlaylistService().updateSmartPlaylist(parseInt(id), { isActive: true } as any, req.user.id);

    return res.json({
      success: true,
      message: 'Smart playlist ativada com sucesso'
    });

  } catch (error: any) {
    await logError('Erro ao ativar smart playlist', error);
    return res.status(400).json({
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

    if (req.user.role === 'client' && req.user.subscriberId !== playlist.subscriberId) {
      return res.status(403).json({
        success: false,
        message: 'Acesso negado: Você só pode desativar suas próprias smart playlists'
      });
    }

    await getSmartPlaylistService().updateSmartPlaylist(parseInt(id), { isActive: false } as any, req.user.id);

    return res.json({
      success: true,
      message: 'Smart playlist desativada com sucesso'
    });

  } catch (error: any) {
    await logError('Erro ao desativar smart playlist', error);
    return res.status(400).json({
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

    const sid = parseInt(clientId, 10);
    if (Number.isNaN(sid) || sid < 1) {
      return res.status(400).json({
        success: false,
        message: 'ID de assinante inválido'
      });
    }

    await assertTenantClientParamAccess(req, sid);

    const result = await getSmartPlaylistService().getSmartPlaylists(
      1,
      parseInt(String(limit), 10),
      { subscriberId: sid }
    );

    return res.json({
      success: true,
      data: result.playlists
    });

  } catch (error: any) {
    if (error?.statusCode === 403) {
      return res.status(403).json({
        success: false,
        message: error.message || 'Acesso negado'
      });
    }
    await logError('Erro ao buscar smart playlists do cliente', error);
    return res.status(500).json({
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

    const cid = parseInt(campaignId, 10);
    if (Number.isNaN(cid) || cid < 1) {
      return res.status(400).json({
        success: false,
        message: 'ID de campanha inválido'
      });
    }

    await assertCampaignReadAccess(req, cid);

    const result = await getSmartPlaylistService().getSmartPlaylists(
      1,
      parseInt(String(limit), 10),
      { campaignId: cid }
    );

    return res.json({
      success: true,
      data: result.playlists
    });

  } catch (error: any) {
    if (error?.statusCode === 403) {
      return res.status(403).json({
        success: false,
        message: error.message || 'Acesso negado'
      });
    }
    if (error?.statusCode === 404) {
      return res.status(404).json({
        success: false,
        message: error.message || 'Não encontrado'
      });
    }
    await logError('Erro ao buscar smart playlists da campanha', error);
    return res.status(500).json({
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

    const tid = parseInt(totemId, 10);
    if (Number.isNaN(tid) || tid < 1) {
      return res.status(400).json({
        success: false,
        message: 'ID de totem inválido'
      });
    }

    await assertTotemReadAccess(req, tid);

    const result = await getSmartPlaylistService().getSmartPlaylists(
      1,
      parseInt(String(limit), 10),
      { totemId: tid }
    );

    return res.json({
      success: true,
      data: result.playlists
    });

  } catch (error: any) {
    if (error?.statusCode === 403) {
      return res.status(403).json({
        success: false,
        message: error.message || 'Acesso negado'
      });
    }
    if (error?.statusCode === 404) {
      return res.status(404).json({
        success: false,
        message: error.message || 'Não encontrado'
      });
    }
    await logError('Erro ao buscar smart playlists do totem', error);
    return res.status(500).json({
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

    if (req.user.role === 'client' && req.user.subscriberId !== playlist.subscriberId) {
      return res.status(403).json({
        success: false,
        message: 'Acesso negado: Você só pode testar suas próprias smart playlists'
      });
    }

    // Gerar playlist em modo de teste (não salva no banco)
    const result = await getSmartPlaylistService().generateSmartPlaylist(parseInt(id), req.user.userId);

    return res.json({
      success: true,
      message: 'Teste de geração realizado com sucesso',
      data: result
    });

  } catch (error: any) {
    await logError('Erro ao testar smart playlist', error);
    return res.status(400).json({
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
router.post('/bulk-generate', authorizeRole(['admin', 'gerente_marketing']), async (req, res) => {
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
        const result = await getSmartPlaylistService().generateSmartPlaylist(playlistId, req.user?.id || req.user?.userId || 0);
        results.push({ playlistId, success: true, result });
      } catch (error: any) {
        errors.push({ playlistId, success: false, error: error.message });
      }
    }

    return res.json({
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
    await logError('Erro ao gerar smart playlists em lote', error);
    return res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
});

export default router;
