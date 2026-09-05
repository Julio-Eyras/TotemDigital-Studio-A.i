/**
 * FxRuleService - Gerenciamento de Regras Inteligentes FX
 * 
 * CRUD completo para regras que acionam efeitos FX baseadas em condições
 */

import { getDatabase } from '../config/database';
import { logError } from '../utils/loggerHelper';
import { normalizeError } from '../utils/errors';

export interface FxRule {
  rule_id: number;
  name: string;
  description?: string;
  site_id?: string;
  conditions: Record<string, any>;
  actions: Record<string, any>;
  priority: number;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
}

export interface CreateFxRuleRequest {
  name: string;
  description?: string;
  site_id?: string;
  conditions: Record<string, any>;
  actions: Record<string, any>;
  priority?: number;
  is_active?: boolean;
}

export interface UpdateFxRuleRequest {
  name?: string;
  description?: string;
  site_id?: string;
  conditions?: Record<string, any>;
  actions?: Record<string, any>;
  priority?: number;
  is_active?: boolean;
}

export interface FxRuleListResponse {
  data: FxRule[];
  total: number;
  page: number;
  limit: number;
}

export class FxRuleService {
  private get db() {
    return getDatabase();
  }

  /**
   * Listar regras com paginação e filtros
   */
  async getAllRules(params: {
    page?: number;
    limit?: number;
    search?: string;
    site_id?: string;
    isActive?: boolean;
  }): Promise<FxRuleListResponse> {
    try {
      const { page = 1, limit = 20, search, site_id, isActive } = params;
      const offset = (page - 1) * limit;

      let whereClause = '1=1';
      const queryParams: any[] = [];
      let paramIndex = 1;

      if (search) {
        whereClause += ` AND (name ILIKE $${paramIndex} OR description ILIKE $${paramIndex})`;
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
      const countQuery = `SELECT COUNT(*) as total FROM fx_rules WHERE ${whereClause}`;
      const countResult = await this.db.findFirst(countQuery, queryParams);
      const total = parseInt(countResult?.total || '0', 10);

      // Buscar dados
      const dataQuery = `
        SELECT 
          rule_id,
          name,
          description,
          site_id,
          conditions,
          actions,
          priority,
          is_active,
          created_at,
          updated_at
        FROM fx_rules
        WHERE ${whereClause}
        ORDER BY priority DESC, name ASC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;
      queryParams.push(limit, offset);
      const dataResult = await this.db.findMany(dataQuery, queryParams);

      return {
        data: dataResult.map(this.mapRowToRule),
        total,
        page,
        limit,
      };} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('FxRuleService.getAllRules error', e.error, params);
      throw new Error(`Erro ao listar regras: ${e.message}`);
    }
  }

  /**
   * Buscar regra por ID
   */
  async getRuleById(ruleId: number): Promise<FxRule | null> {
    try {
      const query = `
        SELECT 
          rule_id,
          name,
          description,
          site_id,
          conditions,
          actions,
          priority,
          is_active,
          created_at,
          updated_at
        FROM fx_rules
        WHERE rule_id = $1
      `;
      const result = await this.db.findFirst(query, [ruleId]);

      if (!result) {
        return null;
      }

      return this.mapRowToRule(result);} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('FxRuleService.getRuleById error', e.error, { ruleId });
      throw new Error(`Erro ao buscar regra: ${e.message}`);
    }
  }

  /**
   * Buscar regras ativas para um site (ordenadas por prioridade)
   */
  async getActiveRulesForSite(siteId?: string): Promise<FxRule[]> {
    try {
      let query = `
        SELECT 
          rule_id,
          name,
          description,
          site_id,
          conditions,
          actions,
          priority,
          is_active,
          created_at,
          updated_at
        FROM fx_rules
        WHERE is_active = true
      `;
      const params: unknown[] = [];

      if (siteId) {
        query += ` AND (site_id = $1 OR site_id IS NULL)`;
        params.push(siteId);
      } else {
        query += ` AND site_id IS NULL`;
      }

      query += ` ORDER BY priority DESC, name ASC`;

      const result = await this.db.findMany(query, params);
      return result.map(this.mapRowToRule);} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('FxRuleService.getActiveRulesForSite error', e.error, { siteId });
      throw new Error(`Erro ao buscar regras ativas: ${e.message}`);
    }
  }

  /**
   * Criar nova regra
   */
  async createRule(data: CreateFxRuleRequest): Promise<FxRule> {
    try {
      const query = `
        INSERT INTO fx_rules (
          name,
          description,
          site_id,
          conditions,
          actions,
          priority,
          is_active
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING 
          rule_id,
          name,
          description,
          site_id,
          conditions,
          actions,
          priority,
          is_active,
          created_at,
          updated_at
      `;

      const params = [
        data.name,
        data.description || null,
        data.site_id || null,
        JSON.stringify(data.conditions),
        JSON.stringify(data.actions),
        data.priority || 0,
        data.is_active !== undefined ? data.is_active : true,
      ];

      const result = await this.db.executeRaw(query, params);
      return this.mapRowToRule(result.rows[0]);} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('FxRuleService.createRule error', e.error, data);
      throw new Error(`Erro ao criar regra: ${e.message}`);
    }
  }

  /**
   * Atualizar regra
   */
  async updateRule(ruleId: number, data: UpdateFxRuleRequest): Promise<FxRule> {
    try {
      const updates: string[] = [];
      const params: unknown[] = [];
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

      if (data.site_id !== undefined) {
        updates.push(`site_id = $${paramIndex}`);
        params.push(data.site_id);
        paramIndex++;
      }

      if (data.conditions !== undefined) {
        updates.push(`conditions = $${paramIndex}`);
        params.push(JSON.stringify(data.conditions));
        paramIndex++;
      }

      if (data.actions !== undefined) {
        updates.push(`actions = $${paramIndex}`);
        params.push(JSON.stringify(data.actions));
        paramIndex++;
      }

      if (data.priority !== undefined) {
        updates.push(`priority = $${paramIndex}`);
        params.push(data.priority);
        paramIndex++;
      }

      if (data.is_active !== undefined) {
        updates.push(`is_active = $${paramIndex}`);
        params.push(data.is_active);
        paramIndex++;
      }

      if (updates.length === 0) {
        return await this.getRuleById(ruleId) as FxRule;
      }

      updates.push(`updated_at = CURRENT_TIMESTAMP`);
      params.push(ruleId);

      const query = `
        UPDATE fx_rules
        SET ${updates.join(', ')}
        WHERE rule_id = $${paramIndex}
        RETURNING 
          rule_id,
          name,
          description,
          site_id,
          conditions,
          actions,
          priority,
          is_active,
          created_at,
          updated_at
      `;

      const result = await this.db.executeRaw(query, params);

      if (result.rows.length === 0) {
        throw new Error(`Regra com ID ${ruleId} não encontrada`);
      }

      return this.mapRowToRule(result.rows[0]);} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('FxRuleService.updateRule error', e.error, { ruleId, data });
      throw new Error(`Erro ao atualizar regra: ${e.message}`);
    }
  }

  /**
   * Deletar regra (soft delete: marca como inativa)
   */
  async deleteRule(ruleId: number): Promise<void> {
    try {
      const query = `
        UPDATE fx_rules
        SET is_active = false, updated_at = CURRENT_TIMESTAMP
        WHERE rule_id = $1
      `;
      const result = await this.db.executeRaw(query, [ruleId]);

      if (result.rowCount === 0) {
        throw new Error(`Regra com ID ${ruleId} não encontrada`);
 
}} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('FxRuleService.deleteRule error', e.error, { ruleId });
      throw new Error(`Erro ao deletar regra: ${e.message}`);
    }
  }

  /**
   * Mapear row do banco para objeto FxRule
   */
  private mapRowToRule(row: any): FxRule {
    return {
      rule_id: row.rule_id,
      name: row.name,
      description: row.description || undefined,
      site_id: row.site_id || undefined,
      conditions: typeof row.conditions === 'string' 
        ? JSON.parse(row.conditions) 
        : (row.conditions || {}),
      actions: typeof row.actions === 'string' 
        ? JSON.parse(row.actions) 
        : (row.actions || {}),
      priority: row.priority,
      is_active: row.is_active,
      created_at: row.created_at,
      updated_at: row.updated_at || undefined,
    };
  }
}

// Singleton opcional
let fxRuleServiceInstance: FxRuleService | null = null;

export function getFxRuleService(): FxRuleService {
  if (!fxRuleServiceInstance) {
    fxRuleServiceInstance = new FxRuleService();
  }
  return fxRuleServiceInstance;
}
