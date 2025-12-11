/**
 * FxAnalyticsService Tests
 * Testes unitários para o serviço de analytics FX
 */

import { FxAnalyticsService } from '../../services/fxAnalyticsService';
import { getDatabase } from '../../config/database';
import { getAnalyticsCacheService } from '../../services/analyticsCacheService';

// Mocks
jest.mock('../../config/database');
jest.mock('../../services/analyticsCacheService');

describe('FxAnalyticsService', () => {
  let analyticsService: FxAnalyticsService;
  let mockDb: any;
  let mockCache: any;

  beforeEach(() => {
    mockDb = {
      findFirst: jest.fn(),
      findMany: jest.fn()
    };
    mockCache = {
      get: jest.fn(),
      set: jest.fn(),
      getOverviewKey: jest.fn(() => 'test-key')
    };
    (getDatabase as jest.Mock).mockReturnValue(mockDb);
    (getAnalyticsCacheService as jest.Mock).mockReturnValue(mockCache);
    analyticsService = new FxAnalyticsService();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getOverview', () => {
    it('deve retornar overview do cache se existir', async () => {
      const cachedOverview = {
        totalExecutions: 100,
        successful: 95,
        failed: 5,
        successRate: 95,
        avgFps: 60,
        avgDuration: 1000,
        topEffects: [],
        topTotems: [],
        trends: []
      };
      mockCache.get.mockResolvedValue(cachedOverview);

      const result = await analyticsService.getOverview({});

      expect(result).toEqual(cachedOverview);
      expect(mockCache.get).toHaveBeenCalled();
      expect(mockDb.findFirst).not.toHaveBeenCalled();
    });

    it('deve buscar do banco se não houver cache', async () => {
      mockCache.get.mockResolvedValue(null);
      mockDb.findFirst.mockResolvedValue({
        total: 100,
        successful: 95,
        failed: 5,
        avg_fps: '60.00',
        avg_duration: '1000.00'
      });
      mockDb.findMany.mockResolvedValue([]);

      const result = await analyticsService.getOverview({});

      expect(result).toBeDefined();
      expect(result.totalExecutions).toBe(100);
      expect(mockCache.set).toHaveBeenCalled();
    });
  });

  describe('comparePeriods', () => {
    it('deve comparar dois períodos corretamente', async () => {
      const currentOverview = {
        totalExecutions: 200,
        successful: 190,
        failed: 10,
        successRate: 95,
        avgFps: 60,
        avgDuration: 1000,
        topEffects: [],
        topTotems: [],
        trends: []
      };
      const previousOverview = {
        totalExecutions: 100,
        successful: 90,
        failed: 10,
        successRate: 90,
        avgFps: 55,
        avgDuration: 1100,
        topEffects: [],
        topTotems: [],
        trends: []
      };

      mockCache.get
        .mockResolvedValueOnce(currentOverview)
        .mockResolvedValueOnce(previousOverview);

      const result = await analyticsService.comparePeriods({
        currentStartDate: '2025-01-01',
        currentEndDate: '2025-01-31',
        previousStartDate: '2024-12-01',
        previousEndDate: '2024-12-31'
      });

      expect(result.current).toEqual(currentOverview);
      expect(result.previous).toEqual(previousOverview);
      expect(result.changes.totalExecutions.value).toBe(100);
      expect(result.changes.totalExecutions.percentage).toBe(100);
    });
  });
});

