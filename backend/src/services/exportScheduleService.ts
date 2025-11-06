/**
 * Export Schedule Service - Smart Signage v2.1
 * CRUD de agendamentos para exportação usando Bull + Redis
 */

import { getDatabase } from '../config/database';
import { AuditService } from './auditService';
import { getExportQueue, ExportJobData } from '../config/queue';
import { parseExpression } from 'cron-parser';
import { exportQueryService } from './exportQueryService';

export interface CreateExportScheduleRequest {
  name: string;
  description?: string;
  queryId: number;
  cronExpression: string;
  enabled?: boolean;
}

export interface UpdateExportScheduleRequest {
  name?: string;
  description?: string;
  queryId?: number;
  cronExpression?: string;
  enabled?: boolean;
}

export interface ExportSchedule {
  schedule_id: number;
  name: string;
  description: string | null;
  query_id: number;
  cron_expression: string;
  enabled: boolean;
  last_execution: Date | null;
  next_execution: Date | null;
  execution_count: number;
  success_count: number;
  failure_count: number;
  created_at: Date;
  updated_at: Date;
  created_by: number | null;
}

export class ExportScheduleService {
  private db = getDatabase();
  
  // Lazy initialization
  private getAuditService(): AuditService {
    if (!(global as any).auditServiceInstance) {
      (global as any).auditServiceInstance = new AuditService();
    }
    return (global as any).auditServiceInstance;
  }

  /**
   * Valida expressão cron
   */
  validateCronExpression(cronExpression: string): { valid: boolean; error?: string; nextExecution?: Date } {
    try {
      const interval = parseExpression(cronExpression);
      const nextExecution = interval.next().toDate();
      
      return {
        valid: true,
        nextExecution
      };
    } catch (error: any) {
      return {
        valid: false,
        error: `Expressão cron inválida: ${error.message}`
      };
    }
  }

  /**
   * Calcula próxima execução baseada no cron
   */
  calculateNextExecution(cronExpression: string): Date | null {
    try {
      const interval = parseExpression(cronExpression);
      return interval.next().toDate();
    } catch (error) {
      return null;
    }
  }

  /**
   * Cria novo agendamento
   */
  async createSchedule(data: CreateExportScheduleRequest, userId: number): Promise<ExportSchedule> {
    try {
      // Validar nome único
      const existing = await this.db.findFirst(`
        SELECT schedule_id FROM export_schedules WHERE name = ?
      `, [data.name]);

      if (existing) {
        throw new Error(`Agendamento com nome '${data.name}' já existe`);
      }

      // Validar query existe
      const query = await exportQueryService.getQueryById(data.queryId);
      if (!query) {
        throw new Error(`Query com ID ${data.queryId} não encontrada`);
      }

      // Validar expressão cron
      const cronValidation = this.validateCronExpression(data.cronExpression);
      if (!cronValidation.valid) {
        throw new Error(cronValidation.error || 'Expressão cron inválida');
      }

      // Calcular próxima execução
      const nextExecution = this.calculateNextExecution(data.cronExpression);

      // Inserir agendamento
      const result = await this.db.executeRaw(`
        INSERT INTO export_schedules (
          name, description, query_id, cron_expression, 
          enabled, next_execution, created_by
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
        RETURNING *
      `, [
        data.name,
        data.description || null,
        data.queryId,
        data.cronExpression,
        data.enabled !== false,
        nextExecution,
        userId
      ]);

      const schedule = result.rows[0];

      // Registrar job no Bull se habilitado
      if (data.enabled !== false) {
        await this.registerScheduleJob(schedule.schedule_id, schedule.query_id, data.cronExpression);
      }

      // Log de auditoria
      await this.getAuditService().log('export', 'schedule_created', userId, {
        scheduleId: schedule.schedule_id,
        scheduleName: data.name,
        queryId: data.queryId
      }).catch(e => console.error('Erro ao registrar log:', e.message));

      return this.mapToExportSchedule(schedule);
    } catch (error: any) {
      console.error('❌ Erro ao criar agendamento:', error.message);
      throw error;
    }
  }

  /**
   * Busca agendamento por ID
   */
  async getScheduleById(scheduleId: number): Promise<ExportSchedule | null> {
    try {
      const schedule = await this.db.findFirst(`
        SELECT * FROM export_schedules WHERE schedule_id = ?
      `, [scheduleId]);

      if (!schedule) {
        return null;
      }

      return this.mapToExportSchedule(schedule);
    } catch (error: any) {
      console.error('❌ Erro ao buscar agendamento:', error.message);
      throw error;
    }
  }

  /**
   * Busca todos os agendamentos
   */
  async getAllSchedules(filters?: {
    queryId?: number;
    enabled?: boolean;
    search?: string;
  }): Promise<ExportSchedule[]> {
    try {
      let sql = 'SELECT * FROM export_schedules WHERE 1=1';
      const params: any[] = [];

      if (filters?.queryId) {
        sql += ' AND query_id = ?';
        params.push(filters.queryId);
      }

      if (filters?.enabled !== undefined) {
        sql += ' AND enabled = ?';
        params.push(filters.enabled);
      }

      if (filters?.search) {
        sql += ' AND (name ILIKE ? OR description ILIKE ?)';
        const searchTerm = `%${filters.search}%`;
        params.push(searchTerm, searchTerm);
      }

      sql += ' ORDER BY created_at DESC';

      const schedules = await this.db.findMany(sql, params);
      return schedules.map(s => this.mapToExportSchedule(s));
    } catch (error: any) {
      console.error('❌ Erro ao buscar agendamentos:', error.message);
      throw error;
    }
  }

  /**
   * Atualiza agendamento
   */
  async updateSchedule(scheduleId: number, data: UpdateExportScheduleRequest, userId: number): Promise<ExportSchedule> {
    try {
      // Verificar se agendamento existe
      const existing = await this.getScheduleById(scheduleId);
      if (!existing) {
        throw new Error(`Agendamento com ID ${scheduleId} não encontrado`);
      }

      // Validar nome único se estiver mudando
      if (data.name && data.name !== existing.name) {
        const duplicate = await this.db.findFirst(`
          SELECT schedule_id FROM export_schedules WHERE name = ? AND schedule_id != ?
        `, [data.name, scheduleId]);

        if (duplicate) {
          throw new Error(`Agendamento com nome '${data.name}' já existe`);
        }
      }

      // Validar query se estiver mudando
      if (data.queryId && data.queryId !== existing.query_id) {
        const query = await exportQueryService.getQueryById(data.queryId);
        if (!query) {
          throw new Error(`Query com ID ${data.queryId} não encontrada`);
        }
      }

      // Validar expressão cron se estiver mudando
      let cronExpression = existing.cron_expression;
      if (data.cronExpression) {
        const cronValidation = this.validateCronExpression(data.cronExpression);
        if (!cronValidation.valid) {
          throw new Error(cronValidation.error || 'Expressão cron inválida');
        }
        cronExpression = data.cronExpression;
      }

      // Calcular próxima execução
      const nextExecution = this.calculateNextExecution(cronExpression);

      // Construir query de atualização dinâmica
      const updates: string[] = [];
      const params: any[] = [];

      if (data.name !== undefined) {
        updates.push('name = ?');
        params.push(data.name);
      }
      if (data.description !== undefined) {
        updates.push('description = ?');
        params.push(data.description || null);
      }
      if (data.queryId !== undefined) {
        updates.push('query_id = ?');
        params.push(data.queryId);
      }
      if (data.cronExpression !== undefined) {
        updates.push('cron_expression = ?');
        params.push(data.cronExpression);
      }
      if (data.enabled !== undefined) {
        updates.push('enabled = ?');
        params.push(data.enabled);
      }

      updates.push('next_execution = ?');
      params.push(nextExecution);

      if (updates.length === 0) {
        return existing;
      }

      params.push(scheduleId);

      const result = await this.db.executeRaw(`
        UPDATE export_schedules 
        SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
        WHERE schedule_id = ?
        RETURNING *
      `, params);

      const schedule = result.rows[0];

      // Atualizar job no Bull
      await this.updateScheduleJob(scheduleId, schedule.query_id, schedule.cron_expression, schedule.enabled);

      // Log de auditoria
      await this.getAuditService().log('export', 'schedule_updated', userId, {
        scheduleId: scheduleId,
        changes: Object.keys(data)
      }).catch(e => console.error('Erro ao registrar log:', e.message));

      return this.mapToExportSchedule(schedule);
    } catch (error: any) {
      console.error('❌ Erro ao atualizar agendamento:', error.message);
      throw error;
    }
  }

  /**
   * Exclui agendamento
   */
  async deleteSchedule(scheduleId: number, userId: number): Promise<void> {
    try {
      // Verificar se agendamento existe
      const existing = await this.getScheduleById(scheduleId);
      if (!existing) {
        throw new Error(`Agendamento com ID ${scheduleId} não encontrado`);
      }

      // Remover job do Bull
      await this.removeScheduleJob(scheduleId);

      // Excluir agendamento
      await this.db.executeRaw(`
        DELETE FROM export_schedules WHERE schedule_id = ?
      `, [scheduleId]);

      // Log de auditoria
      await this.getAuditService().log('export', 'schedule_deleted', userId, {
        scheduleId: scheduleId,
        scheduleName: existing.name
      }).catch(e => console.error('Erro ao registrar log:', e.message));
    } catch (error: any) {
      console.error('❌ Erro ao excluir agendamento:', error.message);
      throw error;
    }
  }

  /**
   * Registra job no Bull
   */
  private async registerScheduleJob(scheduleId: number, queryId: number, cronExpression: string): Promise<void> {
    try {
      const queue = getExportQueue();
      
      // Criar job recorrente com cron
      await queue.add(
        `schedule-${scheduleId}`,
        {
          scheduleId,
          queryId,
          cronExpression
        } as ExportJobData,
        {
          repeat: {
            cron: cronExpression,
            tz: 'America/Sao_Paulo'
          },
          jobId: `schedule-${scheduleId}`
        }
      );

      console.log(`✅ Job registrado para agendamento ${scheduleId}`);
    } catch (error: any) {
      console.error(`❌ Erro ao registrar job para agendamento ${scheduleId}:`, error.message);
      throw error;
    }
  }

  /**
   * Atualiza job no Bull
   */
  private async updateScheduleJob(scheduleId: number, queryId: number, cronExpression: string, enabled: boolean): Promise<void> {
    try {
      const queue = getExportQueue();
      
      // Remover job antigo
      await this.removeScheduleJob(scheduleId);

      // Registrar novo job se habilitado
      if (enabled) {
        await this.registerScheduleJob(scheduleId, queryId, cronExpression);
      }
    } catch (error: any) {
      console.error(`❌ Erro ao atualizar job para agendamento ${scheduleId}:`, error.message);
      throw error;
    }
  }

  /**
   * Remove job do Bull
   */
  private async removeScheduleJob(scheduleId: number): Promise<void> {
    try {
      const queue = getExportQueue();
      
      // Remover job recorrente
      const jobId = `schedule-${scheduleId}`;
      const job = await queue.getJob(jobId);
      
      if (job) {
        await job.remove();
        console.log(`✅ Job removido para agendamento ${scheduleId}`);
      }
    } catch (error: any) {
      console.error(`❌ Erro ao remover job para agendamento ${scheduleId}:`, error.message);
      // Não falhar se job não existir
    }
  }

  /**
   * Executa agendamento manualmente
   */
  async executeScheduleNow(scheduleId: number, userId: number): Promise<void> {
    try {
      const schedule = await this.getScheduleById(scheduleId);
      if (!schedule) {
        throw new Error(`Agendamento com ID ${scheduleId} não encontrado`);
      }

      const queue = getExportQueue();
      
      // Adicionar job único para execução imediata
      await queue.add(
        `schedule-${scheduleId}-manual`,
        {
          scheduleId: schedule.schedule_id,
          queryId: schedule.query_id,
          cronExpression: schedule.cron_expression,
          userId
        } as ExportJobData,
        {
          jobId: `schedule-${scheduleId}-manual-${Date.now()}`
        }
      );

      console.log(`✅ Execução manual iniciada para agendamento ${scheduleId}`);
    } catch (error: any) {
      console.error(`❌ Erro ao executar agendamento ${scheduleId}:`, error.message);
      throw error;
    }
  }

  /**
   * Carrega todos os agendamentos ativos no Bull
   */
  async loadAllActiveSchedules(): Promise<void> {
    try {
      const schedules = await this.getAllSchedules({ enabled: true });
      
      for (const schedule of schedules) {
        try {
          await this.registerScheduleJob(
            schedule.schedule_id,
            schedule.query_id,
            schedule.cron_expression
          );
        } catch (error: any) {
          console.error(`❌ Erro ao carregar agendamento ${schedule.schedule_id}:`, error.message);
        }
      }

      console.log(`✅ ${schedules.length} agendamento(s) ativo(s) carregado(s) no Bull`);
    } catch (error: any) {
      console.error('❌ Erro ao carregar agendamentos:', error.message);
      throw error;
    }
  }

  /**
   * Mapeia resultado do banco para ExportSchedule
   */
  private mapToExportSchedule(row: any): ExportSchedule {
    return {
      schedule_id: row.schedule_id,
      name: row.name,
      description: row.description,
      query_id: row.query_id,
      cron_expression: row.cron_expression,
      enabled: row.enabled,
      last_execution: row.last_execution,
      next_execution: row.next_execution,
      execution_count: row.execution_count || 0,
      success_count: row.success_count || 0,
      failure_count: row.failure_count || 0,
      created_at: row.created_at,
      updated_at: row.updated_at,
      created_by: row.created_by
    };
  }
}

// Exportar instância singleton
export const exportScheduleService = new ExportScheduleService();

