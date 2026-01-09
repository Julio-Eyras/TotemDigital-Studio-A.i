/**
 * Playlist Service Tests - Smart Signage v2.1
 * Testes unitários para PlaylistService
 */

import { PlaylistService } from '../../services/playlistService';
import { getDatabase } from '../../config/database';

// Mock do banco de dados
jest.mock('../../config/database', () => ({
  getDatabase: jest.fn(),
}));

describe('PlaylistService', () => {
  let playlistService: PlaylistService;
  let mockDb: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockDb = {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      executeRaw: jest.fn(),
    };

    (getDatabase as jest.Mock).mockReturnValue(mockDb);
    playlistService = new PlaylistService();
  });

  describe('getAllPlaylists', () => {
    it('deve listar playlists com paginação', async () => {
      const mockPlaylists = [
        {
          playlist_id: 1,
          name: 'Playlist Teste',
          description: 'Descrição teste',
          subscriber_id: 1,
          is_active: true,
          created_at: '2024-01-01',
          updated_at: '2024-01-01',
          media_count: 5,
          total_duration: 300,
        },
      ];

      mockDb.findMany.mockResolvedValue(mockPlaylists);
      mockDb.findFirst.mockResolvedValue({ total: '1' });

      const result = await playlistService.getAllPlaylists({ page: 1, limit: 10 });

      expect(result.data).toEqual(mockPlaylists);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
    });

    it('deve filtrar playlists por busca', async () => {
      mockDb.findMany.mockResolvedValue([]);
      mockDb.findFirst.mockResolvedValue({ total: '0' });

      await playlistService.getAllPlaylists({ page: 1, limit: 10, search: 'teste' });

      expect(mockDb.findMany).toHaveBeenCalledWith(
        expect.stringContaining('ILIKE'),
        expect.arrayContaining([expect.stringContaining('%teste%')])
      );
    });

    it('deve filtrar playlists por subscriber', async () => {
      mockDb.findMany.mockResolvedValue([]);
      mockDb.findFirst.mockResolvedValue({ total: '0' });

      await playlistService.getAllPlaylists({ page: 1, limit: 10, subscriberId: 1 });

      expect(mockDb.findMany).toHaveBeenCalledWith(
        expect.stringContaining('subscriber_id ='),
        expect.arrayContaining([1])
      );
    });
  });

  describe('getPlaylistById', () => {
    it('deve retornar playlist quando encontrada', async () => {
      const mockPlaylist = {
        playlist_id: 1,
        name: 'Playlist Teste',
        description: 'Descrição teste',
        subscriber_id: 1,
        is_active: true,
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
        media_count: 5,
        total_duration: 300,
      };

      mockDb.findFirst.mockResolvedValue(mockPlaylist);

      const result = await playlistService.getPlaylistById(1);

      expect(result).toEqual(mockPlaylist);
    });

    it('deve retornar null quando playlist não encontrada', async () => {
      mockDb.findFirst.mockResolvedValue(null);

      const result = await playlistService.getPlaylistById(999);

      expect(result).toBeNull();
    });
  });

  describe('createPlaylist', () => {
    it('deve criar playlist com dados válidos', async () => {
      const mockPlaylist = {
        playlist_id: 1,
        name: 'Nova Playlist',
        description: 'Descrição',
        subscriber_id: 1,
        is_active: true,
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
        media_count: 0,
        total_duration: 0,
      };

      mockDb.findFirst
        .mockResolvedValueOnce(null) // Playlist não existe
        .mockResolvedValueOnce(mockPlaylist); // Retornar criada
      
      mockDb.executeRaw.mockResolvedValue({
        rows: [{ playlist_id: 1 }],
      });

      const result = await playlistService.createPlaylist({
        name: 'Nova Playlist',
        description: 'Descrição',
        subscriberId: 1,
      });

      expect(result).toEqual(mockPlaylist);
      expect(mockDb.executeRaw).toHaveBeenCalled();
    });

    it('deve lançar erro quando playlist já existe', async () => {
      mockDb.findFirst.mockResolvedValue({ playlist_id: 1 });

      await expect(
        playlistService.createPlaylist({
          name: 'Playlist Existente',
          subscriberId: 1,
        })
      ).rejects.toThrow('Playlist com este nome já existe');
    });
  });

  describe('updatePlaylist', () => {
    it('deve atualizar playlist existente', async () => {
      const mockPlaylist = {
        playlist_id: 1,
        name: 'Playlist Atualizada',
        description: 'Descrição atualizada',
        subscriber_id: 1,
        is_active: true,
        created_at: '2024-01-01',
        updated_at: '2024-01-02',
      };

      jest.spyOn(playlistService, 'getPlaylistById')
        .mockResolvedValueOnce({
          playlist_id: 1,
          name: 'Playlist Antiga',
          description: 'Descrição antiga',
          subscriber_id: 1,
          is_active: true,
          created_at: '2024-01-01',
          updated_at: '2024-01-01',
        } as any)
        .mockResolvedValueOnce(mockPlaylist as any);

      mockDb.findFirst.mockResolvedValueOnce(null); // Nenhuma playlist com mesmo nome
      mockDb.executeRaw.mockResolvedValue({ rows: [] });

      const result = await playlistService.updatePlaylist(1, {
        name: 'Playlist Atualizada',
      });

      expect(result).toMatchObject(mockPlaylist);
      expect(mockDb.executeRaw).toHaveBeenCalled();
    });

    it('deve lançar erro quando playlist não existe', async () => {
      mockDb.findFirst.mockResolvedValue(null);

      await expect(
        playlistService.updatePlaylist(999, { name: 'Teste' })
      ).rejects.toThrow('Playlist não encontrada');
    });
  });

  describe('deletePlaylist', () => {
    it('deve deletar playlist existente', async () => {
      mockDb.findFirst.mockResolvedValue({ playlist_id: 1 });
      mockDb.executeRaw.mockResolvedValue({ rows: [] });

      await playlistService.deletePlaylist(1);

      expect(mockDb.executeRaw).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE playlists'),
        expect.arrayContaining([1])
      );
    });

    it('deve lançar erro quando playlist não existe', async () => {
      mockDb.findFirst.mockResolvedValue(null);

      await expect(playlistService.deletePlaylist(999)).rejects.toThrow();
    });
  });
});

