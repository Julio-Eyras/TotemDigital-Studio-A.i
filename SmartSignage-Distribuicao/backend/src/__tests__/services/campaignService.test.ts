/**
 * Campaign Service Tests - Smart Signage v2.1
 * Testes unitários para CampaignService
 */

import { CampaignService } from '../../services/campaignService';
import { getDatabase } from '../../config/database';

// Mock do banco de dados
jest.mock('../../config/database', () => ({
  getDatabase: jest.fn(),
}));

describe('CampaignService', () => {
  let campaignService: CampaignService;
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

    campaignService = new CampaignService();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('getCampaigns', () => {
    it('deve listar campanhas com paginação', async () => {
      const mockCampaigns = [
        {
          id: 1,
          clientId: 1,
          title: 'Campanha Teste',
          status: 'active',
          isActive: true,
          createdAt: '2024-01-01',
          updatedAt: '2024-01-01',
        },
      ];

      mockDb.findMany.mockResolvedValue(mockCampaigns);
      mockDb.findFirst.mockResolvedValue({ total: 1 });

      const result = await campaignService.getCampaigns(1, 20);

      expect(result.campaigns[0]).toMatchObject(mockCampaigns[0]);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });

    it('deve filtrar campanhas por cliente', async () => {
      mockDb.findMany.mockResolvedValue([]);
      mockDb.findFirst.mockResolvedValue({ total: 0 });

      await campaignService.getCampaigns(1, 20, { clientId: 1 });

      expect(mockDb.findMany).toHaveBeenCalledWith(
        expect.stringContaining('client_id ='),
        expect.arrayContaining([1])
      );
    });

    it('deve filtrar campanhas por status', async () => {
      mockDb.findMany.mockResolvedValue([]);
      mockDb.findFirst.mockResolvedValue({ total: 0 });

      await campaignService.getCampaigns(1, 20, { status: 'active' });

      expect(mockDb.findMany).toHaveBeenCalledWith(
        expect.stringContaining('status ='),
        expect.arrayContaining(['active'])
      );
    });
  });

  describe('getCampaignById', () => {
    it('deve retornar campanha quando encontrada', async () => {
      const mockCampaign = {
        id: 1,
        clientId: 1,
        title: 'Campanha Teste',
        status: 'active',
        isActive: true,
      };

      mockDb.findFirst.mockResolvedValue(mockCampaign);

      const result = await campaignService.getCampaignById(1);

      expect(result).toMatchObject(mockCampaign);
    });

    it('deve retornar null quando campanha não encontrada', async () => {
      mockDb.findFirst.mockResolvedValue(null);

      const result = await campaignService.getCampaignById(999);

      expect(result).toBeNull();
    });
  });

  describe('createCampaign', () => {
    it('deve criar campanha com dados válidos', async () => {
      const mockCampaign = {
        id: 1,
        clientId: 1,
        title: 'Nova Campanha',
        status: 'draft',
        isActive: false,
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01',
      };

      mockDb.findFirst.mockResolvedValueOnce({ client_id: 1 });
      jest.spyOn(campaignService, 'getCampaignById').mockResolvedValueOnce(mockCampaign as any);
      mockDb.executeRaw.mockResolvedValue({ lastInsertRowid: 1 });

      const result = await campaignService.createCampaign(
        {
          clientId: 1,
          title: 'Nova Campanha',
        },
        1 // userId
      );

      expect(result).toMatchObject(mockCampaign);
      expect(mockDb.executeRaw).toHaveBeenCalled();
    });

    it('deve validar datas de início e fim', async () => {
      const startDate = new Date('2024-12-01');
      const endDate = new Date('2024-11-01'); // Data final antes da inicial

      await expect(
        campaignService.createCampaign(
          {
            clientId: 1,
            title: 'Campanha Inválida',
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
          },
          1
        )
      ).rejects.toThrow();
    });
  });

  describe('updateCampaign', () => {
    it('deve atualizar campanha existente', async () => {
      const mockCampaign = {
        id: 1,
        clientId: 1,
        title: 'Campanha Atualizada',
        status: 'active',
        isActive: true,
      };

      jest.spyOn(campaignService, 'getCampaignById')
        .mockResolvedValueOnce({
          id: 1,
          clientId: 1,
          title: 'Campanha Original',
          status: 'draft',
          isActive: false,
        } as any)
        .mockResolvedValueOnce(mockCampaign as any);

      mockDb.executeRaw.mockResolvedValue({ rows: [] });

      const result = await campaignService.updateCampaign(
        1,
        { title: 'Campanha Atualizada' },
        1
      );

      expect(result).toMatchObject(mockCampaign);
      expect(mockDb.executeRaw).toHaveBeenCalled();
    });

    it('deve lançar erro quando campanha não existe', async () => {
      mockDb.findFirst.mockResolvedValue(null);

      await expect(
        campaignService.updateCampaign(999, { title: 'Teste' }, 1)
      ).rejects.toThrow();
    });
  });

  describe('deleteCampaign', () => {
    it('deve deletar campanha existente', async () => {
      jest.spyOn(campaignService, 'getCampaignById').mockResolvedValue({
        id: 1,
        clientId: 1,
        title: 'Campanha',
        status: 'draft',
        isActive: true,
      } as any);
      mockDb.findFirst
        .mockResolvedValueOnce({ count: 0 })
        .mockResolvedValueOnce({ count: 0 });
      mockDb.executeRaw.mockResolvedValue({ rows: [] });

      await campaignService.deleteCampaign(1, 1);

      expect(mockDb.executeRaw).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM campaigns'),
        [1]
      );
    });
  });

  describe('updateCampaign - ativação', () => {
    it('deve ativar campanha via updateCampaign', async () => {
      const mockCampaign = {
        id: 1,
        status: 'active',
        isActive: true,
      };

      jest.spyOn(campaignService, 'getCampaignById')
        .mockResolvedValueOnce({
          id: 1,
          clientId: 1,
          title: 'Campanha',
          status: 'draft',
          isActive: false,
        } as any)
        .mockResolvedValueOnce(mockCampaign as any);
       
      mockDb.executeRaw.mockResolvedValue({ rows: [] });

      const result = await campaignService.updateCampaign(
        1,
        { status: 'active', isActive: true },
        1
      );

      expect(result.isActive).toBe(true);
      expect(result.status).toBe('active');
    });
  });

  describe('updateCampaign - pausa', () => {
    it('deve pausar campanha via updateCampaign', async () => {
      const mockCampaign = {
        id: 1,
        status: 'paused',
        isActive: false,
      };

      jest.spyOn(campaignService, 'getCampaignById')
        .mockResolvedValueOnce({
          id: 1,
          clientId: 1,
          title: 'Campanha',
          status: 'draft',
          isActive: false,
        } as any)
        .mockResolvedValueOnce(mockCampaign as any);
       
      mockDb.executeRaw.mockResolvedValue({ rows: [] });

      const result = await campaignService.updateCampaign(
        1,
        { status: 'paused', isActive: false },
        1
      );

      expect(result.isActive).toBe(false);
      expect(result.status).toBe('paused');
    });
  });
});

