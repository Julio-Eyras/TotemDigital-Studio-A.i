/**
 * Analytics Service Tests - Smart Signage v2.1
 * Testes unitários para AnalyticsService
 */

import { AnalyticsService } from '../../services/analyticsService';
import { getDatabase } from '../../config/database';

// Mock do banco de dados
jest.mock('../../config/database', () => ({
  getDatabase: jest.fn(),
}));

describe('AnalyticsService', () => {
  let analyticsService: AnalyticsService;
  let mockDb: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockDb = {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      executeRaw: jest.fn(),
    };

    (getDatabase as jest.Mock).mockReturnValue(mockDb);

    // Mock do AuditService
    (global as any).auditServiceInstance = {
      log: jest.fn().mockResolvedValue(undefined),
    };

    analyticsService = new AnalyticsService();

    mockDb.findMany.mockImplementation(() => Promise.resolve([]));
  });

  describe('getDashboardStats', () => {
    it('deve retornar estatísticas do dashboard', async () => {
      mockDb.findFirst
        .mockResolvedValueOnce({ count: 10 }) // totalClients
        .mockResolvedValueOnce({ count: 5 }) // totalTotems
        .mockResolvedValueOnce({ count: 20 }) // totalCampaigns
        .mockResolvedValueOnce({ count: 100 }) // totalMedia
        .mockResolvedValueOnce({ count: 1000 }) // totalViews
        .mockResolvedValueOnce({ total: 5000 }) // totalRevenue
        .mockResolvedValueOnce({ count: 5 }) // activeUsers
        .mockResolvedValueOnce({ avg: 95 }) // systemUptime
        .mockResolvedValueOnce({ count: 2 }) // newClients
        .mockResolvedValueOnce({ count: 3 }) // newCampaigns
        .mockResolvedValueOnce({ count: 10 }) // newMedia
        .mockResolvedValueOnce({ count: 50 }) // newViews
        .mockResolvedValueOnce({ total: 500 }); // newRevenue

      mockDb.findMany.mockResolvedValue([]); // Para topCampaigns, topTotems, topMedia, alerts

      const result = await analyticsService.getDashboardStats();

      expect(result).toBeDefined();
      expect(result.overview).toBeDefined();
      expect(result.recentActivity).toBeDefined();
      expect(result.performance).toBeDefined();
      expect(result.alerts).toBeDefined();
    });
  });

  describe('getAnalytics', () => {
    it('deve retornar dados de analytics com filtros', async () => {
      mockDb.findFirst
        .mockResolvedValueOnce({ total: 1000 }) // totalViews
        .mockResolvedValueOnce({ total: 3600 }) // totalDuration
        .mockResolvedValueOnce({ count: 100 }); // uniqueViewers

      mockDb.findMany
        .mockResolvedValueOnce([]) // viewingTrends (executionData)
        .mockResolvedValueOnce([]) // viewingTrends (sessionData)
        .mockResolvedValueOnce([]); // deviceStats

      const result = await analyticsService.getAnalytics({
        clientId: 1,
        startDate: '2024-01-01',
        endDate: '2024-12-31',
      });

      expect(result).toBeDefined();
      expect(result.totalViews).toBeDefined();
      expect(result.viewingTrends).toBeDefined();
      expect(Array.isArray(result.deviceStats)).toBe(true);
    });
  });

  describe('getAnalytics - viewingTrends', () => {
    it('deve incluir tendências de visualização nos analytics', async () => {
      mockDb.findFirst
        .mockResolvedValueOnce({ total: 1000 }) // totalViews
        .mockResolvedValueOnce({ total: 3600 }) // totalDuration
        .mockResolvedValueOnce({ count: 100 }); // uniqueViewers

      mockDb.findMany
        .mockResolvedValueOnce([]) // viewingTrends (executionData)
        .mockResolvedValueOnce([]) // viewingTrends (sessionData)
        .mockResolvedValueOnce([{ device_type: 'v2.0', count: '3' }]); // deviceStats

      const result = await analyticsService.getAnalytics({
        startDate: '2024-01-01',
        endDate: '2024-01-31',
      });

      expect(result).toBeDefined();
      expect(result.viewingTrends).toBeDefined();
      expect(Array.isArray(result.viewingTrends)).toBe(true);
      expect(result.deviceStats).toEqual([
        { deviceType: 'v2.0', count: 3, percentage: 100 },
      ]);
    });
  });
});

