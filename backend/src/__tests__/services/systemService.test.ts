/**
 * System Service Tests - Smart Signage v2.1
 */

import os from 'os';
import { SystemService } from '../../services/systemService';
import { getDatabase } from '../../config/database';

jest.mock('../../config/database', () => ({
  getDatabase: jest.fn(),
}));

jest.mock('axios');

describe('SystemService', () => {
  let service: SystemService;
  let mockDb: any;

  const originalEnv = { ...process.env };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };

    mockDb = {
      findFirst: jest.fn(),
    };

    (getDatabase as jest.Mock).mockReturnValue(mockDb);
    service = new SystemService();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('getSystemHealth', () => {
    it('deve retornar informações de saúde do sistema', async () => {
      jest.spyOn(os, 'totalmem').mockReturnValue(1000);
      jest.spyOn(os, 'freemem').mockReturnValue(400);
      mockDb.findFirst.mockResolvedValueOnce({ test: 1 });
      jest.spyOn<any, any>(service as any, 'getDiskUsage').mockReturnValue({
        used: 200,
        total: 1000,
        percentage: 20,
      });

      const health = await service.getSystemHealth();

      expect(mockDb.findFirst).toHaveBeenCalledWith('SELECT 1 as test');
      expect(health.database.status).toBe('connected');
      expect(health.memory.percentage).toBeCloseTo(60);
      expect(health.disk).toEqual({ used: 200, total: 1000, percentage: 20 });
      expect(typeof health.uptime).toBe('number');
      expect(health.status).toBe('healthy');
    });
  });

  describe('getSystemInfo', () => {
    it('deve retornar informações construídas com dados internos', async () => {
      jest.spyOn<any, any>(service as any, 'getDatabaseVersion').mockResolvedValue('PostgreSQL 14.5');
      jest.spyOn<any, any>(service as any, 'getAIStatus').mockResolvedValue('online');
      jest.spyOn(os, 'platform').mockReturnValue('linux');
      jest.spyOn(os, 'arch').mockReturnValue('x64');

      process.env.NODE_ENV = 'production';
      process.env.AI_PROVIDER = 'ollama';
      process.env.AI_ENABLED = 'true';

      const info = await service.getSystemInfo();

      expect(info.environment).toBe('production');
      expect(info.database.version).toBe('PostgreSQL 14.5');
      expect(info.ai.provider).toBe('ollama');
      expect(info.ai.status).toBe('online');
      expect(info.system.platform).toBe('linux');
      expect(Array.isArray(info.features)).toBe(true);
    });
  });

  describe('getPlayerConfig', () => {
    it('deve montar configuração com base nas variáveis de ambiente', async () => {
      process.env.SERVER_URL = 'https://smartsignage.local';
      process.env.HEARTBEAT_INTERVAL = '45000';
      process.env.PLAYER_AUTO_START = 'true';
      process.env.PLAYER_FULLSCREEN = 'false';
      process.env.PLAYER_PORTRAIT = 'true';
      process.env.PLAYER_ABANDON_PIN = '654321';

      const config = await service.getPlayerConfig();

      expect(config).toEqual({
        serverUrl: 'https://smartsignage.local',
        heartbeatInterval: 45000,
        mediaPath: '/assets/uploads',
        defaultPlaylist: undefined,
        autoStart: true,
        fullscreen: false,
        portrait: true,
        abandonPin: '654321',
      });
    });
  });
});
