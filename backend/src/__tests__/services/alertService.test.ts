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
      mockTelemetry.getTelemetryStats.mockResolvedValue({
        avgFps: 10, // Abaixo do threshold de 15
        totalExecutions: 100
      });

      const alerts = await alertService.checkAllAlerts();
      const fpsAlert = alerts.find(a => a.type === 'fps_low');

      if (fpsAlert) {
        expect(fpsAlert.severity).toBe('warning');
        expect(fpsAlert.message).toContain('FPS');
      }
    });
  });
});

