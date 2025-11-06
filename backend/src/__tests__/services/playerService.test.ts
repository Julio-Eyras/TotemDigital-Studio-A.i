/**
 * Player Service Tests - Smart Signage v2.1
 */

import { PlayerService } from '../../services/playerService';
import { getDatabase } from '../../config/database';

jest.mock('../../config/database', () => ({
  getDatabase: jest.fn(),
}));

describe('PlayerService', () => {
  let service: PlayerService;
  let mockDb: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockDb = {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue(null),
      executeRaw: jest.fn().mockResolvedValue({ rows: [] }),
    };

    (getDatabase as jest.Mock).mockReturnValue(mockDb);
    service = new PlayerService();
  });

  describe('getAllPlayers', () => {
    it('deve listar players com paginação', async () => {
      const mockPlayers = [
        {
          totem_id: 1,
          name: 'Player 1',
          location: 'Lobby',
          client_id: 10,
          is_active: true,
          last_heartbeat: null,
          current_playlist_id: null,
          status: 'offline',
          created_at: '2024-01-01',
          updated_at: '2024-01-02',
        },
      ];

      mockDb.findMany.mockResolvedValueOnce(mockPlayers);
      mockDb.findFirst.mockResolvedValueOnce({ total: '1' });

      const result = await service.getAllPlayers({ page: 1, limit: 5 });

      expect(result.data).toEqual(mockPlayers);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(5);
    });
  });

  describe('createPlayer', () => {
    it('deve criar player quando não existe duplicado', async () => {
      const newPlayer = {
        totem_id: 1,
        name: 'Totem A',
        location: 'Hall',
        client_id: 3,
        is_active: true,
        last_heartbeat: null,
        current_playlist_id: null,
        status: 'offline',
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
      };

      mockDb.findFirst
        .mockResolvedValueOnce(null) // Verificar duplicado
        .mockResolvedValueOnce(newPlayer); // Buscar player criado

      mockDb.executeRaw.mockResolvedValue({ rows: [{ totem_id: 1 }] });

      const result = await service.createPlayer({ name: 'Totem A', location: 'Hall', clientId: 3 });

      expect(mockDb.executeRaw).toHaveBeenCalled();
      expect(result).toEqual(newPlayer);
    });
  });

  describe('updatePlayer', () => {
    it('deve atualizar player existente', async () => {
      const existingPlayer = {
        totem_id: 1,
        name: 'Totem A',
        location: 'Hall',
        client_id: 3,
        is_active: true,
        last_heartbeat: null,
        current_playlist_id: null,
        status: 'online',
      };

      const updatedPlayer = { ...existingPlayer, name: 'Totem B' };

      mockDb.findFirst
        .mockResolvedValueOnce(existingPlayer) // getPlayerById (existente)
        .mockResolvedValueOnce(null) // Verificar nome duplicado
        .mockResolvedValueOnce(updatedPlayer); // getPlayerById (atualizado)

      const result = await service.updatePlayer(1, { name: 'Totem B' });

      expect(mockDb.executeRaw).toHaveBeenCalledWith(expect.stringContaining('UPDATE totems'), expect.arrayContaining(['Totem B', 1]));
      expect(result).toEqual(updatedPlayer);
    });
  });

  describe('deletePlayer', () => {
    it('deve marcar player como inativo', async () => {
      const existingPlayer = {
        totem_id: 1,
        name: 'Totem A',
        status: 'online',
      };

      mockDb.findFirst.mockResolvedValueOnce(existingPlayer);

      await service.deletePlayer(1);

      expect(mockDb.executeRaw).toHaveBeenCalledWith(expect.stringContaining('SET is_active = false'), [1]);
    });
  });

  describe('assignPlaylist', () => {
    it('deve atribuir playlist a player existente', async () => {
      mockDb.findFirst
        .mockResolvedValueOnce({ totem_id: 1, name: 'Totem A' }) // getPlayerById
        .mockResolvedValueOnce({ playlist_id: 5 }); // playlist

      await service.assignPlaylist(1, 5);

      expect(mockDb.executeRaw).toHaveBeenCalledWith(expect.stringContaining('SET current_playlist_id = $1'), [5, 1]);
    });
  });

  describe('getPlayerStatus', () => {
    it('deve retornar status e playlist atual', async () => {
      mockDb.findFirst
        .mockResolvedValueOnce({
          totem_id: 1,
          name: 'Totem A',
          status: 'online',
          last_heartbeat: '2024-01-01T10:00:00Z',
          current_playlist_id: 5,
        })
        .mockResolvedValueOnce({ playlist_id: 5, name: 'Playlist X' });

      const status = await service.getPlayerStatus(1);

      expect(status).toEqual({
        status: 'online',
        lastHeartbeat: '2024-01-01T10:00:00Z',
        currentPlaylist: { playlist_id: 5, name: 'Playlist X' },
      });
    });
  });
});
