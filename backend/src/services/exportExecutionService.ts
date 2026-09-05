import { getDatabase } from '../config/database';
import { logError } from '../utils/loggerHelper';
import { normalizeError } from '../utils/errors';

export interface ExportExecution {
  execution_id: number;
  schedule_id: number | null;
  schedule_name?: string | null;
  query_id: number;
  query_name?: string | null;
  job_id: string | null;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  started_at: Date | null;
  completed_at: Date | null;
  records_exported: number;
  file_path: string | null;
  file_size: number | null;
  error_message: string | null;
  execution_log: string | null;
  created_at: Date;
}

export class ExportExecutionService {
  private get db() {
    return getDatabase();
  }

  async getExecutions(filters?: {
    scheduleId?: number;
    queryId?: number;
    status?: string;
    search?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  }): Promise<{
    data: ExportExecution[];
    total: number;
    page: number;
    limit: number;
  }> {
    try {
      let sql = `
        SELECT 
          ee.*,
          eq.name AS query_name,
          es.name AS schedule_name
        FROM export_executions ee
        LEFT JOIN export_queries eq ON ee.query_id = eq.query_id
        LEFT JOIN export_schedules es ON ee.schedule_id = es.schedule_id
        WHERE 1=1
      `;

      let countSql = `
        SELECT COUNT(*) AS total
        FROM export_executions ee
        LEFT JOIN export_queries eq ON ee.query_id = eq.query_id
        LEFT JOIN export_schedules es ON ee.schedule_id = es.schedule_id
        WHERE 1=1
      `;

      const params: unknown[] = [];
      const countParams: unknown[] = [];

      if (filters?.scheduleId) {
        sql += ' AND ee.schedule_id = ?';
        params.push(filters.scheduleId);
        countSql += ' AND ee.schedule_id = ?';
        countParams.push(filters.scheduleId);
      }

      if (filters?.queryId) {
        sql += ' AND ee.query_id = ?';
        params.push(filters.queryId);
        countSql += ' AND ee.query_id = ?';
        countParams.push(filters.queryId);
      }

      if (filters?.status) {
        sql += ' AND ee.status = ?';
        params.push(filters.status);
        countSql += ' AND ee.status = ?';
        countParams.push(filters.status);
      }

      if (filters?.startDate) {
        sql += ' AND ee.created_at >= ?';
        params.push(filters.startDate);
        countSql += ' AND ee.created_at >= ?';
        countParams.push(filters.startDate);
      }

      if (filters?.endDate) {
        sql += ' AND ee.created_at <= ?';
        params.push(filters.endDate);
        countSql += ' AND ee.created_at <= ?';
        countParams.push(filters.endDate);
      }

      if (filters?.search) {
        sql += ' AND (eq.name ILIKE ? OR es.name ILIKE ?)';
        const searchTerm = `%${filters.search}%`;
        params.push(searchTerm, searchTerm);
        countSql += ' AND (eq.name ILIKE ? OR es.name ILIKE ?)';
        countParams.push(searchTerm, searchTerm);
      }

      sql += ' ORDER BY ee.created_at DESC';

      const page = Math.max(1, filters?.page || 1);
      const limit = Math.max(1, Math.min(filters?.limit || 25, 100));
      const offset = (page - 1) * limit;

      sql += ' LIMIT ? OFFSET ?';
      params.push(limit, offset);

      const [rows, countRow] = await Promise.all([
        this.db.findMany(sql, params),
        this.db.findFirst(countSql, countParams)
      ]);

      const total = Number(countRow?.total || 0);

      return {
        data: rows.map((row) => this.mapToExecution(row)),
        total,
        page,
        limit
      };} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('Erro ao listar execuções de exportação', e.error, { filters });
      throw e.error;
    }
  }

  async getExecutionById(executionId: number): Promise<ExportExecution | null> {
    try {
      const row = await this.db.findFirst(`
        SELECT 
          ee.*,
          eq.name AS query_name,
          es.name AS schedule_name
        FROM export_executions ee
        LEFT JOIN export_queries eq ON ee.query_id = eq.query_id
        LEFT JOIN export_schedules es ON ee.schedule_id = es.schedule_id
        WHERE ee.execution_id = ?
      `, [executionId]);

      if (!row) {
        return null;
      }

      return this.mapToExecution(row);} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('Erro ao buscar execução', e.error, { executionId });
      throw e.error;
    }
  }

  async getExecutionFilePath(executionId: number): Promise<{ filePath: string; fileName: string } | null> {
    try {
      const execution = await this.db.findFirst(`
        SELECT ee.file_path, eq.name AS query_name, ee.created_at
        FROM export_executions ee
        LEFT JOIN export_queries eq ON ee.query_id = eq.query_id
        WHERE ee.execution_id = ?
      `, [executionId]);

      if (!execution || !execution.file_path) {
        return null;
      }

      const timestamp = execution.created_at
        ? new Date(execution.created_at).toISOString().replace(/[:.]/g, '-')
        : 'export';

      const fileName = `${execution.query_name || 'export'}_${timestamp}${this.getFileExtension(execution.file_path)}`;

      return {
        filePath: execution.file_path,
        fileName
      };} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('Erro ao obter arquivo da execução', e.error, { executionId });
      throw e.error;
    }
  }

  private mapToExecution(row: unknown): ExportExecution {
    const r = row as unknown as Record<string, unknown>;
    return {
      execution_id: Number(r.execution_id),
      schedule_id: r.schedule_id !== undefined && r.schedule_id !== null ? Number(r.schedule_id) : null,
      schedule_name: r.schedule_name !== undefined && r.schedule_name !== null ? String(r.schedule_name) : null,
      query_id: Number(r.query_id),
      query_name: r.query_name !== undefined && r.query_name !== null ? String(r.query_name) : null,
      job_id: r.job_id !== undefined && r.job_id !== null ? String(r.job_id) : null,
      status: r.status as ExportExecution['status'],
      started_at: r.started_at !== undefined && r.started_at !== null ? new Date(r.started_at as string | number | Date) : null,
      completed_at: r.completed_at !== undefined && r.completed_at !== null ? new Date(r.completed_at as string | number | Date) : null,
      records_exported: Number(r.records_exported || 0),
      file_path: r.file_path !== undefined && r.file_path !== null ? String(r.file_path) : null,
      file_size: r.file_size !== undefined && r.file_size !== null ? Number(r.file_size) : null,
      error_message: r.error_message !== undefined && r.error_message !== null ? String(r.error_message) : null,
      execution_log: r.execution_log !== undefined && r.execution_log !== null ? String(r.execution_log) : null,
      created_at: new Date(r.created_at as string | number | Date)
    };
  }

  private getFileExtension(filePath: string): string {
    const dotIndex = filePath.lastIndexOf('.');
    if (dotIndex === -1) {
      return '';
    }
    return filePath.substring(dotIndex);
  }
}

export const exportExecutionService = new ExportExecutionService();

