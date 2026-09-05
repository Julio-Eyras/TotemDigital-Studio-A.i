/**
 * FxEffectService - Gerenciamento de Efeitos FX
 * 
 * CRUD completo para efeitos FX disponíveis no sistema SmartDisplayFX Plus
 */

import { getDatabase } from '../config/database';
import { logError } from '../utils/loggerHelper';
import { normalizeError } from '../utils/errors';

export interface FxEffect {
  effect_id: number;
  name: string;
  effect_type: string;
  description?: string;
  default_params: Record<string, any>;
  preview_url?: string;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
}

export interface CreateFxEffectRequest {
  name: string;
  effect_type: string;
  description?: string;
  default_params?: Record<string, any>;
  preview_url?: string;
  is_active?: boolean;
}

export interface UpdateFxEffectRequest {
  name?: string;
  effect_type?: string;
  description?: string;
  default_params?: Record<string, any>;
  preview_url?: string;
  is_active?: boolean;
}

export interface FxEffectListResponse {
  data: FxEffect[];
  total: number;
  page: number;
  limit: number;
}

export class FxEffectService {
  private get db() {
    return getDatabase();
  }

  /**
   * Listar efeitos com paginação e filtros
   */
  async getAllEffects(params: {
    page?: number;
    limit?: number;
    search?: string;
    effect_type?: string;
    isActive?: boolean;
  }): Promise<FxEffectListResponse> {
    try {
      const { page = 1, limit = 20, search, effect_type, isActive } = params;
      const offset = (page - 1) * limit;

      let whereClause = '1=1';
      const queryParams: any[] = [];
      let paramIndex = 1;

      if (search) {
        whereClause += ` AND (name ILIKE $${paramIndex} OR description ILIKE $${paramIndex})`;
        queryParams.push(`%${search}%`);
        paramIndex++;
      }

      if (effect_type) {
        whereClause += ` AND effect_type = $${paramIndex}`;
        queryParams.push(effect_type);
        paramIndex++;
      }

      if (isActive !== undefined) {
        whereClause += ` AND is_active = $${paramIndex}`;
        queryParams.push(isActive);
        paramIndex++;
      }

      // Contar total
      const countQuery = `SELECT COUNT(*) as total FROM fx_effects WHERE ${whereClause}`;
      const countResult = await this.db.findFirst(countQuery, queryParams);
      const total = parseInt(countResult?.total || '0', 10);

      // Buscar dados
      const dataQuery = `
        SELECT 
          effect_id,
          name,
          effect_type,
          description,
          default_params,
          preview_url,
          is_active,
          created_at,
          updated_at
        FROM fx_effects
        WHERE ${whereClause}
        ORDER BY name ASC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;
      queryParams.push(limit, offset);
      const dataResult = await this.db.findMany(dataQuery, queryParams);

      return {
        data: dataResult.map(this.mapRowToEffect),
        total,
        page,
        limit,
      };} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('FxEffectService.getAllEffects error', e.error, params);
      throw new Error(`Erro ao listar efeitos: ${e.message}`);
    }
  }

  /**
   * Buscar efeito por ID
   */
  async getEffectById(effectId: number): Promise<FxEffect | null> {
    try {
      const query = `
        SELECT 
          effect_id,
          name,
          effect_type,
          description,
          default_params,
          preview_url,
          is_active,
          created_at,
          updated_at
        FROM fx_effects
        WHERE effect_id = $1
      `;
      const result = await this.db.findFirst(query, [effectId]);

      if (!result) {
        return null;
      }

      return this.mapRowToEffect(result);} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('FxEffectService.getEffectById error', e.error, { effectId });
      throw new Error(`Erro ao buscar efeito: ${e.message}`);
    }
  }

  /**
   * Buscar efeito por nome
   */
  async getEffectByName(name: string): Promise<FxEffect | null> {
    try {
      const query = `
        SELECT 
          effect_id,
          name,
          effect_type,
          description,
          default_params,
          preview_url,
          is_active,
          created_at,
          updated_at
        FROM fx_effects
        WHERE name = $1
      `;
      const result = await this.db.findFirst(query, [name]);

      if (!result) {
        return null;
      }

      return this.mapRowToEffect(result);} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('FxEffectService.getEffectByName error', e.error, { name });
      throw new Error(`Erro ao buscar efeito por nome: ${e.message}`);
    }
  }

  /**
   * Criar novo efeito
   */
  async createEffect(data: CreateFxEffectRequest): Promise<FxEffect> {
    try {
      const query = `
        INSERT INTO fx_effects (
          name,
          effect_type,
          description,
          default_params,
          preview_url,
          is_active
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING 
          effect_id,
          name,
          effect_type,
          description,
          default_params,
          preview_url,
          is_active,
          created_at,
          updated_at
      `;

      const params = [
        data.name,
        data.effect_type,
        data.description || null,
        JSON.stringify(data.default_params || {}),
        data.preview_url || null,
        data.is_active !== undefined ? data.is_active : true,
      ];

      const result = await this.db.executeRaw(query, params);
      return this.mapRowToEffect(result.rows[0]);} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('FxEffectService.createEffect error', e.error, data);
      if (e.code === '23505') {
        throw new Error(`Efeito com nome "${data.name}" já existe`);
      }
      throw new Error(`Erro ao criar efeito: ${e.message}`);
    }
  }

  /**
   * Atualizar efeito
   */
  async updateEffect(effectId: number, data: UpdateFxEffectRequest): Promise<FxEffect> {
    try {
      const updates: string[] = [];
      const params: unknown[] = [];
      let paramIndex = 1;

      if (data.name !== undefined) {
        updates.push(`name = $${paramIndex}`);
        params.push(data.name);
        paramIndex++;
      }

      if (data.effect_type !== undefined) {
        updates.push(`effect_type = $${paramIndex}`);
        params.push(data.effect_type);
        paramIndex++;
      }

      if (data.description !== undefined) {
        updates.push(`description = $${paramIndex}`);
        params.push(data.description);
        paramIndex++;
      }

      if (data.default_params !== undefined) {
        updates.push(`default_params = $${paramIndex}`);
        params.push(JSON.stringify(data.default_params));
        paramIndex++;
      }

      if (data.preview_url !== undefined) {
        updates.push(`preview_url = $${paramIndex}`);
        params.push(data.preview_url);
        paramIndex++;
      }

      if (data.is_active !== undefined) {
        updates.push(`is_active = $${paramIndex}`);
        params.push(data.is_active);
        paramIndex++;
      }

      if (updates.length === 0) {
        return await this.getEffectById(effectId) as FxEffect;
      }

      updates.push(`updated_at = CURRENT_TIMESTAMP`);
      params.push(effectId);

      const query = `
        UPDATE fx_effects
        SET ${updates.join(', ')}
        WHERE effect_id = $${paramIndex}
        RETURNING 
          effect_id,
          name,
          effect_type,
          description,
          default_params,
          preview_url,
          is_active,
          created_at,
          updated_at
      `;

      const result = await this.db.executeRaw(query, params);

      if (result.rows.length === 0) {
        throw new Error(`Efeito com ID ${effectId} não encontrado`);
      }

      return this.mapRowToEffect(result.rows[0]);} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('FxEffectService.updateEffect error', e.error, { effectId, data });
      throw new Error(`Erro ao atualizar efeito: ${e.message}`);
    }
  }

  /**
   * Deletar efeito (soft delete: marca como inativo)
   */
  async deleteEffect(effectId: number): Promise<void> {
    try {
      const query = `
        UPDATE fx_effects
        SET is_active = false, updated_at = CURRENT_TIMESTAMP
        WHERE effect_id = $1
      `;
      const result = await this.db.executeRaw(query, [effectId]);

      if (result.rowCount === 0) {
        throw new Error(`Efeito com ID ${effectId} não encontrado`);
 
}} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('FxEffectService.deleteEffect error', e.error, { effectId });
      throw new Error(`Erro ao deletar efeito: ${e.message}`);
    }
  }

  /**
   * Listar tipos de efeitos disponíveis
   */
  async getEffectTypes(): Promise<string[]> {
    try {
      const query = `
        SELECT DISTINCT effect_type
        FROM fx_effects
        WHERE is_active = true
        ORDER BY effect_type ASC
      `;
      const result = await this.db.findMany(query);
      return result.map((row) => row.effect_type);} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('FxEffectService.getEffectTypes error', e.error, {});
      throw new Error(`Erro ao listar tipos de efeitos: ${e.message}`);
    }
  }

  /**
   * Mapear row do banco para objeto FxEffect
   */
  private mapRowToEffect(row: any): FxEffect {
    return {
      effect_id: row.effect_id,
      name: row.name,
      effect_type: row.effect_type,
      description: row.description || undefined,
      default_params: typeof row.default_params === 'string' 
        ? JSON.parse(row.default_params) 
        : (row.default_params || {}),
      preview_url: row.preview_url || undefined,
      is_active: row.is_active,
      created_at: row.created_at,
      updated_at: row.updated_at || undefined,
    };
  }
}

// Singleton opcional
let fxEffectServiceInstance: FxEffectService | null = null;

export function getFxEffectService(): FxEffectService {
  if (!fxEffectServiceInstance) {
    fxEffectServiceInstance = new FxEffectService();
  }
  return fxEffectServiceInstance;
}

