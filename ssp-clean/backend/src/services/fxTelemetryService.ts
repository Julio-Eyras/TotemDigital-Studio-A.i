/**
 * FxTelemetryService - Gerenciamento de Telemetria FX
 * 
 * CRUD completo para telemetria de execução de efeitos FX nos totens
 */

import { getDatabase } from '../config/database';
import { logError } from '../utils/loggerHelper';

export interface FxTelemetry {
  id: number;
  totem_id: number;
  effect_id: string;
  event_id?: string;
  content_id?: number;
  planned_start_ts?: string;
  actual_start_ts?: string;
  ended_at?: string;
  duration_ms?: number;
  avg_fps?: number;
  status: string;
  error_message?: string;
  metadata: Record<string, any>;
  created_at: string;
}

export interface CreateFxTelemetryRequest {
  totem_id: number;
  effect_id: string;
  event_id?: string;
  content_id?: number;
  planned_start_ts?: string;
  actual_start_ts?: string;
  ended_at?: string;
  duration_ms?: number;
  avg_fps?: number;
  status?: string;
  error_message?: string;
  metadata?: Record<string, any>;
}

export interface FxTelemetryListResponse {
  data: FxTelemetry[];
  total: number;
  page: number;
  limit: number;
}

export interface FxTelemetryStats {
  total_executions: number;
  successful: number;
  failed: number;
  timeout: number;
  cancelled: number;
  avg_duration_ms: number;
  avg_fps: number;
  success_rate: number;
}

export class FxTelemetryService {
  private get db() {
    return getDatabase();
  }

  /**
   * Listar telemetria com paginação e filtros
   */
  async getAllTelemetry(params: {
    page?: number;
    limit?: number;
    totem_id?: number;
    effect_id?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<FxTelemetryListResponse> {
    try {
      const { page = 1, limit = 50, totem_id, effect_id, status, startDate, endDate } = params;
      const offset = (page - 1) * limit;

      let whereClause = '1=1';
      const queryParams: any[] = [];
      let paramIndex = 1;

      if (totem_id) {
        whereClause += ` AND totem_id = $${paramIndex}`;
        queryParams.push(totem_id);
        paramIndex++;
      }

      if (effect_id) {
        whereClause += ` AND effect_id = $${paramIndex}`;
        queryParams.push(effect_id);
        paramIndex++;
      }

      if (status) {
        whereClause += ` AND status = $${paramIndex}`;
        queryParams.push(status);
        paramIndex++;
      }

      if (startDate) {
        whereClause += ` AND created_at >= $${paramIndex}`;
        queryParams.push(new Date(startDate));
        paramIndex++;
      }

      if (endDate) {
        whereClause += ` AND created_at <= $${paramIndex}`;
        queryParams.push(new Date(endDate));
        paramIndex++;
      }

      // Contar total
      const countQuery = `SELECT COUNT(*) as total FROM fx_telemetry WHERE ${whereClause}`;
      const countResult = await this.db.findFirst(countQuery, queryParams);
      const total = parseInt(countResult?.total || '0', 10);

      // Buscar dados
      const dataQuery = `
        SELECT 
          id,
          totem_id,
          effect_id,
          event_id,
          content_id,
          planned_start_ts,
          actual_start_ts,
          ended_at,
          duration_ms,
          avg_fps,
          status,
          error_message,
          metadata,
          created_at
        FROM fx_telemetry
        WHERE ${whereClause}
        ORDER BY created_at DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;
      queryParams.push(limit, offset);
      const dataResult = await this.db.findMany(dataQuery, queryParams);

      return {
        data: dataResult.map(this.mapRowToTelemetry),
        total,
        page,
        limit,
      };
    } catch (error: any) {
      await logError('FxTelemetryService.getAllTelemetry error', error, params);
      throw new Error(`Erro ao listar telemetria: ${error.message}`);
    }
  }

  /**
   * Buscar telemetria por ID
   */
  async getTelemetryById(id: number): Promise<FxTelemetry | null> {
    try {
      const query = `
        SELECT 
          id,
          totem_id,
          effect_id,
          event_id,
          content_id,
          planned_start_ts,
          actual_start_ts,
          ended_at,
          duration_ms,
          avg_fps,
          status,
          error_message,
          metadata,
          created_at
        FROM fx_telemetry
        WHERE id = $1
      `;
      const result = await this.db.findFirst(query, [id]);

      if (!result) {
        return null;
      }

      return this.mapRowToTelemetry(result);
    } catch (error: any) {
      await logError('FxTelemetryService.getTelemetryById error', error, { id });
      throw new Error(`Erro ao buscar telemetria: ${error.message}`);
    }
  }

  /**
   * Criar nova entrada de telemetria
   */
  async createTelemetry(data: CreateFxTelemetryRequest): Promise<FxTelemetry> {
    try {
      const query = `
        INSERT INTO fx_telemetry (
          totem_id,
          effect_id,
          event_id,
          content_id,
          planned_start_ts,
          actual_start_ts,
          ended_at,
          duration_ms,
          avg_fps,
          status,
          error_message,
          metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING 
          id,
          totem_id,
          effect_id,
          event_id,
          content_id,
          planned_start_ts,
          actual_start_ts,
          ended_at,
          duration_ms,
          avg_fps,
          status,
          error_message,
          metadata,
          created_at
      `;

      const params = [
        data.totem_id,
        data.effect_id,
        data.event_id || null,
        data.content_id || null,
        data.planned_start_ts ? new Date(data.planned_start_ts) : null,
        data.actual_start_ts ? new Date(data.actual_start_ts) : null,
        data.ended_at ? new Date(data.ended_at) : null,
        data.duration_ms || null,
        data.avg_fps || null,
        data.status || 'success',
        data.error_message || null,
        JSON.stringify(data.metadata || {}),
      ];

      const result = await this.db.executeRaw(query, params);
      return this.mapRowToTelemetry(result.rows[0]);
    } catch (error: any) {
      await logError('FxTelemetryService.createTelemetry error', error, data);
      throw new Error(`Erro ao criar telemetria: ${error.message}`);
    }
  }

  /**
   * Obter estatísticas de telemetria
   */
  async getTelemetryStats(params: {
    totem_id?: number;
    effect_id?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<FxTelemetryStats> {
    try {
      let whereClause = '1=1';
      const queryParams: any[] = [];
      let paramIndex = 1;

      if (params.totem_id) {
        whereClause += ` AND totem_id = $${paramIndex}`;
        queryParams.push(params.totem_id);
        paramIndex++;
      }

      if (params.effect_id) {
        whereClause += ` AND effect_id = $${paramIndex}`;
        queryParams.push(params.effect_id);
        paramIndex++;
      }

      if (params.startDate) {
        whereClause += ` AND created_at >= $${paramIndex}`;
        queryParams.push(new Date(params.startDate));
        paramIndex++;
      }

      if (params.endDate) {
        whereClause += ` AND created_at <= $${paramIndex}`;
        queryParams.push(new Date(params.endDate));
        paramIndex++;
      }

      const query = `
        SELECT 
          COUNT(*) as total_executions,
          COUNT(*) FILTER (WHERE status = 'success') as successful,
          COUNT(*) FILTER (WHERE status = 'failed') as failed,
          COUNT(*) FILTER (WHERE status = 'timeout') as timeout,
          COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled,
          AVG(duration_ms) as avg_duration_ms,
          AVG(avg_fps) as avg_fps,
          CASE 
            WHEN COUNT(*) > 0 THEN 
              (COUNT(*) FILTER (WHERE status = 'success')::DECIMAL / COUNT(*)::DECIMAL * 100)
            ELSE 0
          END as success_rate
        FROM fx_telemetry
        WHERE ${whereClause}
      `;

      const result = await this.db.findFirst(query, queryParams);
      const row = result;

      return {
        total_executions: parseInt(row.total_executions || '0', 10),
        successful: parseInt(row.successful || '0', 10),
        failed: parseInt(row.failed || '0', 10),
        timeout: parseInt(row.timeout || '0', 10),
        cancelled: parseInt(row.cancelled || '0', 10),
        avg_duration_ms: parseFloat(row.avg_duration_ms || '0'),
        avg_fps: parseFloat(row.avg_fps || '0'),
        success_rate: parseFloat(row.success_rate || '0'),
      };
    } catch (error: any) {
      await logError('FxTelemetryService.getTelemetryStats error', error, params);
      throw new Error(`Erro ao obter estatísticas: ${error.message}`);
    }
  }

  /**
   * Deletar telemetria antiga (manutenção)
   */
  async deleteOldTelemetry(olderThanDays: number = 90): Promise<number> {
    try {
      const query = `
        DELETE FROM fx_telemetry
        WHERE created_at < NOW() - INTERVAL '${olderThanDays} days'
      `;
      const result = await this.db.executeRaw(query);
      return result.rowCount || 0;
    } catch (error: any) {
      await logError('FxTelemetryService.deleteOldTelemetry error', error, { olderThanDays });
      throw new Error(`Erro ao deletar telemetria antiga: ${error.message}`);
    }
  }

  /**
   * Mapear row do banco para objeto FxTelemetry
   */
  private mapRowToTelemetry(row: any): FxTelemetry {
    return {
      id: row.id,
      totem_id: row.totem_id,
      effect_id: row.effect_id,
      event_id: row.event_id || undefined,
      content_id: row.content_id || undefined,
      planned_start_ts: row.planned_start_ts || undefined,
      actual_start_ts: row.actual_start_ts || undefined,
      ended_at: row.ended_at || undefined,
      duration_ms: row.duration_ms || undefined,
      avg_fps: row.avg_fps ? parseFloat(row.avg_fps) : undefined,
      status: row.status,
      error_message: row.error_message || undefined,
      metadata: typeof row.metadata === 'string' 
        ? JSON.parse(row.metadata) 
        : (row.metadata || {}),
      created_at: row.created_at,
    };
  }
}

// Singleton opcional
let fxTelemetryServiceInstance: FxTelemetryService | null = null;

export function getFxTelemetryService(): FxTelemetryService {
  if (!fxTelemetryServiceInstance) {
    fxTelemetryServiceInstance = new FxTelemetryService();
  }
  return fxTelemetryServiceInstance;
}

