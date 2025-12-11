/**
 * Settings Service Tests - Smart Signage v2.1
 * Testes unitários para SettingsService
 */

import { SettingsService } from '../../services/settingsService';
import { getDatabase } from '../../config/database';

// Mock do banco de dados
jest.mock('../../config/database', () => ({
  getDatabase: jest.fn(),
}));

describe('SettingsService', () => {
  let settingsService: SettingsService;
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

    settingsService = new SettingsService();
  });

  describe('getSettings', () => {
    it('deve retornar configurações organizadas por categoria', async () => {
      const mockSettings = [
        {
          id: 1,
          key: 'app.name',
          value: 'Smart Signage',
          type: 'string',
          category: 'general',
          isPublic: true,
          isEditable: true,
          createdAt: '2024-01-01',
          updatedAt: '2024-01-01',
        },
      ];

      mockDb.findMany.mockResolvedValue(mockSettings);

      const result = await settingsService.getSettings();

      expect(result.categories).toBeDefined();
      expect(result.publicSettings).toBeDefined();
      expect(result.privateSettings).toBeDefined();
    });
  });

  describe('getSetting', () => {
    it('deve retornar configuração quando encontrada', async () => {
      const mockSetting = {
        id: 1,
        key: 'app.name',
        value: 'Smart Signage',
        type: 'string',
        category: 'general',
        isPublic: true,
        isEditable: true,
      };

      mockDb.findFirst.mockResolvedValue(mockSetting);

      const result = await settingsService.getSetting('app.name');

      expect(result).toEqual(mockSetting);
    });

    it('deve retornar null quando configuração não encontrada', async () => {
      mockDb.findFirst.mockResolvedValue(null);

      const result = await settingsService.getSetting('nonexistent.key');

      expect(result).toBeNull();
    });
  });

  describe('updateSettings', () => {
    it('deve atualizar múltiplas configurações', async () => {
      jest.spyOn(settingsService, 'validateSettings').mockResolvedValue({
        isValid: true,
        errors: {},
        warnings: {},
      });

      const getSettingSpy = jest
        .spyOn(settingsService, 'getSetting')
        .mockResolvedValue({
          key: 'app.name',
          type: 'string',
          isEditable: true,
          value: 'Smart Signage',
        } as any);

      getSettingSpy
        .mockResolvedValueOnce({
          key: 'app.name',
          type: 'string',
          isEditable: true,
          value: 'Smart Signage',
        } as any)
        .mockResolvedValueOnce({
          key: 'app.version',
          type: 'string',
          isEditable: true,
          value: '2.0.0',
        } as any);

      mockDb.executeRaw.mockResolvedValue({ rows: [] });

      const result = await settingsService.updateSettings(
        {
          'app.name': 'Smart Signage Pro',
          'app.version': '2.1.0',
        },
        1
      );

      expect(result.isValid).toBe(true);
      expect(mockDb.executeRaw).toHaveBeenCalledTimes(2);
    });

    it('deve retornar erro quando configuração não é editável', async () => {
      jest.spyOn(settingsService, 'validateSettings').mockResolvedValue({
        isValid: true,
        errors: {},
        warnings: {},
      });

      jest.spyOn(settingsService, 'getSetting').mockResolvedValue({
        key: 'app.name',
        type: 'string',
        isEditable: false,
        value: 'Smart Signage',
      } as any);

      const result = await settingsService.updateSettings(
        {
          'app.name': 'Novo Nome',
        },
        1
      );

      expect(result.isValid).toBe(false);
      expect(result.errors['app.name']).toBeDefined();
    });
  });

  describe('validateSettings', () => {
    it('deve validar configurações corretamente', async () => {
      const mockSettings = [
        {
          id: 1,
          key: 'app.name',
          type: 'string',
          validation: 'required|min:3',
          isEditable: true,
        },
      ];

      mockDb.findMany.mockResolvedValue(mockSettings);

      const result = await settingsService.validateSettings({
        'app.name': 'Smart Signage',
      });

      expect(result.isValid).toBeDefined();
      expect(typeof result.isValid).toBe('boolean');
    });
  });
});

