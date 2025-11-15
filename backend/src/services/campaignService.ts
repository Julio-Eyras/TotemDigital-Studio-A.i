/**
 * Campaign Service - Smart Signage v2.0
 * Serviço de gerenciamento de campanhas
 */

import { getDatabase } from '../config/database';
import { AuditService } from './auditService';

export interface CreateCampaignRequest {
  clientId: number;
  title: string;
  description?: string;
  campaignType?: string;
  priority?: number;
  startDate?: string;
  endDate?: string;
  startTime?: string;
  endTime?: string;
  daysOfWeek?: string[];
  status?: string;
  isActive?: boolean;
}

export interface UpdateCampaignRequest {
  title?: string;
  description?: string;
  campaignType?: string;
  priority?: number;
  startDate?: string;
  endDate?: string;
  startTime?: string;
  endTime?: string;
  daysOfWeek?: string[];
  status?: string;
  isActive?: boolean;
}

export interface CampaignResponse {
  id: number;
  clientId: number;
  title: string;
  description?: string;
  campaignType: string;
  priority: number;
  startDate?: string;
  endDate?: string;
  startTime?: string;
  endTime?: string;
  daysOfWeek: string[];
  status: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  clientName?: string;
  totemCount?: number;
  playlistCount?: number;
  mediaCount?: number;
  totalDuration?: number;
  isScheduled?: boolean;
  isExpired?: boolean;
  isActiveNow?: boolean;
}

export interface CampaignStats {
  total: number;
  active: number;
  paused: number;
  finished: number;
  draft: number;
  byType: { type: string; count: number }[];
  byStatus: { status: string; count: number }[];
  byClient: { clientId: number; clientName: string; count: number }[];
  recentActivity: {
    newCampaigns: number;
    activated: number;
    paused: number;
    finished: number;
  };
}

export interface CampaignTotemRequest {
  totemId: number;
  scheduledStart?: string;
  scheduledEnd?: string;
  config?: any;
}

export class CampaignService {
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

  /**
   * Lista campanhas com paginação e filtros
   */
  async getCampaigns(
    page: number = 1,
    limit: number = 20,
    filters: {
      clientId?: number;
      status?: string;
      campaignType?: string;
      isActive?: boolean;
      search?: string;
    } = {}
  ): Promise<{ campaigns: CampaignResponse[]; total: number; page: number; limit: number }> {
    try {
      const offset = (page - 1) * limit;
      let whereClause = 'WHERE 1=1';
      const params: any[] = [];

      // Aplicar filtros
      if (filters.clientId) {
        whereClause += ' AND c.client_id = ?';
        params.push(filters.clientId);
      }

      if (filters.status) {
        whereClause += ' AND c.status = ?';
        params.push(filters.status);
      }

      if (filters.campaignType) {
        whereClause += ' AND c.campaign_type = ?';
        params.push(filters.campaignType);
      }

      if (filters.isActive !== undefined) {
        whereClause += ' AND c.is_active = ?';
        params.push(filters.isActive);
      }

      if (filters.search) {
        whereClause += ' AND (c.title LIKE ? OR c.description LIKE ?)';
        params.push(`%${filters.search}%`, `%${filters.search}%`);
      }

      // Buscar campanhas
      const campaigns = await this.db.findMany(`
        SELECT 
          c.campaign_id as id,
          c.client_id as clientId,
          c.title,
          c.description,
          c.campaign_type as campaignType,
          c.priority,
          c.start_date as startDate,
          c.end_date as endDate,
          c.start_time as startTime,
          c.end_time as endTime,
          c.days_of_week as daysOfWeek,
          c.status,
          c.is_active as isActive,
          c.created_at as createdAt,
          c.updated_at as updatedAt,
          cl.name as clientName
        FROM campaigns c
        LEFT JOIN clients cl ON c.client_id = cl.client_id
        ${whereClause}
        ORDER BY c.priority DESC, c.created_at DESC
        LIMIT ? OFFSET ?
      `, [...params, limit, offset]);

      // Contar total
      const totalResult = await this.db.findFirst(`
        SELECT COUNT(*) as total
        FROM campaigns c
        ${whereClause}
      `, params);

      const total = totalResult?.total || 0;

      // Buscar estatísticas para cada campanha
      const campaignsWithStats = await Promise.all(
        campaigns.map(async (campaign) => {
          const stats = await this.getCampaignStats(campaign.id);
          const scheduleInfo = this.getScheduleInfo(campaign);
          return { ...campaign, ...stats, ...scheduleInfo };
        })
      );

      return {
        campaigns: campaignsWithStats,
        total,
        page,
        limit
      };

    } catch (error: any) {
      console.error('❌ Erro ao buscar campanhas:', error.message);
      throw new Error('Erro interno do servidor');
    }
  }

  /**
   * Busca campanha por ID
   */
  async getCampaignById(campaignId: number): Promise<CampaignResponse | null> {
    try {
      const campaign = await this.db.findFirst(`
        SELECT 
          c.campaign_id as id,
          c.client_id as clientId,
          c.title,
          c.description,
          c.campaign_type as campaignType,
          c.priority,
          c.start_date as startDate,
          c.end_date as endDate,
          c.start_time as startTime,
          c.end_time as endTime,
          c.days_of_week as daysOfWeek,
          c.status,
          c.is_active as isActive,
          c.created_at as createdAt,
          c.updated_at as updatedAt,
          cl.name as clientName
        FROM campaigns c
        LEFT JOIN clients cl ON c.client_id = cl.client_id
        WHERE c.campaign_id = ?
      `, [campaignId]);

      if (!campaign) {
        return null;
      }

      // Buscar estatísticas
      const stats = await this.getCampaignStats(campaignId);
      const scheduleInfo = this.getScheduleInfo(campaign);
      return { ...campaign, ...stats, ...scheduleInfo };

    } catch (error: any) {
      console.error('❌ Erro ao buscar campanha:', error.message);
      throw new Error('Erro interno do servidor');
    }
  }

  /**
   * Cria nova campanha
   */
  async createCampaign(data: CreateCampaignRequest, createdBy: number): Promise<CampaignResponse> {
    try {
      const {
        clientId,
        title,
        description,
        campaignType = 'general',
        priority = 1,
        startDate,
        endDate,
        startTime,
        endTime,
        daysOfWeek = [],
        status = 'draft',
        isActive = true
      } = data;

      // Validar campos obrigatórios
      if (!clientId) {
        throw new Error('clientId é obrigatório');
      }

      if (!title || title.trim() === '') {
        throw new Error('title é obrigatório');
      }

      // Verificar se cliente existe
      const client = await this.db.findFirst(`
        SELECT client_id FROM clients WHERE client_id = ? AND COALESCE(is_active, true) = true
      `, [clientId]);

      if (!client) {
        throw new Error('Cliente não encontrado ou inativo');
      }

      // Criar campanha
      const result = await this.db.executeRaw(`
        INSERT INTO campaigns (
          client_id, title, description, campaign_type, priority,
          start_date, end_date, start_time, end_time, days_of_week,
          status, is_active
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        RETURNING campaign_id
      `, [
        clientId,
        title,
        description,
        campaignType,
        priority,
        startDate,
        endDate,
        startTime,
        endTime,
        JSON.stringify(daysOfWeek),
        status,
        isActive
      ]);

      const insertedCampaign = result?.rows?.[0];
      if (!insertedCampaign?.campaign_id) {
        throw new Error('Erro ao criar campanha');
      }

      // Buscar campanha criada
      const newCampaign = await this.getCampaignById(insertedCampaign.campaign_id);
      if (!newCampaign) {
        throw new Error('Erro ao buscar campanha criada');
      }

      // Log de auditoria
      await this.getAuditService().log('campaign', 'created', createdBy, {
        campaignId: newCampaign.id,
        title: newCampaign.title,
        clientId: newCampaign.clientId
      });

      return newCampaign;

    } catch (error: any) {
      console.error('❌ Erro ao criar campanha:', error.message);
      throw error;
    }
  }

  /**
   * Atualiza campanha
   */
  async updateCampaign(campaignId: number, data: UpdateCampaignRequest, updatedBy: number): Promise<CampaignResponse> {
    try {
      // Verificar se campanha existe
      const existingCampaign = await this.getCampaignById(campaignId);
      if (!existingCampaign) {
        throw new Error('Campanha não encontrada');
      }

      // Construir query de atualização
      const updates: string[] = [];
      const params: any[] = [];

      if (data.title !== undefined) {
        updates.push('title = ?');
        params.push(data.title);
      }

      if (data.description !== undefined) {
        updates.push('description = ?');
        params.push(data.description);
      }

      if (data.campaignType !== undefined) {
        updates.push('campaign_type = ?');
        params.push(data.campaignType);
      }

      if (data.priority !== undefined) {
        updates.push('priority = ?');
        params.push(data.priority);
      }

      if (data.startDate !== undefined) {
        updates.push('start_date = ?');
        params.push(data.startDate);
      }

      if (data.endDate !== undefined) {
        updates.push('end_date = ?');
        params.push(data.endDate);
      }

      if (data.startTime !== undefined) {
        updates.push('start_time = ?');
        params.push(data.startTime);
      }

      if (data.endTime !== undefined) {
        updates.push('end_time = ?');
        params.push(data.endTime);
      }

      if (data.daysOfWeek !== undefined) {
        updates.push('days_of_week = ?');
        params.push(JSON.stringify(data.daysOfWeek));
      }

      if (data.status !== undefined) {
        updates.push('status = ?');
        params.push(data.status);
      }

      if (data.isActive !== undefined) {
        updates.push('is_active = ?');
        params.push(data.isActive);
      }

      if (updates.length === 0) {
        return existingCampaign;
      }

      updates.push('updated_at = CURRENT_TIMESTAMP');
      params.push(campaignId);

      // Atualizar campanha
      await this.db.executeRaw(`
        UPDATE campaigns 
        SET ${updates.join(', ')}
        WHERE campaign_id = ?
      `, params);

      // Buscar campanha atualizada
      const updatedCampaign = await this.getCampaignById(campaignId);
      if (!updatedCampaign) {
        throw new Error('Erro ao buscar campanha atualizada');
      }

      // Log de auditoria
      await this.getAuditService().log('campaign', 'updated', updatedBy, {
        campaignId,
        changes: data
      });

      return updatedCampaign;

    } catch (error: any) {
      console.error('❌ Erro ao atualizar campanha:', error.message);
      throw error;
    }
  }

  /**
   * Remove campanha
   */
  async deleteCampaign(campaignId: number, deletedBy: number): Promise<void> {
    try {
      // Verificar se campanha existe
      const campaign = await this.getCampaignById(campaignId);
      if (!campaign) {
        throw new Error('Campanha não encontrada');
      }

      // Verificar se tem dados associados
      const hasPlaylists = await this.db.findFirst(`
        SELECT COUNT(*) as count FROM playlists WHERE campaign_id = ?
      `, [campaignId]);

      const hasTotems = await this.db.findFirst(`
        SELECT COUNT(*) as count FROM campaign_totems WHERE campaign_id = ?
      `, [campaignId]);

      if (hasPlaylists.count > 0 || hasTotems.count > 0) {
        throw new Error('Não é possível remover campanha com dados associados. Desative-a primeiro.');
      }

      // Remover campanha
      await this.db.executeRaw(`
        DELETE FROM campaigns WHERE campaign_id = ?
      `, [campaignId]);

      // Log de auditoria
      await this.getAuditService().log('campaign', 'deleted', deletedBy, {
        campaignId,
        title: campaign.title,
        clientId: campaign.clientId
      });

    } catch (error: any) {
      console.error('❌ Erro ao remover campanha:', error.message);
      throw error;
    }
  }

  /**
   * Adiciona totem à campanha
   */
  async addTotemToCampaign(campaignId: number, data: CampaignTotemRequest, addedBy: number): Promise<void> {
    try {
      // Verificar se campanha existe
      const campaign = await this.getCampaignById(campaignId);
      if (!campaign) {
        throw new Error('Campanha não encontrada');
      }

      // Verificar se totem existe
      const totem = await this.db.findFirst(`
        SELECT totem_id FROM totems WHERE totem_id = ? AND COALESCE(is_active, true) = true
      `, [data.totemId]);

      if (!totem) {
        throw new Error('Totem não encontrado ou inativo');
      }

      // Verificar se já está associado
      const existing = await this.db.findFirst(`
        SELECT id FROM campaign_totems WHERE campaign_id = ? AND totem_id = ?
      `, [campaignId, data.totemId]);

      if (existing) {
        throw new Error('Totem já está associado à campanha');
      }

      // Adicionar totem à campanha
      await this.db.executeRaw(`
        INSERT INTO campaign_totems (
          campaign_id, totem_id, scheduled_start, scheduled_end, 
          status, config, is_active
        )
        VALUES (?, ?, ?, ?, 'pending', ?, 1)
      `, [
        campaignId,
        data.totemId,
        data.scheduledStart,
        data.scheduledEnd,
        data.config ? JSON.stringify(data.config) : null
      ]);

      // Log de auditoria
      await this.getAuditService().log('campaign', 'totem_added', addedBy, {
        campaignId,
        totemId: data.totemId
      });

    } catch (error: any) {
      console.error('❌ Erro ao adicionar totem à campanha:', error.message);
      throw error;
    }
  }

  /**
   * Remove totem da campanha
   */
  async removeTotemFromCampaign(campaignId: number, totemId: number, removedBy: number): Promise<void> {
    try {
      // Verificar se associação existe
      const association = await this.db.findFirst(`
        SELECT id FROM campaign_totems WHERE campaign_id = ? AND totem_id = ?
      `, [campaignId, totemId]);

      if (!association) {
        throw new Error('Totem não está associado à campanha');
      }

      // Remover associação
      await this.db.executeRaw(`
        DELETE FROM campaign_totems WHERE campaign_id = ? AND totem_id = ?
      `, [campaignId, totemId]);

      // Log de auditoria
      await this.getAuditService().log('campaign', 'totem_removed', removedBy, {
        campaignId,
        totemId
      });

    } catch (error: any) {
      console.error('❌ Erro ao remover totem da campanha:', error.message);
      throw error;
    }
  }

  /**
   * Ativa campanha
   */
  async activateCampaign(campaignId: number, activatedBy: number): Promise<void> {
    try {
      // Verificar se campanha existe
      const campaign = await this.getCampaignById(campaignId);
      if (!campaign) {
        throw new Error('Campanha não encontrada');
      }

      if (campaign.isActive) {
        throw new Error('Campanha já está ativa');
      }

      // Ativar campanha
      await this.db.executeRaw(`
        UPDATE campaigns 
        SET is_active = true, status = 'active', updated_at = CURRENT_TIMESTAMP 
        WHERE campaign_id = ?
      `, [campaignId]);

      // Log de auditoria
      await this.getAuditService().log('campaign', 'activated', activatedBy, {
        campaignId,
        title: campaign.title
      });

    } catch (error: any) {
      console.error('❌ Erro ao ativar campanha:', error.message);
      throw error;
    }
  }

  /**
   * Pausa campanha
   */
  async pauseCampaign(campaignId: number, pausedBy: number): Promise<void> {
    try {
      // Verificar se campanha existe
      const campaign = await this.getCampaignById(campaignId);
      if (!campaign) {
        throw new Error('Campanha não encontrada');
      }

      if (!campaign.isActive) {
        throw new Error('Campanha já está inativa');
      }

      // Pausar campanha
      await this.db.executeRaw(`
        UPDATE campaigns 
        SET is_active = false, status = 'paused', updated_at = CURRENT_TIMESTAMP 
        WHERE campaign_id = ?
      `, [campaignId]);

      // Log de auditoria
      await this.getAuditService().log('campaign', 'paused', pausedBy, {
        campaignId,
        title: campaign.title
      });

    } catch (error: any) {
      console.error('❌ Erro ao pausar campanha:', error.message);
      throw error;
    }
  }

  /**
   * Finaliza campanha
   */
  async finishCampaign(campaignId: number, finishedBy: number): Promise<void> {
    try {
      // Verificar se campanha existe
      const campaign = await this.getCampaignById(campaignId);
      if (!campaign) {
        throw new Error('Campanha não encontrada');
      }

      // Finalizar campanha
      await this.db.executeRaw(`
        UPDATE campaigns 
        SET is_active = false, status = 'finished', updated_at = CURRENT_TIMESTAMP 
        WHERE campaign_id = ?
      `, [campaignId]);

      // Log de auditoria
      await this.getAuditService().log('campaign', 'finished', finishedBy, {
        campaignId,
        title: campaign.title
      });

    } catch (error: any) {
      console.error('❌ Erro ao finalizar campanha:', error.message);
      throw error;
    }
  }

  /**
   * Busca estatísticas de uma campanha
   */
  async getCampaignStats(campaignId: number): Promise<{
    totemCount: number;
    playlistCount: number;
    mediaCount: number;
    totalDuration: number;
  }> {
    try {
      // Contar totems
      const totemCountResult = await this.db.findFirst(`
        SELECT COUNT(*) as count FROM campaign_totems WHERE campaign_id = ? AND is_active = true
      `, [campaignId]);

      // Contar playlists
      const playlistCountResult = await this.db.findFirst(`
        SELECT COUNT(*) as count FROM playlists WHERE campaign_id = ? AND is_active = true
      `, [campaignId]);

      // Contar mídia (via playlists)
      const mediaCountResult = await this.db.findFirst(`
        SELECT COUNT(DISTINCT pi.media_id) as count
        FROM playlist_items pi
        JOIN playlists p ON pi.playlist_id = p.playlist_id
        WHERE p.campaign_id = ? AND p.is_active = true
      `, [campaignId]);

      // Calcular duração total
      const durationResult = await this.db.findFirst(`
        SELECT SUM(COALESCE(pi.display_seconds, m.duration_seconds, 0)) as total
        FROM playlist_items pi
        JOIN playlists p ON pi.playlist_id = p.playlist_id
        JOIN medias m ON pi.media_id = m.media_id
        WHERE p.campaign_id = ? AND p.is_active = true
      `, [campaignId]);

      return {
        totemCount: totemCountResult?.count || 0,
        playlistCount: playlistCountResult?.count || 0,
        mediaCount: mediaCountResult?.count || 0,
        totalDuration: durationResult?.total || 0
      };

    } catch (error: any) {
      console.error('❌ Erro ao buscar estatísticas da campanha:', error.message);
      return {
        totemCount: 0,
        playlistCount: 0,
        mediaCount: 0,
        totalDuration: 0
      };
    }
  }

  /**
   * Busca totems de uma campanha
   */
  async getCampaignTotems(campaignId: number): Promise<any[]> {
    try {
      const totems = await this.db.findMany(`
        SELECT
          t.totem_id as id,
          t.name,
          t.location,
          t.uin,
          t.is_active as isActive,
          t.last_heartbeat as lastHeartbeat,
          t.created_at as createdAt
        FROM totems t
        INNER JOIN campaign_totems ct ON t.totem_id = ct.totem_id
        WHERE ct.campaign_id = ?
        ORDER BY t.name
      `, [campaignId]);

      return totems;
    } catch (error: any) {
      console.error('❌ Erro ao buscar totems da campanha:', error.message);
      throw new Error('Erro interno do servidor');
    }
  }

  /**
   * Busca estatísticas gerais de campanhas
   */
  async getCampaignsStats(): Promise<CampaignStats> {
    try {
      // Total de campanhas
      const totalResult = await this.db.findFirst(`
        SELECT COUNT(*) as total FROM campaigns
      `);

      // Por status
      const byStatus = await this.db.findMany(`
        SELECT status, COUNT(*) as count
        FROM campaigns
        GROUP BY status
        ORDER BY count DESC
      `);

      // Contar por status
      const activeResult = await this.db.findFirst(`
        SELECT COUNT(*) as count FROM campaigns WHERE status = 'active' AND is_active = true
      `);

      const pausedResult = await this.db.findFirst(`
        SELECT COUNT(*) as count FROM campaigns WHERE status = 'paused'
      `);

      const finishedResult = await this.db.findFirst(`
        SELECT COUNT(*) as count FROM campaigns WHERE status = 'finished'
      `);

      const draftResult = await this.db.findFirst(`
        SELECT COUNT(*) as count FROM campaigns WHERE status = 'draft'
      `);

      // Por tipo
      const byType = await this.db.findMany(`
        SELECT campaign_type as type, COUNT(*) as count
        FROM campaigns
        GROUP BY campaign_type
        ORDER BY count DESC
      `);

      // Por cliente
      const byClient = await this.db.findMany(`
        SELECT 
          c.client_id as clientId,
          cl.name as clientName,
          COUNT(*) as count
        FROM campaigns c
        LEFT JOIN clients cl ON c.client_id = cl.client_id
        GROUP BY c.client_id, cl.name
        ORDER BY count DESC
        LIMIT 10
      `);

      // Atividade recente (últimos 7 dias)
      const newCampaignsResult = await this.db.findFirst(`
        SELECT COUNT(*) as count FROM campaigns WHERE created_at >= NOW() - INTERVAL '7 days'
      `);

      const activatedResult = await this.db.findFirst(`
        SELECT COUNT(*) as count FROM campaigns 
        WHERE status = 'active' AND updated_at >= NOW() - INTERVAL '7 days'
      `);

      const pausedResult2 = await this.db.findFirst(`
        SELECT COUNT(*) as count FROM campaigns 
        WHERE status = 'paused' AND updated_at >= NOW() - INTERVAL '7 days'
      `);

      const finishedResult2 = await this.db.findFirst(`
        SELECT COUNT(*) as count FROM campaigns 
        WHERE status = 'finished' AND updated_at >= NOW() - INTERVAL '7 days'
      `);

      return {
        total: totalResult?.total || 0,
        active: activeResult?.count || 0,
        paused: pausedResult?.count || 0,
        finished: finishedResult?.count || 0,
        draft: draftResult?.count || 0,
        byType: byType.map(t => ({ type: t.type, count: t.count })),
        byStatus: byStatus.map(s => ({ status: s.status, count: s.count })),
        byClient: byClient.map(c => ({ clientId: c.clientId, clientName: c.clientName, count: c.count })),
        recentActivity: {
          newCampaigns: newCampaignsResult?.count || 0,
          activated: activatedResult?.count || 0,
          paused: pausedResult2?.count || 0,
          finished: finishedResult2?.count || 0
        }
      };

    } catch (error: any) {
      console.error('❌ Erro ao buscar estatísticas gerais:', error.message);
      throw new Error('Erro interno do servidor');
    }
  }

  /**
   * Busca campanhas ativas para um totem
   */
  async getActiveCampaignsForTotem(totemId: number): Promise<CampaignResponse[]> {
    try {
      const campaigns = await this.db.findMany(`
        SELECT 
          c.campaign_id as id,
          c.client_id as clientId,
          c.title,
          c.description,
          c.campaign_type as campaignType,
          c.priority,
          c.start_date as startDate,
          c.end_date as endDate,
          c.start_time as startTime,
          c.end_time as endTime,
          c.days_of_week as daysOfWeek,
          c.status,
          c.is_active as isActive,
          c.created_at as createdAt,
          c.updated_at as updatedAt,
          cl.name as clientName
        FROM campaigns c
        LEFT JOIN clients cl ON c.client_id = cl.client_id
        JOIN campaign_totems ct ON c.campaign_id = ct.campaign_id
        WHERE ct.totem_id = ? AND c.is_active = true AND c.status = 'active'
        ORDER BY c.priority DESC, c.created_at DESC
      `, [totemId]);

      // Buscar estatísticas para cada campanha
      const campaignsWithStats = await Promise.all(
        campaigns.map(async (campaign) => {
          const stats = await this.getCampaignStats(campaign.id);
          const scheduleInfo = this.getScheduleInfo(campaign);
          return { ...campaign, ...stats, ...scheduleInfo };
        })
      );

      return campaignsWithStats;

    } catch (error: any) {
      console.error('❌ Erro ao buscar campanhas ativas para totem:', error.message);
      throw new Error('Erro interno do servidor');
    }
  }

  /**
   * Busca campanhas que precisam ser ativadas/pausadas
   */
  async getCampaignsToUpdate(): Promise<CampaignResponse[]> {
    try {
      const now = new Date().toISOString();

      // Campanhas que devem ser ativadas
      const toActivate = await this.db.findMany(`
        SELECT 
          c.campaign_id as id,
          c.client_id as clientId,
          c.title,
          c.description,
          c.campaign_type as campaignType,
          c.priority,
          c.start_date as startDate,
          c.end_date as endDate,
          c.start_time as startTime,
          c.end_time as endTime,
          c.days_of_week as daysOfWeek,
          c.status,
          c.is_active as isActive,
          c.created_at as createdAt,
          c.updated_at as updatedAt,
          cl.name as clientName
        FROM campaigns c
        LEFT JOIN clients cl ON c.client_id = cl.client_id
        WHERE c.status = 'draft' 
        AND c.start_date <= ? 
        AND c.is_active = false
      `, [now]);

      // Campanhas que devem ser pausadas
      const toPause = await this.db.findMany(`
        SELECT 
          c.campaign_id as id,
          c.client_id as clientId,
          c.title,
          c.description,
          c.campaign_type as campaignType,
          c.priority,
          c.start_date as startDate,
          c.end_date as endDate,
          c.start_time as startTime,
          c.end_time as endTime,
          c.days_of_week as daysOfWeek,
          c.status,
          c.is_active as isActive,
          c.created_at as createdAt,
          c.updated_at as updatedAt,
          cl.name as clientName
        FROM campaigns c
        LEFT JOIN clients cl ON c.client_id = cl.client_id
        WHERE c.status = 'active' 
        AND c.end_date <= ? 
        AND c.is_active = true
      `, [now]);

      return [...toActivate, ...toPause];

    } catch (error: any) {
      console.error('❌ Erro ao buscar campanhas para atualizar:', error.message);
      throw new Error('Erro interno do servidor');
    }
  }

  /**
   * Obtém informações de agendamento da campanha
   */
  private getScheduleInfo(campaign: any): {
    isScheduled: boolean;
    isExpired: boolean;
    isActiveNow: boolean;
  } {
    const now = new Date();
    const startDate = campaign.startDate ? new Date(campaign.startDate) : null;
    const endDate = campaign.endDate ? new Date(campaign.endDate) : null;

    const isScheduled = !!(startDate || endDate);
    const isExpired = endDate ? now > endDate : false;
    const isActiveNow = campaign.isActive && 
      (!startDate || now >= startDate) && 
      (!endDate || now <= endDate);

    return {
      isScheduled,
      isExpired,
      isActiveNow
    };
  }

  /**
   * Busca campanhas por cliente
   */
  async getCampaignsByClient(clientId: number, limit: number = 50): Promise<CampaignResponse[]> {
    try {
      const campaigns = await this.db.findMany(`
        SELECT 
          c.campaign_id as id,
          c.client_id as clientId,
          c.title,
          c.description,
          c.campaign_type as campaignType,
          c.priority,
          c.start_date as startDate,
          c.end_date as endDate,
          c.start_time as startTime,
          c.end_time as endTime,
          c.days_of_week as daysOfWeek,
          c.status,
          c.is_active as isActive,
          c.created_at as createdAt,
          c.updated_at as updatedAt,
          cl.name as clientName
        FROM campaigns c
        LEFT JOIN clients cl ON c.client_id = cl.client_id
        WHERE c.client_id = ?
        ORDER BY c.priority DESC, c.created_at DESC
        LIMIT ?
      `, [clientId, limit]);

      // Buscar estatísticas para cada campanha
      const campaignsWithStats = await Promise.all(
        campaigns.map(async (campaign) => {
          const stats = await this.getCampaignStats(campaign.id);
          const scheduleInfo = this.getScheduleInfo(campaign);
          return { ...campaign, ...stats, ...scheduleInfo };
        })
      );

      return campaignsWithStats;

    } catch (error: any) {
      console.error('❌ Erro ao buscar campanhas por cliente:', error.message);
      throw new Error('Erro interno do servidor');
    }
  }
}

