/**
 * PlaylistEngineWorker
 * 
 * Worker que monitora mudanças em campanhas, playlists e mídias
 * e regenera playlists automaticamente quando necessário.
 * 
 * Eventos monitorados:
 * - Criação/atualização de campanhas
 * - Criação/atualização de playlists
 * - Criação/atualização de mídias
 * - Mudanças em subscriber_publisher_access
 * - Mudanças em campaign_publishers
 */

import cron from 'node-cron';
import { getPlaylistEngineServiceInstance } from '../services/playlistEngineService';
import { logDebug, logError, logWarn } from '../utils/loggerHelper';
import { getDatabase } from '../config/database';
import { normalizeError } from '../utils/errors';

export class PlaylistEngineWorker {
  private isRunning: boolean = false;
  private cronJob: cron.ScheduledTask | null = null;
  private db = getDatabase();

  /**
   * Inicia o worker
   */
  start(): void {
    if (this.isRunning) {
      logWarn('PlaylistEngineWorker já está em execução');
      return;
    }

    this.isRunning = true;

    // Executar a cada 5 minutos para verificar mudanças
    this.cronJob = cron.schedule('*/5 * * * *', async () => {
      try {
        await this.checkAndRegeneratePlaylists();} catch (error: unknown) {
        const e = normalizeError(error);
        await logError('Erro no PlaylistEngineWorker', e.error);
      }
    });

    logDebug('PlaylistEngineWorker iniciado', {
      schedule: 'A cada 5 minutos'
    });
  }

  /**
   * Para o worker
   */
  stop(): void {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
    }
    this.isRunning = false;
    logDebug('PlaylistEngineWorker parado');
  }

  /**
   * Verifica mudanças e regenera playlists quando necessário
   */
  private async checkAndRegeneratePlaylists(): Promise<void> {
    try {
      const engine = getPlaylistEngineServiceInstance();

      // 1. Verificar campanhas modificadas recentemente (últimos 5 minutos)
      const recentCampaigns = await this.db.findMany(`
        SELECT DISTINCT campaign_id
        FROM campaigns
        WHERE updated_at >= NOW() - INTERVAL '5 minutes'
          AND is_active = true
          AND status = 'active'
      `);

      for (const campaign of recentCampaigns) {
        await logDebug('Regenerando playlists para campanha modificada', {
          campaignId: campaign.campaign_id
        });
        await engine.regeneratePlaylistsForCampaign(campaign.campaign_id);
      }

      // 2. Verificar mudanças em subscriber_publisher_access (últimos 5 minutos)
      const recentAccessChanges = await this.db.findMany(`
        SELECT DISTINCT publisher_id
        FROM subscriber_publisher_access
        WHERE updated_at >= NOW() - INTERVAL '5 minutes'
          OR created_at >= NOW() - INTERVAL '5 minutes'
      `);

      for (const access of recentAccessChanges) {
        await logDebug('Regenerando playlists para publisher com mudanças de acesso', {
          publisherId: access.publisher_id
        });
        await engine.regeneratePlaylistsForPublisher(access.publisher_id);
      }

      // 3. Verificar mudanças em campaign_publishers (últimos 5 minutos)
      const recentCampaignPublishers = await this.db.findMany(`
        SELECT DISTINCT publisher_id
        FROM campaign_publishers
        WHERE updated_at >= NOW() - INTERVAL '5 minutes'
          OR created_at >= NOW() - INTERVAL '5 minutes'
      `);

      for (const cp of recentCampaignPublishers) {
        await logDebug('Regenerando playlists para publisher com mudanças em campanhas', {
          publisherId: cp.publisher_id
        });
        await engine.regeneratePlaylistsForPublisher(cp.publisher_id);
      }

      // 4. Verificar playlists modificadas recentemente (últimos 5 minutos)
      const recentPlaylists = await this.db.findMany(`
        SELECT DISTINCT cp.campaign_id
        FROM playlists p
        INNER JOIN campaign_playlists cp ON p.playlist_id = cp.playlist_id
        WHERE p.updated_at >= NOW() - INTERVAL '5 minutes'
          AND p.is_active = true
      `);

      for (const playlist of recentPlaylists) {
        await logDebug('Regenerando playlists para campanha com playlist modificada', {
          campaignId: playlist.campaign_id
        });
        await engine.regeneratePlaylistsForCampaign(playlist.campaign_id);
      }

      // 5. Verificar mídias modificadas recentemente (últimos 5 minutos)
      const recentMedias = await this.db.findMany(`
        SELECT DISTINCT cm.campaign_id
        FROM medias m
        INNER JOIN campaign_medias cm ON m.media_id = cm.media_id
        WHERE m.updated_at >= NOW() - INTERVAL '5 minutes'
          AND m.is_active = true
          AND m.status = 'approved'
      `);

      for (const media of recentMedias) {
        await logDebug('Regenerando playlists para campanha com mídia modificada', {
          campaignId: media.campaign_id
        });
        await engine.regeneratePlaylistsForCampaign(media.campaign_id);
      }

      // 6. Verificar playlist_items modificados recentemente (últimos 5 minutos)
      const recentPlaylistItems = await this.db.findMany(`
        SELECT DISTINCT cp.campaign_id
        FROM playlist_items pi
        INNER JOIN playlists p ON pi.playlist_id = p.playlist_id
        INNER JOIN campaign_playlists cp ON p.playlist_id = cp.playlist_id
        WHERE pi.updated_at >= NOW() - INTERVAL '5 minutes'
          AND p.is_active = true
      `);

      for (const item of recentPlaylistItems) {
        await logDebug('Regenerando playlists para campanha com item de playlist modificado', {
          campaignId: item.campaign_id
        });
        await engine.regeneratePlaylistsForCampaign(item.campaign_id);
 
}} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('Erro ao verificar e regenerar playlists', e.error);
    }
  }

  /**
   * Regenera playlists para um totem específico (chamada manual)
   */
  async regenerateForTotem(totemId: number, smartTvId?: number): Promise<void> {
    try {
      const engine = getPlaylistEngineServiceInstance();
      await engine.generatePlaylistForTotem(totemId, smartTvId, true);
      await logDebug('Playlist regenerada manualmente para totem', {
        totemId, smartTvId });} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('Erro ao regenerar playlist para totem', e.error, { totemId, smartTvId });
      throw e.error;
    }
  }

  /**
   * Regenera playlists para um publisher específico (chamada manual)
   */
  async regenerateForPublisher(publisherId: number): Promise<void> {
    try {
      const engine = getPlaylistEngineServiceInstance();
      await engine.regeneratePlaylistsForPublisher(publisherId);
      await logDebug('Playlists regeneradas manualmente para publisher', {
        publisherId });} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('Erro ao regenerar playlists para publisher', e.error, { publisherId });
      throw e.error;
    }
  }

  /**
   * Regenera playlists para uma campanha específica (chamada manual)
   */
  async regenerateForCampaign(campaignId: number): Promise<void> {
    try {
      const engine = getPlaylistEngineServiceInstance();
      await engine.regeneratePlaylistsForCampaign(campaignId);
      await logDebug('Playlists regeneradas manualmente para campanha', {
        campaignId });} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('Erro ao regenerar playlists para campanha', e.error, { campaignId });
      throw e.error;
    }
  }
}

// Singleton instance
let playlistEngineWorkerInstance: PlaylistEngineWorker | null = null;

export function getPlaylistEngineWorkerInstance(): PlaylistEngineWorker {
  if (!playlistEngineWorkerInstance) {
    playlistEngineWorkerInstance = new PlaylistEngineWorker();
  }
  return playlistEngineWorkerInstance;
}

