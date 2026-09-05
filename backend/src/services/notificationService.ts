/**
 * Notification Service - Smart Signage Pro v3.1
 * Serviço para notificações em tempo real via WebSocket
 */

import { getWebSocketService } from './websocketService';
import { logInfo, logError } from '../utils/loggerHelper';
import { normalizeError } from '../utils/errors';

export interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  userId?: number;
  clientId?: number;
  data?: Record<string, unknown>;
  createdAt: Date;
  read: boolean;
}

export interface NotificationPreferences {
  userId: number;
  email: boolean;
  push: boolean;
  sms: boolean;
  webhook: boolean;
  channels: string[];
}

export class NotificationService {
  /**
   * Enviar notificação em tempo real
   */
  async sendNotification(notification: Omit<Notification, 'id' | 'createdAt' | 'read'>): Promise<Notification> {
    try {
      const notificationId = `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const fullNotification: Notification = {
        ...notification,
        id: notificationId,
        createdAt: new Date(),
        read: false
      };

      // Enviar via WebSocket
      const wsService = getWebSocketService();
      
      if (notification.userId) {
        // Notificação para usuário específico
        wsService.sendToUser(notification.userId, {
          type: 'notification',
          data: fullNotification
        });
      } else if (notification.clientId) {
        // Notificação para todos os usuários do cliente
        wsService.broadcastToClient(notification.clientId, {
          type: 'notification',
          data: fullNotification
        });
      } else {
        // Broadcast global (apenas para admins)
        wsService.broadcast({
          type: 'notification',
          data: fullNotification
        }, ['admin', 'admin_sql']);
      }

      // Salvar notificação no banco
      await this.saveNotification(fullNotification);

      await logInfo('Notificação enviada', {
        notificationId,
        type: notification.type,
        userId: notification.userId,
        clientId: notification.clientId
      });

      return fullNotification;} catch (error: unknown) {
        const e = normalizeError(error);

      await logError('Erro ao enviar notificação', error as Error, {});
      throw e.error;
    }
  }

  /**
   * Obter notificações do usuário
   */
  async getUserNotifications(userId: number, limit: number = 50): Promise<Notification[]> {
    try {
      const { getDatabase } = await import('../config/database');
      const db = getDatabase();

      const result = await db.findMany(`
        SELECT 
          notification_id as id,
          notification_type as type,
          title,
          message,
          user_id as "userId",
          client_id as "clientId",
          data,
          created_at as "createdAt",
          read
        FROM notifications
        WHERE user_id = $1 OR (user_id IS NULL AND client_id IN (
          SELECT client_id FROM users WHERE id = $1
        ))
        ORDER BY created_at DESC
        LIMIT $2
      `, [userId, limit]);

      return result.map((row: Record<string, unknown>) => ({
        id: row.id as string,
        type: row.type as 'info' | 'success' | 'warning' | 'error',
        title: row.title as string,
        message: row.message as string,
        userId: row.userId as number | undefined,
        clientId: row.clientId as number | undefined,
        data: row.data as unknown as Record<string, unknown> | undefined,
        createdAt: row.createdAt as Date,
        read: row.read as boolean
      }));} catch (error: unknown) {
await logError('Erro ao obter notificações', error as Error, { userId });
      return [];
    }
  }

  /**
   * Marcar notificação como lida
   */
  async markAsRead(notificationId: string, userId: number): Promise<void> {
    try {
      const { getDatabase } = await import('../config/database');
      const db = getDatabase();

      await db.executeRaw(`
        UPDATE notifications
        SET read = true, updated_at = CURRENT_TIMESTAMP
        WHERE notification_id = $1 AND user_id = $2
      `, [notificationId, userId]);

      await logInfo('Notificação marcada como lida', {
        notificationId, userId });} catch (error: unknown) {
await logError('Erro ao marcar notificação como lida', error as Error, {
        notificationId,
        userId
      });
    }
  }

  /**
   * Criar notificação (alias para sendNotification)
   */
  async createNotification(notification: Omit<Notification, 'id' | 'createdAt' | 'read'>): Promise<Notification> {
    return this.sendNotification(notification);
  }

  /**
   * Obter notificação por ID
   */
  async getNotificationById(notificationId: string, userId: number): Promise<Notification | null> {
    try {
      const { getDatabase } = await import('../config/database');
      const db = getDatabase();

      const result = await db.findFirst(`
        SELECT 
          notification_id as id,
          notification_type as type,
          title,
          message,
          user_id as "userId",
          client_id as "clientId",
          data,
          created_at as "createdAt",
          read
        FROM notifications
        WHERE notification_id = $1 AND (user_id = $2 OR user_id IS NULL)
      `, [notificationId, userId]);

      if (!result) {
        return null;
      }

      return {
        id: result.id as string,
        type: result.type as 'info' | 'success' | 'warning' | 'error',
        title: result.title as string,
        message: result.message as string,
        userId: result.userId as number | undefined,
        clientId: result.clientId as number | undefined,
        data: result.data as unknown as Record<string, unknown> | undefined,
        createdAt: result.createdAt as Date,
        read: result.read as boolean
      };} catch (error: unknown) {
await logError('Erro ao obter notificação', error as Error, { notificationId, userId });
      return null;
    }
  }

  /**
   * Obter notificações com filtros
   */
  async getNotifications(
    limit: number = 50,
    offset: number = 0,
    filters?: { userId?: number; clientId?: number; read?: boolean; type?: string }
  ): Promise<Notification[]> {
    try {
      const { getDatabase } = await import('../config/database');
      const db = getDatabase();

      let query = `
        SELECT 
          notification_id as id,
          notification_type as type,
          title,
          message,
          user_id as "userId",
          client_id as "clientId",
          data,
          created_at as "createdAt",
          read
        FROM notifications
        WHERE 1=1
      `;
      const params: (string | number | boolean)[] = [];
      let paramIndex = 1;

      if (filters?.userId) {
        query += ` AND (user_id = $${paramIndex} OR user_id IS NULL)`;
        params.push(filters.userId);
        paramIndex++;
      }

      if (filters?.clientId) {
        query += ` AND client_id = $${paramIndex}`;
        params.push(filters.clientId);
        paramIndex++;
      }

      if (filters?.read !== undefined) {
        query += ` AND read = $${paramIndex}`;
        params.push(filters.read);
        paramIndex++;
      }

      if (filters?.type) {
        query += ` AND notification_type = $${paramIndex}`;
        params.push(filters.type);
        paramIndex++;
      }

      query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(limit, offset);

      const result = await db.findMany(query, params);

      return result.map((row: Record<string, unknown>) => ({
        id: row.id as string,
        type: row.type as 'info' | 'success' | 'warning' | 'error',
        title: row.title as string,
        message: row.message as string,
        userId: row.userId as number | undefined,
        clientId: row.clientId as number | undefined,
        data: row.data as unknown as Record<string, unknown> | undefined,
        createdAt: row.createdAt as Date,
        read: row.read as boolean
      }));} catch (error: unknown) {
await logError('Erro ao obter notificações', error as Error, { filters });
      return [];
    }
  }

  /**
   * Deletar notificação
   */
  async deleteNotification(notificationId: string, userId: number): Promise<boolean> {
    try {
      const { getDatabase } = await import('../config/database');
      const db = getDatabase();

      await db.executeRaw(`
        DELETE FROM notifications
        WHERE notification_id = $1 AND user_id = $2
      `, [notificationId, userId]);

      await logInfo('Notificação deletada', { notificationId, userId });
      return true;} catch (error: unknown) {
await logError('Erro ao deletar notificação', error as Error, {
        notificationId,
        userId
      });
      return false;
    }
  }

  /**
   * Salvar notificação no banco
   */
  private async saveNotification(notification: Notification): Promise<void> {
    try {
      const { getDatabase } = await import('../config/database');
      const db = getDatabase();

      await db.executeRaw(`
        INSERT INTO notifications (
          notification_id, notification_type, title, message,
          user_id, client_id, data, created_at, read
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [
        notification.id,
        notification.type,
        notification.title,
        notification.message,
        notification.userId || null,
        notification.clientId || null,
        notification.data ? JSON.stringify(notification.data) : null,
        notification.createdAt,
        notification.read
      ]);} catch (error: unknown) {
await logError('Erro ao salvar notificação', error as Error, {
        notificationId: notification.id
      });
    }
  }
}

// Singleton
let notificationServiceInstance: NotificationService | null = null;

export function getNotificationService(): NotificationService {
  if (!notificationServiceInstance) {
    notificationServiceInstance = new NotificationService();
  }
  return notificationServiceInstance;
}
