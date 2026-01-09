/**
 * Subscriber Service - Cache Invalidation Tests
 * Testes para validação de invalidação de cache
 */

import { SubscriberService } from '../../services/subscriberService';
import { getDatabase } from '../../config/database';
import { CacheService } from '../../services/cacheService';

jest.mock('../../config/database', () => ({
  getDatabase: jest.fn(),
}));

jest.mock('../../services/cacheService', () => ({
  CacheService: jest.fn(),
}));

describe('SubscriberService - Cache Invalidation', () => {
  let subscriberService: SubscriberService;
  let mockDb: any;
  let mockCache: any;

  beforeEach(() => {
    mockDb = {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      executeRaw: jest.fn(),
    };

    (getDatabase as jest.Mock).mockReturnValue(mockDb);

    mockCache = {
      get: jest.fn(),
      set: jest.fn(),
      delete: jest.fn(),
      deletePattern: jest.fn(),
      getOrSet: jest.fn(),
      invalidateEntity: jest.fn(),
      isAvailable: jest.fn().mockReturnValue(true),
    };

    (CacheService as jest.Mock).mockImplementation(() => mockCache);

    subscriberService = new SubscriberService();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('invalidateSubscriberCache', () => {
    it('deve invalidar cache de limites quando subscriber é atualizado', async () => {
      await subscriberService.invalidateSubscriberCache(1);

      expect(mockCache.invalidateEntity).toHaveBeenCalledWith('subscriber', 1);
    });

    it('deve invalidar cache de recursos quando subscriber é atualizado', async () => {
      await subscriberService.invalidateSubscriberCache(1);

      // Deve invalidar cache de contagem de recursos
      expect(mockCache.deletePattern).toHaveBeenCalledWith(
        expect.stringContaining('subscriber:1')
      );
    });
  });

  describe('Cache em getMaxLimits', () => {
    it('deve usar cache com TTL de 5 minutos', async () => {
      const mockLimits = {
        medias: 100,
        playlists: 50,
        campaigns: 20,
        storage_gb: 10,
      };

      mockCache.getOrSet.mockResolvedValue(mockLimits);

      await subscriberService.getMaxLimits(1);

      expect(mockCache.getOrSet).toHaveBeenCalledWith(
        expect.stringContaining('subscriber:1:limits'),
        expect.any(Function),
        300 // 5 minutos em segundos
      );
    });
  });

  describe('Cache em getCurrentResourceCount', () => {
    it('deve usar cache com TTL de 1 minuto', async () => {
      mockCache.getOrSet.mockResolvedValue({ media_count: 10 });

      await subscriberService.getCurrentResourceCount(1, 'media');

      expect(mockCache.getOrSet).toHaveBeenCalledWith(
        expect.stringContaining('subscriber:1:resources'),
        expect.any(Function),
        60 // 1 minuto em segundos
      );
    });
  });

  describe('Cache em getCurrentStorage', () => {
    it('deve usar cache com TTL de 1 minuto', async () => {
      mockCache.getOrSet.mockResolvedValue(5.0);

      await subscriberService.getCurrentStorage(1);

      expect(mockCache.getOrSet).toHaveBeenCalledWith(
        expect.stringContaining('subscriber:1:storage'),
        expect.any(Function),
        60 // 1 minuto em segundos
      );
    });
  });

  describe('Cache invalidation em operações CRUD', () => {
    it('deve invalidar cache ao criar subscriber', async () => {
      mockDb.executeRaw.mockResolvedValue({ rows: [{ subscriber_id: 1 }] });
      mockDb.findFirst.mockResolvedValue({
        subscriber_id: 1,
        name: 'Test',
      });

      await subscriberService.createSubscriber({
        name: 'Test',
        contract_id: 1,
      });

      // Cache deve ser invalidado após criação
      expect(mockCache.invalidateEntity).toHaveBeenCalled();
    });

    it('deve invalidar cache ao atualizar subscriber', async () => {
      mockDb.executeRaw.mockResolvedValue({ rowsAffected: 1 });
      mockDb.findFirst.mockResolvedValue({
        subscriber_id: 1,
        name: 'Updated',
      });

      await subscriberService.updateSubscriber(1, {
        name: 'Updated',
      });

      // Cache deve ser invalidado após atualização
      expect(mockCache.invalidateEntity).toHaveBeenCalled();
    });

    it('deve invalidar cache ao deletar subscriber', async () => {
      mockDb.executeRaw.mockResolvedValue({ rowsAffected: 1 });

      await subscriberService.deleteSubscriber(1);

      // Cache deve ser invalidado após exclusão
      expect(mockCache.invalidateEntity).toHaveBeenCalled();
    });
  });
});
