/**
 * Notification Service Tests - Smart Signage v2.1
 * Testes unitários para NotificationService
 */

import { NotificationService } from '../../services/notificationService';
import { getDatabase } from '../../config/database';

// Mock do banco de dados
jest.mock('../../config/database', () => ({
  getDatabase: jest.fn(),
}));

describe('NotificationService', () => {
  let notificationService: NotificationService;
  let mockDb: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockDb = {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      executeRaw: jest.fn(),
    };

    (getDatabase as jest.Mock).mockReturnValue(mockDb);

    // Mock do AuditService
    (global as any).auditServiceInstance = {
      log: jest.fn().mockResolvedValue(undefined),
    };

    notificationService = new NotificationService();
  });

  describe('createNotification', () => {
    it('deve criar notificação com dados válidos', async () => {
      const mockNotification = {
        id: 1,
        type: 'info',
        title: 'Notificação Teste',
        message: 'Mensagem de teste',
        userId: 1,
        isRead: false,
        createdAt: '2024-01-01',
      };

      mockDb.executeRaw.mockResolvedValue({ lastInsertRowid: 1 });
      mockDb.findFirst.mockResolvedValue(mockNotification);

      const result = await notificationService.createNotification(
        {
          type: 'info',
          title: 'Notificação Teste',
          message: 'Mensagem de teste',
          userId: 1,
        },
        1
      );

      expect(result).toEqual(mockNotification);
      expect(mockDb.executeRaw).toHaveBeenCalled();
    });

    it('deve enviar email para notificações de alta prioridade', async () => {
      const mockNotification = {
        id: 1,
        type: 'error',
        title: 'Erro Crítico',
        message: 'Erro no sistema',
        userId: 1,
        isRead: false,
      };

      const mockUser = {
        email: 'user@example.com',
      };

      mockDb.executeRaw.mockResolvedValue({ lastInsertRowid: 1 });
      mockDb.findFirst
        .mockResolvedValueOnce(mockUser) // Buscar email do usuário
        .mockResolvedValueOnce(mockNotification); // Buscar notificação criada

      // Mock do emailService
      const mockEmailService = {
        sendNotificationEmail: jest.fn().mockResolvedValue({ success: true }),
      };
      jest.doMock('../../services/emailService', () => ({
        emailService: mockEmailService,
      }));

      await notificationService.createNotification(
        {
          type: 'error',
          title: 'Erro Crítico',
          message: 'Erro no sistema',
          userId: 1,
          priority: 'high',
        },
        1
      );

      expect(mockDb.findFirst).toHaveBeenCalledWith(
        expect.stringContaining('SELECT email FROM users'),
        [1]
      );
    });
  });

  describe('getNotificationById', () => {
    it('deve retornar notificação quando encontrada', async () => {
      const mockNotification = {
        id: 1,
        type: 'info',
        title: 'Notificação Teste',
        message: 'Mensagem',
        isRead: false,
      };

      mockDb.findFirst.mockResolvedValue(mockNotification);

      const result = await notificationService.getNotificationById(1);

      expect(result).toEqual(mockNotification);
    });

    it('deve retornar null quando notificação não encontrada', async () => {
      mockDb.findFirst.mockResolvedValue(null);

      const result = await notificationService.getNotificationById(999);

      expect(result).toBeNull();
    });
  });

  describe('getNotifications', () => {
    it('deve listar notificações com paginação', async () => {
      const mockNotifications = [
        {
          id: 1,
          type: 'info',
          title: 'Notificação 1',
          message: 'Mensagem 1',
          isRead: false,
        },
      ];

      mockDb.findMany.mockResolvedValue(mockNotifications);
      mockDb.findFirst.mockResolvedValue({ total: '1' });

      const result = await notificationService.getNotifications(1, 20);

      expect(result.notifications).toEqual(mockNotifications);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });

    it('deve filtrar notificações por usuário', async () => {
      mockDb.findMany.mockResolvedValue([]);
      mockDb.findFirst.mockResolvedValue({ total: '0' });

      await notificationService.getNotifications(1, 20, { userId: 1 });

      expect(mockDb.findMany).toHaveBeenCalledWith(
        expect.stringContaining('user_id ='),
        expect.arrayContaining([1])
      );
    });
  });

  describe('markAsRead', () => {
    it('deve marcar notificação como lida', async () => {
      mockDb.executeRaw.mockResolvedValue({ rows: [] });

      await notificationService.markAsRead(1, 1);

      expect(mockDb.executeRaw).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE notifications'),
        expect.arrayContaining([1, 1])
      );
    });
  });

  describe('deleteNotification', () => {
    it('deve deletar notificação', async () => {
      mockDb.executeRaw.mockResolvedValue({ rows: [] });

      await notificationService.deleteNotification(1, 1);

      expect(mockDb.executeRaw).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM notifications'),
        expect.arrayContaining([1, 1])
      );
    });
  });
});

