/**
 * Smart Playlist Service Tests - Smart Signage v2.1
 * Testes unitários para SmartPlaylistService
 */

import { SmartPlaylistService } from '../../services/smartPlaylistService';
import { getDatabase } from '../../config/database';
import { AIService } from '../../services/aiService';

// Mock do banco de dados
jest.mock('../../config/database', () => ({
  getDatabase: jest.fn(),
}));

// Mock do AIService
jest.mock('../../services/aiService', () => ({
  AIService: jest.fn(),
}));

// Mock de child_process
jest.mock('child_process', () => ({
  spawn: jest.fn(),
}));

describe('SmartPlaylistService', () => {
  let smartPlaylistService: SmartPlaylistService;
  let mockDb: any;
  let mockAIService: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockDb = {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      executeRaw: jest.fn(),
    };

    mockAIService = {
      generatePlaylistSuggestions: jest.fn().mockResolvedValue({ items: [] }),
    };

    (getDatabase as jest.Mock).mockReturnValue(mockDb);
    (AIService as jest.Mock).mockImplementation(() => mockAIService);

    // Mock do AuditService
    (global as any).auditServiceInstance = {
      log: jest.fn().mockResolvedValue(undefined),
    };

    smartPlaylistService = new SmartPlaylistService();
  });

  describe('getSmartPlaylists', () => {
    it('deve listar smart playlists com paginação', async () => {
      const mockPlaylists = [
        {
          id: 1,
          name: 'Smart Playlist 1',
          status: 'active',
          aiEnabled: true,
          createdAt: '2024-01-01',
        },
      ];

      mockDb.findMany.mockResolvedValue(mockPlaylists);
      mockDb.findFirst.mockResolvedValue({ total: '1' });

      const result = await smartPlaylistService.getSmartPlaylists(1, 20);

      expect(result.playlists).toBeDefined();
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });

    it('deve filtrar smart playlists por cliente', async () => {
      mockDb.findMany.mockResolvedValue([]);
      mockDb.findFirst.mockResolvedValue({ total: '0' });

      await smartPlaylistService.getSmartPlaylists(1, 20, { clientId: 1 });

      expect(mockDb.findMany).toHaveBeenCalledWith(
        expect.stringContaining('client_id ='),
        expect.arrayContaining([1])
      );
    });
  });

  describe('getSmartPlaylistById', () => {
    it('deve retornar smart playlist quando encontrada', async () => {
      const mockPlaylist = {
        id: 1,
        name: 'Smart Playlist Teste',
        status: 'active',
        aiEnabled: true,
      };

      mockDb.findFirst.mockResolvedValue(mockPlaylist);

      const result = await smartPlaylistService.getSmartPlaylistById(1);

      expect(result).toBeDefined();
      expect(result?.id).toBe(1);
    });

    it('deve retornar null quando smart playlist não encontrada', async () => {
      mockDb.findFirst.mockResolvedValue(null);

      const result = await smartPlaylistService.getSmartPlaylistById(999);

      expect(result).toBeNull();
    });
  });

  describe('createSmartPlaylist', () => {
    it('deve criar smart playlist com dados válidos', async () => {
      const mockPlaylist = {
        id: 1,
        name: 'Nova Smart Playlist',
        clientId: 1,
        status: 'active',
        aiEnabled: true,
        createdAt: '2024-01-01',
      };

      mockDb.findFirst.mockResolvedValue(null); // Playlist não existe
      mockDb.executeRaw.mockResolvedValue({ rows: [mockPlaylist] });

      const result = await smartPlaylistService.createSmartPlaylist(
        {
          clientId: 1,
          name: 'Nova Smart Playlist',
          aiEnabled: true,
        },
        1
      );

      expect(result).toBeDefined();
      expect(result.id).toBe(1);
      expect(mockDb.executeRaw).toHaveBeenCalled();
    });
  });

  describe('updateSmartPlaylist', () => {
    it('deve atualizar smart playlist existente', async () => {
      const mockPlaylist = {
        id: 1,
        name: 'Smart Playlist Atualizada',
        status: 'active',
      };

      mockDb.findFirst
        .mockResolvedValueOnce({ smart_playlist_id: 1 }) // Verificar existência
        .mockResolvedValueOnce(mockPlaylist); // Retornar atualizada
      
      mockDb.executeRaw.mockResolvedValue({ rows: [] });

      const result = await smartPlaylistService.updateSmartPlaylist(
        1,
        {
          name: 'Smart Playlist Atualizada',
        },
        1
      );

      expect(result).toBeDefined();
      expect(mockDb.executeRaw).toHaveBeenCalled();
    });
  });

  describe('deleteSmartPlaylist', () => {
    it('deve deletar smart playlist existente', async () => {
      mockDb.findFirst.mockResolvedValue({ smart_playlist_id: 1 });
      mockDb.executeRaw.mockResolvedValue({ rows: [] });

      await smartPlaylistService.deleteSmartPlaylist(1, 1);

      expect(mockDb.executeRaw).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM smart_playlists'),
        [1]
      );
    });
  });

  describe('generateSmartPlaylist', () => {
    it('deve gerar playlist inteligente', async () => {
      const mockPlaylist = {
        id: 1,
        clientId: 1,
        aiEnabled: true,
        rules: '[]',
      };

      mockDb.findFirst.mockResolvedValue(mockPlaylist);
      mockDb.findMany.mockResolvedValue([]); // Mídia disponível
      mockDb.executeRaw
        .mockResolvedValueOnce({ rows: [] }) // Limpar itens existentes
        .mockResolvedValueOnce({ lastInsertRowid: 1 }); // Inserir novos itens

      const result = await smartPlaylistService.generateSmartPlaylist(1, 1);

      expect(result).toBeDefined();
      expect(result.generatedItems).toBeDefined();
      expect(typeof result.generatedItems).toBe('number');
    });
  });
});

