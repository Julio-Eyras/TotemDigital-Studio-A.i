/**
 * Log Rotation Service Tests - Smart Signage v2.1
 */

const readdirSync = jest.fn();
const statSync = jest.fn();
const existsSync = jest.fn();
const renameSync = jest.fn();
const unlinkSync = jest.fn();
const mkdirSync = jest.fn();
const chmodSync = jest.fn();

jest.mock('fs', () => ({
  readdirSync,
  statSync,
  existsSync,
  renameSync,
  unlinkSync,
  mkdirSync,
  chmodSync,
}));

import { LogRotationService } from '../../services/logRotationService';
import { getDatabase } from '../../config/database';

jest.mock('../../config/database', () => ({
  getDatabase: jest.fn(),
}));

jest.mock('../../services/notificationService', () => ({
  NotificationService: jest.fn().mockImplementation(() => ({
    createNotification: jest.fn().mockResolvedValue(undefined),
  })),
}));

describe('LogRotationService', () => {
  let service: LogRotationService;
  let mockDb: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockDb = {
      findMany: jest.fn().mockResolvedValue([]),
    };

    (getDatabase as jest.Mock).mockReturnValue(mockDb);
    service = new LogRotationService();
  });

  describe('getConfig', () => {
    it('deve ler configurações do banco e converter unidades', async () => {
      mockDb.findMany.mockResolvedValueOnce([
        { setting_key: 'log.rotation.max_size', setting_value: '200MB' },
        { setting_key: 'log.rotation.max_days', setting_value: '7' },
        { setting_key: 'log.rotation.min_free_space', setting_value: '2GB' },
        { setting_key: 'log.rotation.enabled', setting_value: 'true' },
        { setting_key: 'log.rotation.compress', setting_value: 'false' },
        { setting_key: 'log.alerts.enabled', setting_value: 'true' },
        { setting_key: 'log.directory', setting_value: '/var/logs' },
      ]);

      const config = await service.getConfig();

      expect(config.maxSize).toBe(200 * 1024 * 1024);
      expect(config.maxDays).toBe(7);
      expect(config.minFreeSpace).toBe(2 * 1024 * 1024 * 1024);
      expect(config.enabled).toBe(true);
      expect(config.compress).toBe(false);
      expect(config.logDirectory).toBe('/var/logs');
    });
  });

  describe('listLogFiles', () => {
    it('deve retornar apenas arquivos .log com metadados', async () => {
      existsSync.mockReturnValue(true);
      readdirSync.mockReturnValue(['app.log', 'notes.txt']);
      const fileStats = {
        size: 1024,
        birthtime: new Date('2024-01-01T10:00:00Z'),
        mtime: new Date('2024-01-02T10:00:00Z'),
        isFile: () => true,
        isDirectory: () => false,
      };
      statSync.mockReturnValue(fileStats);

      const files = await service.listLogFiles('/var/logs');

      expect(files).toHaveLength(1);
      expect(files[0]).toMatchObject({ name: 'app.log', size: 1024 });
    });
  });

  describe('checkRotation', () => {
    it('deve indicar necessidade de rotação quando espaço livre for baixo', async () => {
      const config = {
        maxSize: 100,
        maxDays: 30,
        minFreeSpace: 200,
        enabled: true,
        compress: true,
        alertsEnabled: true,
        logDirectory: '/var/logs',
      };

      jest.spyOn(service, 'getConfig').mockResolvedValue(config as any);
      jest.spyOn(service, 'getDiskSpace').mockResolvedValue({
        total: 1000,
        free: 100,
        used: 900,
        percentUsed: 90,
      });
      jest.spyOn(service, 'listLogFiles').mockResolvedValue([]);
      const sendAlertSpy = jest.spyOn<any, any>(service as any, 'sendAlert').mockResolvedValue(undefined);

      const result = await service.checkRotation();

      expect(result.needsRotation).toBe(true);
      expect(result.reason).toBe('low_disk_space');
      expect(sendAlertSpy).toHaveBeenCalledWith('low_disk_space', expect.any(Object));
    });
  });

  describe('rotateLogs', () => {
    it('deve rotacionar e excluir arquivos quando necessário', async () => {
      const now = Date.now();
      const config = {
        maxSize: 100,
        maxDays: 1,
        minFreeSpace: 200,
        enabled: true,
        compress: false,
        alertsEnabled: true,
        logDirectory: '/var/logs',
      };

      const logFiles = [
        {
          name: 'app.log',
          path: '/var/logs/app.log',
          size: 150,
          created: new Date(now - 1000),
          modified: new Date(now - 1000),
        },
        {
          name: 'old.log',
          path: '/var/logs/old.log',
          size: 10,
          created: new Date(now - 5 * 24 * 60 * 60 * 1000),
          modified: new Date(now - 5 * 24 * 60 * 60 * 1000),
        },
      ];

      jest.spyOn(service, 'getConfig').mockResolvedValue(config as any);
      jest.spyOn(service, 'listLogFiles').mockResolvedValue(logFiles as any);
      const sendAlertSpy = jest.spyOn<any, any>(service as any, 'sendAlert').mockResolvedValue(undefined);

      const result = await service.rotateLogs();

      expect(renameSync).toHaveBeenCalledWith('/var/logs/app.log', expect.stringContaining('app.log.'));
      expect(unlinkSync).toHaveBeenCalledWith('/var/logs/old.log');
      expect(result).toMatchObject({ success: true, filesRotated: 1, filesDeleted: 1 });
      expect(sendAlertSpy).toHaveBeenCalledWith('rotation_completed', expect.objectContaining({ filesRotated: 1, filesDeleted: 1 }));
    });
  });
});
