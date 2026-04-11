/**
 * FxSiteService - Gerenciamento de Sites FX (Rede Estrela)
 * 
 * CRUD completo para sites/rede estrela do SmartDisplayFX Plus
 */

import { getDatabase } from '../config/database';
import { logError } from '../utils/loggerHelper';

export interface FxSite {
  site_id: string;
  name: string;
  description?: string;
  client_id?: number;
  broker_url?: string;
  broker_type: string;
  broker_config: Record<string, any>;
  sync_interval_ms: number;
  time_sync_enabled: boolean;
  config: Record<string, any>;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
}

export interface CreateFxSiteRequest {
  site_id: string;
  name: string;
  description?: string;
  client_id?: number;
  broker_url?: string;
  broker_type?: string;
  broker_config?: Record<string, any>;
  sync_interval_ms?: number;
  time_sync_enabled?: boolean;
  config?: Record<string, any>;
  is_active?: boolean;
}

export interface UpdateFxSiteRequest {
  name?: string;
  description?: string;
  client_id?: number;
  broker_url?: string;
  broker_type?: string;
  broker_config?: Record<string, any>;
  sync_interval_ms?: number;
  time_sync_enabled?: boolean;
  config?: Record<string, any>;
  is_active?: boolean;
}

export interface FxSiteListResponse {
  data: FxSite[];
  total: number;
  page: number;
  limit: number;
}

export interface FxTotemSite {
  id: number;
  totem_id: number;
  site_id: string;
  role: string;
  position_x?: number;
  position_y?: number;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
}

export class FxSiteService {
  private get db() {
    return getDatabase();
  }

  /**
   * Listar sites com paginação e filtros
   */
  async getAllSites(params: {
    page?: number;
    limit?: number;
    search?: string;
    client_id?: number;
    isActive?: boolean;
  }): Promise<FxSiteListResponse> {
    try {
      const { page = 1, limit = 20, search, client_id, isActive } = params;
      const offset = (page - 1) * limit;

      let whereClause = '1=1';
      const queryParams: any[] = [];
      let paramIndex = 1;

      if (search) {
        whereClause += ` AND (name ILIKE $${paramIndex} OR site_id ILIKE $${paramIndex} OR description ILIKE $${paramIndex})`;
        queryParams.push(`%${search}%`);
        paramIndex++;
      }

      if (client_id) {
        whereClause += ` AND client_id = $${paramIndex}`;
        queryParams.push(client_id);
        paramIndex++;
      }

      if (isActive !== undefined) {
        whereClause += ` AND is_active = $${paramIndex}`;
        queryParams.push(isActive);
        paramIndex++;
      }

      // Contar total
      const countQuery = `SELECT COUNT(*) as total FROM fx_sites WHERE ${whereClause}`;
      const countResult = await this.db.findFirst(countQuery, queryParams);
      const total = parseInt(countResult?.total || '0', 10);

      // Buscar dados
      const dataQuery = `
        SELECT 
          site_id,
          name,
          description,
          client_id,
          broker_url,
          broker_type,
          broker_config,
          sync_interval_ms,
          time_sync_enabled,
          config,
          is_active,
          created_at,
          updated_at
        FROM fx_sites
        WHERE ${whereClause}
        ORDER BY name ASC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;
      queryParams.push(limit, offset);
      const dataResult = await this.db.findMany(dataQuery, queryParams);

      return {
        data: dataResult.map(this.mapRowToSite),
        total,
        page,
        limit,
      };
    } catch (error: any) {
      await logError('FxSiteService.getAllSites error', error, params);
      throw new Error(`Erro ao listar sites: ${error.message}`);
    }
  }

  /**
   * Buscar site por ID
   */
  async getSiteById(siteId: string): Promise<FxSite | null> {
    try {
      const query = `
        SELECT 
          site_id,
          name,
          description,
          client_id,
          broker_url,
          broker_type,
          broker_config,
          sync_interval_ms,
          time_sync_enabled,
          config,
          is_active,
          created_at,
          updated_at
        FROM fx_sites
        WHERE site_id = $1
      `;
      const result = await this.db.findFirst(query, [siteId]);

      if (!result) {
        return null;
      }

      return this.mapRowToSite(result);
    } catch (error: any) {
      await logError('FxSiteService.getSiteById error', error, { siteId });
      throw new Error(`Erro ao buscar site: ${error.message}`);
    }
  }

  /**
   * Criar novo site
   */
  async createSite(data: CreateFxSiteRequest): Promise<FxSite> {
    try {
      const query = `
        INSERT INTO fx_sites (
          site_id,
          name,
          description,
          client_id,
          broker_url,
          broker_type,
          broker_config,
          sync_interval_ms,
          time_sync_enabled,
          config,
          is_active
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING 
          site_id,
          name,
          description,
          client_id,
          broker_url,
          broker_type,
          broker_config,
          sync_interval_ms,
          time_sync_enabled,
          config,
          is_active,
          created_at,
          updated_at
      `;

      const params = [
        data.site_id,
        data.name,
        data.description || null,
        data.client_id || null,
        data.broker_url || null,
        data.broker_type || 'mqtt',
        JSON.stringify(data.broker_config || {}),
        data.sync_interval_ms || 2000,
        data.time_sync_enabled !== undefined ? data.time_sync_enabled : true,
        JSON.stringify(data.config || {}),
        data.is_active !== undefined ? data.is_active : true,
      ];

      const result = await this.db.executeRaw(query, params);
      return this.mapRowToSite(result.rows[0]);
    } catch (error: any) {
      await logError('FxSiteService.createSite error', error, data);
      if (error.code === '23505') {
        throw new Error(`Site com ID "${data.site_id}" já existe`);
      }
      throw new Error(`Erro ao criar site: ${error.message}`);
    }
  }

  /**
   * Atualizar site
   */
  async updateSite(siteId: string, data: UpdateFxSiteRequest): Promise<FxSite> {
    try {
      const updates: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;

      if (data.name !== undefined) {
        updates.push(`name = $${paramIndex}`);
        params.push(data.name);
        paramIndex++;
      }

      if (data.description !== undefined) {
        updates.push(`description = $${paramIndex}`);
        params.push(data.description);
        paramIndex++;
      }

      if (data.client_id !== undefined) {
        updates.push(`client_id = $${paramIndex}`);
        params.push(data.client_id);
        paramIndex++;
      }

      if (data.broker_url !== undefined) {
        updates.push(`broker_url = $${paramIndex}`);
        params.push(data.broker_url);
        paramIndex++;
      }

      if (data.broker_type !== undefined) {
        updates.push(`broker_type = $${paramIndex}`);
        params.push(data.broker_type);
        paramIndex++;
      }

      if (data.broker_config !== undefined) {
        updates.push(`broker_config = $${paramIndex}`);
        params.push(JSON.stringify(data.broker_config));
        paramIndex++;
      }

      if (data.sync_interval_ms !== undefined) {
        updates.push(`sync_interval_ms = $${paramIndex}`);
        params.push(data.sync_interval_ms);
        paramIndex++;
      }

      if (data.time_sync_enabled !== undefined) {
        updates.push(`time_sync_enabled = $${paramIndex}`);
        params.push(data.time_sync_enabled);
        paramIndex++;
      }

      if (data.config !== undefined) {
        updates.push(`config = $${paramIndex}`);
        params.push(JSON.stringify(data.config));
        paramIndex++;
      }

      if (data.is_active !== undefined) {
        updates.push(`is_active = $${paramIndex}`);
        params.push(data.is_active);
        paramIndex++;
      }

      if (updates.length === 0) {
        return await this.getSiteById(siteId) as FxSite;
      }

      updates.push(`updated_at = CURRENT_TIMESTAMP`);
      params.push(siteId);

      const query = `
        UPDATE fx_sites
        SET ${updates.join(', ')}
        WHERE site_id = $${paramIndex}
        RETURNING 
          site_id,
          name,
          description,
          client_id,
          broker_url,
          broker_type,
          broker_config,
          sync_interval_ms,
          time_sync_enabled,
          config,
          is_active,
          created_at,
          updated_at
      `;

      const result = await this.db.executeRaw(query, params);

      if (result.rows.length === 0) {
        throw new Error(`Site com ID ${siteId} não encontrado`);
      }

      return this.mapRowToSite(result.rows[0]);
    } catch (error: any) {
      await logError('FxSiteService.updateSite error', error, { siteId, data });
      throw new Error(`Erro ao atualizar site: ${error.message}`);
    }
  }

  /**
   * Deletar site (soft delete: marca como inativo)
   */
  async deleteSite(siteId: string): Promise<void> {
    try {
      const query = `
        UPDATE fx_sites
        SET is_active = false, updated_at = CURRENT_TIMESTAMP
        WHERE site_id = $1
      `;
      const result = await this.db.executeRaw(query, [siteId]);

      if (result.rowCount === 0) {
        throw new Error(`Site com ID ${siteId} não encontrado`);
      }
    } catch (error: any) {
      await logError('FxSiteService.deleteSite error', error, { siteId });
      throw new Error(`Erro ao deletar site: ${error.message}`);
    }
  }

  /**
   * Listar totens de um site
   */
  async getTotemsForSite(siteId: string): Promise<FxTotemSite[]> {
    try {
      const query = `
        SELECT 
          id,
          totem_id,
          site_id,
          role,
          position_x,
          position_y,
          is_active,
          created_at,
          updated_at
        FROM fx_totem_sites
        WHERE site_id = $1 AND is_active = true
        ORDER BY role DESC, totem_id ASC
      `;
      const result = await this.db.findMany(query, [siteId]);
      return result.map(this.mapRowToTotemSite);
    } catch (error: any) {
      await logError('FxSiteService.getTotemsForSite error', error, { siteId });
      throw new Error(`Erro ao listar totens do site: ${error.message}`);
    }
  }

  /**
   * Adicionar totem a um site
   */
  async addTotemToSite(siteId: string, totemId: number, role: string = 'participant', positionX?: number, positionY?: number): Promise<FxTotemSite> {
    try {
      const query = `
        INSERT INTO fx_totem_sites (
          totem_id,
          site_id,
          role,
          position_x,
          position_y
        ) VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (totem_id, site_id) 
        DO UPDATE SET
          role = EXCLUDED.role,
          position_x = EXCLUDED.position_x,
          position_y = EXCLUDED.position_y,
          is_active = true,
          updated_at = CURRENT_TIMESTAMP
        RETURNING 
          id,
          totem_id,
          site_id,
          role,
          position_x,
          position_y,
          is_active,
          created_at,
          updated_at
      `;
      const result = await this.db.executeRaw(query, [totemId, siteId, role, positionX || null, positionY || null]);
      return this.mapRowToTotemSite(result.rows[0]);
    } catch (error: any) {
      await logError('FxSiteService.addTotemToSite error', error, { siteId, totemId, role });
      throw new Error(`Erro ao adicionar totem ao site: ${error.message}`);
    }
  }

  /**
   * Remover totem de um site
   */
  async removeTotemFromSite(siteId: string, totemId: number): Promise<void> {
    try {
      const query = `
        UPDATE fx_totem_sites
        SET is_active = false, updated_at = CURRENT_TIMESTAMP
        WHERE site_id = $1 AND totem_id = $2
      `;
      const result = await this.db.executeRaw(query, [siteId, totemId]);

      if (result.rowCount === 0) {
        throw new Error(`Totem ${totemId} não está associado ao site ${siteId}`);
      }
    } catch (error: any) {
      await logError('FxSiteService.removeTotemFromSite error', error, { siteId, totemId });
      throw new Error(`Erro ao remover totem do site: ${error.message}`);
    }
  }

  /**
   * Mapear row do banco para objeto FxSite
   */
  private mapRowToSite(row: any): FxSite {
    return {
      site_id: row.site_id,
      name: row.name,
      description: row.description || undefined,
      client_id: row.client_id || undefined,
      broker_url: row.broker_url || undefined,
      broker_type: row.broker_type,
      broker_config: typeof row.broker_config === 'string' 
        ? JSON.parse(row.broker_config) 
        : (row.broker_config || {}),
      sync_interval_ms: row.sync_interval_ms,
      time_sync_enabled: row.time_sync_enabled,
      config: typeof row.config === 'string' 
        ? JSON.parse(row.config) 
        : (row.config || {}),
      is_active: row.is_active,
      created_at: row.created_at,
      updated_at: row.updated_at || undefined,
    };
  }

  /**
   * Mapear row do banco para objeto FxTotemSite
   */
  private mapRowToTotemSite(row: any): FxTotemSite {
    return {
      id: row.id,
      totem_id: row.totem_id,
      site_id: row.site_id,
      role: row.role,
      position_x: row.position_x || undefined,
      position_y: row.position_y || undefined,
      is_active: row.is_active,
      created_at: row.created_at,
      updated_at: row.updated_at || undefined,
    };
  }
}

// Singleton opcional
let fxSiteServiceInstance: FxSiteService | null = null;

export function getFxSiteService(): FxSiteService {
  if (!fxSiteServiceInstance) {
    fxSiteServiceInstance = new FxSiteService();
  }
  return fxSiteServiceInstance;
}

