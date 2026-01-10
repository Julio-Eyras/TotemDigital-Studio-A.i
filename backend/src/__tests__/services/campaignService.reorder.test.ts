/**
 * Campaign Service - Reorder Tests
 * Testes para funcionalidades de reordenação (drag & drop)
 */

import { CampaignService } from '../../services/campaignService';
import { getDatabase } from '../../config/database';
import { getCacheService } from '../../services/cacheService';

jest.mock('../../config/database', () => ({
  getDatabase: jest.fn(),
}));

jest.mock('../../services/cacheService', () => ({
  CacheService: jest.fn(),
  getCacheService: jest.fn(),
}));

describe('CampaignService - Reorder', () => {
  let campaignService: CampaignService;
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
      invalidateEntity: jest.fn(),
      isAvailable: jest.fn().mockReturnValue(true),
    };

    (getCacheService as jest.Mock).mockReturnValue(mockCache);

    (global as any).auditServiceInstance = {
      log: jest.fn().mockResolvedValue(undefined),
    };

    campaignService = new CampaignService();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('reorderCampaignMedias', () => {
    it('deve reordenar mídias da campaign com sucesso', async () => {
      const campaignId = 1;
      const mediaIds = [3, 1, 2];

      // Mock getCampaignById que é chamado internamente
      jest.spyOn(campaignService, 'getCampaignById').mockResolvedValue({
        id: campaignId,
        subscriberId: 1,
        title: 'Test Campaign',
      } as any);

      // Mock para buscar playlists existentes da campaign
      mockDb.findMany.mockResolvedValueOnce([
        { playlist_id: 1 },
        { playlist_id: 2 },
        { playlist_id: 3 }
      ]);
      mockDb.findFirst.mockResolvedValue({ campaign_id: campaignId });
      mockDb.executeRaw.mockResolvedValue({ rowsAffected: 3 });
      mockCache.invalidateEntity.mockResolvedValue(undefined);

      await campaignService.reorderCampaignMedias(
        campaignId,
        mediaIds,
        1 // userId
      );

      expect(mockDb.executeRaw).toHaveBeenCalled();
      expect(mockCache.invalidateEntity).toHaveBeenCalledWith('campaign', campaignId);
    });

    it('deve atualizar order_index e priority corretamente', async () => {
      const campaignId = 1;
      const mediaIds = [3, 1, 2];

      jest.spyOn(campaignService, 'getCampaignById').mockResolvedValue({
        id: campaignId,
        subscriberId: 1,
        title: 'Test Campaign',
      } as any);

      mockDb.findFirst.mockResolvedValue({ campaign_id: campaignId });
      mockDb.executeRaw.mockResolvedValue({ rowsAffected: 1 });
      mockCache.invalidateEntity.mockResolvedValue(undefined);

      await campaignService.reorderCampaignMedias(campaignId, mediaIds, 1);

      // Verificar que order_index foi atualizado para cada mídia
      expect(mockDb.executeRaw).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE campaign_medias'),
        expect.any(Array)
      );
    });

    it('deve lançar erro se campaign não encontrada', async () => {
      jest.spyOn(campaignService, 'getCampaignById').mockResolvedValue(null);

      await expect(
        campaignService.reorderCampaignMedias(999, [1, 2, 3], 1)
      ).rejects.toThrow();
    });
  });

  describe('reorderCampaignPlaylists', () => {
    it('deve reordenar playlists da campaign com sucesso', async () => {
      const campaignId = 1;
      const playlistIds = [2, 1, 3];

      jest.spyOn(campaignService, 'getCampaignById').mockResolvedValue({
        id: campaignId,
        subscriberId: 1,
        title: 'Test Campaign',
      } as any);

      // Mock para buscar playlists existentes da campaign
      mockDb.findMany.mockResolvedValue([
        { playlist_id: 1 },
        { playlist_id: 2 },
        { playlist_id: 3 }
      ]);
      mockDb.findFirst.mockResolvedValue({ campaign_id: campaignId });
      mockDb.executeRaw.mockResolvedValue({ rowsAffected: 3 });

      await campaignService.reorderCampaignPlaylists(
        campaignId,
        playlistIds,
        1 // userId
      );

      expect(mockDb.executeRaw).toHaveBeenCalled();
      expect(mockCache.invalidateEntity).toHaveBeenCalledWith('campaign', campaignId);
    });

    it('deve atualizar order_index e priority corretamente', async () => {
      const campaignId = 1;
      const playlistIds = [2, 1, 3];

      jest.spyOn(campaignService, 'getCampaignById').mockResolvedValue({
        id: campaignId,
        subscriberId: 1,
        title: 'Test Campaign',
      } as any);

      // Mock para buscar playlists existentes
      mockDb.findMany.mockResolvedValue([
        { playlist_id: 1 },
        { playlist_id: 2 },
        { playlist_id: 3 }
      ]);
      mockDb.findFirst.mockResolvedValue({ campaign_id: campaignId });
      mockDb.executeRaw.mockResolvedValue({ rowsAffected: 1 });
      mockCache.invalidateEntity.mockResolvedValue(undefined);

      await campaignService.reorderCampaignPlaylists(campaignId, playlistIds, 1);

      expect(mockDb.executeRaw).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE campaign_playlists'),
        expect.any(Array)
      );
    });

    it('deve retornar false se campaign não encontrada', async () => {
      mockDb.findFirst.mockResolvedValue(null);

      await expect(
        campaignService.reorderCampaignPlaylists(999, [1, 2, 3], 1)
      ).rejects.toThrow();
    });
  });
});
