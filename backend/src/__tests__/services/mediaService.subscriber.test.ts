/**
 * Media Service - Subscriber Tests
 * Testes específicos para funcionalidades relacionadas a subscriber
 */

import { MediaService } from '../../services/mediaService';
import { getDatabase } from '../../config/database';
import { StorageService } from '../../services/storageService';
import { CacheService } from '../../services/cacheService';

jest.mock('../../config/database', () => ({
  getDatabase: jest.fn(),
}));

jest.mock('../../services/storageService', () => ({
  StorageService: jest.fn(),
}));

jest.mock('../../services/cacheService', () => ({
  CacheService: jest.fn(),
}));

describe('MediaService - Subscriber', () => {
  let mediaService: MediaService;
  let mockDb: any;
  let mockStorage: any;
  let mockCache: any;

  beforeEach(() => {
    mockDb = {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      executeRaw: jest.fn(),
    };

    (getDatabase as jest.Mock).mockReturnValue(mockDb);

    mockStorage = {
      getSubscriberStorageUsage: jest.fn().mockResolvedValue(0),
      checkSubscriberQuota: jest.fn().mockResolvedValue({
        allowed: true,
        currentUsage: 0,
        quota: 5368709120,
        available: 5368709120,
      }),
    };

    mockCache = {
      invalidateEntity: jest.fn(),
      isAvailable: jest.fn().mockReturnValue(true),
    };

    (StorageService as jest.Mock).mockImplementation(() => mockStorage);
    (CacheService as jest.Mock).mockImplementation(() => mockCache);

    mediaService = new MediaService();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getMedia - Filtros por subscriberId', () => {
    it('deve filtrar mídias por subscriberId', async () => {
      const mockMedia = {
        media: [
          { media_id: 1, title: 'Media 1', subscriber_id: 1 },
        ],
        total: 1,
        page: 1,
        limit: 20,
      };

      mockDb.findMany.mockResolvedValue(mockMedia.media);
      mockDb.findFirst.mockResolvedValue({ total: 1 });

      const result = await mediaService.getMedia(1, 20, {
        subscriberId: 1,
      });

      expect(result.media).toHaveLength(1);
      expect(mockDb.findMany).toHaveBeenCalledWith(
        expect.stringContaining('subscriber_id ='),
        expect.arrayContaining([1])
      );
    });

    it('deve aplicar busca por nome, descrição e file_name', async () => {
      mockDb.findMany.mockResolvedValue([]);
      mockDb.findFirst.mockResolvedValue({ total: 0 });

      await mediaService.getMedia(1, 20, {
        search: 'test',
      });

      expect(mockDb.findMany).toHaveBeenCalledWith(
        expect.stringContaining('ILIKE'),
        expect.arrayContaining([expect.stringContaining('%test%')])
      );
    });

    it('deve aplicar filtros de data', async () => {
      mockDb.findMany.mockResolvedValue([]);
      mockDb.findFirst.mockResolvedValue({ total: 0 });

      await mediaService.getMedia(1, 20, {
        createdFrom: '2026-01-01',
        createdTo: '2026-01-31',
      });

      expect(mockDb.findMany).toHaveBeenCalledWith(
        expect.stringContaining('created_at >='),
        expect.arrayContaining([expect.any(String)])
      );
    });
  });

  describe('getMediaByTags - subscriberId', () => {
    it('deve filtrar mídias por tags e subscriberId', async () => {
      const mockMedia = [
        { media_id: 1, title: 'Media 1', subscriber_id: 1 },
      ];

      mockDb.findMany.mockResolvedValue(mockMedia);

      const result = await mediaService.getMediaByTags(['tag1', 'tag2'], 1);

      expect(result).toHaveLength(1);
      expect(mockDb.findMany).toHaveBeenCalledWith(
        expect.stringContaining('subscriber_id ='),
        expect.arrayContaining([1])
      );
    });
  });

  describe('Cache Invalidation', () => {
    it('deve invalidar cache ao criar mídia', async () => {
      mockDb.findFirst.mockResolvedValue({ subscriber_id: 1 });
      mockDb.executeRaw.mockResolvedValue({ rows: [{ media_id: 1 }] });
      mockDb.findMany.mockResolvedValue([{ media_id: 1 }]);

      await mediaService.createMedia({
        subscriberId: 1,
        title: 'Test',
        mediaType: 'image',
      } as any, {} as any);

      expect(mockCache.invalidateEntity).toHaveBeenCalledWith('media', 1);
    });

    it('deve invalidar cache ao atualizar mídia', async () => {
      mockDb.findFirst.mockResolvedValue({ media_id: 1, subscriber_id: 1 });
      mockDb.executeRaw.mockResolvedValue({ rowsAffected: 1 });

      await mediaService.updateMedia(1, {
        title: 'Updated',
      } as any);

      expect(mockCache.invalidateEntity).toHaveBeenCalledWith('media', 1);
    });

    it('deve invalidar cache ao deletar mídia', async () => {
      mockDb.findFirst.mockResolvedValue({ media_id: 1, subscriber_id: 1 });
      mockDb.executeRaw.mockResolvedValue({ rowsAffected: 1 });

      await mediaService.deleteMedia(1);

      expect(mockCache.invalidateEntity).toHaveBeenCalledWith('media', 1);
    });
  });
});
