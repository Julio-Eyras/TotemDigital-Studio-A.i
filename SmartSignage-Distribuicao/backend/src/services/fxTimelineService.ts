/**
 * FxTimelineService - Gerenciamento de Timelines FX
 * 
 * CRUD completo para timelines globais de efeitos FX para sites
 */

import { getDatabase } from '../config/database';
import { logError } from '../utils/loggerHelper';

export interface FxTimeline {
  timeline_id: number;
  site_id: string;
  name?: string;
  version: number;
  events: any[];
  generated_at: string;
  starts_at?: string;
  ends_at?: string;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
}

export interface CreateFxTimelineRequest {
  site_id: string;
  name?: string;
  version?: number;
  events: any[];
  generated_at?: string;
  starts_at?: string;
  ends_at?: string;
  is_active?: boolean;
}

export interface UpdateFxTimelineRequest {
  site_id?: string;
  name?: string;
  version?: number;
  events?: any[];
  generated_at?: string;
  starts_at?: string;
  ends_at?: string;
  is_active?: boolean;
}

export interface FxTimelineListResponse {
  data: FxTimeline[];
  total: number;
  page: number;
  limit: number;
}

export class FxTimelineService {
  private get db() {
    return getDatabase();
  }

  /**
   * Listar timelines com paginação e filtros
   */
  async getAllTimelines(params: {
    page?: number;
    limit?: number;
    search?: string;
    site_id?: string;
    isActive?: boolean;
  }): Promise<FxTimelineListResponse> {
    try {
      const { page = 1, limit = 20, search, site_id, isActive } = params;
      const offset = (page - 1) * limit;

      let whereClause = '1=1';
      const queryParams: any[] = [];
      let paramIndex = 1;

      if (search) {
        whereClause += ` AND (name ILIKE $${paramIndex} OR site_id ILIKE $${paramIndex})`;
        queryParams.push(`%${search}%`);
        paramIndex++;
      }

      if (site_id) {
        whereClause += ` AND site_id = $${paramIndex}`;
        queryParams.push(site_id);
        paramIndex++;
      }

      if (isActive !== undefined) {
        whereClause += ` AND is_active = $${paramIndex}`;
        queryParams.push(isActive);
        paramIndex++;
      }

      // Contar total
      const countQuery = `SELECT COUNT(*) as total FROM fx_timelines WHERE ${whereClause}`;
      const countResult = await this.db.findFirst(countQuery, queryParams);
      const total = parseInt(countResult?.total || '0', 10);

      // Buscar dados
      const dataQuery = `
        SELECT 
          timeline_id,
          site_id,
          name,
          version,
          events,
          generated_at,
          starts_at,
          ends_at,
          is_active,
          created_at,
          updated_at
        FROM fx_timelines
        WHERE ${whereClause}
        ORDER BY generated_at DESC, version DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;
      queryParams.push(limit, offset);
      const dataResult = await this.db.findMany(dataQuery, queryParams);

      return {
        data: dataResult.map(this.mapRowToTimeline),
        total,
        page,
        limit,
      };
    } catch (error: any) {
      await logError('FxTimelineService.getAllTimelines error', error, params);
      throw new Error(`Erro ao listar timelines: ${error.message}`);
    }
  }

  /**
   * Buscar timeline por ID
   */
  async getTimelineById(timelineId: number): Promise<FxTimeline | null> {
    try {
      const query = `
        SELECT 
          timeline_id,
          site_id,
          name,
          version,
          events,
          generated_at,
          starts_at,
          ends_at,
          is_active,
          created_at,
          updated_at
        FROM fx_timelines
        WHERE timeline_id = $1
      `;
      const result = await this.db.findFirst(query, [timelineId]);

      if (!result) {
        return null;
      }

      return this.mapRowToTimeline(result);
    } catch (error: any) {
      await logError('FxTimelineService.getTimelineById error', error, { timelineId });
      throw new Error(`Erro ao buscar timeline: ${error.message}`);
    }
  }

  /**
   * Buscar timeline ativa mais recente para um site
   */
  async getActiveTimelineForSite(siteId: string): Promise<FxTimeline | null> {
    try {
      const query = `
        SELECT 
          timeline_id,
          site_id,
          name,
          version,
          events,
          generated_at,
          starts_at,
          ends_at,
          is_active,
          created_at,
          updated_at
        FROM fx_timelines
        WHERE site_id = $1 AND is_active = true
        ORDER BY generated_at DESC, version DESC
        LIMIT 1
      `;
      const result = await this.db.findFirst(query, [siteId]);

      if (!result) {
        return null;
      }

      return this.mapRowToTimeline(result);
    } catch (error: any) {
      await logError('FxTimelineService.getActiveTimelineForSite error', error, { siteId });
      throw new Error(`Erro ao buscar timeline ativa: ${error.message}`);
    }
  }

  /**
   * Criar nova timeline
   */
  async createTimeline(data: CreateFxTimelineRequest): Promise<FxTimeline> {
    try {
      const query = `
        INSERT INTO fx_timelines (
          site_id,
          name,
          version,
          events,
          generated_at,
          starts_at,
          ends_at,
          is_active
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING 
          timeline_id,
          site_id,
          name,
          version,
          events,
          generated_at,
          starts_at,
          ends_at,
          is_active,
          created_at,
          updated_at
      `;

      const params = [
        data.site_id,
        data.name || null,
        data.version || 1,
        JSON.stringify(data.events),
        data.generated_at ? new Date(data.generated_at) : new Date(),
        data.starts_at ? new Date(data.starts_at) : null,
        data.ends_at ? new Date(data.ends_at) : null,
        data.is_active !== undefined ? data.is_active : true,
      ];

      const result = await this.db.executeRaw(query, params);
      return this.mapRowToTimeline(result.rows[0]);
    } catch (error: any) {
      await logError('FxTimelineService.createTimeline error', error, data);
      throw new Error(`Erro ao criar timeline: ${error.message}`);
    }
  }

  /**
   * Atualizar timeline
   */
  async updateTimeline(timelineId: number, data: UpdateFxTimelineRequest): Promise<FxTimeline> {
    try {
      const updates: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;

      if (data.site_id !== undefined) {
        updates.push(`site_id = $${paramIndex}`);
        params.push(data.site_id);
        paramIndex++;
      }

      if (data.name !== undefined) {
        updates.push(`name = $${paramIndex}`);
        params.push(data.name);
        paramIndex++;
      }

      if (data.version !== undefined) {
        updates.push(`version = $${paramIndex}`);
        params.push(data.version);
        paramIndex++;
      }

      if (data.events !== undefined) {
        updates.push(`events = $${paramIndex}`);
        params.push(JSON.stringify(data.events));
        paramIndex++;
      }

      if (data.generated_at !== undefined) {
        updates.push(`generated_at = $${paramIndex}`);
        params.push(new Date(data.generated_at));
        paramIndex++;
      }

      if (data.starts_at !== undefined) {
        updates.push(`starts_at = $${paramIndex}`);
        params.push(data.starts_at ? new Date(data.starts_at) : null);
        paramIndex++;
      }

      if (data.ends_at !== undefined) {
        updates.push(`ends_at = $${paramIndex}`);
        params.push(data.ends_at ? new Date(data.ends_at) : null);
        paramIndex++;
      }

      if (data.is_active !== undefined) {
        updates.push(`is_active = $${paramIndex}`);
        params.push(data.is_active);
        paramIndex++;
      }

      if (updates.length === 0) {
        return await this.getTimelineById(timelineId) as FxTimeline;
      }

      updates.push(`updated_at = CURRENT_TIMESTAMP`);
      params.push(timelineId);

      const query = `
        UPDATE fx_timelines
        SET ${updates.join(', ')}
        WHERE timeline_id = $${paramIndex}
        RETURNING 
          timeline_id,
          site_id,
          name,
          version,
          events,
          generated_at,
          starts_at,
          ends_at,
          is_active,
          created_at,
          updated_at
      `;

      const result = await this.db.executeRaw(query, params);

      if (result.rows.length === 0) {
        throw new Error(`Timeline com ID ${timelineId} não encontrada`);
      }

      return this.mapRowToTimeline(result.rows[0]);
    } catch (error: any) {
      await logError('FxTimelineService.updateTimeline error', error, { timelineId, data });
      throw new Error(`Erro ao atualizar timeline: ${error.message}`);
    }
  }

  /**
   * Deletar timeline (soft delete: marca como inativa)
   */
  async deleteTimeline(timelineId: number): Promise<void> {
    try {
      const query = `
        UPDATE fx_timelines
        SET is_active = false, updated_at = CURRENT_TIMESTAMP
        WHERE timeline_id = $1
      `;
      const result = await this.db.executeRaw(query, [timelineId]);

      if (result.rowCount === 0) {
        throw new Error(`Timeline com ID ${timelineId} não encontrada`);
      }
    } catch (error: any) {
      await logError('FxTimelineService.deleteTimeline error', error, { timelineId });
      throw new Error(`Erro ao deletar timeline: ${error.message}`);
    }
  }

  /**
   * Mapear row do banco para objeto FxTimeline
   */
  private mapRowToTimeline(row: any): FxTimeline {
    return {
      timeline_id: row.timeline_id,
      site_id: row.site_id,
      name: row.name || undefined,
      version: row.version,
      events: typeof row.events === 'string' 
        ? JSON.parse(row.events) 
        : (row.events || []),
      generated_at: row.generated_at,
      starts_at: row.starts_at || undefined,
      ends_at: row.ends_at || undefined,
      is_active: row.is_active,
      created_at: row.created_at,
      updated_at: row.updated_at || undefined,
    };
  }
}

// Singleton opcional
let fxTimelineServiceInstance: FxTimelineService | null = null;

export function getFxTimelineService(): FxTimelineService {
  if (!fxTimelineServiceInstance) {
    fxTimelineServiceInstance = new FxTimelineService();
  }
  return fxTimelineServiceInstance;
}

