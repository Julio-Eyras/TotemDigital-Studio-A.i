/**
 * Subscribers Routes Integration Tests - Smart Signage v2.1
 * Testes de integração para rotas de subscribers
 */

import request from 'supertest';
import express from 'express';
import { getSubscriberService } from '../../services/subscriberService';

// Mock do serviço
jest.mock('../../services/subscriberService');
jest.mock('../../middleware/auth.middleware', () => ({
  authMiddleware: (req: any, res: any, next: any) => {
    req.user = { userId: 1, role: 'admin', subscriberId: 1 };
    next();
  },
  authorizeRole: () => (req: any, res: any, next: any) => next(),
}));
jest.mock('../../middleware/subscriberIsolation.middleware', () => ({
  subscriberIsolationMiddleware: (req: any, res: any, next: any) => next(),
}));

import subscribersRouter from '../../routes/subscribers';

const app = express();
app.use(express.json());
app.use('/api/subscribers', subscribersRouter);

describe('Subscribers Routes', () => {
  let mockSubscriberService: any;

  beforeEach(() => {
    mockSubscriberService = {
      getAllSubscribers: jest.fn(),
      getSubscriberById: jest.fn(),
      createSubscriber: jest.fn(),
      updateSubscriber: jest.fn(),
      deleteSubscriber: jest.fn(),
      getSubscriberStats: jest.fn(),
      getContracts: jest.fn(),
    };

    (getSubscriberService as jest.Mock).mockReturnValue(mockSubscriberService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/subscribers', () => {
    it('deve retornar lista de subscribers', async () => {
      const mockSubscribers = {
        data: [
          { subscriber_id: 1, name: 'Subscriber 1' },
          { subscriber_id: 2, name: 'Subscriber 2' },
        ],
        total: 2,
        page: 1,
        limit: 10,
      };

      mockSubscriberService.getAllSubscribers.mockResolvedValue(mockSubscribers);

      const response = await request(app)
        .get('/api/subscribers')
        .query({ page: 1, limit: 10 });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveLength(2);
    });

    it('deve aplicar filtro de busca', async () => {
      const mockSubscribers = {
        data: [{ subscriber_id: 1, name: 'Test Subscriber' }],
        total: 1,
        page: 1,
        limit: 10,
      };

      mockSubscriberService.getAllSubscribers.mockResolvedValue(mockSubscribers);

      const response = await request(app)
        .get('/api/subscribers')
        .query({ search: 'Test' });

      expect(response.status).toBe(200);
      expect(mockSubscriberService.getAllSubscribers).toHaveBeenCalledWith(
        expect.objectContaining({ search: 'Test' })
      );
    });

    it('deve aplicar filtro de status ativo', async () => {
      mockSubscriberService.getAllSubscribers.mockResolvedValue({
        data: [],
        total: 0,
        page: 1,
        limit: 10,
      });

      const response = await request(app)
        .get('/api/subscribers')
        .query({ is_active: 'true' });

      expect(response.status).toBe(200);
      expect(mockSubscriberService.getAllSubscribers).toHaveBeenCalledWith(
        expect.objectContaining({ is_active: true })
      );
    });
  });

  describe('GET /api/subscribers/:id', () => {
    it('deve retornar subscriber por ID', async () => {
      const mockSubscriber = {
        subscriber_id: 1,
        name: 'Test Subscriber',
        email: 'test@example.com',
      };

      mockSubscriberService.getSubscriberById.mockResolvedValue(mockSubscriber);

      const response = await request(app).get('/api/subscribers/1');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data.subscriber_id).toBe(1);
    });

    it('deve retornar 404 se subscriber não encontrado', async () => {
      mockSubscriberService.getSubscriberById.mockResolvedValue(null);

      const response = await request(app).get('/api/subscribers/999');

      expect(response.status).toBe(404);
    });
  });

  describe('POST /api/subscribers', () => {
    it('deve criar subscriber com sucesso', async () => {
      const newSubscriber = {
        name: 'New Subscriber',
        contract_id: 1,
        email: 'new@example.com',
      };

      const createdSubscriber = {
        subscriber_id: 1,
        ...newSubscriber,
      };

      mockSubscriberService.createSubscriber.mockResolvedValue(createdSubscriber);

      const response = await request(app)
        .post('/api/subscribers')
        .send(newSubscriber);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data.subscriber_id).toBe(1);
    });

    it('deve retornar 400 se dados inválidos', async () => {
      const invalidSubscriber = {
        name: '', // Nome vazio
      };

      const response = await request(app)
        .post('/api/subscribers')
        .send(invalidSubscriber);

      expect(response.status).toBe(400);
    });
  });

  describe('PUT /api/subscribers/:id', () => {
    it('deve atualizar subscriber com sucesso', async () => {
      const updateData = {
        name: 'Updated Name',
        email: 'updated@example.com',
      };

      const updatedSubscriber = {
        subscriber_id: 1,
        ...updateData,
      };

      mockSubscriberService.updateSubscriber.mockResolvedValue(updatedSubscriber);

      const response = await request(app)
        .put('/api/subscribers/1')
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data.name).toBe('Updated Name');
    });

    it('deve retornar 404 se subscriber não encontrado', async () => {
      mockSubscriberService.updateSubscriber.mockResolvedValue(null);

      const response = await request(app)
        .put('/api/subscribers/999')
        .send({ name: 'Test' });

      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /api/subscribers/:id', () => {
    it('deve deletar subscriber com sucesso', async () => {
      mockSubscriberService.deleteSubscriber.mockResolvedValue(true);

      const response = await request(app).delete('/api/subscribers/1');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message');
    });

    it('deve retornar 404 se subscriber não encontrado', async () => {
      mockSubscriberService.deleteSubscriber.mockResolvedValue(false);

      const response = await request(app).delete('/api/subscribers/999');

      expect(response.status).toBe(404);
    });
  });

  describe('GET /api/subscribers/:id/stats', () => {
    it('deve retornar estatísticas do subscriber', async () => {
      const mockStats = {
        localsCount: 5,
        totemsCount: 10,
        media_count: 50,
        playlist_count: 20,
        campaign_count: 5,
        storage_used_gb: 5.0,
        storage_limit_gb: 10,
        plan_limits: {
          medias: 100,
          playlists: 50,
          campaigns: 20,
        },
      };

      mockSubscriberService.getSubscriberStats.mockResolvedValue(mockStats);

      const response = await request(app).get('/api/subscribers/1/stats');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('media_count', 50);
      expect(response.body.data).toHaveProperty('plan_limits');
    });
  });
});
