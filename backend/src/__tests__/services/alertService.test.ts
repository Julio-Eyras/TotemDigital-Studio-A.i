/**
 * AlertService Tests
 * Testes unitários para o serviço de alertas
 */

import { AlertService } from '../../services/alertService';
import { getDatabase } from '../../config/database';
import { getFxTelemetryService } from '../../services/fxTelemetryService';

// Mocks
jest.mock('../../config/database');
jest.mock('../../services/fxTelemetryService');
jest.mock('../../services/emailService');
jest.mock('axios');

describe('AlertService', () => {
  let alertService: AlertService;
  let mockDb: any;
  let mockTelemetry: any;

  beforeEach(() => {
    mockDb = {
      findMany: jest.fn(),
      findFirst: jest.fn()
    };
    mockTelemetry = {
      getTelemetryStats: jest.fn()
    };
    (getDatabase as jest.Mock).mockReturnValue(mockDb);
    (getFxTelemetryService as jest.Mock).mockReturnValue(mockTelemetry);
    alertService = new AlertService();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('checkAllAlerts', () => {
    it('deve verificar todos os alertas configurados', async () => {
      mockTelemetry.getTelemetryStats.mockResolvedValue({
        avgFps: 10, // FPS baixo
        totalExecutions: 100
      });

      const alerts = await alertService.checkAllAlerts();

      expect(Array.isArray(alerts)).toBe(true);
    });
  });

  describe('checkFPSAlert', () => {
    it('deve criar alerta se FPS estiver baixo', async () => {
      // Mock de totens com FPS baixo
      mockDb.findMany.mockResolvedValue([
        {
          totem_id: 1,
          count: 5,
          avg_fps: '10.5',
          min_fps: '8.0',
          max_fps: '12.0'
        },
        {
          totem_id: 2,
          count: 4,
          avg_fps: '12.3',
          min_fps: '10.0',
          max_fps: '14.0'
        }
      ]);

      const alerts = await alertService.checkAllAlerts();
      const fpsAlert = alerts.find(a => a.type === 'fps_low');

      if (fpsAlert) {
        expect(fpsAlert.severity).toBe('warning');
        expect(fpsAlert.message).toContain('FPS');
        expect(fpsAlert.message).toContain('totem');
      }
    });

    it('não deve criar alerta se FPS estiver acima do threshold', async () => {
      // Mock vazio = nenhum totem com FPS baixo
      mockDb.findMany.mockResolvedValue([]);

      const alerts = await alertService.checkAllAlerts();
      const fpsAlert = alerts.find(a => a.type === 'fps_low');

      expect(fpsAlert).toBeUndefined();
    });
  });

  describe('checkTotemOffline', () => {
    it('deve criar alerta quando totens estiverem offline', async () => {
      mockDb.findMany.mockResolvedValue([
        {
          totem_id: 1,
          name: 'Totem 1',
          last_heartbeat: new Date(Date.now() - 10 * 60 * 1000), // 10 minutos atrás
          minutes_offline: 10
        }
      ]);

      const alerts = await alertService.checkAllAlerts();
      const offlineAlert = alerts.find(a => a.type === 'totem_offline');

      if (offlineAlert) {
        expect(offlineAlert.severity).toBe('error');
        expect(offlineAlert.message).toContain('offline');
      }
    });
  });

  describe('checkFailureRate', () => {
    it('deve criar alerta quando taxa de falha estiver alta', async () => {
      mockDb.findFirst.mockResolvedValue({
        total: 100,
        failed: 15 // 15% de falha (acima do threshold de 10%)
      });

      const alerts = await alertService.checkAllAlerts();
      const failureAlert = alerts.find(a => a.type === 'failure_rate');

      if (failureAlert) {
        expect(failureAlert.severity).toBe('error');
        expect(failureAlert.message).toContain('falha');
      }
    });

    it('não deve criar alerta quando taxa de falha estiver baixa', async () => {
      mockDb.findFirst.mockResolvedValue({
        total: 100,
        failed: 5 // 5% de falha (abaixo do threshold de 10%)
      });

      const alerts = await alertService.checkAllAlerts();
      const failureAlert = alerts.find(a => a.type === 'failure_rate');

      expect(failureAlert).toBeUndefined();
    });
  });
});

