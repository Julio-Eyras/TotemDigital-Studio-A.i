/**
 * Notification Service - Smart Signage v2.0
 * Serviço de notificações
 */

import { getDatabase } from '../config/database';
import { AuditService } from './auditService';

export interface Notification {
  id: number;
  type: 'info' | 'warning' | 'error' | 'success';
  title: string;
  message: string;
  userId?: number;
  clientId?: number;
  isRead: boolean;
  metadata?: any;
  createdAt: string;
  expiresAt?: string;
}

export interface NotificationRequest {
  type: 'info' | 'warning' | 'error' | 'success' | 'system_alert';
  title: string;
  message: string;
  userId?: number;
  clientId?: number;
  priority?: 'low' | 'medium' | 'high';
  metadata?: any;
  expiresAt?: string;
}

export class NotificationService {
  private db = getDatabase();
  
  // Lazy initialization - só criar quando necessário
  private getAuditService(): AuditService {
    if (!(global as any).auditServiceInstance) {
      (global as any).auditServiceInstance = new AuditService();
    }
    return (global as any).auditServiceInstance;
  }

  /**
   * Inicializa o serviço
   */
  async initialize(): Promise<void> {
    try {
      console.log('🔔 NotificationService inicializado');
    } catch (error: any) {
      console.error('❌ Erro ao inicializar NotificationService:', error.message);
      throw error;
    }
  }

  /**
   * Cria nova notificação
   */
  async createNotification(notification: NotificationRequest, createdBy: number): Promise<Notification> {
    try {
      const result = await this.db.executeRaw(`
        INSERT INTO notifications (
          type, title, message, user_id, client_id, 
          is_read, metadata, expires_at
        )
        VALUES (?, ?, ?, ?, ?, 0, ?, ?)
      `, [
        notification.type,
        notification.title,
        notification.message,
        notification.userId,
        notification.clientId,
        notification.metadata ? JSON.stringify(notification.metadata) : null,
        notification.expiresAt
      ]);

      if (!result.lastInsertRowid) {
        throw new Error('Erro ao criar notificação');
      }

      const newNotification = await this.getNotificationById(result.lastInsertRowid);
      if (!newNotification) {
        throw new Error('Erro ao buscar notificação criada');
      }

      // Log de auditoria
      await this.getAuditService().log('notification', 'created', createdBy, {
        notificationId: newNotification.id,
        type: newNotification.type,
        title: newNotification.title
      });

      return newNotification;

    } catch (error: any) {
      console.error('❌ Erro ao criar notificação:', error.message);
      throw error;
    }
  }

  /**
   * Busca notificação por ID
   */
  async getNotificationById(notificationId: number): Promise<Notification | null> {
    try {
      const notification = await this.db.findFirst(`
        SELECT 
          notification_id as id,
          type,
          title,
          message,
          user_id as userId,
          client_id as clientId,
          is_read as isRead,
          metadata,
          created_at as createdAt,
          expires_at as expiresAt
        FROM notifications
        WHERE notification_id = ?
      `, [notificationId]);

      if (!notification) {
        return null;
      }

      return {
        ...notification,
        metadata: notification.metadata ? JSON.parse(notification.metadata) : undefined
      };

    } catch (error: any) {
      console.error('❌ Erro ao buscar notificação:', error.message);
      throw new Error('Erro interno do servidor');
    }
  }

  /**
   * Lista notificações com paginação
   */
  async getNotifications(
    page: number = 1,
    limit: number = 20,
    filters: {
      userId?: number;
      clientId?: number;
      type?: string;
      isRead?: boolean;
    } = {}
  ): Promise<{ notifications: Notification[]; total: number; page: number; limit: number }> {
    try {
      const offset = (page - 1) * limit;
      let whereClause = 'WHERE 1=1';
      const params: any[] = [];

      // Aplicar filtros
      if (filters.userId) {
        whereClause += ' AND (user_id = ? OR user_id IS NULL)';
        params.push(filters.userId);
      }

      if (filters.clientId) {
        whereClause += ' AND (client_id = ? OR client_id IS NULL)';
        params.push(filters.clientId);
      }

      if (filters.type) {
        whereClause += ' AND type = ?';
        params.push(filters.type);
      }

      if (filters.isRead !== undefined) {
        whereClause += ' AND is_read = ?';
        params.push(filters.isRead ? 1 : 0);
      }

      // Filtrar notificações expiradas
      whereClause += ' AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)';

      // Buscar notificações
      const notifications = await this.db.findMany(`
        SELECT 
          notification_id as id,
          type,
          title,
          message,
          user_id as userId,
          client_id as clientId,
          is_read as isRead,
          metadata,
          created_at as createdAt,
          expires_at as expiresAt
        FROM notifications
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
      `, [...params, limit, offset]);

      // Contar total
      const totalResult = await this.db.findFirst(`
        SELECT COUNT(*) as total FROM notifications ${whereClause}
      `, params);

      const total = totalResult?.total || 0;

      // Processar notificações
      const processedNotifications = notifications.map(notification => ({
        ...notification,
        metadata: notification.metadata ? JSON.parse(notification.metadata) : undefined
      }));

      return {
        notifications: processedNotifications,
        total,
        page,
        limit
      };

    } catch (error: any) {
      console.error('❌ Erro ao buscar notificações:', error.message);
      throw new Error('Erro interno do servidor');
    }
  }

  /**
   * Marca notificação como lida
   */
  async markAsRead(notificationId: number, userId: number): Promise<void> {
    try {
      await this.db.executeRaw(`
        UPDATE notifications 
        SET is_read = 1 
        WHERE notification_id = ? AND (user_id = ? OR user_id IS NULL)
      `, [notificationId, userId]);

      // Log de auditoria
      await this.getAuditService().log('notification', 'read', userId, {
        notificationId
      });

    } catch (error: any) {
      console.error('❌ Erro ao marcar notificação como lida:', error.message);
      throw error;
    }
  }

  /**
   * Marca todas as notificações como lidas
   */
  async markAllAsRead(userId: number): Promise<void> {
    try {
      await this.db.executeRaw(`
        UPDATE notifications 
        SET is_read = 1 
        WHERE (user_id = ? OR user_id IS NULL) AND is_read = 0
      `, [userId]);

      // Log de auditoria
      await this.getAuditService().log('notification', 'mark_all_read', userId, {
        message: 'Todas as notificações marcadas como lidas'
      });

    } catch (error: any) {
      console.error('❌ Erro ao marcar todas as notificações como lidas:', error.message);
      throw error;
    }
  }

  /**
   * Remove notificação
   */
  async deleteNotification(notificationId: number, deletedBy: number): Promise<void> {
    try {
      await this.db.executeRaw(`
        DELETE FROM notifications WHERE notification_id = ?
      `, [notificationId]);

      // Log de auditoria
      await this.getAuditService().log('notification', 'deleted', deletedBy, {
        notificationId
      });

    } catch (error: any) {
      console.error('❌ Erro ao remover notificação:', error.message);
      throw error;
    }
  }

  /**
   * Remove notificações expiradas
   */
  async cleanupExpiredNotifications(): Promise<number> {
    try {
      const result = await this.db.executeRaw(`
        DELETE FROM notifications 
        WHERE expires_at IS NOT NULL AND expires_at <= CURRENT_TIMESTAMP
      `);

      return result.changes || 0;

    } catch (error: any) {
      console.error('❌ Erro ao limpar notificações expiradas:', error.message);
      throw error;
    }
  }

  /**
   * Cria notificação de sistema
   */
  async createSystemNotification(
    type: 'info' | 'warning' | 'error' | 'success',
    title: string,
    message: string,
    metadata?: any
  ): Promise<void> {
    try {
      await this.createNotification({
        type,
        title,
        message,
        metadata
      }, 1); // ID do sistema

    } catch (error: any) {
      console.error('❌ Erro ao criar notificação de sistema:', error.message);
    }
  }

  /**
   * Cria notificação para usuário
   */
  async createUserNotification(
    userId: number,
    type: 'info' | 'warning' | 'error' | 'success',
    title: string,
    message: string,
    metadata?: any
  ): Promise<void> {
    try {
      await this.createNotification({
        type,
        title,
        message,
        userId,
        metadata
      }, 1); // ID do sistema

    } catch (error: any) {
      console.error('❌ Erro ao criar notificação para usuário:', error.message);
    }
  }

  /**
   * Cria notificação para cliente
   */
  async createClientNotification(
    clientId: number,
    type: 'info' | 'warning' | 'error' | 'success',
    title: string,
    message: string,
    metadata?: any
  ): Promise<void> {
    try {
      await this.createNotification({
        type,
        title,
        message,
        clientId,
        metadata
      }, 1); // ID do sistema

    } catch (error: any) {
      console.error('❌ Erro ao criar notificação para cliente:', error.message);
    }
  }
}
