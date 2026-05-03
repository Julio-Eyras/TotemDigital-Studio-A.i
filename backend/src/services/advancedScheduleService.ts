/**
 * Advanced Schedule Service - Smart Signage v2.1
 * Serviço de agendamento avançado para campanhas e playlists
 */

import { getDatabase } from '../config/database';
import { AuditService } from './auditService';
import { getAdvancedScheduleQueue, AdvancedScheduleJobData } from '../config/queue';
import { parseExpression } from 'cron-parser';
import { logError, logInfo } from '../utils/loggerHelper';

export interface CreateAdvancedScheduleRequest {
  name: string;
  description?: string;
  scheduleType: 'campaign' | 'playlist' | 'campaign_activation' | 'playlist_generation';
  targetId: number; // campaign_id ou playlist_id
  cronExpression: string;
  scheduleConfig?: {
    // Configurações específicas por tipo
    [key: string]: any;
  };
  enabled?: boolean;
}

export interface UpdateAdvancedScheduleRequest {
  name?: string;
  description?: string;
  cronExpression?: string;
  scheduleConfig?: any;
  enabled?: boolean;
}

export interface AdvancedSchedule {
  schedule_id: number;
  name: string;
  description: string | null;
  schedule_type: string;
  target_id: number;
  cron_expression: string;
  schedule_config: any;
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

export class AdvancedScheduleService {
  private get db() {
    return getDatabase();
  }
  
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
   * Cria novo agendamento avançado
   */
  async createSchedule(data: CreateAdvancedScheduleRequest, userId: number): Promise<AdvancedSchedule> {
    try {
      // Validar nome único
      const existing = await this.db.findFirst(`
        SELECT schedule_id FROM advanced_schedules WHERE name = ?
      `, [data.name]);

      if (existing) {
        throw new Error(`Agendamento com nome '${data.name}' já existe`);
      }

      // Validar target existe baseado no tipo
      await this.validateTarget(data.scheduleType, data.targetId);

      // Validar expressão cron
      const cronValidation = this.validateCronExpression(data.cronExpression);
      if (!cronValidation.valid) {
        throw new Error(cronValidation.error || 'Expressão cron inválida');
      }

      // Calcular próxima execução
      const nextExecution = this.calculateNextExecution(data.cronExpression);

      // Inserir agendamento
      const result = await this.db.executeRaw(`
        INSERT INTO advanced_schedules (
          name, description, schedule_type, target_id, cron_expression,
          schedule_config, enabled, next_execution, created_by
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        RETURNING *
      `, [
        data.name,
        data.description || null,
        data.scheduleType,
        data.targetId,
        data.cronExpression,
        data.scheduleConfig ? JSON.stringify(data.scheduleConfig) : null,
        data.enabled !== false,
        nextExecution,
        userId
      ]);

      const schedule = result.rows[0];

      // Registrar job no Bull se habilitado
      if (data.enabled !== false) {
        await this.registerScheduleJob(schedule.schedule_id, data.scheduleType, data.targetId, data.cronExpression);
      }

      // Log de auditoria
      await this.getAuditService().log('schedule', 'advanced_schedule_created', userId, {
        scheduleId: schedule.schedule_id,
        scheduleName: data.name,
        scheduleType: data.scheduleType,
        targetId: data.targetId
      }).catch(e => logError('Erro ao registrar log de auditoria', e, { scheduleId: schedule.schedule_id }).catch(() => {}));

      return this.mapToAdvancedSchedule(schedule);
    } catch (error: any) {
      await logError('Erro ao criar agendamento avançado', error, { data });
      throw error;
    }
  }

  /**
   * Valida se o target existe baseado no tipo
   */
  private async validateTarget(scheduleType: string, targetId: number): Promise<void> {
    try {
      switch (scheduleType) {
        case 'campaign':
        case 'campaign_activation':
          const campaign = await this.db.findFirst(`
            SELECT campaign_id FROM campaigns WHERE campaign_id = ?
          `, [targetId]);
          if (!campaign) {
            throw new Error(`Campanha com ID ${targetId} não encontrada`);
          }
          break;

        case 'playlist':
        case 'playlist_generation':
          const playlist = await this.db.findFirst(`
            SELECT playlist_id FROM playlists WHERE playlist_id = ?
          `, [targetId]);
          if (!playlist) {
            throw new Error(`Playlist com ID ${targetId} não encontrada`);
          }
          break;

        default:
          throw new Error(`Tipo de agendamento não suportado: ${scheduleType}`);
      }
    } catch (error: any) {
      throw error;
    }
  }

  /**
   * Registra job no Bull
   */
  private async registerScheduleJob(
    scheduleId: number,
    scheduleType: string,
    targetId: number,
    cronExpression: string
  ): Promise<void> {
    try {
      const queue = getAdvancedScheduleQueue();
      
      // Adicionar job recorrente com cron
      await queue.add(
        `schedule-${scheduleId}`,
        {
          scheduleId,
          scheduleType,
          targetId
        } as AdvancedScheduleJobData,
        {
          repeat: {
            cron: cronExpression
          },
          jobId: `schedule-${scheduleId}`
        }
      );

      await logInfo('Job registrado para agendamento', { scheduleId });
    } catch (error: any) {
      await logError('Erro ao registrar job', error, { scheduleId });
      throw error;
    }
  }

  /**
   * Lista agendamentos avançados
   */
  async getSchedules(filters: {
    scheduleType?: string;
    targetId?: number;
    enabled?: boolean;
  } = {}): Promise<AdvancedSchedule[]> {
    try {
      let whereClause = 'WHERE 1=1';
      const params: any[] = [];

      if (filters.scheduleType) {
        whereClause += ' AND schedule_type = ?';
        params.push(filters.scheduleType);
      }

      if (filters.targetId) {
        whereClause += ' AND target_id = ?';
        params.push(filters.targetId);
      }

      if (filters.enabled !== undefined) {
        whereClause += ' AND enabled = ?';
        params.push(filters.enabled ? 1 : 0);
      }

      const schedules = await this.db.findMany(`
        SELECT * FROM advanced_schedules
        ${whereClause}
        ORDER BY created_at DESC
      `, params);

      return schedules.map(s => this.mapToAdvancedSchedule(s));
    } catch (error: any) {
      await logError('Erro ao buscar agendamentos', error, { filters });
      throw error;
    }
  }

  /**
   * Busca agendamento por ID
   */
  async getScheduleById(scheduleId: number): Promise<AdvancedSchedule | null> {
    try {
      const schedule = await this.db.findFirst(`
        SELECT * FROM advanced_schedules WHERE schedule_id = ?
      `, [scheduleId]);

      if (!schedule) {
        return null;
      }

      return this.mapToAdvancedSchedule(schedule);
    } catch (error: any) {
      await logError('Erro ao buscar agendamento', error, { scheduleId });
      throw error;
    }
  }

  /**
   * subscriber_id do dono do alvo (campanha ou playlist) deste agendamento.
   */
  async getSubscriberIdForSchedule(scheduleId: number): Promise<number | null> {
    try {
      const row = (await this.db.findFirst(
        `
        SELECT (
          CASE sch.schedule_type
            WHEN 'campaign' THEN (SELECT c.subscriber_id FROM campaigns c WHERE c.campaign_id = sch.target_id LIMIT 1)
            WHEN 'campaign_activation' THEN (SELECT c.subscriber_id FROM campaigns c WHERE c.campaign_id = sch.target_id LIMIT 1)
            WHEN 'playlist' THEN (SELECT p.subscriber_id FROM playlists p WHERE p.playlist_id = sch.target_id LIMIT 1)
            WHEN 'playlist_generation' THEN (SELECT p.subscriber_id FROM playlists p WHERE p.playlist_id = sch.target_id LIMIT 1)
            ELSE NULL
          END
        ) AS subscriber_id
        FROM advanced_schedules sch
        WHERE sch.schedule_id = ?
        `,
        [scheduleId]
      )) as { subscriber_id: number | null } | null;
      const sid = row?.subscriber_id;
      return sid != null && Number.isFinite(Number(sid)) ? Number(sid) : null;
    } catch (error: any) {
      await logError('Erro ao resolver subscriber do agendamento', error, { scheduleId });
      throw error;
    }
  }

  /**
   * subscriber_id do dono do alvo (campanha ou playlist) para um tipo/target antes de criar agendamento.
   */
  async getSubscriberIdForScheduleTarget(scheduleType: string, targetId: number): Promise<number | null> {
    const t = String(scheduleType || '').trim();
    const tid = Number(targetId);
    if (!Number.isFinite(tid) || tid < 1) {
      return null;
    }
    try {
      const row = (await this.db.findFirst(
        `
        SELECT (
          CASE ?
            WHEN 'campaign' THEN (SELECT c.subscriber_id FROM campaigns c WHERE c.campaign_id = ? LIMIT 1)
            WHEN 'campaign_activation' THEN (SELECT c.subscriber_id FROM campaigns c WHERE c.campaign_id = ? LIMIT 1)
            WHEN 'playlist' THEN (SELECT p.subscriber_id FROM playlists p WHERE p.playlist_id = ? LIMIT 1)
            WHEN 'playlist_generation' THEN (SELECT p.subscriber_id FROM playlists p WHERE p.playlist_id = ? LIMIT 1)
            ELSE NULL
          END
        ) AS subscriber_id
        `,
        [t, tid, tid, tid, tid]
      )) as { subscriber_id: number | null } | null;
      const sid = row?.subscriber_id;
      return sid != null && Number.isFinite(Number(sid)) ? Number(sid) : null;
    } catch (error: any) {
      await logError('Erro ao resolver subscriber do alvo do agendamento', error, { scheduleType: t, targetId: tid });
      throw error;
    }
  }

  /**
   * Atualiza agendamento
   */
  async updateSchedule(scheduleId: number, data: UpdateAdvancedScheduleRequest, userId: number): Promise<AdvancedSchedule> {
    try {
      const schedule = await this.getScheduleById(scheduleId);
      if (!schedule) {
        throw new Error(`Agendamento com ID ${scheduleId} não encontrado`);
      }

      const updates: string[] = [];
      const params: any[] = [];

      if (data.name !== undefined) {
        // Validar nome único se mudou
        if (data.name !== schedule.name) {
          const existing = await this.db.findFirst(`
            SELECT schedule_id FROM advanced_schedules WHERE name = ? AND schedule_id != ?
          `, [data.name, scheduleId]);

          if (existing) {
            throw new Error(`Agendamento com nome '${data.name}' já existe`);
          }
        }
        updates.push('name = ?');
        params.push(data.name);
      }

      if (data.description !== undefined) {
        updates.push('description = ?');
        params.push(data.description || null);
      }

      if (data.cronExpression !== undefined) {
        // Validar expressão cron
        const cronValidation = this.validateCronExpression(data.cronExpression);
        if (!cronValidation.valid) {
          throw new Error(cronValidation.error || 'Expressão cron inválida');
        }

        updates.push('cron_expression = ?');
        params.push(data.cronExpression);

        // Recalcular próxima execução
        const nextExecution = this.calculateNextExecution(data.cronExpression);
        updates.push('next_execution = ?');
        params.push(nextExecution);

        // Re-registrar job no Bull
        await this.removeScheduleJob(scheduleId);
        if (data.enabled !== false && schedule.enabled) {
          await this.registerScheduleJob(scheduleId, schedule.schedule_type, schedule.target_id, data.cronExpression);
        }
      }

      if (data.scheduleConfig !== undefined) {
        updates.push('schedule_config = ?');
        params.push(JSON.stringify(data.scheduleConfig));
      }

      if (data.enabled !== undefined) {
        updates.push('enabled = ?');
        params.push(data.enabled ? 1 : 0);

        // Registrar ou remover job no Bull
        if (data.enabled) {
          await this.registerScheduleJob(scheduleId, schedule.schedule_type, schedule.target_id, schedule.cron_expression);
        } else {
          await this.removeScheduleJob(scheduleId);
        }
      }

      if (updates.length === 0) {
        return schedule;
      }

      params.push(scheduleId);

      await this.db.executeRaw(`
        UPDATE advanced_schedules
        SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
        WHERE schedule_id = ?
      `, params);

      // Log de auditoria
      await this.getAuditService().log('schedule', 'advanced_schedule_updated', userId, {
        scheduleId,
        changes: Object.keys(data)
      }).catch(e => logError('Erro ao registrar log de auditoria', e, { scheduleId: schedule.schedule_id }).catch(() => {}));

      const updated = await this.getScheduleById(scheduleId);
      if (!updated) {
        throw new Error('Erro ao buscar agendamento atualizado');
      }

      return updated;
    } catch (error: any) {
      await logError('Erro ao atualizar agendamento', error, { scheduleId, data });
      throw error;
    }
  }

  /**
   * Remove job do Bull
   */
  private async removeScheduleJob(scheduleId: number): Promise<void> {
    try {
      const queue = getAdvancedScheduleQueue();
      const job = await queue.getJob(`schedule-${scheduleId}`);
      
      if (job) {
        await job.remove();
        await logInfo('Job removido para agendamento', { scheduleId });
      }
    } catch (error: any) {
      await logError('Erro ao remover job', error, { scheduleId });
      // Não falhar se o job não existir
    }
  }

  /**
   * Exclui agendamento
   */
  async deleteSchedule(scheduleId: number, userId: number): Promise<void> {
    try {
      const schedule = await this.getScheduleById(scheduleId);
      if (!schedule) {
        throw new Error(`Agendamento com ID ${scheduleId} não encontrado`);
      }

      // Remover job do Bull
      await this.removeScheduleJob(scheduleId);

      // Excluir agendamento
      await this.db.executeRaw(`
        DELETE FROM advanced_schedules WHERE schedule_id = ?
      `, [scheduleId]);

      // Log de auditoria
      await this.getAuditService().log('schedule', 'advanced_schedule_deleted', userId, {
        scheduleId,
        scheduleName: schedule.name
      }).catch(e => logError('Erro ao registrar log de auditoria', e, { scheduleId: schedule.schedule_id }).catch(() => {}));
    } catch (error: any) {
      await logError('Erro ao excluir agendamento', error, { scheduleId });
      throw error;
    }
  }

  /**
   * Mapeia resultado do banco para AdvancedSchedule
   */
  private mapToAdvancedSchedule(row: any): AdvancedSchedule {
    return {
      schedule_id: row.schedule_id,
      name: row.name,
      description: row.description,
      schedule_type: row.schedule_type,
      target_id: row.target_id,
      cron_expression: row.cron_expression,
      schedule_config: typeof row.schedule_config === 'string' 
        ? JSON.parse(row.schedule_config) 
        : row.schedule_config,
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
export const advancedScheduleService = new AdvancedScheduleService();


