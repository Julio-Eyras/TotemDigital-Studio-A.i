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

  describe('updateSetting', () => {
    it('deve atualizar configuração existente', async () => {
      const mockSetting = {
        id: 1,
        key: 'app.name',
        value: 'Smart Signage Pro',
        type: 'string',
        isEditable: true,
      };

      mockDb.findFirst
        .mockResolvedValueOnce(mockSetting) // Verificar existência e editabilidade
        .mockResolvedValueOnce(mockSetting); // Retornar atualizada
      
      mockDb.executeRaw.mockResolvedValue({ rows: [] });

      const result = await settingsService.updateSetting('app.name', 'Smart Signage Pro', 1);

      expect(result).toBeDefined();
      expect(mockDb.executeRaw).toHaveBeenCalled();
    });

    it('deve lançar erro quando configuração não é editável', async () => {
      const mockSetting = {
        id: 1,
        key: 'app.name',
        isEditable: false,
      };

      mockDb.findFirst.mockResolvedValue(mockSetting);

      await expect(
        settingsService.updateSetting('app.name', 'New Value', 1)
      ).rejects.toThrow();
    });
  });

  describe('updateSettings', () => {
    it('deve atualizar múltiplas configurações', async () => {
      const mockSettings = [
        { id: 1, key: 'app.name', isEditable: true },
        { id: 2, key: 'app.version', isEditable: true },
      ];

      mockDb.findMany.mockResolvedValue(mockSettings);
      mockDb.findFirst.mockResolvedValue(mockSettings[0]);
      mockDb.executeRaw.mockResolvedValue({ rows: [] });

      const result = await settingsService.updateSettings(
        {
          'app.name': 'Smart Signage Pro',
          'app.version': '2.1.0',
        },
        1
      );

      expect(result).toBeDefined();
      expect(mockDb.executeRaw).toHaveBeenCalled();
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

