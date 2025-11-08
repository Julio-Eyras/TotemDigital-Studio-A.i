/**
 * Advanced Schedule Worker - Smart Signage v2.1
 * Worker para processar jobs de agendamento avançado (campanhas e playlists)
 */

import { Job } from 'bull';
import { getAdvancedScheduleQueue, AdvancedScheduleJobData, AdvancedScheduleJobResult } from '../config/queue';
import { advancedScheduleService } from '../services/advancedScheduleService';
import { getDatabase } from '../config/database';
import { CampaignService } from '../services/campaignService';
import { SmartPlaylistService } from '../services/smartPlaylistService';

const getDb = () => getDatabase();
const campaignService = new CampaignService();
const smartPlaylistService = new SmartPlaylistService();

/**
 * Processa job de agendamento avançado
 */
export async function processAdvancedScheduleJob(job: Job<AdvancedScheduleJobData>): Promise<AdvancedScheduleJobResult> {
  const db = getDb();
  const { scheduleId, scheduleType, targetId } = job.data;
  const startTime = new Date();
  let executionId: number | null = null;

  try {
    console.log(`🔄 Processando agendamento: Schedule ${scheduleId}, Type ${scheduleType}, Target ${targetId}`);

    // Buscar agendamento
    const schedule = await advancedScheduleService.getScheduleById(scheduleId);
    if (!schedule) {
      throw new Error(`Agendamento com ID ${scheduleId} não encontrado`);
    }

    // Criar registro de execução
    const executionResult = await db.executeRaw(`
      INSERT INTO schedule_executions (
        schedule_id, job_id, status, started_at
      )
      VALUES (?, ?, 'running', CURRENT_TIMESTAMP)
      RETURNING execution_id
    `, [scheduleId, job.id.toString()]);

    executionId = executionResult.rows[0].execution_id;

    // Processar baseado no tipo
    let result: AdvancedScheduleJobResult;

    switch (scheduleType) {
      case 'campaign_activation':
        result = await processCampaignActivation(targetId, schedule.schedule_config);
        break;

      case 'playlist_generation':
        result = await processPlaylistGeneration(targetId, schedule.schedule_config);
        break;

      case 'campaign':
        result = await processCampaignSchedule(targetId, schedule.schedule_config);
        break;

      case 'playlist':
        result = await processPlaylistSchedule(targetId, schedule.schedule_config);
        break;

      default:
        throw new Error(`Tipo de agendamento não suportado: ${scheduleType}`);
    }

    const duration = (new Date().getTime() - startTime.getTime()) / 1000;

    // Atualizar execução
    await db.executeRaw(`
      UPDATE schedule_executions 
      SET status = 'completed', completed_at = CURRENT_TIMESTAMP,
          execution_log = ?
      WHERE execution_id = ?
    `, [
      `Agendamento concluído: ${result.message} em ${duration.toFixed(2)}s`,
      executionId
    ]);

    // Atualizar estatísticas do agendamento
    await db.executeRaw(`
      UPDATE advanced_schedules 
      SET last_execution = CURRENT_TIMESTAMP,
          next_execution = ?,
          execution_count = execution_count + 1,
          success_count = success_count + 1
      WHERE schedule_id = ?
    `, [
      advancedScheduleService.calculateNextExecution(schedule.cron_expression),
      scheduleId
    ]);

    console.log(`✅ Agendamento concluído: ${result.message}`);

    return result;

  } catch (error: any) {
    console.error(`❌ Erro ao processar agendamento:`, error.message);

    // Atualizar execução com erro
    if (executionId) {
      await db.executeRaw(`
        UPDATE schedule_executions 
        SET status = 'failed', completed_at = CURRENT_TIMESTAMP,
            error_message = ?, execution_log = ?
        WHERE execution_id = ?
      `, [
        error.message,
        `Erro: ${error.message}`,
        executionId
      ]);
    }

    // Atualizar estatísticas do agendamento
    if (scheduleId) {
      const schedule = await advancedScheduleService.getScheduleById(scheduleId);
      if (schedule) {
        await db.executeRaw(`
          UPDATE advanced_schedules 
          SET last_execution = CURRENT_TIMESTAMP,
              next_execution = ?,
              execution_count = execution_count + 1,
              failure_count = failure_count + 1
          WHERE schedule_id = ?
        `, [
          advancedScheduleService.calculateNextExecution(schedule.cron_expression),
          scheduleId
        ]);
      }
    }

    return {
      success: false,
      message: 'Erro ao processar agendamento',
      error: error.message,
      executionLog: `Erro: ${error.message}`
    };
  }
}

/**
 * Processa ativação de campanha
 */
async function processCampaignActivation(campaignId: number, config: any): Promise<AdvancedScheduleJobResult> {
  try {
    const campaign = await campaignService.getCampaignById(campaignId);
    if (!campaign) {
      throw new Error(`Campanha com ID ${campaignId} não encontrada`);
    }

    // Ativar campanha
    await campaignService.updateCampaign(campaignId, {
      status: 'active',
      isActive: true
    }, 1); // System user

    return {
      success: true,
      message: `Campanha '${campaign.title}' ativada com sucesso`,
      executionLog: `Campanha ${campaignId} ativada`
    };
  } catch (error: any) {
    throw new Error(`Erro ao ativar campanha: ${error.message}`);
  }
}

/**
 * Processa geração de playlist
 */
async function processPlaylistGeneration(playlistId: number, config: any): Promise<AdvancedScheduleJobResult> {
  try {
    const db = getDb();
    // Buscar playlist
    const playlist = await db.findFirst(`
      SELECT * FROM playlists WHERE playlist_id = ?
    `, [playlistId]);

    if (!playlist) {
      throw new Error(`Playlist com ID ${playlistId} não encontrada`);
    }

    // Buscar campanha associada
    const campaign = await db.findFirst(`
      SELECT * FROM campaigns WHERE campaign_id = ?
    `, [playlist.campaign_id]);

    if (!campaign) {
      throw new Error(`Campanha associada não encontrada`);
    }

    // Buscar ou criar smart playlist
    let smartPlaylist = await db.findFirst(`
      SELECT smart_playlist_id FROM smart_playlists 
      WHERE campaign_id = ? AND totem_id = ?
      LIMIT 1
    `, [campaign.campaign_id, playlist.totem_id]);

    let smartPlaylistId: number;

    if (!smartPlaylist) {
      // Criar smart playlist se não existir
      const newSmartPlaylist = await smartPlaylistService.createSmartPlaylist({
        clientId: campaign.client_id,
        campaignId: campaign.campaign_id,
        totemId: playlist.totem_id,
        name: playlist.name || `Playlist Gerada - ${new Date().toISOString()}`,
        description: config?.description || 'Playlist gerada automaticamente',
        targetAudience: config?.targetAudience,
        timeOfDay: config?.timeOfDay,
        dayOfWeek: config?.dayOfWeek,
        season: config?.season,
        weather: config?.weather,
        location: config?.location,
        contentType: config?.contentType,
        duration: config?.duration,
        maxItems: config?.maxItems || 20,
        aiEnabled: config?.aiEnabled !== false,
        rules: config?.rules || []
      }, 1); // System user
      smartPlaylistId = newSmartPlaylist.id;
    } else {
      smartPlaylistId = smartPlaylist.smart_playlist_id;
    }

    // Gerar playlist inteligente
    const generationResult = await smartPlaylistService.generateSmartPlaylist(smartPlaylistId, 1); // System user

    return {
      success: true,
      message: `Playlist '${playlist.name}' gerada com sucesso - ${generationResult.generatedItems} itens`,
      executionLog: `Playlist ${playlistId} gerada com ${generationResult.generatedItems} itens`
    };
  } catch (error: any) {
    throw new Error(`Erro ao gerar playlist: ${error.message}`);
  }
}

/**
 * Processa agendamento de campanha (ações customizadas)
 */
async function processCampaignSchedule(campaignId: number, config: any): Promise<AdvancedScheduleJobResult> {
  try {
    const campaign = await campaignService.getCampaignById(campaignId);
    if (!campaign) {
      throw new Error(`Campanha com ID ${campaignId} não encontrada`);
    }

    // Executar ação configurada
    const action = config?.action || 'activate';

    switch (action) {
      case 'activate':
        await campaignService.updateCampaign(campaignId, {
          status: 'active',
          isActive: true
        }, 1);
        return {
          success: true,
          message: `Campanha '${campaign.title}' ativada`,
          executionLog: `Campanha ${campaignId} ativada`
        };

      case 'pause':
        await campaignService.updateCampaign(campaignId, {
          status: 'paused',
          isActive: false
        }, 1);
        return {
          success: true,
          message: `Campanha '${campaign.title}' pausada`,
          executionLog: `Campanha ${campaignId} pausada`
        };

      case 'finish':
        await campaignService.updateCampaign(campaignId, {
          status: 'finished',
          isActive: false
        }, 1);
        return {
          success: true,
          message: `Campanha '${campaign.title}' finalizada`,
          executionLog: `Campanha ${campaignId} finalizada`
        };

      default:
        throw new Error(`Ação não suportada: ${action}`);
    }
  } catch (error: any) {
    throw new Error(`Erro ao processar agendamento de campanha: ${error.message}`);
  }
}

/**
 * Processa agendamento de playlist (ações customizadas)
 */
async function processPlaylistSchedule(playlistId: number, config: any): Promise<AdvancedScheduleJobResult> {
  try {
    const db = getDb();
    const playlist = await db.findFirst(`
      SELECT * FROM playlists WHERE playlist_id = ?
    `, [playlistId]);

    if (!playlist) {
      throw new Error(`Playlist com ID ${playlistId} não encontrada`);
    }

    // Executar ação configurada
    const action = config?.action || 'activate';

    switch (action) {
      case 'activate':
        await db.executeRaw(`
          UPDATE playlists SET is_active = true, updated_at = CURRENT_TIMESTAMP
          WHERE playlist_id = ?
        `, [playlistId]);
        return {
          success: true,
          message: `Playlist '${playlist.name}' ativada`,
          executionLog: `Playlist ${playlistId} ativada`
        };

      case 'deactivate':
        await db.executeRaw(`
          UPDATE playlists SET is_active = false, updated_at = CURRENT_TIMESTAMP
          WHERE playlist_id = ?
        `, [playlistId]);
        return {
          success: true,
          message: `Playlist '${playlist.name}' desativada`,
          executionLog: `Playlist ${playlistId} desativada`
        };

      case 'regenerate':
        // Regenerar playlist
        return await processPlaylistGeneration(playlistId, config);

      default:
        throw new Error(`Ação não suportada: ${action}`);
    }
  } catch (error: any) {
    throw new Error(`Erro ao processar agendamento de playlist: ${error.message}`);
  }
}

// Registrar worker
export function registerAdvancedScheduleWorker(): void {
  const queue = getAdvancedScheduleQueue();
  
  queue.process(async (job: Job<AdvancedScheduleJobData>) => {
    return await processAdvancedScheduleJob(job);
  });

  console.log('✅ Worker de agendamento avançado registrado');
}

