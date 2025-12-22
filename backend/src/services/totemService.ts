/**
 * Totem Service - Smart Signage v2.0
 * Serviço de gerenciamento de totems
 */

import { getDatabase } from '../config/database';
import { AuditService } from './auditService';
import { logError, logDebug } from '../utils/loggerHelper';
import { getEventLogService, EventType } from './eventLogService';
import { getCacheService } from './cacheService';

export interface CreateTotemRequest {
  name?: string;
  identifier: string;
  deviceId?: string;
  localId?: string;
  location?: string;
  description?: string;
  config?: any;
  version?: string;
  firmwareVersion?: string;
  ipAddress?: string;
  // REMOVIDO: clientId - totem não pertence a subscriber, pertence a publisher via local_id
  isActive?: boolean;
  active?: boolean;
}

export interface UpdateTotemRequest {
  name?: string;
  identifier?: string;
  deviceId?: string;
  localId?: string;
  location?: string;
  description?: string;
  config?: any;
  version?: string;
  firmwareVersion?: string;
  ipAddress?: string;
  // REMOVIDO: clientId - totem não pertence a subscriber, pertence a publisher via local_id
  isActive?: boolean;
  active?: boolean;
}

export interface TotemResponse {
  id: number;
  name?: string;
  identifier: string;
  uin?: string;
  deviceId?: string;
  localId?: string;
  location?: string;
  description?: string;
  config?: any;
  status: string;
  version?: string;
  firmwareVersion?: string;
  ipAddress?: string;
  lastSeen?: string;
  lastHeartbeat?: string;
  active: boolean;
  is_active?: boolean;
  isActive?: boolean;
  // REMOVIDO: client_id/clientId - totem não pertence a subscriber
  // publisher_id pode ser derivado via local_id → locals → publishers
  publisherId?: number; // Derivado de local_id (para conveniência)
  current_playlist_id?: number;
  currentPlaylistId?: number;
  createdAt: string;
  updatedAt: string;
  localName?: string;
  hostName?: string;
  campaignCount?: number;
  playlistCount?: number;
  uptime?: number;
}

export interface TotemStats {
  total: number;
  online: number;
  offline: number;
  error: number;
  maintenance: number;
  byStatus: { status: string; count: number }[];
  recentActivity: {
    newTotems: number;
    heartbeats: number;
    errors: number;
  };
}

export interface HeartbeatData {
  totemId: number;
  status: string;
  version?: string;
  firmwareVersion?: string;
  ipAddress?: string;
  config?: any;
  metrics?: {
    cpu?: number;
    memory?: number;
    disk?: number;
    temperature?: number;
  };
}

export class TotemService {
  private get db() {
    return getDatabase();
  }
  
  // Lazy initialization - só criar quando necessário
  private getAuditService(): AuditService {
    if (!(global as any).auditServiceInstance) {
      (global as any).auditServiceInstance = new AuditService();
    }
    return (global as any).auditServiceInstance;
  }

  private get eventLogService() {
    return getEventLogService();
  }

  private get cache() {
    return getCacheService();
  }

  /**
   * Lista todos os totems (alias para getTotems)
   */
  async getAllTotems(filters: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    // REMOVIDO: clientId - totem não pertence a subscriber
    publisherId?: number; // Filtrar por publisher via local_id
  }): Promise<any> {
    const result = await this.getTotems(
      filters.page || 1,
      filters.limit || 1000,
      {
        status: filters.status,
        isActive: filters.status === 'active' ? true : filters.status === 'inactive' ? false : undefined,
        search: filters.search
      }
    );
    return result;
  }

  /**
   * Lista totems com paginação e filtros
   */
  async getTotems(
    page: number = 1,
    limit: number = 20,
    filters: {
      status?: string;
      isActive?: boolean;
      localId?: string;
      search?: string;
    } = {}
  ): Promise<{ totems: TotemResponse[]; total: number; page: number; limit: number }> {
    try {
      const offset = (page - 1) * limit;
      let whereClause = 'WHERE 1=1';
      const params: any[] = [];

      // Aplicar filtros
      if (filters.status) {
        whereClause += ' AND t.status = ?';
        params.push(filters.status);
      }

      if (filters.isActive !== undefined) {
        whereClause += ' AND COALESCE(t.is_active, false) = ?';
        params.push(filters.isActive);
      }

      if (filters.localId) {
        whereClause += ' AND t.local_id = ?';
        params.push(filters.localId);
      }

      if (filters.search) {
        whereClause += ' AND (t.identifier LIKE ? OR t.description LIKE ? OR t.device_id LIKE ?)';
        params.push(`%${filters.search}%`, `%${filters.search}%`, `%${filters.search}%`);
      }

      // Buscar totems
      const totems = await this.db.findMany(`
        SELECT 
          t.totem_id as id,
          t.name,
          t.identifier,
          t.device_id as deviceId,
          t.local_id as localId,
          t.location,
          t.description,
          t.config,
          t.status,
          t.version,
          t.firmware_version as firmwareVersion,
          t.ip_address as ipAddress,
          t.last_seen as lastSeen,
          t.last_heartbeat as lastHeartbeat,
          t.active,
          t.is_active as is_active,
          t.current_playlist_id,
          t.created_at as createdAt,
          t.updated_at as updatedAt,
          l.description as localName,
          p.name as hostName,
          p.publisher_id as publisherId
        FROM totems t
        LEFT JOIN locals l ON t.local_id = l.local_id
        LEFT JOIN publishers p ON l.publisher_id = p.publisher_id
        ${whereClause}
        ORDER BY t.last_heartbeat DESC, t.created_at DESC
        LIMIT ? OFFSET ?
      `, [...params, limit, offset]);

      // Contar total
      const totalResult = await this.db.findFirst(`
        SELECT COUNT(*) as total
        FROM totems t
        ${whereClause}
      `, params);

      const total = totalResult?.total || 0;

      // Buscar estatísticas para cada totem
      const totemsWithStats = await Promise.all(
        totems.map(async (totem) => {
          const stats = await this.getTotemStats(totem.id);
          const uptime = await this.calculateUptime(totem.lastHeartbeat);
          return { ...totem, ...stats, uptime };
        })
      );

      return {
        totems: totemsWithStats,
        total,
        page,
        limit
      };

    } catch (error: any) {
      await logError('Erro ao buscar totems', error);
      throw new Error('Erro interno do servidor');
    }
  }

  /**
   * Busca totem por UIN
   */
  async getTotemByUin(uin: string): Promise<TotemResponse | null> {
    try {
      const totem = await this.db.findFirst(`
        SELECT
          t.totem_id as id,
          t.name,
          t.identifier,
          t.uin,
          t.location,
          t.description,
          t.local_id,
          t.status,
          t.active,
          t.is_active as is_active,
          t.current_playlist_id,
          t.blocked,
          t.blocked_until,
          t.last_heartbeat as lastHeartbeat,
          t.created_at as createdAt,
          t.updated_at as updatedAt,
          l.description as location,
          p.name as hostName,
          p.publisher_id as publisherId
        FROM totems t
        LEFT JOIN locals l ON t.local_id = l.local_id
        LEFT JOIN publishers p ON l.publisher_id = p.publisher_id
        WHERE t.uin = ? OR t.identifier = ?
      `, [uin, uin]);

      return totem;
    } catch (error: any) {
      await logError('Erro ao buscar totem por UIN', error);
      throw new Error('Erro interno do servidor');
    }
  }

  /**
   * Busca totem por ID
   */
  async getTotemById(totemId: number): Promise<TotemResponse | null> {
    try {
      const totem = await this.db.findFirst(`
        SELECT 
          t.totem_id as id,
          t.name,
          t.identifier,
          t.device_id as deviceId,
          t.local_id as localId,
          t.location,
          t.description,
          t.config,
          t.status,
          t.version,
          t.firmware_version as firmwareVersion,
          t.ip_address as ipAddress,
          t.last_seen as lastSeen,
          t.last_heartbeat as lastHeartbeat,
          t.active,
          t.is_active as is_active,
          t.current_playlist_id,
          t.created_at as createdAt,
          t.updated_at as updatedAt,
          l.description as localName,
          p.name as hostName,
          p.publisher_id as publisherId
        FROM totems t
        LEFT JOIN locals l ON t.local_id = l.local_id
        LEFT JOIN publishers p ON l.publisher_id = p.publisher_id
        WHERE t.totem_id = ?
      `, [totemId]);

      if (!totem) {
        return null;
      }

      // Buscar estatísticas
      const stats = await this.getTotemStats(totemId);
      const uptime = await this.calculateUptime(totem.lastHeartbeat);
      return { ...totem, ...stats, uptime };

    } catch (error: any) {
      await logError('Erro ao buscar totem', error);
      throw new Error('Erro interno do servidor');
    }
  }

  /**
   * Busca totem por identifier
   */
  async getTotemByIdentifier(identifier: string): Promise<TotemResponse | null> {
    try {
      const totem = await this.db.findFirst(`
        SELECT 
          t.totem_id as id,
          t.name,
          t.identifier,
          t.device_id as deviceId,
          t.local_id as localId,
          t.location,
          t.description,
          t.config,
          t.status,
          t.version,
          t.firmware_version as firmwareVersion,
          t.ip_address as ipAddress,
          t.last_seen as lastSeen,
          t.last_heartbeat as lastHeartbeat,
          t.active,
          t.is_active as is_active,
          t.current_playlist_id,
          t.created_at as createdAt,
          t.updated_at as updatedAt,
          l.description as localName,
          p.name as hostName,
          p.publisher_id as publisherId
        FROM totems t
        LEFT JOIN locals l ON t.local_id = l.local_id
        LEFT JOIN publishers p ON l.publisher_id = p.publisher_id
        WHERE t.identifier = ?
      `, [identifier]);

      if (!totem) {
        return null;
      }

      // Buscar estatísticas
      const stats = await this.getTotemStats(totem.id);
      const uptime = await this.calculateUptime(totem.lastHeartbeat);
      return { ...totem, ...stats, uptime };

    } catch (error: any) {
      await logError('Erro ao buscar totem por identifier', error);
      throw new Error('Erro interno do servidor');
    }
  }

  /**
   * Busca totem por device ID
   */
  async getTotemByDeviceId(deviceId: string): Promise<TotemResponse | null> {
    try {
      const totem = await this.db.findFirst(`
        SELECT 
          t.totem_id as id,
          t.name,
          t.identifier,
          t.device_id as deviceId,
          t.local_id as localId,
          t.location,
          t.description,
          t.config,
          t.status,
          t.version,
          t.firmware_version as firmwareVersion,
          t.ip_address as ipAddress,
          t.last_seen as lastSeen,
          t.last_heartbeat as lastHeartbeat,
          t.active,
          t.is_active as is_active,
          t.current_playlist_id,
          t.created_at as createdAt,
          t.updated_at as updatedAt,
          l.description as localName,
          p.name as hostName,
          p.publisher_id as publisherId
        FROM totems t
        LEFT JOIN locals l ON t.local_id = l.local_id
        LEFT JOIN publishers p ON l.publisher_id = p.publisher_id
        WHERE t.device_id = ?
      `, [deviceId]);

      if (!totem) {
        return null;
      }

      // Buscar estatísticas
      const stats = await this.getTotemStats(totem.id);
      const uptime = await this.calculateUptime(totem.lastHeartbeat);
      return { ...totem, ...stats, uptime };

    } catch (error: any) {
      await logError('Erro ao buscar totem por device ID', error);
      throw new Error('Erro interno do servidor');
    }
  }

  /**
   * Cria novo totem
   */
  async createTotem(data: CreateTotemRequest, createdBy: number): Promise<TotemResponse> {
    try {
      const { 
        name,
        identifier, 
        deviceId, 
        localId, 
        location,
        description, 
        config, 
        version, 
        firmwareVersion, 
        ipAddress, 
        active = true,
        isActive = true
      } = data;

      const totemIdentifier = identifier || name;

      if (!totemIdentifier) {
        throw new Error('Identifier é obrigatório');
      }

      // Verificar se identifier já existe
      const existingTotem = await this.db.findFirst(`
        SELECT totem_id FROM totems WHERE identifier = ?
      `, [totemIdentifier]);

      if (existingTotem) {
        throw new Error('Identifier já existe');
      }

      // Verificar se device ID já existe (se fornecido)
      if (deviceId) {
        const existingDevice = await this.db.findFirst(`
          SELECT totem_id FROM totems WHERE device_id = ?
        `, [deviceId]);

        if (existingDevice) {
          throw new Error('Device ID já existe');
        }
      }

      // Criar totem
      const result = await this.db.executeRaw(`
        INSERT INTO totems (
          name,
          identifier,
          device_id,
          local_id,
          location,
          description,
          config,
          version,
          firmware_version,
          ip_address,
          active,
          is_active,
          status,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending_approval', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING totem_id
      `, [
        name || identifier,
        totemIdentifier,
        deviceId,
        localId,
        location || null,
        description,
        config ? JSON.stringify(config) : null,
        version,
        firmwareVersion,
        ipAddress,
        active,
        isActive
      ]);

      const insertedId = result?.rows?.[0]?.totem_id;

      if (!insertedId) {
        throw new Error('Erro ao criar totem');
      }

      // Buscar totem criado
      const newTotem = await this.getTotemById(insertedId);
      if (!newTotem) {
        throw new Error('Erro ao buscar totem criado');
      }

      // Log de auditoria
      await this.getAuditService().log('totem', 'created', createdBy, {
        totemId: newTotem.id,
        identifier: newTotem.identifier
      });

      // Invalidar cache relacionado
      await this.cache.invalidateEntity('totem', newTotem.id).catch(() => {});

      return newTotem;

    } catch (error: any) {
      await logError('Erro ao criar totem', error);
      throw error;
    }
  }

  /**
   * Atualiza totem
   */
  async updateTotem(totemId: number, data: UpdateTotemRequest, updatedBy: number): Promise<TotemResponse> {
    try {
      // Verificar se totem existe
      const existingTotem = await this.getTotemById(totemId);
      if (!existingTotem) {
        throw new Error('Totem não encontrado');
      }

      // Verificar se identifier já existe (se estiver sendo alterado)
      if (data.identifier && data.identifier !== existingTotem.identifier) {
        const identifierExists = await this.db.findFirst(`
          SELECT totem_id FROM totems WHERE identifier = ? AND totem_id != ?
        `, [data.identifier, totemId]);

        if (identifierExists) {
          throw new Error('Identifier já existe');
        }
      }

      // Verificar se device ID já existe (se estiver sendo alterado)
      if (data.deviceId && data.deviceId !== existingTotem.deviceId) {
        const deviceIdExists = await this.db.findFirst(`
          SELECT totem_id FROM totems WHERE device_id = ? AND totem_id != ?
        `, [data.deviceId, totemId]);

        if (deviceIdExists) {
          throw new Error('Device ID já existe');
        }
      }

      // Construir query de atualização
      const updates: string[] = [];
      const params: any[] = [];

      if (data.name !== undefined) {
        updates.push('name = ?');
        params.push(data.name);
      }

      if (data.identifier !== undefined) {
        updates.push('identifier = ?');
        params.push(data.identifier);
      }

      if (data.deviceId !== undefined) {
        updates.push('device_id = ?');
        params.push(data.deviceId);
      }

      if (data.localId !== undefined) {
        updates.push('local_id = ?');
        params.push(data.localId);
      }

      if (data.location !== undefined) {
        updates.push('location = ?');
        params.push(data.location);
      }

      if (data.description !== undefined) {
        updates.push('description = ?');
        params.push(data.description);
      }

      if (data.config !== undefined) {
        updates.push('config = ?');
        params.push(JSON.stringify(data.config));
      }

      if (data.version !== undefined) {
        updates.push('version = ?');
        params.push(data.version);
      }

      if (data.firmwareVersion !== undefined) {
        updates.push('firmware_version = ?');
        params.push(data.firmwareVersion);
      }

      if (data.ipAddress !== undefined) {
        updates.push('ip_address = ?');
        params.push(data.ipAddress);
      }

      // REMOVIDO: clientId - totem não pertence a subscriber, pertence a publisher via local_id

      if (data.active !== undefined) {
        const value = data.active ? 1 : 0;
        updates.push('active = ?');
        params.push(value);
        updates.push('is_active = ?');
        params.push(value);
      }

      if (data.isActive !== undefined) {
        const value = data.isActive ? 1 : 0;
        updates.push('is_active = ?');
        params.push(value);
        if (data.active === undefined) {
          updates.push('active = ?');
          params.push(value);
        }
      }

      if (updates.length === 0) {
        return existingTotem;
      }

      updates.push('updated_at = CURRENT_TIMESTAMP');
      params.push(totemId);

      // Atualizar totem
      await this.db.executeRaw(`
        UPDATE totems 
        SET ${updates.join(', ')}
        WHERE totem_id = ?
      `, params);

      // Buscar totem atualizado
      const updatedTotem = await this.getTotemById(totemId);
      if (!updatedTotem) {
        throw new Error('Erro ao buscar totem atualizado');
      }

      // Log de auditoria
      await this.getAuditService().log('totem', 'updated', updatedBy, {
        totemId,
        changes: data
      });

      // Invalidar cache relacionado
      await this.cache.invalidateEntity('totem', totemId).catch(() => {});

      return updatedTotem;

    } catch (error: any) {
      await logError('Erro ao atualizar totem', error);
      throw error;
    }
  }

  /**
   * Processa heartbeat do totem
   */
  async processHeartbeat(data: HeartbeatData): Promise<TotemResponse> {
    try {
      const { totemId, status, version, firmwareVersion, ipAddress, config, metrics } = data;

      // Verificar se totem existe
      const totem = await this.getTotemById(totemId);
      if (!totem) {
        throw new Error('Totem não encontrado');
      }
      const previousStatus = totem.status;

      // Atualizar dados do heartbeat
      const updates: string[] = [];
      const params: any[] = [];

      updates.push('last_heartbeat = CURRENT_TIMESTAMP');
      updates.push('last_seen = CURRENT_TIMESTAMP');

      if (status) {
        updates.push('status = ?');
        params.push(status);
      }

      if (version) {
        updates.push('version = ?');
        params.push(version);
      }

      if (firmwareVersion) {
        updates.push('firmware_version = ?');
        params.push(firmwareVersion);
      }

      if (ipAddress) {
        updates.push('ip_address = ?');
        params.push(ipAddress);
      }

      if (config) {
        updates.push('config = ?');
        params.push(JSON.stringify(config));
      }

      params.push(totemId);

      // Atualizar totem
      await this.db.executeRaw(`
        UPDATE totems 
        SET ${updates.join(', ')}
        WHERE totem_id = ?
      `, params);

      // Salvar métricas se fornecidas
      if (metrics) {
        await this.saveTotemMetrics(totemId, metrics);
      }

      // Buscar totem atualizado
      const updatedTotem = await this.getTotemById(totemId);
      if (!updatedTotem) {
        throw new Error('Erro ao buscar totem atualizado');
      }

      await this.logTotemHeartbeatEvent({
        totem: updatedTotem,
        previousStatus,
        status: status || updatedTotem.status,
        ipAddress,
        version,
        firmwareVersion,
        metrics,
        source: 'processHeartbeat'
      });

      // Invalidar cache relacionado
      await this.cache.invalidateEntity('totem', totemId).catch(() => {});

      return updatedTotem;

    } catch (error: any) {
      await logError('Erro ao processar heartbeat', error);
      throw error;
    }
  }

  /**
   * Salva métricas do totem
   */
  private async saveTotemMetrics(totemId: number, metrics: any): Promise<void> {
    try {
      // Aqui você pode implementar o salvamento de métricas
      // Por exemplo, em uma tabela de métricas ou sistema de monitoramento
      await logDebug(`Métricas do totem`, { totemId, metrics });
    } catch (error: any) {
      await logError('Erro ao salvar métricas', error);
    }
  }

  /**
   * Calcula uptime do totem
   */
  private async calculateUptime(lastHeartbeat?: string): Promise<number> {
    if (!lastHeartbeat) {
      return 0;
    }

    const lastHeartbeatTime = new Date(lastHeartbeat).getTime();
    const now = Date.now();
    const diffMs = now - lastHeartbeatTime;
    
    // Retorna uptime em segundos
    return Math.floor(diffMs / 1000);
  }

  /**
   * Busca estatísticas de um totem (com cache de 2 minutos)
   */
  async getTotemStats(totemId: number): Promise<{
    campaignCount: number;
    playlistCount: number;
  }> {
    const cacheKey = this.cache.generateKey('stats', 'totem', totemId.toString());
    
    return this.cache.getOrSet(
      cacheKey,
      async () => {
        try {
          // Contar campanhas
          const campaignCountResult = await this.db.findFirst(`
            SELECT COUNT(*) as count
            FROM campaign_totems ct
            JOIN campaigns c ON ct.campaign_id = c.campaign_id
            WHERE ct.totem_id = ? AND COALESCE(c.is_active, true) = true
          `, [totemId]);

          // Contar playlists
          const playlistCountResult = await this.db.findFirst(`
            SELECT COUNT(*) as count
            FROM playlists p
            JOIN campaigns c ON p.campaign_id = c.campaign_id
            WHERE p.totem_id = ? AND COALESCE(c.is_active, true) = true
          `, [totemId]);

          return {
            campaignCount: campaignCountResult?.count || 0,
            playlistCount: playlistCountResult?.count || 0
          };

        } catch (error: any) {
          await logError('Erro ao buscar estatísticas do totem', error);
          return {
            campaignCount: 0,
            playlistCount: 0
          };
        }
      },
      120 // Cache por 2 minutos
    );
  }

  /**
   * Registra heartbeat do totem
   */
  async registerHeartbeat(totemId: number, heartbeatData: any): Promise<any> {
    try {
      const existingTotem = await this.getTotemById(totemId);
      if (!existingTotem) {
        throw new Error('Totem não encontrado');
      }
      const previousStatus = existingTotem.status;

      await this.db.executeRaw(`
        UPDATE totems 
        SET last_heartbeat = CURRENT_TIMESTAMP,
            status = ?,
            ip_address = ?,
            mac_address = ?,
            system_info = ?
        WHERE totem_id = ?
      `, [
        heartbeatData.status || 'online',
        heartbeatData.ipAddress,
        heartbeatData.macAddress,
        JSON.stringify(heartbeatData.systemInfo),
        totemId
      ]);

      const updatedTotem = await this.getTotemById(totemId);
      if (updatedTotem) {
        await this.logTotemHeartbeatEvent({
          totem: updatedTotem,
          previousStatus,
          status: heartbeatData.status || updatedTotem.status,
          ipAddress: heartbeatData.ipAddress,
          version: updatedTotem.version,
          firmwareVersion: updatedTotem.firmwareVersion,
          metrics: heartbeatData.systemInfo,
          source: 'registerHeartbeat'
        });
      }

      return { success: true, timestamp: new Date().toISOString() };
    } catch (error: any) {
      await logError('Erro ao registrar heartbeat', error);
      throw new Error('Erro interno do servidor');
    }
  }

  /**
   * Busca histórico de heartbeats
   */
  async getHeartbeatHistory(totemId: number, filters: any): Promise<any[]> {
    try {
      const heartbeats = await this.db.findMany(`
        SELECT
          h.heartbeat_id as id,
          h.totem_id as totemId,
          h.status,
          h.ip_address as ipAddress,
          h.mac_address as macAddress,
          h.system_info as systemInfo,
          h.timestamp,
          h.created_at as createdAt
        FROM totem_heartbeats h
        WHERE h.totem_id = ?
        ORDER BY h.timestamp DESC
        LIMIT ?
      `, [totemId, filters.limit || 100]);

      return heartbeats;
    } catch (error: any) {
      await logError('Erro ao buscar histórico de heartbeats', error);
      throw new Error('Erro interno do servidor');
    }
  }

  /**
   * Busca playlist atual do totem
   */
  async getCurrentPlaylist(totemId: number): Promise<any> {
    try {
      const playlist = await this.db.findFirst(`
        SELECT
          p.playlist_id as id,
          p.name,
          p.description,
          p.is_active as isActive,
          p.created_at as createdAt
        FROM playlists p
        INNER JOIN totem_playlists tp ON p.playlist_id = tp.playlist_id
        WHERE tp.totem_id = ? AND p.is_active = 1
        ORDER BY tp.assigned_at DESC
        LIMIT 1
      `, [totemId]);

      return playlist;
    } catch (error: any) {
      await logError('Erro ao buscar playlist atual', error);
      throw new Error('Erro interno do servidor');
    }
  }

  /**
   * Busca analytics do totem
   */
  async getTotemAnalytics(totemId: number, filters: any): Promise<any> {
    try {
      const analytics = await this.db.findFirst(`
        SELECT
          COUNT(*) as totalViews,
          SUM(duration_seconds) as totalDuration,
          AVG(duration_seconds) as averageDuration,
          COUNT(DISTINCT session_id) as uniqueSessions
        FROM totem_analytics
        WHERE totem_id = ?
        AND timestamp >= ? AND timestamp <= ?
      `, [totemId, filters.startDate, filters.endDate]);

      return {
        totemId,
        period: filters.period || '30d',
        ...analytics
      };
    } catch (error: any) {
      await logError('Erro ao buscar analytics do totem', error);
      throw new Error('Erro interno do servidor');
    }
  }

  private async logTotemHeartbeatEvent(options: {
    totem: TotemResponse;
    previousStatus?: string;
    status?: string;
    ipAddress?: string;
    version?: string;
    firmwareVersion?: string;
    metrics?: HeartbeatData['metrics'];
    source: string;
  }): Promise<void> {
    try {
      const eventLogService = this.eventLogService;
      const metadata = {
        status: options.status,
        previousStatus: options.previousStatus,
        ipAddress: options.ipAddress,
        version: options.version,
        firmwareVersion: options.firmwareVersion,
        metrics: options.metrics,
        source: options.source
      };

      await eventLogService.logEvent({
        eventType: EventType.TOTEM_HEARTBEAT,
        entityType: 'totem',
        entityId: options.totem.id,
        totemId: options.totem.id,
        campaignId: undefined,
        metadata
      });

      if (options.status && options.status !== options.previousStatus) {
        let statusEvent: EventType | null = null;
        if (options.status === 'online') {
          statusEvent = EventType.TOTEM_ONLINE;
        } else if (options.status === 'offline') {
          statusEvent = EventType.TOTEM_OFFLINE;
        } else if (options.status === 'error') {
          statusEvent = EventType.TOTEM_ERROR;
        }

        if (statusEvent) {
          await eventLogService.logEvent({
            eventType: statusEvent,
            entityType: 'totem',
            entityId: options.totem.id,
            totemId: options.totem.id,
            metadata: {
              previousStatus: options.previousStatus,
              newStatus: options.status,
              ipAddress: options.ipAddress,
              version: options.version,
              firmwareVersion: options.firmwareVersion,
              source: options.source,
              errorMessage: statusEvent === EventType.TOTEM_ERROR ? 'Erro detectado no totem' : undefined // Padrão conceitual
            }
          });
        }
      }
    } catch (eventError: any) {
      await logError('Erro ao registrar eventos do totem', eventError, {
        totemId: options.totem.id
      });
    }
  }

  /**
   * Busca estatísticas gerais de totems
   */
  async getTotemsStats(): Promise<TotemStats> {
    try {
      // Total de totems
      const totalResult = await this.db.findFirst(`
        SELECT COUNT(*) as total FROM totems
      `);

      // Por status
      const byStatus = await this.db.findMany(`
        SELECT status, COUNT(*) as count
        FROM totems
        WHERE active = true
        GROUP BY status
        ORDER BY count DESC
      `);

      // Contar por status
      const onlineResult = await this.db.findFirst(`
        SELECT COUNT(*) as count FROM totems WHERE status = 'online' AND active = true
      `);

      const offlineResult = await this.db.findFirst(`
        SELECT COUNT(*) as count FROM totems WHERE status = 'offline' AND active = true
      `);

      const errorResult = await this.db.findFirst(`
        SELECT COUNT(*) as count FROM totems WHERE status = 'error' AND active = true
      `);

      const maintenanceResult = await this.db.findFirst(`
        SELECT COUNT(*) as count FROM totems WHERE status = 'maintenance' AND active = true
      `);

      // Atividade recente (últimos 7 dias)
      const newTotemsResult = await this.db.findFirst(`
        SELECT COUNT(*) as count FROM totems WHERE created_at >= datetime('now', '-7 days')
      `);

      const heartbeatsResult = await this.db.findFirst(`
        SELECT COUNT(*) as count FROM totems WHERE last_heartbeat >= datetime('now', '-7 days')
      `);

      const errorsResult = await this.db.findFirst(`
        SELECT COUNT(*) as count FROM totems WHERE status = 'error' AND updated_at >= datetime('now', '-7 days')
      `);

      return {
        total: totalResult?.total || 0,
        online: onlineResult?.count || 0,
        offline: offlineResult?.count || 0,
        error: errorResult?.count || 0,
        maintenance: maintenanceResult?.count || 0,
        byStatus: byStatus.map(s => ({ status: s.status, count: s.count })),
        recentActivity: {
          newTotems: newTotemsResult?.count || 0,
          heartbeats: heartbeatsResult?.count || 0,
          errors: errorsResult?.count || 0
        }
      };

    } catch (error: any) {
      await logError('Erro ao buscar estatísticas gerais', error);
      throw new Error('Erro interno do servidor');
    }
  }

  /**
   * Desativa totem
   */
  async deactivateTotem(totemId: number, deactivatedBy: number): Promise<void> {
    try {
      // Verificar se totem existe
      const totem = await this.getTotemById(totemId);
      if (!totem) {
        throw new Error('Totem não encontrado');
      }

      if (!totem.active) {
        throw new Error('Totem já está inativo');
      }

      // Desativar totem
      await this.db.executeRaw(`
        UPDATE totems 
        SET active = false, status = 'offline', updated_at = CURRENT_TIMESTAMP 
        WHERE totem_id = ?
      `, [totemId]);

      // Log de auditoria
      await this.getAuditService().log('totem', 'deactivated', deactivatedBy, {
        totemId,
        identifier: totem.identifier
      });

    } catch (error: any) {
      await logError('Erro ao desativar totem', error);
      throw error;
    }
  }

  /**
   * Ativa totem
   */
  async activateTotem(totemId: number, activatedBy: number): Promise<void> {
    try {
      // Verificar se totem existe
      const totem = await this.getTotemById(totemId);
      if (!totem) {
        throw new Error('Totem não encontrado');
      }

      if (totem.active) {
        throw new Error('Totem já está ativo');
      }

      // Ativar totem
      await this.db.executeRaw(`
        UPDATE totems 
        SET active = true, updated_at = CURRENT_TIMESTAMP
        WHERE totem_id = ?
      `, [totemId]);

      // Log de auditoria
      await this.getAuditService().log('totem', 'activated', activatedBy, {
        totemId,
        identifier: totem.identifier
      });

    } catch (error: any) {
      await logError('Erro ao ativar totem', error);
      throw error;
    }
  }

  /**
   * Remove totem (soft delete)
   */
  async deleteTotem(totemId: number, deletedBy: number): Promise<void> {
    try {
      // Verificar se totem existe
      const totem = await this.getTotemById(totemId);
      if (!totem) {
        throw new Error('Totem não encontrado');
      }

      // Verificar se tem dados associados
      const hasCampaigns = await this.db.findFirst(`
        SELECT COUNT(*) as count FROM campaign_totems WHERE totem_id = ?
      `, [totemId]);

      const hasPlaylists = await this.db.findFirst(`
        SELECT COUNT(*) as count FROM playlists WHERE totem_id = ?
      `, [totemId]);

      if (hasCampaigns.count > 0 || hasPlaylists.count > 0) {
        throw new Error('Não é possível remover totem com dados associados. Desative-o primeiro.');
      }

      // Desativar totem (soft delete)
      await this.db.executeRaw(`
        UPDATE totems 
        SET active = false, status = 'offline', updated_at = CURRENT_TIMESTAMP
        WHERE totem_id = ?
      `, [totemId]);

      // Log de auditoria
      await this.getAuditService().log('totem', 'deleted', deletedBy, {
        totemId,
        identifier: totem.identifier
      });

      // Invalidar cache relacionado
      await this.cache.invalidateEntity('totem', totemId).catch(() => {});

      } catch (error: any) {
      await logError('Erro ao remover totem', error);
      throw error;
    }
  }

  /**
   * Busca totems offline há mais de X minutos
   */
  async getOfflineTotems(minutes: number = 30): Promise<TotemResponse[]> {
    try {
      const totems = await this.db.findMany(`
        SELECT 
          t.totem_id as id,
          t.identifier,
          t.device_id as deviceId,
          t.local_id as localId,
          t.description,
          t.config,
          t.status,
          t.version,
          t.firmware_version as firmwareVersion,
          t.ip_address as ipAddress,
          t.last_seen as lastSeen,
          t.last_heartbeat as lastHeartbeat,
          t.active,
          t.created_at as createdAt,
          t.updated_at as updatedAt,
          l.description as localName,
          p.name as hostName,
          p.publisher_id as publisherId
        FROM totems t
        LEFT JOIN locals l ON t.local_id = l.local_id
        LEFT JOIN publishers p ON l.publisher_id = p.publisher_id
        WHERE t.active = 1 AND (
          t.last_heartbeat IS NULL OR 
          t.last_heartbeat < datetime('now', '-${minutes} minutes')
        )
        ORDER BY t.last_heartbeat ASC
      `);

      return totems;

    } catch (error: any) {
      await logError('Erro ao buscar totems offline', error);
      throw new Error('Erro interno do servidor');
    }
  }
}

