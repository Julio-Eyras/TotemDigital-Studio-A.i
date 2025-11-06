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
        .mockResolvedValueOnce([]) // viewingTrends
        .mockResolvedValueOnce([]) // mostViewedContent
        .mockResolvedValueOnce([]) // deviceStats
        .mockResolvedValueOnce([]) // locationStats
        .mockResolvedValueOnce([]) // campaignPerformance
        .mockResolvedValueOnce([]) // totemPerformance
        .mockResolvedValueOnce([]) // qrCodeStats
        .mockResolvedValueOnce([]); // revenue byClient/byCampaign

      const result = await analyticsService.getAnalytics({
        clientId: 1,
        startDate: '2024-01-01',
        endDate: '2024-12-31',
      });

      expect(result).toBeDefined();
      expect(result.totalViews).toBeDefined();
      expect(result.viewingTrends).toBeDefined();
    });
  });

  describe('getViewingTrends', () => {
    it('deve retornar tendências de visualização', async () => {
      const mockTrends = [
        {
          date: '2024-01-01',
          views: 100,
          duration: 3600,
          uniqueViewers: 50,
        },
      ];

      mockDb.findMany.mockResolvedValue(mockTrends);

      const result = await analyticsService.getViewingTrends({
        startDate: '2024-01-01',
        endDate: '2024-01-31',
      });

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('getDiskUsage', () => {
    it('deve retornar uso de disco', async () => {
      // Mock será baseado em execução de comando do sistema
      // Por enquanto, testamos que o método existe e retorna dados estruturados
      const result = await analyticsService.getDiskUsage();

      expect(result).toBeDefined();
      expect(typeof result.total).toBe('number');
      expect(typeof result.used).toBe('number');
      expect(typeof result.free).toBe('number');
    });
  });
});

