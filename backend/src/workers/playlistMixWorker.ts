/**
 * Playlist Mix Worker
 * Worker para regeneração automática de mixagens de playlists
 */

import cron from 'node-cron';
import { getDatabase } from '../config/database';
import { getTotemPlaylistMixService } from '../services/totemPlaylistMixService';
import { logInfo, logError, logDebug } from '../utils/loggerHelper';
import { normalizeError } from '../utils/errors';

export class PlaylistMixWorker {
  private db = getDatabase();
  private mixService = getTotemPlaylistMixService();
  private jobs: cron.ScheduledTask[] = [];

  /**
   * Inicia o worker de regeneração automática
   */
  start(): void {
    if (this.jobs.length > 0) {
      logInfo('Playlist Mix Worker já está em execução', { service: 'playlist-mix-worker' });
      return;
    }
    logInfo('Iniciando Playlist Mix Worker...', { service: 'playlist-mix-worker' });

    // Regenerar mixagens a cada hora (no minuto 0)
    const hourlyJob = cron.schedule('0 * * * *', async () => {
      await this.regenerateAllActiveMixes();
    });

    // Regenerar mixagens diariamente às 2h da manhã
    const dailyJob = cron.schedule('0 2 * * *', async () => {
      await this.regenerateAllActiveMixes(true);
    });

    // Regenerar quando campanhas mudam (verificar a cada 15 minutos)
    const campaignCheckJob = cron.schedule('*/15 * * * *', async () => {
      await this.checkAndRegenerateOnCampaignChange();
    });

    this.jobs.push(hourlyJob, dailyJob, campaignCheckJob);

    logInfo('Playlist Mix Worker iniciado', {
      service: 'playlist-mix-worker',
      schedules: [
        'Regeneração horária: 0 * * * *',
        'Regeneração diária: 0 2 * * *',
        'Verificação de campanhas: */15 * * * *'
      ]
    });
  }

  /**
   * Para o worker
   */
  stop(): void {
    logInfo('Parando Playlist Mix Worker...', { service: 'playlist-mix-worker' });
    
    for (const job of this.jobs) {
      job.stop();
    }
    
    this.jobs = [];
    logInfo('Playlist Mix Worker parado', { service: 'playlist-mix-worker' });
  }

  /**
   * Regenera mixagens para todos os totens ativos
   */
  private async regenerateAllActiveMixes(force: boolean = false): Promise<void> {
    try {
      logInfo('Iniciando regeneração de mixagens', { service: 'playlist-mix-worker', force });

      // Buscar todos os totens ativos
      const totems = await this.db.findMany(`
        SELECT totem_id, identifier, name
        FROM totems
        WHERE is_active = true
        ORDER BY totem_id
      `);

      logInfo(`Encontrados ${totems.length} totens ativos para regeneração`, {
        service: 'playlist-mix-worker'
      });

      let successCount = 0;
      let errorCount = 0;

      for (const totem of totems) {
        try {
          // Verificar se precisa regenerar
          if (!force) {
            const currentMix = await this.mixService.getCurrentMix(totem.totem_id);
            if (currentMix) {
              const mixAge = new Date().getTime() - new Date(currentMix.generated_at).getTime();
              const hoursSinceGeneration = mixAge / (1000 * 60 * 60);
              
              // Só regenerar se a mixagem tiver mais de 1 hora
              if (hoursSinceGeneration < 1) {
                await logDebug('Mixagem ainda recente, pulando regeneração', {
                  totemId: totem.totem_id,
                  hoursSinceGeneration: hoursSinceGeneration.toFixed(2)
                });
                continue;
              }
            }
          }

          await this.mixService.generateMixForTotem(totem.totem_id);
          successCount++;

          await logDebug('Mixagem regenerada com sucesso', {
            totemId: totem.totem_id,
            identifier: totem.identifier
          });} catch (error: unknown) {
          const e = normalizeError(error);
          errorCount++;
          await logError('Erro ao regenerar mixagem para totem', e.error, {
            totemId: totem.totem_id,
            identifier: totem.identifier
        });
        }
      }

      logInfo('Regeneração de mixagens concluída', {
        service: 'playlist-mix-worker',
        total: totems.length,
        success: successCount,
        errors: errorCount
      });} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('Erro ao regenerar mixagens', e.error, { service: 'playlist-mix-worker' });
    }
  }

  /**
   * Verifica mudanças em campanhas e regenera mixagens afetadas
   */
  private async checkAndRegenerateOnCampaignChange(): Promise<void> {
    try {
      // Buscar campanhas que foram modificadas nas últimas 15 minutos
      const recentCampaigns = await this.db.findMany(`
        SELECT DISTINCT ct.totem_id
        FROM campaign_totems ct
        INNER JOIN campaigns c ON ct.campaign_id = c.campaign_id
        WHERE c.updated_at >= NOW() - INTERVAL '15 minutes'
          AND c.is_active = true
          AND EXISTS (
            SELECT 1 FROM totems t 
            WHERE t.totem_id = ct.totem_id 
            AND t.is_active = true 
          )
      `);

      if (recentCampaigns.length === 0) {
        return;
      }

      logInfo(`Encontradas ${recentCampaigns.length} campanhas modificadas, regenerando mixagens afetadas`, {
        service: 'playlist-mix-worker'
      });

      for (const row of recentCampaigns) {
        try {
          await this.mixService.generateMixForTotem(row.totem_id);
          await logDebug('Mixagem regenerada devido a mudança em campanha', {
            totemId: row.totem_id
          });} catch (error: unknown) {
          const e = normalizeError(error);
          await logError('Erro ao regenerar mixagem após mudança em campanha', e.error, {
            totemId: row.totem_id
        });
        }
 
}} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('Erro ao verificar mudanças em campanhas', e.error, {
        service: 'playlist-mix-worker'
    });
    }
  }

  /**
   * Regenera mixagem para um totem específico
   */
  async regenerateForTotem(totemId: number): Promise<void> {
    try {
      await this.mixService.generateMixForTotem(totemId);
      await logInfo('Mixagem regenerada manualmente', {
        service: 'playlist-mix-worker',
        totemId
      });} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('Erro ao regenerar mixagem manualmente', e.error, {
        service: 'playlist-mix-worker',
        totemId
    });
      throw e.error;
    }
  }
}

// Singleton instance
let playlistMixWorkerInstance: PlaylistMixWorker | null = null;

export function getPlaylistMixWorker(): PlaylistMixWorker {
  if (!playlistMixWorkerInstance) {
    playlistMixWorkerInstance = new PlaylistMixWorker();
  }
  return playlistMixWorkerInstance;
}

