/**
 * Campaigns Routes Integration Tests - Smart Signage v2.1
 * Testes de integração para rotas de campaigns
 */

import request from 'supertest';
import express from 'express';
import { getCampaignService } from '../../services/campaignService';
import { getSubscriberService } from '../../services/subscriberService';

// Mock do serviço
jest.mock('../../services/campaignService');
jest.mock('../../services/subscriberService', () => ({
  getSubscriberService: jest.fn(() => ({
    validatePlanLimits: jest.fn().mockResolvedValue(true),
  })),
}));
jest.mock('../../middleware/auth.middleware', () => ({
  // campaigns router usa authenticateToken
  authenticateToken: (req: any, _res: any, next: any) => {
    req.user = { userId: 1, role: 'admin', subscriberId: 1 };
    req.subscriberId = 1;
    next();
  },
  authorizeRole: () => (_req: any, _res: any, next: any) => next(),
}));
jest.mock('../../middleware/subscriberIsolation.middleware', () => ({
  subscriberIsolationMiddleware: (_req: any, _res: any, next: any) => next(),
}));

import campaignsRouter from '../../routes/campaigns';

const app = express();
app.use(express.json());
app.use('/api/campaigns', campaignsRouter);

describe('Campaigns Routes', () => {
  let mockCampaignService: any;

  beforeEach(() => {
    mockCampaignService = {
      getCampaigns: jest.fn(),
      getCampaignById: jest.fn(),
      createCampaign: jest.fn(),
      updateCampaign: jest.fn(),
      deleteCampaign: jest.fn(),
      reorderCampaignMedias: jest.fn(),
      reorderCampaignPlaylists: jest.fn(),
    };

    (getCampaignService as jest.Mock).mockReturnValue(mockCampaignService);
    (getSubscriberService as unknown as jest.Mock).mockReturnValue({
      validatePlanLimits: jest.fn().mockResolvedValue(true),
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/campaigns', () => {
    it('deve retornar lista de campaigns', async () => {
      const mockCampaigns = {
        campaigns: [
          { id: 1, title: 'Campaign 1', subscriberId: 1 },
          { id: 2, title: 'Campaign 2', subscriberId: 1 },
        ],
        total: 2,
        page: 1,
        limit: 20,
      };

      mockCampaignService.getCampaigns.mockResolvedValue(mockCampaigns);

      const response = await request(app)
        .get('/api/campaigns')
        .query({ page: 1, limit: 20 });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('data');
      expect(response.body.data.data).toHaveLength(2);
    });

    it('deve aplicar filtro de subscriberId', async () => {
      mockCampaignService.getCampaigns.mockResolvedValue({
        campaigns: [],
        total: 0,
        page: 1,
        limit: 20,
      });

      const response = await request(app)
        .get('/api/campaigns')
        .query({ subscriberId: 1 });

      expect(response.status).toBe(200);
      expect(mockCampaignService.getCampaigns).toHaveBeenCalledWith(
        expect.any(Number),
        expect.any(Number),
        expect.objectContaining({ subscriberId: 1 })
      );
    });

    it('deve aplicar filtro de busca', async () => {
      mockCampaignService.getCampaigns.mockResolvedValue({
        campaigns: [{ id: 1, title: 'Test Campaign', subscriberId: 1 }],
        total: 1,
        page: 1,
        limit: 20,
      });

      const response = await request(app)
        .get('/api/campaigns')
        .query({ search: 'Test' });

      expect(response.status).toBe(200);
      expect(mockCampaignService.getCampaigns).toHaveBeenCalledWith(
        expect.any(Number),
        expect.any(Number),
        expect.objectContaining({ search: 'Test' })
      );
    });
  });

  describe('GET /api/campaigns/:id', () => {
    it('deve retornar campaign por ID', async () => {
      const mockCampaign = {
        id: 1,
        title: 'Test Campaign',
        subscriberId: 1,
      };

      mockCampaignService.getCampaignById.mockResolvedValue(mockCampaign);

      const response = await request(app).get('/api/campaigns/1');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data.id).toBe(1);
    });

    it('deve retornar 404 se campaign não encontrada', async () => {
      mockCampaignService.getCampaignById.mockResolvedValue(null);

      const response = await request(app).get('/api/campaigns/999');

      expect(response.status).toBe(404);
    });
  });

  describe('POST /api/campaigns', () => {
    it('deve criar campaign com sucesso', async () => {
      const newCampaign = {
        subscriberId: 1,
        title: 'New Campaign',
        description: 'Test description',
      };

      const createdCampaign = {
        id: 1,
        ...newCampaign,
      };

      mockCampaignService.createCampaign.mockResolvedValue(createdCampaign);

      const response = await request(app)
        .post('/api/campaigns')
        .send(newCampaign);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data.id).toBe(1);
    });

    it('deve retornar 400 se dados inválidos', async () => {
      const invalidCampaign = {
        title: '', // Título vazio
      };

      const response = await request(app)
        .post('/api/campaigns')
        .send(invalidCampaign);

      expect(response.status).toBe(400);
    });
  });

  describe('PUT /api/campaigns/:id/medias/reorder', () => {
    it('deve reordenar mídias da campaign', async () => {
      const reorderData = {
        mediaIds: [3, 1, 2],
      };

      mockCampaignService.reorderCampaignMedias.mockResolvedValue(true);

      const response = await request(app)
        .put('/api/campaigns/1/medias/reorder')
        .send(reorderData);

      expect(response.status).toBe(200);
      expect(mockCampaignService.reorderCampaignMedias).toHaveBeenCalledWith(
        1,
        reorderData.mediaIds,
        1
      );
    });
  });

  describe('PUT /api/campaigns/:id/playlists/reorder', () => {
    it('deve reordenar playlists da campaign', async () => {
      const reorderData = {
        playlistIds: [2, 1, 3],
      };

      mockCampaignService.reorderCampaignPlaylists.mockResolvedValue(true);

      const response = await request(app)
        .put('/api/campaigns/1/playlists/reorder')
        .send(reorderData);

      expect(response.status).toBe(200);
      expect(mockCampaignService.reorderCampaignPlaylists).toHaveBeenCalledWith(
        1,
        reorderData.playlistIds,
        1
      );
    });
  });
});
