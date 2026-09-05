/**
 * Export Query Service - Smart Signage v2.1
 * CRUD de queries SQL para exportação
 */

import { getDatabase } from '../config/database';
import { AuditService } from './auditService';
import { logError } from '../utils/loggerHelper';
import { normalizeError } from '../utils/errors';

export interface CreateExportQueryRequest {
  name: string;
  description?: string;
  provider: 'PostgreSQL' | 'Redis' | 'Grafana' | 'Prometheus';
  sqlQuery: string;
  databaseConfig?: {
    // Configuração opcional específica por provider
    // Se não informado, usa configuração do sistema
    [key: string]: unknown;
  };
  exportConfig: {
    outputDirectory: string;
    fileName: string;
    format: 'xlsx' | 'pdf' | 'csv'; // Formato de exportação
    sheetName?: string; // Apenas para Excel
    applyFormatting?: boolean;
    timestampSuffix?: boolean;
    dateFormat?: string;
    createSubfolders?: boolean;
  };
  enabled?: boolean;
}

export interface UpdateExportQueryRequest {
  name?: string;
  description?: string;
  provider?: 'PostgreSQL' | 'Redis' | 'Grafana' | 'Prometheus';
  sqlQuery?: string;
  databaseConfig?: Record<string, unknown>;
  exportConfig?: Record<string, unknown>;
  enabled?: boolean;
}

export interface ExportQuery {
  query_id: number;
  name: string;
  description: string | null;
  provider: string;
  sql_query: string;
  database_config: unknown;
  export_config: unknown;
  enabled: boolean;
  created_at: Date;
  updated_at: Date;
  created_by: number | null;
}

export class ExportQueryService {
  private get db() {
    return getDatabase();
  }
  
  // Lazy initialization
  private getAuditService(): AuditService {
    const g = global as typeof globalThis & { auditServiceInstance?: AuditService };
    if (!g.auditServiceInstance) {
      g.auditServiceInstance = new AuditService();
    }
    return g.auditServiceInstance;
  }

  /**
   * Cria nova query
   */
  async createQuery(data: CreateExportQueryRequest, userId: number): Promise<ExportQuery> {
    try {
      // Validar nome único
      const existing = await this.db.findFirst(`
        SELECT query_id FROM export_queries WHERE name = $1
      `, [data.name]);

      if (existing) {
        throw new Error(`Query com nome '${data.name}' já existe`);
      }

      // Inserir query
      const result = await this.db.executeRaw(`
        INSERT INTO export_queries (
          name, description, provider, sql_query, 
          database_config, export_config, enabled, created_by
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `, [
        data.name,
        data.description || null,
        data.provider,
        data.sqlQuery,
        JSON.stringify(data.databaseConfig || {}),
        JSON.stringify(data.exportConfig),
        data.enabled !== false,
        userId
      ]);

      const query = result.rows[0];

      // Log de auditoria
      await this.getAuditService().log('export', 'query_created', userId, {
        queryId: query.query_id,
        queryName: data.name
      }).catch(e => logError('Erro ao registrar log de auditoria', e, { queryId: query.query_id || query.id }).catch(() => {}));

      return this.mapToExportQuery(query);} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('Erro ao criar query', e.error, { data });
      throw e.error;
    }
  }

  /**
   * Busca query por ID
   */
  async getQueryById(queryId: number): Promise<ExportQuery | null> {
    try {
      const query = await this.db.findFirst(`
        SELECT * FROM export_queries WHERE query_id = $1
      `, [queryId]);

      if (!query) {
        return null;
      }

      return this.mapToExportQuery(query);} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('Erro ao buscar query', e.error, { queryId });
      throw e.error;
    }
  }

  /**
   * Busca todas as queries
   */
  async getAllQueries(filters?: {
    provider?: string;
    enabled?: boolean;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<{
    data: ExportQuery[];
    total: number;
    page: number;
    limit: number;
  }> {
    try {
      let sql = 'SELECT * FROM export_queries WHERE 1=1';
      let countSql = 'SELECT COUNT(*) as total FROM export_queries WHERE 1=1';
      const params: unknown[] = [];
      const countParams: unknown[] = [];

      // Construir WHERE clause com placeholders PostgreSQL ($1, $2, ...)
      let paramIndex = 1;
      let countParamIndex = 1;

      if (filters?.provider) {
        sql += ` AND provider = $${paramIndex++}`;
        params.push(filters.provider);
        countSql += ` AND provider = $${countParamIndex++}`;
        countParams.push(filters.provider);
      }

      if (filters?.enabled !== undefined) {
        sql += ` AND enabled = $${paramIndex++}`;
        params.push(filters.enabled);
        countSql += ` AND enabled = $${countParamIndex++}`;
        countParams.push(filters.enabled);
      }

      if (filters?.search) {
        const searchTerm = `%${filters.search}%`;
        sql += ` AND (name ILIKE $${paramIndex++} OR description ILIKE $${paramIndex++})`;
        params.push(searchTerm, searchTerm);
        countSql += ` AND (name ILIKE $${countParamIndex++} OR description ILIKE $${countParamIndex++})`;
        countParams.push(searchTerm, searchTerm);
      }

      sql += ' ORDER BY created_at DESC';

      const page = Math.max(1, filters?.page || 1);
      const limit = Math.max(1, Math.min(filters?.limit || 25, 100));
      const offset = (page - 1) * limit;

      sql += ` LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
      params.push(limit, offset);

      const [rows, countRow] = await Promise.all([
        this.db.findMany(sql, params),
        this.db.findFirst(countSql, countParams)
      ]);

      const total = Number(countRow?.total || 0);

      return {
        data: rows.map(q => this.mapToExportQuery(q)),
        total,
        page,
        limit
      };} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('Erro ao buscar queries', e.error, { filters });
      throw e.error;
    }
  }

  /**
   * Atualiza query
   */
  async updateQuery(queryId: number, data: UpdateExportQueryRequest, userId: number): Promise<ExportQuery> {
    try {
      // Verificar se query existe
      const existing = await this.getQueryById(queryId);
      if (!existing) {
        throw new Error(`Query com ID ${queryId} não encontrada`);
      }

      // Validar nome único se estiver mudando
      if (data.name && data.name !== existing.name) {
          const duplicate = await this.db.findFirst(`
            SELECT query_id FROM export_queries WHERE name = $1 AND query_id != $2
          `, [data.name, queryId]);

        if (duplicate) {
          throw new Error(`Query com nome '${data.name}' já existe`);
        }
      }

      // Construir query de atualização dinâmica
      const updates: string[] = [];
      const params: unknown[] = [];
      let paramIndex = 1;

      if (data.name !== undefined) {
        updates.push(`name = $${paramIndex++}`);
        params.push(data.name);
      }
      if (data.description !== undefined) {
        updates.push(`description = $${paramIndex++}`);
        params.push(data.description || null);
      }
      if (data.provider !== undefined) {
        updates.push(`provider = $${paramIndex++}`);
        params.push(data.provider);
      }
      if (data.sqlQuery !== undefined) {
        updates.push(`sql_query = $${paramIndex++}`);
        params.push(data.sqlQuery);
      }
      if (data.databaseConfig !== undefined) {
        updates.push(`database_config = $${paramIndex++}`);
        params.push(JSON.stringify(data.databaseConfig));
      }
      if (data.exportConfig !== undefined) {
        updates.push(`export_config = $${paramIndex++}`);
        params.push(JSON.stringify(data.exportConfig));
      }
      if (data.enabled !== undefined) {
        updates.push(`enabled = $${paramIndex++}`);
        params.push(data.enabled);
      }

      if (updates.length === 0) {
        return existing;
      }

      const queryIdPlaceholder = `$${paramIndex++}`;
      params.push(queryId);

      const result = await this.db.executeRaw(`
        UPDATE export_queries 
        SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
        WHERE query_id = ${queryIdPlaceholder}
        RETURNING *
      `, params);

      const query = result.rows[0];

      // Log de auditoria
      await this.getAuditService().log('export', 'query_updated', userId, {
        queryId: queryId,
        changes: Object.keys(data)
      }).catch(e => logError('Erro ao registrar log de auditoria', e, { queryId: query.query_id }).catch(() => {}));

      return this.mapToExportQuery(query);} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('Erro ao atualizar query', e.error, { queryId, data });
      throw e.error;
    }
  }

  /**
   * Exclui query
   */
  async deleteQuery(queryId: number, userId: number): Promise<void> {
    try {
      // Verificar se query existe
      const existing = await this.getQueryById(queryId);
      if (!existing) {
        throw new Error(`Query com ID ${queryId} não encontrada`);
      }

      // Verificar se há agendamentos associados
      const schedules = await this.db.findMany(`
        SELECT schedule_id FROM export_schedules WHERE query_id = $1
      `, [queryId]);

      if (schedules.length > 0) {
        throw new Error(`Query possui ${schedules.length} agendamento(s) associado(s). Remova os agendamentos antes de excluir a query.`);
      }

      // Excluir query
      await this.db.executeRaw(`
        DELETE FROM export_queries WHERE query_id = $1
      `, [queryId]);

      // Log de auditoria
      await this.getAuditService().log('export', 'query_deleted', userId, {
        queryId: queryId,
        queryName: existing.name
      }).catch(e => logError('Erro ao registrar log de auditoria', e, {
        queryId }).catch(() => {}));} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('Erro ao excluir query', e.error, { queryId });
      throw e.error;
    }
  }

  /**
   * Testa conexão com banco de dados
   */
  async testConnection(provider: string, databaseConfig?: Record<string, unknown>): Promise<boolean> {
    try {
      switch (provider) {
        case 'PostgreSQL':
          // Testar conexão PostgreSQL (banco principal)
          const db = getDatabase();
          await db.findFirst('SELECT 1');
          return true;

        case 'Redis':
          // Testar conexão Redis
          const { testRedisConnection } = await import('../config/redis');
          return await testRedisConnection();

        case 'Grafana':
          // Testar conexão Grafana
          const { testGrafanaConnection } = await import('../config/grafana');
          return await testGrafanaConnection();

        case 'Prometheus':
          // Testar conexão Prometheus
          const { testPrometheusConnection } = await import('../config/prometheus');
          return await testPrometheusConnection();

        default:
          return false;
 
}} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('Erro ao testar conexão', e.error, { provider, databaseConfig });
      return false;
    }
  }

  /**
   * Mapeia resultado do banco para ExportQuery
   */
  private mapToExportQuery(rowRaw: unknown): ExportQuery {
    const row = rowRaw as unknown as Record<string, unknown>;
    return {
      query_id: row.query_id as number,
      name: row.name as string,
      description: row.description as string | null,
      provider: row.provider as string,
      sql_query: row.sql_query as string,
      database_config: typeof row.database_config === 'string' 
        ? JSON.parse(row.database_config) 
        : row.database_config || {},
      export_config: typeof row.export_config === 'string'
        ? JSON.parse(row.export_config)
        : row.export_config || {},
      enabled: row.enabled as boolean,
      created_at: row.created_at as Date,
      updated_at: row.updated_at as Date,
      created_by: row.created_by as number | null
    };
  }
}

// Exportar instância singleton
export const exportQueryService = new ExportQueryService();

