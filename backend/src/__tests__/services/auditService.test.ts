/**
 * Audit Service Tests - Smart Signage v2.1
 */

import { AuditService } from '../../services/auditService';
import { getDatabase } from '../../config/database';

jest.mock('../../config/database', () => ({
  getDatabase: jest.fn(),
}));

describe('AuditService', () => {
  let service: AuditService;
  let mockDb: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockDb = {
      executeRaw: jest.fn().mockResolvedValue(undefined),
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue(null),
    };

    (getDatabase as jest.Mock).mockReturnValue(mockDb);
    service = new AuditService();
  });

  describe('log', () => {
    it('deve registrar log de auditoria sem lançar erro', async () => {
      await service.log('campaign', 'created', 10, { entityId: 5, info: 'teste' });

      expect(mockDb.executeRaw).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO audit_logs'),
        [10, 'created', 'campaign', 5, JSON.stringify({ entityId: 5, info: 'teste' })],
      );
    });
  });

  describe('getAuditLogs', () => {
    it('deve retornar logs convertendo metadata', async () => {
      mockDb.findMany.mockResolvedValue([
        {
          id: 1,
          userId: 10,
          action: 'created',
          entity: 'campaign',
          entityId: 5,
          metadata: JSON.stringify({ foo: 'bar' }),
          timestamp: '2024-01-01T10:00:00Z',
        },
      ]);

      const logs = await service.getAuditLogs({ userId: 10, limit: 5 });

      expect(mockDb.findMany).toHaveBeenCalledWith(
        expect.stringContaining('WHERE 1=1'),
        expect.arrayContaining([10, 5, 0]),
      );

      expect(logs).toHaveLength(1);
      expect(logs[0]).toMatchObject({
        id: 1,
        userId: 10,
        entity: 'campaign',
        metadata: { foo: 'bar' },
      });
    });
  });

  describe('getAuditLogById', () => {
    it('deve retornar log específico', async () => {
      mockDb.findFirst.mockResolvedValue({
        id: 1,
        userId: 10,
        action: 'updated',
        entity: 'campaign',
        entityId: 5,
        metadata: JSON.stringify({ foo: 'bar' }),
        timestamp: '2024-01-02T12:00:00Z',
      });

      const log = await service.getAuditLogById(1);

      expect(mockDb.findFirst).toHaveBeenCalledWith(expect.stringContaining('WHERE al.id = ?'), [1]);
      expect(log).toMatchObject({ id: 1, metadata: { foo: 'bar' } });
    });
  });

  describe('getUserAuditLogs', () => {
    it('deve retornar logs de usuário com limite', async () => {
      mockDb.findMany.mockResolvedValueOnce([
        {
          id: 2,
          userId: 20,
          action: 'login',
          entity: 'auth',
          metadata: null,
          timestamp: '2024-01-03T08:00:00Z',
        },
      ]);

      const logs = await service.getUserAuditLogs(20, 10);

      expect(mockDb.findMany).toHaveBeenCalledWith(
        expect.stringContaining('WHERE al.user_id = ?'),
        [20, 10],
      );
      expect(logs).toHaveLength(1);
      expect(logs[0]).toMatchObject({ id: 2, action: 'login' });
    });
  });
});
