/**
 * Player Debug Service Tests - Smart Signage v2.1
 */

import { PlayerDebugService } from '../../services/playerDebugService';
import { getDatabase } from '../../config/database';

jest.mock('../../config/database', () => ({
  getDatabase: jest.fn(),
}));

describe('PlayerDebugService', () => {
  let service: PlayerDebugService;
  let mockDb: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockDb = {
      executeRaw: jest.fn().mockResolvedValue(undefined),
      findMany: jest.fn().mockResolvedValue([]),
    };

    (getDatabase as jest.Mock).mockReturnValue(mockDb);
    service = new PlayerDebugService();
  });

  describe('logTransaction', () => {
    it('deve criar tabela caso não exista e inserir transação', async () => {
      await service.logTransaction({
        transactionId: 'tx-1',
        uin: 'ABC123',
        action: 'validate',
        status: 'success',
      });

      expect(mockDb.executeRaw).toHaveBeenCalledWith(expect.stringContaining('CREATE TABLE IF NOT EXISTS player_debug_transactions'));
      expect(mockDb.executeRaw).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO player_debug_transactions'), expect.any(Array));
    });
  });

  describe('getTransactions', () => {
    it('deve retornar transações convertendo JSON corretamente', async () => {
      mockDb.findMany.mockResolvedValue([
        {
          transaction_id: 'tx-1',
          timestamp: new Date('2024-01-01T10:00:00Z'),
          uin: 'ABC123',
          action: 'validate',
          status: 'success',
          request_headers: JSON.stringify({ 'Content-Type': 'application/json' }),
          request_body: JSON.stringify({ foo: 'bar' }),
          response_body: JSON.stringify({ ok: true }),
          metadata: JSON.stringify({ source: 'test' }),
        },
      ]);

      const result = await service.getTransactions({ uin: 'ABC123', limit: 10 });

      expect(mockDb.executeRaw).toHaveBeenCalledWith(expect.stringContaining('CREATE TABLE IF NOT EXISTS player_debug_transactions'));
      expect(mockDb.findMany).toHaveBeenCalled();
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        transactionId: 'tx-1',
        uin: 'ABC123',
        action: 'validate',
        status: 'success',
        requestHeaders: { 'Content-Type': 'application/json' },
        requestBody: { foo: 'bar' },
        responseBody: { ok: true },
        metadata: { source: 'test' },
      });
    });

    it('deve aplicar filtros na busca', async () => {
      await service.getTransactions({ status: 'error', startDate: new Date('2024-01-01') });

      expect(mockDb.findMany).toHaveBeenCalledWith(expect.stringContaining('status = ?'), expect.arrayContaining(['error']));
    });
  });
});
