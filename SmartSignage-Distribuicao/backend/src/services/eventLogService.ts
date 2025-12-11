/**
 * Event Log Service - Smart Signage v2.1
 * Serviço para registrar eventos importantes no banco de dados
 * 
 * Estratégia de Logging:
 * - Arquivos locais: logs operacionais (erro, debug, execução)
 * - Banco de dados: eventos importantes (playback, exibição, BI, campanhas)
 */

import { getDatabase } from '../config/database';
import { getLogger } from '../config/logger';

export interface EventLogEntry {
  id?: number;
  eventType: EventType;
  entityType: string;
  entityId?: number;
  totemId?: number;
  campaignId?: number;
  playlistId?: number;
  mediaId?: number;
  metadata?: any;
  timestamp?: Date;
}

export enum EventType {
  // Playback de mídia
  VIDEO_PLAYBACK_START = 'video_playback_start',
  VIDEO_PLAYBACK_END = 'video_playback_end',
  VIDEO_PLAYBACK_ERROR = 'video_playback_error',
  IMAGE_DISPLAY = 'image_display',
  AUDIO_PLAYBACK = 'audio_playback',
  
  // Exibição de anúncios
  AD_DISPLAY_START = 'ad_display_start',
  AD_DISPLAY_END = 'ad_display_end',
  AD_DISPLAY_SKIP = 'ad_display_skip',
  
  // Campanhas
  CAMPAIGN_START = 'campaign_start',
  CAMPAIGN_END = 'campaign_end',
  CAMPAIGN_PAUSE = 'campaign_pause',
  CAMPAIGN_RESUME = 'campaign_resume',
  
  // Playlists
  PLAYLIST_START = 'playlist_start',
  PLAYLIST_END = 'playlist_end',
  PLAYLIST_ITEM_PLAY = 'playlist_item_play',
  
  // Totem/Player
  TOTEM_COMMAND_SENT = 'totem_command_sent',
  TOTEM_COMMAND_COMPLETED = 'totem_command_completed',
  TOTEM_COMMAND_FAILED = 'totem_command_failed',
  TOTEM_ONLINE = 'totem_online',
  TOTEM_OFFLINE = 'totem_offline',
  TOTEM_HEARTBEAT = 'totem_heartbeat',
  TOTEM_ERROR = 'totem_error',
  
  // BI e Analytics
  USER_ACTION = 'user_action',
  INTERACTION = 'interaction',
  VIEW_TIME = 'view_time',
  ENGAGEMENT = 'engagement',
  
  // QR Code
  QR_CODE_SCAN = 'qr_code_scan',
  
  // Outros
  SYSTEM_EVENT = 'system_event',
  CUSTOM_EVENT = 'custom_event'
}

export class EventLogService {
  private get db() {
    return getDatabase();
  }

  /**
   * Registra um evento importante no banco de dados
   */
  async logEvent(event: EventLogEntry): Promise<number> {
    try {
      const result = await this.db.executeRaw(`
        INSERT INTO event_logs (
          event_type, 
          entity_type, 
          entity_id, 
          totem_id, 
          campaign_id, 
          playlist_id, 
          media_id, 
          metadata, 
          timestamp
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
        RETURNING id
      `, [
        event.eventType,
        event.entityType,
        event.entityId || null,
        event.totemId || null,
        event.campaignId || null,
        event.playlistId || null,
        event.mediaId || null,
        event.metadata ? JSON.stringify(event.metadata) : null
      ]);

      const eventId = result.rows[0]?.id;
      
      // Log operacional em arquivo (para debug)
      const logger = await getLogger();
      logger.debug('Event logged to database', {
        eventId,
        eventType: event.eventType,
        entityType: event.entityType,
        totemId: event.totemId
      });

      return eventId;
    } catch (error: any) {
      // Em caso de erro, registrar no arquivo de log operacional
      const logger = await getLogger();
      logger.error('Failed to log event to database', {
        error: error.message,
        event: event
      });
      throw error;
    }
  }

  /**
   * Registra início de reprodução de vídeo
   */
  async logVideoPlaybackStart(
    mediaId: number,
    totemId: number,
    playlistId?: number,
    campaignId?: number,
    metadata?: any
  ): Promise<number> {
    return this.logEvent({
      eventType: EventType.VIDEO_PLAYBACK_START,
      entityType: 'media',
      entityId: mediaId,
      mediaId,
      totemId,
      playlistId,
      campaignId,
      metadata: {
        ...metadata,
        playbackStartTime: new Date().toISOString()
      }
    });
  }

  /**
   * Registra fim de reprodução de vídeo
   * @param duration Duração em segundos (será salvo como durationSeconds no metadata)
   */
  async logVideoPlaybackEnd(
    mediaId: number,
    totemId: number,
    duration: number,
    completed: boolean = true,
    metadata?: any
  ): Promise<number> {
    return this.logEvent({
      eventType: EventType.VIDEO_PLAYBACK_END,
      entityType: 'media',
      entityId: mediaId,
      mediaId,
      totemId,
      metadata: {
        ...metadata,
        durationSeconds: duration, // Padrão conceitual: durationSeconds
        duration, // Manter compatibilidade
        result: completed ? 'success' : 'failure',
        completed,
        playbackEndTime: new Date().toISOString()
      }
    });
  }

  /**
   * Registra exibição de anúncio
   * @param adId ID da mídia/anúncio (mediaId)
   * @param totemId ID do totem
   * @param campaignId ID da campanha
   * @param startTime Data/hora de início
   * @param endTime Data/hora de fim (opcional)
   * @param metadata Metadados adicionais (pode incluir: slot, price, currency, result, skipReason)
   */
  async logAdDisplay(
    adId: number,
    totemId: number,
    campaignId: number,
    startTime: Date,
    endTime?: Date,
    metadata?: any
  ): Promise<number> {
    const eventType = endTime ? EventType.AD_DISPLAY_END : EventType.AD_DISPLAY_START;
    const durationSeconds = endTime ? Math.floor((endTime.getTime() - startTime.getTime()) / 1000) : null;
    
    return this.logEvent({
      eventType,
      entityType: 'ad',
      entityId: adId,
      mediaId: adId, // Salvar também como mediaId para queries
      totemId,
      campaignId,
      metadata: {
        ...metadata,
        mediaId: adId, // Padrão conceitual
        totemId, // Padrão conceitual
        campaignId, // Padrão conceitual
        startTime: startTime.toISOString(),
        endTime: endTime?.toISOString(),
        durationSeconds, // Padrão conceitual: durationSeconds
        duration: durationSeconds, // Manter compatibilidade
        result: metadata?.result || (endTime ? 'success' : undefined) // Padrão conceitual
      }
    });
  }

  /**
   * Registra scan de QR Code
   * @param metadata Pode incluir: location, userAgent, ipAddress, campaignId, clientId, redirectUrl, scanResult, errorMessage
   */
  async logQRCodeScan(
    qrCodeId: number,
    totemId?: number,
    metadata?: any
  ): Promise<number> {
    return this.logEvent({
      eventType: EventType.QR_CODE_SCAN,
      entityType: 'qrcode',
      entityId: qrCodeId,
      totemId,
      metadata: {
        ...metadata,
        qrCodeId, // Padrão conceitual
        totemId: totemId || metadata?.totemId, // Padrão conceitual
        scanTime: new Date().toISOString(),
        scanResult: metadata?.scanResult || 'success' // Padrão conceitual: 'success' | 'failure'
      }
    });
  }

  /**
   * Registra início de campanha
   */
  async logCampaignStart(
    campaignId: number,
    totemId: number,
    metadata?: any
  ): Promise<number> {
    return this.logEvent({
      eventType: EventType.CAMPAIGN_START,
      entityType: 'campaign',
      entityId: campaignId,
      campaignId,
      totemId,
      metadata: {
        ...metadata,
        startTime: new Date().toISOString()
      }
    });
  }

  /**
   * Registra fim de campanha
   */
  async logCampaignEnd(
    campaignId: number,
    totemId: number,
    metadata?: any
  ): Promise<number> {
    return this.logEvent({
      eventType: EventType.CAMPAIGN_END,
      entityType: 'campaign',
      entityId: campaignId,
      campaignId,
      totemId,
      metadata: {
        ...metadata,
        endTime: new Date().toISOString()
      }
    });
  }

  /**
   * Busca eventos por filtros
   */
  async getEvents(filters: {
    eventType?: EventType;
    totemId?: number;
    campaignId?: number;
    playlistId?: number;
    mediaId?: number;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }): Promise<EventLogEntry[]> {
    try {
      let whereClause = 'WHERE 1=1';
      const params: any[] = [];
      let paramIndex = 1;

      if (filters.eventType) {
        whereClause += ` AND event_type = $${paramIndex++}`;
        params.push(filters.eventType);
      }

      if (filters.totemId) {
        whereClause += ` AND totem_id = $${paramIndex++}`;
        params.push(filters.totemId);
      }

      if (filters.campaignId) {
        whereClause += ` AND campaign_id = $${paramIndex++}`;
        params.push(filters.campaignId);
      }

      if (filters.playlistId) {
        whereClause += ` AND playlist_id = $${paramIndex++}`;
        params.push(filters.playlistId);
      }

      if (filters.mediaId) {
        whereClause += ` AND media_id = $${paramIndex++}`;
        params.push(filters.mediaId);
      }

      if (filters.startDate) {
        whereClause += ` AND timestamp >= $${paramIndex++}`;
        params.push(filters.startDate);
      }

      if (filters.endDate) {
        whereClause += ` AND timestamp <= $${paramIndex++}`;
        params.push(filters.endDate);
      }

      const limit = filters.limit || 100;
      const offset = filters.offset || 0;

      const results = await this.db.findMany(`
        SELECT 
          id,
          event_type as "eventType",
          entity_type as "entityType",
          entity_id as "entityId",
          totem_id as "totemId",
          campaign_id as "campaignId",
          playlist_id as "playlistId",
          media_id as "mediaId",
          metadata,
          timestamp
        FROM event_logs
        ${whereClause}
        ORDER BY timestamp DESC
        LIMIT $${paramIndex++} OFFSET $${paramIndex++}
      `, [...params, limit, offset]);

      return results.map((row: any) => ({
        id: row.id,
        eventType: row.eventType,
        entityType: row.entityType,
        entityId: row.entityId,
        totemId: row.totemId,
        campaignId: row.campaignId,
        playlistId: row.playlistId,
        mediaId: row.mediaId,
        metadata: row.metadata ? JSON.parse(row.metadata) : null,
        timestamp: row.timestamp
      }));
    } catch (error: any) {
      const logger = await getLogger();
      logger.error('Failed to get events', { error: error.message, filters });
      throw error;
    }
  }

  /**
   * Estatísticas de eventos para BI
   */
  async getEventStatistics(filters: {
    totemId?: number;
    campaignId?: number;
    startDate?: Date;
    endDate?: Date;
  }): Promise<{
    totalEvents: number;
    eventsByType: { [key: string]: number };
    eventsByTotem: { [key: number]: number };
    eventsByCampaign: { [key: number]: number };
    totalPlaybacks: number;
    totalAdDisplays: number;
    averageViewTime: number;
  }> {
    try {
      let whereClause = 'WHERE 1=1';
      const params: any[] = [];
      let paramIndex = 1;

      if (filters.totemId) {
        whereClause += ` AND totem_id = $${paramIndex++}`;
        params.push(filters.totemId);
      }

      if (filters.campaignId) {
        whereClause += ` AND campaign_id = $${paramIndex++}`;
        params.push(filters.campaignId);
      }

      if (filters.startDate) {
        whereClause += ` AND timestamp >= $${paramIndex++}`;
        params.push(filters.startDate);
      }

      if (filters.endDate) {
        whereClause += ` AND timestamp <= $${paramIndex++}`;
        params.push(filters.endDate);
      }

      // Total de eventos
      const totalResult = await this.db.findFirst(`
        SELECT COUNT(*) as total
        FROM event_logs
        ${whereClause}
      `, params);

      // Eventos por tipo
      const byTypeResult = await this.db.findMany(`
        SELECT event_type, COUNT(*) as count
        FROM event_logs
        ${whereClause}
        GROUP BY event_type
      `, params);

      // Eventos por totem
      const byTotemResult = await this.db.findMany(`
        SELECT totem_id, COUNT(*) as count
        FROM event_logs
        ${whereClause} AND totem_id IS NOT NULL
        GROUP BY totem_id
      `, params);

      // Eventos por campanha
      const byCampaignResult = await this.db.findMany(`
        SELECT campaign_id, COUNT(*) as count
        FROM event_logs
        ${whereClause} AND campaign_id IS NOT NULL
        GROUP BY campaign_id
      `, params);

      // Total de playbacks
      const playbacksResult = await this.db.findFirst(`
        SELECT COUNT(*) as total
        FROM event_logs
        ${whereClause}
        AND event_type IN ('video_playback_start', 'video_playback_end', 'image_display', 'audio_playback')
      `, params);

      // Total de exibições de anúncios
      const adDisplaysResult = await this.db.findFirst(`
        SELECT COUNT(*) as total
        FROM event_logs
        ${whereClause}
        AND event_type IN ('ad_display_start', 'ad_display_end')
      `, params);

      // Tempo médio de visualização (calculado a partir de metadata)
      const viewTimeResult = await this.db.findFirst(`
        SELECT AVG((metadata->>'duration')::numeric) as avg_duration
        FROM event_logs
        ${whereClause}
        AND metadata->>'duration' IS NOT NULL
      `, params);

      const eventsByType: { [key: string]: number } = {};
      byTypeResult.forEach((row: any) => {
        eventsByType[row.event_type] = parseInt(row.count);
      });

      const eventsByTotem: { [key: number]: number } = {};
      byTotemResult.forEach((row: any) => {
        eventsByTotem[row.totem_id] = parseInt(row.count);
      });

      const eventsByCampaign: { [key: number]: number } = {};
      byCampaignResult.forEach((row: any) => {
        eventsByCampaign[row.campaign_id] = parseInt(row.count);
      });

      return {
        totalEvents: parseInt(totalResult?.total || '0'),
        eventsByType,
        eventsByTotem,
        eventsByCampaign,
        totalPlaybacks: parseInt(playbacksResult?.total || '0'),
        totalAdDisplays: parseInt(adDisplaysResult?.total || '0'),
        averageViewTime: parseFloat(viewTimeResult?.avg_duration || '0')
      };
    } catch (error: any) {
      const logger = await getLogger();
      logger.error('Failed to get event statistics', { error: error.message, filters });
      throw error;
    }
  }
}

// Singleton instance
let eventLogServiceInstance: EventLogService | null = null;

export function getEventLogService(): EventLogService {
  if (!eventLogServiceInstance) {
    eventLogServiceInstance = new EventLogService();
  }
  return eventLogServiceInstance;
}

