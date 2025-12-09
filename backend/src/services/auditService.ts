/**
 * Audit Service - Smart Signage v2.0
 * Serviço de auditoria e logs
 */

import { getDatabase } from '../config/database';
import { logError, logInfo } from '../utils/loggerHelper';

export interface AuditLogEntry {
  id?: number;
  userId?: number;
  action: string;
  entity: string;
  entityId?: number;
  metadata?: any;
  timestamp?: string;
  userAgent?: string;
  ipAddress?: string;
}

export interface AuditLogFilter {
  userId?: number;
  action?: string;
  entity?: string;
  entityId?: number;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

export class AuditService {
  private get db() {
    return getDatabase();
  }

  /**
   * Registra log de auditoria
   */
  async log(
    entity: string,
    action: string,
    userId?: number,
    metadata?: any,
    _userAgent?: string,
    _ipAddress?: string
  ): Promise<void> {
    try {
      await this.db.executeRaw(`
        INSERT INTO audit_logs (user_id, action, entity, entity_id, metadata, timestamp)
        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `, [
        userId || null,
        action,
        entity,
        metadata?.entityId || null,
        metadata ? JSON.stringify(metadata) : null
      ]);

    } catch (error: any) {
      await logError('Erro ao registrar log de auditoria', error, { entity, action, entityId: metadata?.entityId });
      // Não lançar erro para não quebrar o fluxo principal
    }
  }

  /**
   * Busca logs de auditoria
   */
  async getAuditLogs(filters: AuditLogFilter = {}): Promise<AuditLogEntry[]> {
    try {
      let whereClause = 'WHERE 1=1';
      const params: any[] = [];

      // Aplicar filtros
      if (filters.userId) {
        whereClause += ' AND al.user_id = ?';
        params.push(filters.userId);
      }

      if (filters.action) {
        whereClause += ' AND al.action = ?';
        params.push(filters.action);
      }

      if (filters.entity) {
        whereClause += ' AND al.entity = ?';
        params.push(filters.entity);
      }

      if (filters.entityId) {
        whereClause += ' AND al.entity_id = ?';
        params.push(filters.entityId);
      }

      if (filters.startDate) {
        whereClause += ' AND al.timestamp >= ?';
        params.push(filters.startDate);
      }

      if (filters.endDate) {
        whereClause += ' AND al.timestamp <= ?';
        params.push(filters.endDate);
      }

      // Limite e offset
      const limit = filters.limit || 100;
      const offset = filters.offset || 0;

      const logs = await this.db.findMany(`
        SELECT 
          al.id,
          al.user_id as userId,
          al.action,
          al.entity,
          al.entity_id as entityId,
          al.metadata,
          al.timestamp,
          u.username as user_name
        FROM audit_logs al
        LEFT JOIN users u ON al.user_id = u.id
        ${whereClause}
        ORDER BY al.timestamp DESC
        LIMIT ? OFFSET ?
      `, [...params, limit, offset]);

      return logs.map(log => ({
        id: log.id,
        userId: log.userId,
        action: log.action,
        entity: log.entity,
        entityId: log.entityId,
        metadata: log.metadata ? JSON.parse(log.metadata) : null,
        timestamp: log.timestamp
      }));

    } catch (error: any) {
      await logError('Erro ao buscar logs de auditoria', error, { filters });
      throw new Error('Erro interno do servidor');
    }
  }

  /**
   * Busca log por ID
   */
  async getAuditLogById(logId: number): Promise<AuditLogEntry | null> {
    try {
      const log = await this.db.findFirst(`
        SELECT 
          al.id,
          al.user_id as userId,
          al.action,
          al.entity,
          al.entity_id as entityId,
          al.metadata,
          al.timestamp,
          u.username as user_name
        FROM audit_logs al
        LEFT JOIN users u ON al.user_id = u.id
        WHERE al.id = ?
      `, [logId]);

      if (!log) {
        return null;
      }

      return {
        id: log.id,
        userId: log.userId,
        action: log.action,
        entity: log.entity,
        entityId: log.entityId,
        metadata: log.metadata ? JSON.parse(log.metadata) : null,
        timestamp: log.timestamp
      };

    } catch (error: any) {
      await logError('Erro ao buscar log de auditoria', error, { logId });
      throw new Error('Erro interno do servidor');
    }
  }

  /**
   * Busca logs de um usuário
   */
  async getUserAuditLogs(userId: number, limit: number = 50): Promise<AuditLogEntry[]> {
    try {
      const logs = await this.db.findMany(`
        SELECT 
          al.id,
          al.user_id as userId,
          al.action,
          al.entity,
          al.entity_id as entityId,
          al.metadata,
          al.timestamp,
          u.username as user_name
        FROM audit_logs al
        LEFT JOIN users u ON al.user_id = u.id
        WHERE al.user_id = ?
        ORDER BY al.timestamp DESC
        LIMIT ?
      `, [userId, limit]);

      return logs.map(log => ({
        id: log.id,
        userId: log.userId,
        action: log.action,
        entity: log.entity,
        entityId: log.entityId,
        metadata: log.metadata ? JSON.parse(log.metadata) : null,
        timestamp: log.timestamp
      }));

    } catch (error: any) {
      await logError('Erro ao buscar logs do usuário', error, { userId, limit });
      throw new Error('Erro interno do servidor');
    }
  }

  /**
   * Busca logs de uma entidade
   */
  async getEntityAuditLogs(entity: string, entityId: number, limit: number = 50): Promise<AuditLogEntry[]> {
    try {
      const logs = await this.db.findMany(`
        SELECT 
          al.id,
          al.user_id as userId,
          al.action,
          al.entity,
          al.entity_id as entityId,
          al.metadata,
          al.timestamp,
          u.username as user_name
        FROM audit_logs al
        LEFT JOIN users u ON al.user_id = u.id
        WHERE al.entity = ? AND al.entity_id = ?
        ORDER BY al.timestamp DESC
        LIMIT ?
      `, [entity, entityId, limit]);

      return logs.map(log => ({
        id: log.id,
        userId: log.userId,
        action: log.action,
        entity: log.entity,
        entityId: log.entityId,
        metadata: log.metadata ? JSON.parse(log.metadata) : null,
        timestamp: log.timestamp
      }));

    } catch (error: any) {
      await logError('Erro ao buscar logs da entidade', error, { entity, entityId, limit });
      throw new Error('Erro interno do servidor');
    }
  }

  /**
   * Busca estatísticas de auditoria
   */
  async getAuditStats(days: number = 30): Promise<{
    totalLogs: number;
    byAction: { action: string; count: number }[];
    byEntity: { entity: string; count: number }[];
    byUser: { userId: number; username: string; count: number }[];
    recentActivity: { date: string; count: number }[];
  }> {
    try {
      // Total de logs
      const totalLogsResult = await this.db.findFirst(`
        SELECT COUNT(*) as total
        FROM audit_logs
        WHERE timestamp >= datetime('now', '-${days} days')
      `);

      // Por ação
      const byAction = await this.db.findMany(`
        SELECT action, COUNT(*) as count
        FROM audit_logs
        WHERE timestamp >= datetime('now', '-${days} days')
        GROUP BY action
        ORDER BY count DESC
        LIMIT 10
      `);

      // Por entidade
      const byEntity = await this.db.findMany(`
        SELECT entity, COUNT(*) as count
        FROM audit_logs
        WHERE timestamp >= datetime('now', '-${days} days')
        GROUP BY entity
        ORDER BY count DESC
        LIMIT 10
      `);

      // Por usuário
      const byUser = await this.db.findMany(`
        SELECT 
          al.user_id as userId,
          u.username,
          COUNT(*) as count
        FROM audit_logs al
        LEFT JOIN users u ON al.user_id = u.id
        WHERE al.timestamp >= datetime('now', '-${days} days')
        GROUP BY al.user_id, u.username
        ORDER BY count DESC
        LIMIT 10
      `);

      // Atividade recente (últimos 7 dias)
      const recentActivity = await this.db.findMany(`
        SELECT 
          DATE(timestamp) as date,
          COUNT(*) as count
        FROM audit_logs
        WHERE timestamp >= datetime('now', '-7 days')
        GROUP BY DATE(timestamp)
        ORDER BY date DESC
      `);

      return {
        totalLogs: totalLogsResult?.total || 0,
        byAction: byAction.map(a => ({ action: a.action, count: a.count })),
        byEntity: byEntity.map(e => ({ entity: e.entity, count: e.count })),
        byUser: byUser.map(u => ({ userId: u.userId, username: u.username, count: u.count })),
        recentActivity: recentActivity.map(r => ({ date: r.date, count: r.count }))
      };

    } catch (error: any) {
      await logError('Erro ao buscar estatísticas de auditoria', error, { days });
      throw new Error('Erro interno do servidor');
    }
  }

  /**
   * Limpa logs antigos
   */
  async cleanupOldLogs(daysToKeep: number = 90): Promise<number> {
    try {
      const result = await this.db.executeRaw(`
        DELETE FROM audit_logs
        WHERE timestamp < datetime('now', '-${daysToKeep} days')
      `);

      await logInfo('Logs de auditoria antigos removidos', { count: result.changes, days: daysToKeep });
      return result.changes;

    } catch (error: any) {
      await logError('Erro ao limpar logs antigos', error, { days: daysToKeep });
      throw new Error('Erro interno do servidor');
    }
  }

  /**
   * Exporta logs para CSV
   */
  async exportLogsToCSV(filters: AuditLogFilter = {}): Promise<string> {
    try {
      const logs = await this.getAuditLogs({ ...filters, limit: 10000 });

      let csv = 'ID,User ID,Action,Entity,Entity ID,Metadata,Timestamp\n';

      for (const log of logs) {
        const metadata = log.metadata ? JSON.stringify(log.metadata).replace(/"/g, '""') : '';
        csv += `${log.id},${log.userId || ''},${log.action},${log.entity},${log.entityId || ''},"${metadata}",${log.timestamp}\n`;
      }

      return csv;

    } catch (error: any) {
      await logError('Erro ao exportar logs', error, { filters });
      throw new Error('Erro interno do servidor');
    }
  }

  /**
   * Busca logs de segurança
   */
  async getSecurityLogs(limit: number = 100): Promise<AuditLogEntry[]> {
    try {
      const securityActions = [
        'login_success',
        'login_failed',
        'logout',
        'password_changed',
        'user_created',
        'user_deleted',
        'role_assigned',
        'role_removed',
        'permission_granted',
        'permission_revoked'
      ];

      const placeholders = securityActions.map(() => '?').join(',');

      const logs = await this.db.findMany(`
        SELECT 
          al.id,
          al.user_id as userId,
          al.action,
          al.entity,
          al.entity_id as entityId,
          al.metadata,
          al.timestamp,
          u.username as user_name
        FROM audit_logs al
        LEFT JOIN users u ON al.user_id = u.id
        WHERE al.action IN (${placeholders})
        ORDER BY al.timestamp DESC
        LIMIT ?
      `, [...securityActions, limit]);

      return logs.map(log => ({
        id: log.id,
        userId: log.userId,
        action: log.action,
        entity: log.entity,
        entityId: log.entityId,
        metadata: log.metadata ? JSON.parse(log.metadata) : null,
        timestamp: log.timestamp
      }));

    } catch (error: any) {
      await logError('Erro ao buscar logs de segurança', error, {});
      throw new Error('Erro interno do servidor');
    }
  }

  /**
   * Busca tentativas de login falhadas
   */
  async getFailedLoginAttempts(hours: number = 24): Promise<AuditLogEntry[]> {
    try {
      const logs = await this.db.findMany(`
        SELECT 
          al.id,
          al.user_id as userId,
          al.action,
          al.entity,
          al.entity_id as entityId,
          al.metadata,
          al.timestamp,
          u.username as user_name
        FROM audit_logs al
        LEFT JOIN users u ON al.user_id = u.id
        WHERE al.action = 'login_failed'
        AND al.timestamp >= datetime('now', '-${hours} hours')
        ORDER BY al.timestamp DESC
      `);

      return logs.map(log => ({
        id: log.id,
        userId: log.userId,
        action: log.action,
        entity: log.entity,
        entityId: log.entityId,
        metadata: log.metadata ? JSON.parse(log.metadata) : null,
        timestamp: log.timestamp
      }));

    } catch (error: any) {
      await logError('Erro ao buscar tentativas de login falhadas', error, { hours });
      throw new Error('Erro interno do servidor');
    }
  }

  /**
   * Verifica se usuário tem muitas tentativas de login falhadas
   */
  async hasTooManyFailedLogins(username: string, maxAttempts: number = 5, hours: number = 1): Promise<boolean> {
    try {
      const result = await this.db.findFirst(`
        SELECT COUNT(*) as count
        FROM audit_logs al
        LEFT JOIN users u ON al.user_id = u.id
        WHERE al.action = 'login_failed'
        AND (u.username = ? OR al.metadata LIKE ?)
        AND al.timestamp >= datetime('now', '-${hours} hours')
      `, [username, `%"username":"${username}"%`]);

      return (result?.count || 0) >= maxAttempts;

    } catch (error: any) {
      await logError('Erro ao verificar tentativas de login falhadas', error, { username, hours });
      return false;
    }
  }

  /**
   * Registra log de sistema
   */
  async logSystemEvent(eventType: string, description: string, metadata?: any): Promise<void> {
    try {
      await this.db.executeRaw(`
        INSERT INTO system_logs (event_type, description, created_at)
        VALUES (?, ?, CURRENT_TIMESTAMP)
      `, [eventType, description]);

      // Também registrar no audit_logs para consistência
      await this.log('system', eventType, undefined, { description, ...metadata });

    } catch (error: any) {
      await logError('Erro ao registrar evento do sistema', error, { eventType, metadata });
    }
  }

  /**
   * Busca logs do sistema
   */
  async getSystemLogs(limit: number = 100): Promise<any[]> {
    try {
      const logs = await this.db.findMany(`
        SELECT 
          log_id as id,
          event_type as eventType,
          description,
          created_at as createdAt
        FROM system_logs
        ORDER BY created_at DESC
        LIMIT ?
      `, [limit]);

      return logs;

    } catch (error: any) {
      await logError('Erro ao buscar logs do sistema', error, { limit });
      throw new Error('Erro interno do servidor');
    }
  }
}

