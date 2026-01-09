/**
 * Playlists Routes Integration Tests - Smart Signage v2.1
 * Testes de integração para rotas de playlists
 */

import request from 'supertest';
import express from 'express';
import { getPlaylistService } from '../../services/playlistService';

// Mock do serviço
jest.mock('../../services/playlistService');
jest.mock('../../services/subscriberService', () => ({
  getSubscriberService: jest.fn(() => ({
    validatePlanLimits: jest.fn().mockResolvedValue(true),
  })),
}));
jest.mock('../../middleware/auth.middleware', () => ({
  authMiddleware: (req: any, res: any, next: any) => {
    req.user = { userId: 1, role: 'admin', subscriberId: 1 };
    req.subscriberId = 1;
    next();
  },
  authorizeRole: () => (req: any, res: any, next: any) => next(),
}));
jest.mock('../../middleware/subscriberIsolation.middleware', () => ({
  subscriberIsolationMiddleware: (req: any, res: any, next: any) => next(),
}));

import playlistsRouter from '../../routes/playlists';

const app = express();
app.use(express.json());
app.use('/api/playlists', playlistsRouter);

describe('Playlists Routes', () => {
  let mockPlaylistService: any;

  beforeEach(() => {
    mockPlaylistService = {
      getAllPlaylists: jest.fn(),
      getPlaylistById: jest.fn(),
      createPlaylist: jest.fn(),
      updatePlaylist: jest.fn(),
      deletePlaylist: jest.fn(),
      reorderPlaylistMedia: jest.fn(),
    };

    (getPlaylistService as jest.Mock).mockReturnValue(mockPlaylistService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/playlists', () => {
    it('deve retornar lista de playlists', async () => {
      const mockPlaylists = {
        playlists: [
          { playlist_id: 1, name: 'Playlist 1', subscriber_id: 1 },
          { playlist_id: 2, name: 'Playlist 2', subscriber_id: 1 },
        ],
        total: 2,
        page: 1,
        limit: 10,
      };

      mockPlaylistService.getAllPlaylists.mockResolvedValue(mockPlaylists);

      const response = await request(app)
        .get('/api/playlists')
        .query({ page: 1, limit: 10 });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveLength(2);
    });

    it('deve aplicar filtro de subscriberId', async () => {
      mockPlaylistService.getAllPlaylists.mockResolvedValue({
        playlists: [],
        total: 0,
        page: 1,
        limit: 10,
      });

      const response = await request(app)
        .get('/api/playlists')
        .query({ subscriberId: 1 });

      expect(response.status).toBe(200);
      expect(mockPlaylistService.getAllPlaylists).toHaveBeenCalledWith(
        expect.objectContaining({ subscriberId: 1 })
      );
    });
  });

  describe('GET /api/playlists/:id', () => {
    it('deve retornar playlist por ID', async () => {
      const mockPlaylist = {
        playlist_id: 1,
        name: 'Test Playlist',
        subscriber_id: 1,
      };

      mockPlaylistService.getPlaylistById.mockResolvedValue(mockPlaylist);

      const response = await request(app).get('/api/playlists/1');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data.playlist_id).toBe(1);
    });

    it('deve retornar 404 se playlist não encontrada', async () => {
      mockPlaylistService.getPlaylistById.mockResolvedValue(null);

      const response = await request(app).get('/api/playlists/999');

      expect(response.status).toBe(404);
    });
  });

  describe('POST /api/playlists', () => {
    it('deve criar playlist com sucesso', async () => {
      const newPlaylist = {
        subscriberId: 1,
        name: 'New Playlist',
        description: 'Test description',
      };

      const createdPlaylist = {
        playlist_id: 1,
        ...newPlaylist,
      };

      mockPlaylistService.createPlaylist.mockResolvedValue(createdPlaylist);

      const response = await request(app)
        .post('/api/playlists')
        .send(newPlaylist);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data.playlist_id).toBe(1);
    });

    it('deve retornar 400 se dados inválidos', async () => {
      const invalidPlaylist = {
        name: '', // Nome vazio
      };

      const response = await request(app)
        .post('/api/playlists')
        .send(invalidPlaylist);

      expect(response.status).toBe(400);
    });
  });

  describe('PUT /api/playlists/:id/media/reorder', () => {
    it('deve reordenar mídias da playlist', async () => {
      const reorderData = {
        mediaIds: [3, 1, 2],
      };

      mockPlaylistService.reorderPlaylistMedia.mockResolvedValue(true);

      const response = await request(app)
        .put('/api/playlists/1/media/reorder')
        .send(reorderData);

      expect(response.status).toBe(200);
      expect(mockPlaylistService.reorderPlaylistMedia).toHaveBeenCalledWith(
        1,
        reorderData.mediaIds
      );
    });
  });
});
