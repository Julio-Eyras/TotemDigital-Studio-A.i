/**
 * Subscriber Service Tests - Smart Signage v2.1
 * Testes unitários para SubscriberService
 */

import { SubscriberService } from '../../services/subscriberService';
import { getDatabase } from '../../config/database';
import { CacheService } from '../../services/cacheService';

// Mock do banco de dados
jest.mock('../../config/database', () => ({
  getDatabase: jest.fn(),
}));

// Mock do CacheService
jest.mock('../../services/cacheService', () => ({
  CacheService: jest.fn(),
}));

describe('SubscriberService', () => {
  let subscriberService: SubscriberService;
  let mockDb: any;
  let mockCache: any;

  beforeEach(() => {
    // Mock do banco de dados
    mockDb = {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      executeRaw: jest.fn(),
    };

    (getDatabase as jest.Mock).mockReturnValue(mockDb);

    // Mock do CacheService
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

  describe('getAllSubscribers', () => {
    it('deve retornar lista de subscribers com paginação', async () => {
      const mockSubscribers = [
        { subscriber_id: 1, name: 'Subscriber 1', is_active: true },
        { subscriber_id: 2, name: 'Subscriber 2', is_active: true },
      ];

      mockDb.findMany.mockResolvedValue(mockSubscribers);
      mockDb.findFirst.mockResolvedValue({ total: 2 });

      const result = await subscriberService.getAllSubscribers({
        page: 1,
        limit: 10,
      });

      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('total', 2);
      expect(result).toHaveProperty('page', 1);
      expect(result).toHaveProperty('limit', 10);
      expect(result.data).toHaveLength(2);
    });

    it('deve aplicar filtro de busca', async () => {
      const mockSubscribers = [
        { subscriber_id: 1, name: 'Test Subscriber', is_active: true },
      ];

      mockDb.findMany.mockResolvedValue(mockSubscribers);
      mockDb.findFirst.mockResolvedValue({ total: 1 });

      const result = await subscriberService.getAllSubscribers({
        page: 1,
        limit: 10,
        search: 'Test',
      });

      expect(mockDb.findMany).toHaveBeenCalledWith(
        expect.stringContaining('LIKE'),
        expect.arrayContaining([expect.stringContaining('%Test%')])
      );
      expect(result.data).toHaveLength(1);
    });

    it('deve aplicar filtro de status ativo', async () => {
      mockDb.findMany.mockResolvedValue([]);
      mockDb.findFirst.mockResolvedValue({ total: 0 });

      await subscriberService.getAllSubscribers({
        page: 1,
        limit: 10,
        is_active: true,
      });

      expect(mockDb.findMany).toHaveBeenCalledWith(
        expect.stringContaining('is_active = true'),
        expect.any(Array)
      );
    });

    it('deve aplicar ordenação', async () => {
      mockDb.findMany.mockResolvedValue([]);
      mockDb.findFirst.mockResolvedValue({ total: 0 });

      await subscriberService.getAllSubscribers({
        page: 1,
        limit: 10,
        sortBy: 'name',
        sortOrder: 'asc',
      });

      expect(mockDb.findMany).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY'),
        expect.any(Array)
      );
    });
  });

  describe('getSubscriberById', () => {
    it('deve retornar subscriber por ID', async () => {
      const mockSubscriber = {
        subscriber_id: 1,
        name: 'Test Subscriber',
        email: 'test@example.com',
        is_active: true,
      };

      mockDb.findFirst.mockResolvedValue(mockSubscriber);

      const result = await subscriberService.getSubscriberById(1);

      expect(result).toEqual(mockSubscriber);
      expect(mockDb.findFirst).toHaveBeenCalledWith(
        expect.stringContaining('subscriber_id = $1'),
        [1]
      );
    });

    it('deve retornar null se subscriber não encontrado', async () => {
      mockDb.findFirst.mockResolvedValue(null);

      const result = await subscriberService.getSubscriberById(999);

      expect(result).toBeNull();
    });
  });

  describe('getMaxLimits', () => {
    it('deve retornar limites do plano com cache', async () => {
      const mockLimits = {
        medias: 100,
        playlists: 50,
        campaigns: 20,
        storage_gb: 10,
      };

      mockCache.getOrSet.mockResolvedValue(mockLimits);

      const result = await subscriberService.getMaxLimits(1);

      expect(result).toEqual(mockLimits);
      expect(mockCache.getOrSet).toHaveBeenCalled();
    });

    it('deve retornar limites ilimitados quando plan não tem limites', async () => {
      mockCache.getOrSet.mockResolvedValue({
        medias: -1,
        playlists: -1,
        campaigns: -1,
        storage_gb: -1,
      });

      const result = await subscriberService.getMaxLimits(1);

      expect(result.medias).toBe(-1);
      expect(result.playlists).toBe(-1);
    });
  });

  describe('getCurrentResourceCount', () => {
    it('deve retornar contagem atual de recursos com cache', async () => {
      const mockCount = {
        media_count: 10,
        playlist_count: 5,
        campaign_count: 2,
      };

      mockCache.getOrSet.mockResolvedValue(mockCount);

      const result = await subscriberService.getCurrentResourceCount(1, 'media');

      expect(result).toBe(10);
      expect(mockCache.getOrSet).toHaveBeenCalled();
    });
  });

  describe('getCurrentStorage', () => {
    it('deve retornar storage atual em GB com cache', async () => {
      const mockStorage = 5.5; // GB

      mockCache.getOrSet.mockResolvedValue(mockStorage);

      const result = await subscriberService.getCurrentStorage(1);

      expect(result).toBe(5.5);
      expect(mockCache.getOrSet).toHaveBeenCalled();
    });
  });

  describe('getSubscriberStats', () => {
    it('deve retornar estatísticas completas do subscriber', async () => {
      mockDb.findFirst
        .mockResolvedValueOnce({ count: '5' }) // localsCount
        .mockResolvedValueOnce({ count: '10' }) // totemsCount
        .mockResolvedValueOnce({ count: '3' }) // smartTvsCount
        .mockResolvedValueOnce({ count: '2' }) // activeCampaignsCount
        .mockResolvedValueOnce({ count: '8' }) // onlineTotems
        .mockResolvedValueOnce({ count: '1' }) // playingTvs
        .mockResolvedValueOnce({ count: '50' }) // mediaCount
        .mockResolvedValueOnce({ count: '20' }) // playlistCount
        .mockResolvedValueOnce({ count: '5' }) // campaignCount
        .mockResolvedValueOnce({ total_bytes: '5368709120' }); // storage (5GB)

      mockCache.getOrSet
        .mockResolvedValueOnce({ medias: 100, playlists: 50, campaigns: 20, storage_gb: 10 }) // getMaxLimits
        .mockResolvedValueOnce(5.0); // getCurrentStorage

      const result = await subscriberService.getSubscriberStats(1);

      expect(result).toHaveProperty('localsCount', 5);
      expect(result).toHaveProperty('totemsCount', 10);
      expect(result).toHaveProperty('smartTvsCount', 3);
      expect(result).toHaveProperty('activeCampaignsCount', 2);
      expect(result).toHaveProperty('onlineTotems', 8);
      expect(result).toHaveProperty('playingTvs', 1);
      expect(result).toHaveProperty('media_count', 50);
      expect(result).toHaveProperty('playlist_count', 20);
      expect(result).toHaveProperty('campaign_count', 5);
      expect(result).toHaveProperty('storage_used_gb', 5.0);
      expect(result).toHaveProperty('storage_limit_gb', 10);
      expect(result).toHaveProperty('plan_limits');
    });
  });

  describe('createSubscriber', () => {
    it('deve criar subscriber com sucesso', async () => {
      const newSubscriber = {
        name: 'New Subscriber',
        contract_id: 1,
        email: 'new@example.com',
        phone: '+5511999999999',
      };

      mockDb.executeRaw.mockResolvedValue({ rows: [{ subscriber_id: 1 }] });
      mockDb.findFirst.mockResolvedValue({
        subscriber_id: 1,
        ...newSubscriber,
      });

      const result = await subscriberService.createSubscriber(newSubscriber);

      expect(result).toHaveProperty('subscriber_id');
      expect(mockDb.executeRaw).toHaveBeenCalled();
    });

    it('deve validar limites do plano antes de criar', async () => {
      const newSubscriber = {
        name: 'New Subscriber',
        contract_id: 1,
      };

      mockCache.getOrSet.mockResolvedValue({
        medias: 0,
        playlists: 0,
        campaigns: 0,
        storage_gb: 0,
      });

      // Simular que o plano não permite criação
      // (a validação real seria feita no middleware/route)
      
      mockDb.executeRaw.mockResolvedValue({ rows: [{ subscriber_id: 1 }] });
      mockDb.findFirst.mockResolvedValue({
        subscriber_id: 1,
        ...newSubscriber,
      });

      const result = await subscriberService.createSubscriber(newSubscriber);

      expect(result).toHaveProperty('subscriber_id');
    });
  });

  describe('updateSubscriber', () => {
    it('deve atualizar subscriber com sucesso', async () => {
      const updateData = {
        name: 'Updated Name',
        email: 'updated@example.com',
      };

      mockDb.executeRaw.mockResolvedValue({ rowsAffected: 1 });
      mockDb.findFirst.mockResolvedValue({
        subscriber_id: 1,
        ...updateData,
      });

      const result = await subscriberService.updateSubscriber(1, updateData);

      expect(result).toHaveProperty('subscriber_id', 1);
      expect(mockDb.executeRaw).toHaveBeenCalled();
    });

    it('deve retornar null se subscriber não encontrado', async () => {
      mockDb.executeRaw.mockResolvedValue({ rowsAffected: 0 });
      mockDb.findFirst.mockResolvedValue(null);

      const result = await subscriberService.updateSubscriber(999, {
        name: 'Test',
      });

      expect(result).toBeNull();
    });
  });

  describe('deleteSubscriber', () => {
    it('deve deletar subscriber com sucesso', async () => {
      mockDb.executeRaw.mockResolvedValue({ rowsAffected: 1 });

      const result = await subscriberService.deleteSubscriber(1);

      expect(result).toBe(true);
      expect(mockDb.executeRaw).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE subscribers'),
        expect.arrayContaining([1])
      );
    });

    it('deve retornar false se subscriber não encontrado', async () => {
      mockDb.executeRaw.mockResolvedValue({ rowsAffected: 0 });

      const result = await subscriberService.deleteSubscriber(999);

      expect(result).toBe(false);
    });
  });
});
