/**
 * Rotas para o Motor de Playlists
 * 
 * Permite regenerar playlists manualmente e consultar playlists geradas
 */

import { Router } from 'express';
import { authMiddleware, authorizeRole } from '../middleware/auth.middleware';
import { getPlaylistEngineServiceInstance } from '../services/playlistEngineService';
import { logError } from '../utils/loggerHelper';

const router = Router();

// Todas as rotas requerem autenticação
router.use(authMiddleware as any);

/**
 * GET /api/playlist-engine/totem-playlists
 * Lista todas as playlists ativas de totens
 */
router.get('/totem-playlists', async (req, res) => {
  try {
    const publisherId = req.query.publisherId ? parseInt(req.query.publisherId as string) : undefined;
    const totemId = req.query.totemId ? parseInt(req.query.totemId as string) : undefined;
    const page = req.query.page ? parseInt(req.query.page as string) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;

    if (publisherId && isNaN(publisherId)) {
      return res.status(400).json({
        success: false,
        error: 'ID do publisher inválido'
      });
    }

    if (totemId && isNaN(totemId)) {
      return res.status(400).json({
        success: false,
        error: 'ID do totem inválido'
      });
    }

    const engine = getPlaylistEngineServiceInstance();
    const result = await engine.getAllTotemPlaylists({
      publisherId,
      totemId,
      page,
      limit
    });

    return res.json({
      success: true,
      data: result.data,
      total: result.total,
      page: result.page,
      limit: result.limit
    });
  } catch (error: any) {
    await logError('Erro ao listar playlists de totens', error);
    return res.status(500).json({
      success: false,
      error: 'Erro ao listar playlists de totens'
    });
  }
});

/**
 * GET /api/playlist-engine/totem/:totemId
 * Busca playlist ativa de um totem
 */
router.get('/totem/:totemId', async (req, res) => {
  try {
    const totemId = parseInt(req.params.totemId);
    const smartTvId = req.query.smartTvId ? parseInt(req.query.smartTvId as string) : undefined;

    if (isNaN(totemId)) {
      return res.status(400).json({
        success: false,
        error: 'ID do totem inválido'
      });
    }

    const engine = getPlaylistEngineServiceInstance();
    const playlist = await engine.getActivePlaylist(totemId, smartTvId);

    if (!playlist) {
      return res.status(404).json({
        success: false,
        error: 'Nenhuma playlist ativa encontrada para este totem'
      });
    }

    return res.json({
      success: true,
      data: playlist
    });
  } catch (error: any) {
    await logError('Erro ao buscar playlist do totem', error, {
      totemId: req.params.totemId
    });
    return res.status(500).json({
      success: false,
      error: 'Erro ao buscar playlist do totem'
    });
  }
});

/**
 * POST /api/playlist-engine/totem/:totemId/regenerate
 * Regenera playlist para um totem específico
 * Requer role admin ou manager
 */
router.post('/totem/:totemId/regenerate', authorizeRole(['admin', 'admin_sql', 'manager']), async (req, res) => {
  try {
    const totemId = parseInt(req.params.totemId);
    const smartTvId = req.body.smartTvId ? parseInt(req.body.smartTvId) : undefined;
    const force = req.body.force === true;

    if (isNaN(totemId)) {
      return res.status(400).json({
        success: false,
        error: 'ID do totem inválido'
      });
    }

    const engine = getPlaylistEngineServiceInstance();
    const result = await engine.generatePlaylistForTotem(totemId, smartTvId, force);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error || 'Erro ao regenerar playlist'
      });
    }

    return res.json({
      success: true,
      data: result
    });
  } catch (error: any) {
    await logError('Erro ao regenerar playlist do totem', error, {
      totemId: req.params.totemId
    });
    return res.status(500).json({
      success: false,
      error: 'Erro ao regenerar playlist do totem'
    });
  }
});

/**
 * POST /api/playlist-engine/publisher/:publisherId/regenerate
 * Regenera playlists para todos os totens de um publisher
 * Requer role admin ou manager
 */
router.post('/publisher/:publisherId/regenerate', authorizeRole(['admin', 'admin_sql', 'manager']), async (req, res) => {
  try {
    const publisherId = parseInt(req.params.publisherId);

    if (isNaN(publisherId)) {
      return res.status(400).json({
        success: false,
        error: 'ID do publisher inválido'
      });
    }

    const engine = getPlaylistEngineServiceInstance();
    const count = await engine.regeneratePlaylistsForPublisher(publisherId);

    return res.json({
      success: true,
      data: {
        publisherId,
        totemsRegenerated: count
      }
    });
  } catch (error: any) {
    await logError('Erro ao regenerar playlists do publisher', error, {
      publisherId: req.params.publisherId
    });
    return res.status(500).json({
      success: false,
      error: 'Erro ao regenerar playlists do publisher'
    });
  }
});

/**
 * POST /api/playlist-engine/campaign/:campaignId/regenerate
 * Regenera playlists para todos os totens afetados por uma campanha
 * Requer role admin ou manager
 */
router.post('/campaign/:campaignId/regenerate', authorizeRole(['admin', 'admin_sql', 'manager']), async (req, res) => {
  try {
    const campaignId = parseInt(req.params.campaignId);

    if (isNaN(campaignId)) {
      return res.status(400).json({
        success: false,
        error: 'ID da campanha inválido'
      });
    }

    const engine = getPlaylistEngineServiceInstance();
    const count = await engine.regeneratePlaylistsForCampaign(campaignId);

    return res.json({
      success: true,
      data: {
        campaignId,
        totemsRegenerated: count
      }
    });
  } catch (error: any) {
    await logError('Erro ao regenerar playlists da campanha', error, {
      campaignId: req.params.campaignId
    });
    return res.status(500).json({
      success: false,
      error: 'Erro ao regenerar playlists da campanha'
    });
  }
});

/**
 * GET /api/playlist-engine/stats
 * Estatísticas do motor de playlists
 * Requer role admin
 */
router.get('/stats', authorizeRole(['admin', 'admin_sql']), async (_req, res) => {
  try {
    const { getDatabase } = require('../config/database-pg');
    const db = getDatabase();

    // Estatísticas gerais
    const totalPlaylists = await db.findFirst(`
      SELECT COUNT(*) as count
      FROM totem_playlists
      WHERE is_active = true AND status = 'active'
    `);

    const totalItems = await db.findFirst(`
      SELECT COUNT(*) as count
      FROM totem_playlist_items
      WHERE is_active = true
    `);

    const recentGenerations = await db.findMany(`
      SELECT 
        status,
        COUNT(*) as count,
        AVG(generation_time_ms) as avg_time_ms
      FROM totem_playlist_generation_log
      WHERE generated_at >= NOW() - INTERVAL '24 hours'
      GROUP BY status
    `);

    res.json({
      success: true,
      data: {
        totalPlaylists: totalPlaylists?.count || 0,
        totalItems: totalItems?.count || 0,
        recentGenerations: recentGenerations || []
      }
    });
  } catch (error: any) {
    await logError('Erro ao buscar estatísticas do motor', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao buscar estatísticas do motor'
    });
  }
});

export default router;

