/**
 * Campaign Service - Reorder Tests
 * Testes para funcionalidades de reordenação (drag & drop)
 */

import { CampaignService } from '../../services/campaignService';
import { getDatabase } from '../../config/database';
import { CacheService } from '../../services/cacheService';

jest.mock('../../config/database', () => ({
  getDatabase: jest.fn(),
}));

jest.mock('../../services/cacheService', () => ({
  CacheService: jest.fn(),
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

    (CacheService as jest.Mock).mockImplementation(() => mockCache);

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

      mockDb.findFirst.mockResolvedValue({ campaign_id: campaignId });
      mockDb.executeRaw.mockResolvedValue({ rowsAffected: 3 });

      const result = await campaignService.reorderCampaignMedias(
        campaignId,
        mediaIds
      );

      expect(result).toBe(true);
      expect(mockDb.executeRaw).toHaveBeenCalledTimes(3); // Uma vez para cada mídia
      expect(mockCache.invalidateEntity).toHaveBeenCalledWith('campaign', campaignId);
    });

    it('deve atualizar order_index e priority corretamente', async () => {
      const campaignId = 1;
      const mediaIds = [3, 1, 2];

      mockDb.findFirst.mockResolvedValue({ campaign_id: campaignId });
      mockDb.executeRaw.mockResolvedValue({ rowsAffected: 1 });

      await campaignService.reorderCampaignMedias(campaignId, mediaIds);

      // Verificar que order_index foi atualizado para cada mídia
      expect(mockDb.executeRaw).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE campaign_medias'),
        expect.arrayContaining([expect.any(Number), expect.any(Number)])
      );
    });

    it('deve retornar false se campaign não encontrada', async () => {
      mockDb.findFirst.mockResolvedValue(null);

      const result = await campaignService.reorderCampaignMedias(999, [1, 2, 3]);

      expect(result).toBe(false);
      expect(mockDb.executeRaw).not.toHaveBeenCalled();
    });

    it('deve validar que todas as mídias pertencem à campaign', async () => {
      const campaignId = 1;
      const mediaIds = [1, 2, 3];

      mockDb.findFirst
        .mockResolvedValueOnce({ campaign_id: campaignId }) // Campaign existe
        .mockResolvedValueOnce({ count: '2' }); // Apenas 2 mídias pertencem à campaign

      // Se nem todas as mídias pertencem, deve lançar erro ou retornar false
      await expect(
        campaignService.reorderCampaignMedias(campaignId, mediaIds)
      ).rejects.toThrow();
    });
  });

  describe('reorderCampaignPlaylists', () => {
    it('deve reordenar playlists da campaign com sucesso', async () => {
      const campaignId = 1;
      const playlistIds = [2, 1, 3];

      mockDb.findFirst.mockResolvedValue({ campaign_id: campaignId });
      mockDb.executeRaw.mockResolvedValue({ rowsAffected: 3 });

      const result = await campaignService.reorderCampaignPlaylists(
        campaignId,
        playlistIds
      );

      expect(result).toBe(true);
      expect(mockDb.executeRaw).toHaveBeenCalledTimes(3);
      expect(mockCache.invalidateEntity).toHaveBeenCalledWith('campaign', campaignId);
    });

    it('deve atualizar order_index e priority corretamente', async () => {
      const campaignId = 1;
      const playlistIds = [2, 1, 3];

      mockDb.findFirst.mockResolvedValue({ campaign_id: campaignId });
      mockDb.executeRaw.mockResolvedValue({ rowsAffected: 1 });

      await campaignService.reorderCampaignPlaylists(campaignId, playlistIds);

      expect(mockDb.executeRaw).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE campaign_playlists'),
        expect.arrayContaining([expect.any(Number), expect.any(Number)])
      );
    });

    it('deve retornar false se campaign não encontrada', async () => {
      mockDb.findFirst.mockResolvedValue(null);

      const result = await campaignService.reorderCampaignPlaylists(999, [1, 2, 3]);

      expect(result).toBe(false);
      expect(mockDb.executeRaw).not.toHaveBeenCalled();
    });
  });
});
