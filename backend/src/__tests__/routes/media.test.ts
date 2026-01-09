/**
 * Media Routes Integration Tests - Smart Signage v2.1
 * Testes de integração para rotas de media
 */

import request from 'supertest';
import express from 'express';
import { getMediaService } from '../../services/mediaService';
import { StorageService } from '../../services/storageService';

// Mock do serviço
jest.mock('../../services/mediaService');
jest.mock('../../services/storageService');
jest.mock('../../services/subscriberService', () => ({
  getSubscriberService: jest.fn(() => ({
    validatePlanLimits: jest.fn().mockResolvedValue(true),
    validateStorageLimit: jest.fn().mockResolvedValue(true),
    getSubscriberStorageUsage: jest.fn().mockResolvedValue(0),
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

import mediaRouter from '../../routes/media';

const app = express();
app.use(express.json());
app.use('/api/media', mediaRouter);

describe('Media Routes', () => {
  let mockMediaService: any;
  let mockStorageService: any;

  beforeEach(() => {
    mockMediaService = {
      getMedia: jest.fn(),
      getMediaById: jest.fn(),
      createMedia: jest.fn(),
      updateMedia: jest.fn(),
      deleteMedia: jest.fn(),
    };

    mockStorageService = {
      getSubscriberStorageUsage: jest.fn().mockResolvedValue(0),
      checkSubscriberQuota: jest.fn().mockResolvedValue({
        allowed: true,
        currentUsage: 0,
        quota: 5368709120, // 5GB
        available: 5368709120,
      }),
    };

    (getMediaService as jest.Mock).mockReturnValue(mockMediaService);
    (StorageService as jest.Mock).mockImplementation(() => mockStorageService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/media', () => {
    it('deve retornar lista de mídias', async () => {
      const mockMedia = {
        media: [
          { media_id: 1, title: 'Media 1', subscriber_id: 1 },
          { media_id: 2, title: 'Media 2', subscriber_id: 1 },
        ],
        total: 2,
        page: 1,
        limit: 20,
      };

      mockMediaService.getMedia.mockResolvedValue(mockMedia);

      const response = await request(app)
        .get('/api/media')
        .query({ page: 1, limit: 20 });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveLength(2);
    });

    it('deve aplicar filtro de subscriberId', async () => {
      mockMediaService.getMedia.mockResolvedValue({
        media: [],
        total: 0,
        page: 1,
        limit: 20,
      });

      const response = await request(app)
        .get('/api/media')
        .query({ subscriberId: 1 });

      expect(response.status).toBe(200);
      expect(mockMediaService.getMedia).toHaveBeenCalledWith(
        expect.any(Number),
        expect.any(Number),
        expect.objectContaining({ subscriberId: 1 })
      );
    });

    it('deve aplicar filtro de busca', async () => {
      mockMediaService.getMedia.mockResolvedValue({
        media: [{ media_id: 1, title: 'Test Media', subscriber_id: 1 }],
        total: 1,
        page: 1,
        limit: 20,
      });

      const response = await request(app)
        .get('/api/media')
        .query({ search: 'Test' });

      expect(response.status).toBe(200);
      expect(mockMediaService.getMedia).toHaveBeenCalledWith(
        expect.any(Number),
        expect.any(Number),
        expect.objectContaining({ search: 'Test' })
      );
    });

    it('deve aplicar filtros de data', async () => {
      mockMediaService.getMedia.mockResolvedValue({
        media: [],
        total: 0,
        page: 1,
        limit: 20,
      });

      const response = await request(app)
        .get('/api/media')
        .query({ createdFrom: '2026-01-01', createdTo: '2026-01-31' });

      expect(response.status).toBe(200);
      expect(mockMediaService.getMedia).toHaveBeenCalledWith(
        expect.any(Number),
        expect.any(Number),
        expect.objectContaining({
          createdFrom: '2026-01-01',
          createdTo: '2026-01-31',
        })
      );
    });
  });

  describe('GET /api/media/:id', () => {
    it('deve retornar mídia por ID', async () => {
      const mockMedia = {
        media_id: 1,
        title: 'Test Media',
        subscriber_id: 1,
      };

      mockMediaService.getMediaById.mockResolvedValue(mockMedia);

      const response = await request(app).get('/api/media/1');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data.media_id).toBe(1);
    });

    it('deve retornar 404 se mídia não encontrada', async () => {
      mockMediaService.getMediaById.mockResolvedValue(null);

      const response = await request(app).get('/api/media/999');

      expect(response.status).toBe(404);
    });
  });

  describe('POST /api/media', () => {
    it('deve criar mídia com sucesso', async () => {
      const newMedia = {
        subscriberId: 1,
        title: 'New Media',
        description: 'Test description',
        mediaType: 'image',
      };

      const createdMedia = {
        media_id: 1,
        ...newMedia,
      };

      mockMediaService.createMedia.mockResolvedValue(createdMedia);

      const response = await request(app)
        .post('/api/media')
        .send(newMedia);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data.media_id).toBe(1);
    });

    it('deve retornar 400 se dados inválidos', async () => {
      const invalidMedia = {
        title: '', // Título vazio
      };

      const response = await request(app)
        .post('/api/media')
        .send(invalidMedia);

      expect(response.status).toBe(400);
    });
  });

  describe('PUT /api/media/:id', () => {
    it('deve atualizar mídia com sucesso', async () => {
      const updateData = {
        title: 'Updated Media',
        description: 'Updated description',
      };

      const updatedMedia = {
        media_id: 1,
        ...updateData,
      };

      mockMediaService.updateMedia.mockResolvedValue(updatedMedia);

      const response = await request(app)
        .put('/api/media/1')
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data.title).toBe('Updated Media');
    });

    it('deve retornar 404 se mídia não encontrada', async () => {
      mockMediaService.updateMedia.mockResolvedValue(null);

      const response = await request(app)
        .put('/api/media/999')
        .send({ title: 'Test' });

      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /api/media/:id', () => {
    it('deve deletar mídia com sucesso', async () => {
      mockMediaService.deleteMedia.mockResolvedValue(true);

      const response = await request(app).delete('/api/media/1');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message');
    });

    it('deve retornar 404 se mídia não encontrada', async () => {
      mockMediaService.deleteMedia.mockResolvedValue(false);

      const response = await request(app).delete('/api/media/999');

      expect(response.status).toBe(404);
    });
  });
});
