/**
 * Playlist Service - Reorder Tests
 * Testes para funcionalidades de reordenação (drag & drop)
 */

import { PlaylistService } from '../../services/playlistService';
import { getDatabase } from '../../config/database';
import { CacheService } from '../../services/cacheService';

jest.mock('../../config/database', () => ({
  getDatabase: jest.fn(),
}));

jest.mock('../../services/cacheService', () => ({
  CacheService: jest.fn(),
}));

describe('PlaylistService - Reorder', () => {
  let playlistService: PlaylistService;
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

    playlistService = new PlaylistService();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('reorderPlaylistMedia', () => {
    it('deve reordenar mídias da playlist com sucesso', async () => {
      const playlistId = 1;
      const mediaIds = [3, 1, 2];

      mockDb.findFirst.mockResolvedValue({ playlist_id: playlistId });
      mockDb.executeRaw.mockResolvedValue({ rowsAffected: 3 });

      const items = mediaIds.map((id, index) => ({ itemId: id, orderIndex: index + 1 }));
      await playlistService.reorderPlaylistMedia(
        playlistId,
        items
      );

      // reorderPlaylistMedia retorna void, não boolean
      expect(mockDb.executeRaw).toHaveBeenCalled();
      expect(mockDb.executeRaw).toHaveBeenCalledTimes(3);
      expect(mockCache.invalidateEntity).toHaveBeenCalledWith('playlist', playlistId);
    });

    it('deve atualizar order_index corretamente', async () => {
      const playlistId = 1;
      const mediaIds = [3, 1, 2];

      mockDb.findFirst.mockResolvedValue({ playlist_id: playlistId });
      mockDb.executeRaw.mockResolvedValue({ rowsAffected: 1 });

      const items = mediaIds.map((id, index) => ({ itemId: id, orderIndex: index + 1 }));
      await playlistService.reorderPlaylistMedia(playlistId, items);

      expect(mockDb.executeRaw).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE playlist_media'),
        expect.arrayContaining([expect.any(Number), expect.any(Number)])
      );
    });

    it('deve retornar false se playlist não encontrada', async () => {
      mockDb.findFirst.mockResolvedValue(null);

      const items = [1, 2, 3].map((id, index) => ({ itemId: id, orderIndex: index + 1 }));
      await expect(
        playlistService.reorderPlaylistMedia(999, items)
      ).rejects.toThrow();
    });

    it('deve validar que todas as mídias pertencem à playlist', async () => {
      const playlistId = 1;
      const mediaIds = [1, 2, 3];

      mockDb.findFirst
        .mockResolvedValueOnce({ playlist_id: playlistId }) // Playlist existe
        .mockResolvedValueOnce({ count: '2' }); // Apenas 2 mídias pertencem à playlist

      await expect(
        playlistService.reorderPlaylistMedia(playlistId, mediaIds.map((id, index) => ({ itemId: id, orderIndex: index + 1 })))
      ).rejects.toThrow();
    });
  });
});
