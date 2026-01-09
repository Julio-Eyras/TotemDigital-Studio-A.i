/**
 * Subscriber Service - Plan Limits Validation Tests
 * Testes específicos para validação de limites de planos
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

describe('SubscriberService - Plan Limits Validation', () => {
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

  describe('validatePlanLimits', () => {
    it('deve permitir criação quando há limite disponível', async () => {
      mockCache.getOrSet
        .mockResolvedValueOnce({ medias: 100, playlists: 50, campaigns: 20 }) // getMaxLimits
        .mockResolvedValueOnce({ media_count: 50, playlist_count: 25, campaign_count: 10 }); // getCurrentResourceCount

      const result = await subscriberService.validatePlanLimits(1, 'media');

      expect(result).toBe(true);
    });

    it('deve rejeitar criação quando limite de mídias excedido', async () => {
      mockCache.getOrSet
        .mockResolvedValueOnce({ medias: 100, playlists: 50, campaigns: 20 }) // getMaxLimits
        .mockResolvedValueOnce({ media_count: 100, playlist_count: 25, campaign_count: 10 }); // getCurrentResourceCount

      await expect(
        subscriberService.validatePlanLimits(1, 'media')
      ).rejects.toThrow();
    });

    it('deve permitir criação quando limite é ilimitado (-1)', async () => {
      mockCache.getOrSet
        .mockResolvedValueOnce({ medias: -1, playlists: -1, campaigns: -1 }) // getMaxLimits
        .mockResolvedValueOnce({ media_count: 1000, playlist_count: 500, campaign_count: 200 }); // getCurrentResourceCount

      const result = await subscriberService.validatePlanLimits(1, 'media');

      expect(result).toBe(true);
    });

    it('deve validar limite de playlists', async () => {
      mockCache.getOrSet
        .mockResolvedValueOnce({ medias: 100, playlists: 50, campaigns: 20 }) // getMaxLimits
        .mockResolvedValueOnce({ media_count: 50, playlist_count: 50, campaign_count: 10 }); // getCurrentResourceCount

      await expect(
        subscriberService.validatePlanLimits(1, 'playlist')
      ).rejects.toThrow();
    });

    it('deve validar limite de campanhas', async () => {
      mockCache.getOrSet
        .mockResolvedValueOnce({ medias: 100, playlists: 50, campaigns: 20 }) // getMaxLimits
        .mockResolvedValueOnce({ media_count: 50, playlist_count: 25, campaign_count: 20 }); // getCurrentResourceCount

      await expect(
        subscriberService.validatePlanLimits(1, 'campaign')
      ).rejects.toThrow();
    });
  });

  describe('validateStorageLimit', () => {
    it('deve permitir upload quando há storage disponível', async () => {
      mockCache.getOrSet
        .mockResolvedValueOnce({ storage_gb: 10 }) // getMaxLimits
        .mockResolvedValueOnce(5.0); // getCurrentStorage (5GB usado)

      const fileSizeBytes = 1024 * 1024 * 1024; // 1GB

      await expect(
        subscriberService.validateStorageLimit(1, fileSizeBytes)
      ).resolves.not.toThrow();
    });

    it('deve rejeitar upload quando storage excedido', async () => {
      mockCache.getOrSet
        .mockResolvedValueOnce({ storage_gb: 10 }) // getMaxLimits
        .mockResolvedValueOnce(9.5); // getCurrentStorage (9.5GB usado)

      const fileSizeBytes = 1024 * 1024 * 1024; // 1GB (excederia o limite)

      await expect(
        subscriberService.validateStorageLimit(1, fileSizeBytes)
      ).rejects.toThrow();
    });

    it('deve permitir upload quando storage é ilimitado (-1)', async () => {
      mockCache.getOrSet
        .mockResolvedValueOnce({ storage_gb: -1 }) // getMaxLimits
        .mockResolvedValueOnce(100.0); // getCurrentStorage (100GB usado)

      const fileSizeBytes = 10 * 1024 * 1024 * 1024; // 10GB

      await expect(
        subscriberService.validateStorageLimit(1, fileSizeBytes)
      ).resolves.not.toThrow();
    });
  });

  describe('getMaxLimits - Cache', () => {
    it('deve usar cache para limites do plano', async () => {
      const mockLimits = {
        medias: 100,
        playlists: 50,
        campaigns: 20,
        storage_gb: 10,
      };

      mockCache.getOrSet.mockResolvedValue(mockLimits);

      const result1 = await subscriberService.getMaxLimits(1);
      const result2 = await subscriberService.getMaxLimits(1);

      expect(result1).toEqual(mockLimits);
      expect(result2).toEqual(mockLimits);
      // Cache deve ser usado (getOrSet chamado apenas uma vez por chave)
      expect(mockCache.getOrSet).toHaveBeenCalled();
    });

    it('deve invalidar cache quando subscriber é atualizado', async () => {
      await subscriberService.invalidateSubscriberCache(1);

      expect(mockCache.invalidateEntity).toHaveBeenCalledWith('subscriber', 1);
    });
  });
});
