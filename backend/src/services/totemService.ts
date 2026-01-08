/**
 * Totem Service - Smart Signage v2.0
 * Serviço de gerenciamento de totems
 */

import { getDatabase } from '../config/database';
import { AuditService } from './auditService';
import { logError, logDebug } from '../utils/loggerHelper';
import { getEventLogService, EventType } from './eventLogService';
import { getCacheService } from './cacheService';
import { getTotemPlaylistMixService } from './totemPlaylistMixService';

export interface CreateTotemRequest {
  name?: string;
  identifier: string;
  uin?: string; // Unique Identifier Number
  deviceId?: string;
  localId?: number; // OBRIGATÓRIO: totem deve pertencer a um local
  contract_id?: number; // Opcional: contrato que gerou a criação (rastreabilidade)
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
  uin?: string; // Unique Identifier Number
  deviceId?: string;
  localId?: number; // Totem deve pertencer a um local
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
  aiContext?: {
    pedestrian_count?: number;
    pedestrian_density?: 'low' | 'medium' | 'high';
    pedestrian_demographics?: any;
    sentiment_score?: number;
    sentiment_label?: 'positive' | 'neutral' | 'negative';
    emotion_tags?: string[];
    time_of_day?: string;
    day_type?: string;
    weather_context?: any;
    event_context?: any;
    performance_metrics?: any;
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

      // Buscar totems (schema v2 - colunas ajustadas)
      const totems = await this.db.findMany(`
        SELECT 
          t.totem_id as id,
          t.name,
          t.identifier,
          t.device_id as deviceId,
          t.local_id as localId,
          l.name as location,
          t.description,
          t.network_info as config,
          t.status,
          t.firmware_version as firmwareVersion,
          t.network_info->>'ip' as ipAddress,
          t.last_heartbeat as lastSeen,
          t.last_heartbeat as lastHeartbeat,
          t.is_active as active,
          t.is_active as is_active,
          NULL as current_playlist_id,
          t.created_at as createdAt,
          t.updated_at as updatedAt,
          l.name as localName,
          p.name as hostName,
          p.publisher_id as publisherId
        FROM totems t
        LEFT JOIN locals l ON t.local_id = l.local_id
        LEFT JOIN publishers p ON l.publisher_id = p.publisher_id
        ${whereClause}
        ORDER BY t.last_heartbeat DESC NULLS LAST, t.created_at DESC
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
          l.name as location,
          t.description,
          t.local_id,
          t.status,
          t.is_active as active,
          t.is_active as is_active,
          NULL as current_playlist_id,
          false as blocked,
          NULL as blocked_until,
          t.last_heartbeat as lastHeartbeat,
          t.created_at as createdAt,
          t.updated_at as updatedAt,
          l.name as localName,
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
          l.name as location,
          t.description,
          t.network_info as config,
          t.status,
          t.firmware_version as firmwareVersion,
          t.network_info->>'ip' as ipAddress,
          t.last_heartbeat as lastSeen,
          t.last_heartbeat as lastHeartbeat,
          t.is_active as active,
          t.is_active as is_active,
          NULL as current_playlist_id,
          t.created_at as createdAt,
          t.updated_at as updatedAt,
          l.name as localName,
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
          l.name as location,
          t.description,
          t.network_info as config,
          t.status,
          t.firmware_version as firmwareVersion,
          t.network_info->>'ip' as ipAddress,
          t.last_heartbeat as lastSeen,
          t.last_heartbeat as lastHeartbeat,
          t.is_active as active,
          t.is_active as is_active,
          NULL as current_playlist_id,
          t.created_at as createdAt,
          t.updated_at as updatedAt,
          l.name as localName,
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
          l.name as location,
          t.description,
          t.network_info as config,
          t.status,
          t.firmware_version as firmwareVersion,
          t.network_info->>'ip' as ipAddress,
          t.last_heartbeat as lastSeen,
          t.last_heartbeat as lastHeartbeat,
          t.is_active as active,
          t.is_active as is_active,
          NULL as current_playlist_id,
          t.created_at as createdAt,
          t.updated_at as updatedAt,
          l.name as localName,
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
  async createTotem(
    data: CreateTotemRequest,
    createdBy: number,
    requestPublisherId?: number,
    isAdmin: boolean = false
  ): Promise<TotemResponse> {
    try {
      const { 
        name,
        identifier, 
        uin,
        deviceId, 
        localId,
        contract_id,
        description, 
        config, 
        firmwareVersion, 
        isActive = true
      } = data;

      const totemIdentifier = identifier || name;

      if (!totemIdentifier) {
        throw new Error('Identifier é obrigatório');
      }

      if (!localId) {
        throw new Error('local_id é obrigatório. Totem deve pertencer a um local.');
      }

      // Validar se local existe e obter publisher_id
      const local = await this.db.findFirst(`
        SELECT 
          l.local_id,
          l.name as local_name,
          p.publisher_id,
          p.name as publisher_name
        FROM locals l
        JOIN publishers p ON l.publisher_id = p.publisher_id
        WHERE l.local_id = ?
      `, [localId]);

      if (!local) {
        throw new Error('Local não encontrado');
      }

      // Validação de ownership: não-admin só pode criar totens em locals do seu publisher
      if (!isAdmin && requestPublisherId && local.publisher_id !== requestPublisherId) {
        throw new Error('Acesso negado: Você só pode criar totens em locals do seu próprio publisher');
      }

      // Verificar se identifier já existe
      const existingTotem = await this.db.findFirst(`
        SELECT totem_id FROM totems WHERE identifier = ?
      `, [totemIdentifier]);

      if (existingTotem) {
        throw new Error('Identifier já existe');
      }

      // Verificar se UIN já existe (se fornecido)
      if (uin) {
        const existingUin = await this.db.findFirst(`
          SELECT totem_id FROM totems WHERE uin = ?
        `, [uin]);

        if (existingUin) {
          throw new Error('UIN já existe');
        }
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

      // Validar contract_id se fornecido (deve existir e estar ativo)
      if (contract_id) {
        const contract = await this.db.findFirst(`
          SELECT contract_id, status, start_date, end_date
          FROM subscriber_contracts 
          WHERE contract_id = $1
          UNION ALL
          SELECT contract_id, status, start_date, end_date
          FROM publisher_contracts 
          WHERE contract_id = $1
        `, [contract_id]);

        if (!contract) {
          throw new Error('Contrato não encontrado');
        }

        if (contract.status !== 'active' && contract.status !== 'draft') {
          throw new Error('Contrato deve estar em status "active" ou "draft"');
        }
      }

      // Criar totem
      const result = await this.db.executeRaw(`
        INSERT INTO totems (
          name,
          identifier,
          uin,
          device_id,
          local_id,
          created_via_contract_id,
          description,
          network_info,
          firmware_version,
          is_active,
          status,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'offline', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING totem_id
      `, [
        name || identifier,
        totemIdentifier,
        uin || null,
        deviceId || null,
        localId,
        contract_id || null,
        description || null,
        config ? JSON.stringify(config) : null,
        firmwareVersion || null,
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
  async updateTotem(
    totemId: number,
    data: UpdateTotemRequest,
    updatedBy: number,
    requestPublisherId?: number,
    isAdmin: boolean = false
  ): Promise<TotemResponse> {
    try {
      // Verificar se totem existe e obter publisher_id
      const existingTotem = await this.getTotemById(totemId);
      if (!existingTotem) {
        throw new Error('Totem não encontrado');
      }

      // Se localId está sendo alterado, validar ownership
      const existingLocalId = typeof existingTotem.localId === 'string' ? parseInt(existingTotem.localId) : existingTotem.localId;
      if (data.localId !== undefined && data.localId !== existingLocalId) {
        const local = await this.db.findFirst(`
          SELECT 
            l.local_id,
            p.publisher_id
          FROM locals l
          JOIN publishers p ON l.publisher_id = p.publisher_id
          WHERE l.local_id = ?
        `, [data.localId]);

        if (!local) {
          throw new Error('Local não encontrado');
        }

        // Validação de ownership: não-admin só pode mover totem para local do seu publisher
        if (!isAdmin && requestPublisherId && local.publisher_id !== requestPublisherId) {
          throw new Error('Acesso negado: Você só pode mover totem para locals do seu próprio publisher');
        }
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

      // Verificar se UIN já existe (se estiver sendo alterado)
      if (data.uin !== undefined && data.uin !== existingTotem.uin) {
        if (data.uin) {
          const uinExists = await this.db.findFirst(`
            SELECT totem_id FROM totems WHERE uin = ? AND totem_id != ?
          `, [data.uin, totemId]);

          if (uinExists) {
            throw new Error('UIN já existe');
          }
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

      if (data.uin !== undefined) {
        updates.push('uin = ?');
        params.push(data.uin || null);
      }

      if (data.deviceId !== undefined) {
        updates.push('device_id = ?');
        params.push(data.deviceId);
      }

      if (data.localId !== undefined) {
        updates.push('local_id = ?');
        params.push(data.localId);
      }

      // location não existe mais na tabela totems (vem de locals.name)
      // Removido: if (data.location !== undefined) { ... }

      if (data.description !== undefined) {
        updates.push('description = ?');
        params.push(data.description);
      }

      if (data.config !== undefined) {
        updates.push('network_info = ?');
        params.push(JSON.stringify(data.config));
      }

      // version não existe mais no schema v2
      // Removido: if (data.version !== undefined) { ... }

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
      const { totemId, status, version, firmwareVersion, ipAddress, config, metrics, aiContext } = data;

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

      // Atualizar contexto de IA se fornecido
      if (aiContext) {
        try {
          const mixService = getTotemPlaylistMixService();
          await mixService.updateAIContext(totemId, aiContext);
          await logDebug('Contexto de IA atualizado via heartbeat', { totemId });
        } catch (error: any) {
          // Log erro mas não falha o heartbeat
          await logError('Erro ao atualizar contexto de IA no heartbeat', error, { totemId });
        }
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
   * Obtém playlist mixada atual do totem (nova implementação com mix inteligente)
   */
  async getCurrentMixedPlaylist(totemId: number): Promise<any> {
    try {
      const mixService = getTotemPlaylistMixService();
      
      // Tentar obter mix atual
      let currentMix = await mixService.getCurrentMix(totemId);
      
      // Se não houver mix atual, gerar uma nova
      if (!currentMix) {
        await logDebug('Nenhuma mixagem encontrada, gerando nova', { totemId });
        currentMix = await mixService.generateMixForTotem(totemId);
      }
      
      if (!currentMix) {
        return null;
      }
      
      // Converter mix_items para formato de playlist
      const playlistItems = currentMix.mix_items.map((item: any, index: number) => ({
        item_id: index + 1,
        media_id: item.media_id,
        playlist_id: item.playlist_id,
        campaign_id: item.campaign_id,
        order_index: item.order_index || index + 1,
        duration: item.duration || 10,
        weight: item.weight,
        priority: item.priority,
        tags: item.tags || [],
      }));
      
      return {
        mix_id: currentMix.mix_id,
        playlist_id: null, // Não é uma playlist única, é um mix
        name: `Mix Inteligente v${currentMix.mix_version}`,
        description: `Playlist mixada gerada automaticamente (${currentMix.mix_strategy})`,
        items: playlistItems,
        total_items: currentMix.total_items,
        total_duration: currentMix.total_duration,
        mix_strategy: currentMix.mix_strategy,
        context_snapshot: currentMix.context_snapshot,
        generated_at: currentMix.generated_at,
        applied_at: currentMix.applied_at,
      };
    } catch (error: any) {
      await logError('Erro ao obter playlist mixada', error, { totemId });
      // Fallback para método antigo se houver erro
      return this.getCurrentPlaylist(totemId);
    }
  }

  /**
   * Gera nova playlist mixada para o totem
   */
  async generateMixedPlaylist(totemId: number): Promise<any> {
    try {
      const mixService = getTotemPlaylistMixService();
      const newMix = await mixService.generateMixForTotem(totemId);
      
      // Converter para formato de resposta
      return {
        mix_id: newMix.mix_id,
        totem_id: newMix.totem_id,
        mix_version: newMix.mix_version,
        total_items: newMix.total_items,
        total_duration: newMix.total_duration,
        mix_strategy: newMix.mix_strategy,
        generated_at: newMix.generated_at,
        applied_at: newMix.applied_at,
        items: newMix.mix_items,
      };
    } catch (error: any) {
      await logError('Erro ao gerar playlist mixada', error, { totemId });
      throw error;
    }
  }

  /**
   * Busca playlist atual do totem (método legado - mantido para compatibilidade)
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
          t.network_info as config,
          t.status,
          t.firmware_version as firmwareVersion,
          t.network_info->>'ip' as ipAddress,
          t.last_heartbeat as lastSeen,
          t.last_heartbeat as lastHeartbeat,
          t.is_active as active,
          t.created_at as createdAt,
          t.updated_at as updatedAt,
          l.name as localName,
          p.name as hostName,
          p.publisher_id as publisherId
        FROM totems t
        LEFT JOIN locals l ON t.local_id = l.local_id
        LEFT JOIN publishers p ON l.publisher_id = p.publisher_id
        WHERE t.is_active = true AND (
          t.last_heartbeat IS NULL OR 
          t.last_heartbeat < NOW() - INTERVAL '${minutes} minutes'
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

