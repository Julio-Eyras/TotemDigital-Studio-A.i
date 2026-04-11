import { getDatabase } from '../config/database';
import { logError } from '../utils/loggerHelper';

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

      const params: any[] = [];
      const countParams: any[] = [];

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
      };
    } catch (error: any) {
      await logError('Erro ao listar execuções de exportação', error, { filters });
      throw error;
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

      return this.mapToExecution(row);
    } catch (error: any) {
      await logError('Erro ao buscar execução', error, { executionId });
      throw error;
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
      };
    } catch (error: any) {
      await logError('Erro ao obter arquivo da execução', error, { executionId });
      throw error;
    }
  }

  private mapToExecution(row: any): ExportExecution {
    return {
      execution_id: row.execution_id,
      schedule_id: row.schedule_id,
      schedule_name: row.schedule_name,
      query_id: row.query_id,
      query_name: row.query_name,
      job_id: row.job_id,
      status: row.status,
      started_at: row.started_at,
      completed_at: row.completed_at,
      records_exported: row.records_exported || 0,
      file_path: row.file_path,
      file_size: row.file_size,
      error_message: row.error_message,
      execution_log: row.execution_log,
      created_at: row.created_at
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


