/**
 * Dashboard Service Tests - Smart Signage v2.1
 */

import { DashboardService } from '../../services/dashboardService';
import { getDatabase } from '../../config/database';

jest.mock('../../config/database', () => ({
  getDatabase: jest.fn(),
}));

describe('DashboardService', () => {
  let service: DashboardService;
  let mockDb: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockDb = {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    };

    (getDatabase as jest.Mock).mockReturnValue(mockDb);
    service = new DashboardService();
  });

  describe('getDashboardStats', () => {
    it('deve retornar estatísticas agregadas convertendo para número', async () => {
      mockDb.findFirst
        .mockResolvedValueOnce({ total: '12' }) // media
        .mockResolvedValueOnce({ total: '5' }) // playlists
        .mockResolvedValueOnce({ total: '9' }) // players
        .mockResolvedValueOnce({ total: '20' }) // users
        .mockResolvedValueOnce({ total: '7' }) // active players
        .mockResolvedValueOnce({ total: '2' }); // offline players

      const stats = await service.getDashboardStats();

      expect(stats).toEqual({
        totalMedia: 12,
        totalPlaylists: 5,
        totalPlayers: 9,
        totalUsers: 20,
        activePlayers: 7,
        offlinePlayers: 2,
      });
    });
  });

  describe('getRecentActivity', () => {
    it('deve consolidar atividades recentes ordenadas por timestamp', async () => {
      const mediaActivity = [{
        type: 'upload',
        message: 'Novo arquivo "Video.mp4" enviado',
        timestamp: '2024-01-02T10:00:00Z',
        status: 'success',
        id: '1',
      }];
      const playlistActivity = [{
        type: 'playlist',
        message: 'Playlist "Promo" criada',
        timestamp: '2024-01-03T08:00:00Z',
        status: 'success',
        id: '2',
      }];
      const playerActivity = [{
        type: 'player',
        message: 'Player "Totem 1" ficou offline',
        timestamp: '2024-01-01T22:00:00Z',
        status: 'warning',
        id: '3',
      }];

      mockDb.findMany
        .mockResolvedValueOnce(mediaActivity)
        .mockResolvedValueOnce(playlistActivity)
        .mockResolvedValueOnce(playerActivity);

      const result = await service.getRecentActivity(6);

      expect(mockDb.findMany).toHaveBeenNthCalledWith(1, expect.any(String), [2]);
      expect(result.map((a) => a.id)).toEqual(['2', '1', '3']);
    });
  });

  describe('getStatsByClient', () => {
    it('deve retornar estatísticas específicas de um cliente', async () => {
      mockDb.findFirst
        .mockResolvedValueOnce({ total: '4' })
        .mockResolvedValueOnce({ total: '3' })
        .mockResolvedValueOnce({ total: '2' })
        .mockResolvedValueOnce({ total: '1' });

      const stats = await service.getStatsByClient(99);

      expect(mockDb.findFirst).toHaveBeenNthCalledWith(1, expect.any(String), [99]);
      expect(stats).toEqual({
        mediaCount: 4,
        playlistCount: 3,
        playerCount: 2,
        activePlayerCount: 1,
      });
    });
  });

  describe('getUsageCharts', () => {
    it('deve montar dados de gráficos convertendo valores numéricos', async () => {
      mockDb.findMany
        .mockResolvedValueOnce([{ type: 'video', count: '5' }, { type: 'image', count: '3' }])
        .mockResolvedValueOnce([{ status: 'online', count: '4' }, { status: 'offline', count: '2' }])
        .mockResolvedValueOnce([{ date: '2024-01-01', count: '7' }]);

      const charts = await service.getUsageCharts();

      expect(charts).toEqual({
        mediaByType: [{ type: 'video', count: 5 }, { type: 'image', count: 3 }],
        playersByStatus: [{ status: 'online', count: 4 }, { status: 'offline', count: 2 }],
        activityByDay: [{ date: '2024-01-01', count: 7 }],
      });
    });
  });
});
