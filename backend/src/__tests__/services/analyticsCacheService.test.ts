/**
 * AnalyticsCacheService Tests
 * Testes unitários para o serviço de cache de analytics
 */

import { AnalyticsCacheService } from '../../services/analyticsCacheService';
import { getRedisClient } from '../../config/redis';

// Mock do Redis
jest.mock('../../config/redis', () => ({
  getRedisClient: jest.fn()
}));

describe('AnalyticsCacheService', () => {
  let cacheService: AnalyticsCacheService;
  let mockRedis: any;

  beforeEach(() => {
    mockRedis = {
      get: jest.fn(),
      setex: jest.fn(),
      del: jest.fn(),
      keys: jest.fn()
    };
    (getRedisClient as jest.Mock).mockReturnValue(mockRedis);
    cacheService = new AnalyticsCacheService();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('get', () => {
    it('deve retornar valor do cache se existir', async () => {
      const cachedValue = { data: 'test' };
      mockRedis.get.mockResolvedValue(JSON.stringify(cachedValue));

      const result = await cacheService.get('test-key');

      expect(result).toEqual(cachedValue);
      expect(mockRedis.get).toHaveBeenCalledWith('test-key');
    });

    it('deve retornar null se chave não existe', async () => {
      mockRedis.get.mockResolvedValue(null);

      const result = await cacheService.get('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('set', () => {
    it('deve armazenar valor no cache', async () => {
      const value = { data: 'test' };
      mockRedis.setex.mockResolvedValue('OK');

      await cacheService.set('test-key', value, 300);

      expect(mockRedis.setex).toHaveBeenCalledWith(
        'test-key',
        300,
        JSON.stringify(value)
      );
    });
  });

  describe('delete', () => {
    it('deve remover chave do cache', async () => {
      mockRedis.del.mockResolvedValue(1);

      await cacheService.delete('test-key');

      expect(mockRedis.del).toHaveBeenCalledWith('test-key');
    });
  });

  describe('getOverviewKey', () => {
    it('deve gerar chave correta para overview', () => {
      const key = cacheService.getOverviewKey(1, '2025-01-01', '2025-01-31');
      expect(key).toBe('analytics:overview:client:1:start:2025-01-01:end:2025-01-31');
    });

    it('deve gerar chave sem parâmetros opcionais', () => {
      const key = cacheService.getOverviewKey();
      expect(key).toBe('analytics:overview');
    });
  });

  describe('invalidateClientCache', () => {
    it('deve invalidar cache de um cliente', async () => {
      mockRedis.keys.mockResolvedValue([
        'analytics:overview:client:1',
        'analytics:totems:client:1'
      ]);
      mockRedis.del.mockResolvedValue(2);

      await cacheService.invalidateClientCache(1);

      expect(mockRedis.keys).toHaveBeenCalledWith('analytics:*:client:1*');
      expect(mockRedis.del).toHaveBeenCalled();
    });
  });
});

