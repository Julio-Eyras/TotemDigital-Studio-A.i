/**
 * Totem Service Tests - Smart Signage v2.1
 * Testes unitários para TotemService
 */

import { TotemService } from '../../services/totemService';
import { getDatabase } from '../../config/database';

// Mock do banco de dados
jest.mock('../../config/database', () => ({
  getDatabase: jest.fn(),
}));

describe('TotemService', () => {
  let totemService: TotemService;
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

    totemService = new TotemService();
  });

  describe('getTotems', () => {
    it('deve listar totems com paginação', async () => {
      const mockTotems = [
        {
          id: 1,
          identifier: 'TOTEM-001',
          status: 'online',
          active: true,
          lastHeartbeat: '2024-01-01',
          createdAt: '2024-01-01',
        },
      ];

      mockDb.findMany.mockResolvedValue(mockTotems);
      mockDb.findFirst.mockImplementation((query: string) => {
        if (query.includes('COUNT(*) as total')) {
          return { total: 1 };
        }
        if (query.includes('campaign_totems')) {
          return { count: 2 };
        }
        if (query.includes('playlists')) {
          return { count: 1 };
        }
        return { count: 0 };
      });

      const result = await totemService.getTotems(1, 20);

      expect(result.totems).toBeDefined();
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });

    it('deve filtrar totems por status', async () => {
      mockDb.findMany.mockResolvedValue([]);
      mockDb.findFirst.mockResolvedValue({ total: 0 });

      await totemService.getTotems(1, 20, { status: 'online' });

      expect(mockDb.findMany).toHaveBeenCalledWith(
        expect.stringContaining('status ='),
        expect.arrayContaining(['online'])
      );
    });
  });

  describe('getTotemById', () => {
    it('deve retornar totem quando encontrado', async () => {
      const mockTotem = {
        id: 1,
        identifier: 'TOTEM-001',
        status: 'online',
        active: true,
      };

      mockDb.findFirst
        .mockResolvedValueOnce(mockTotem) // Buscar totem
        .mockResolvedValueOnce({ count: 2 }) // getTotemStats - campaignCount
        .mockResolvedValueOnce({ count: 1 }); // getTotemStats - playlistCount

      const result = await totemService.getTotemById(1);

      expect(result).toBeDefined();
      expect(result?.id).toBe(1);
    });

    it('deve retornar null quando totem não encontrado', async () => {
      mockDb.findFirst.mockResolvedValue(null);

      const result = await totemService.getTotemById(999);

      expect(result).toBeNull();
    });
  });

  describe('getTotemByUin', () => {
    it('deve retornar totem quando encontrado por UIN', async () => {
      const mockTotem = {
        id: 1,
        identifier: 'TOTEM-001',
        uin: 'ABC123',
        status: 'online',
        active: true,
      };

      mockDb.findFirst.mockResolvedValue(mockTotem);

      const result = await totemService.getTotemByUin('ABC123');

      expect(result).toEqual(mockTotem);
    });

    it('deve retornar null quando totem não encontrado por UIN', async () => {
      mockDb.findFirst.mockResolvedValue(null);

      const result = await totemService.getTotemByUin('INVALID');

      expect(result).toBeNull();
    });
  });

  describe('createTotem', () => {
    it('deve criar totem com dados válidos', async () => {
      const mockTotem = {
        id: 1,
        identifier: 'TOTEM-001',
        status: 'offline',
        active: true,
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01',
      };

      mockDb.findFirst
        .mockResolvedValueOnce(null) // Verificar duplicidade
        .mockResolvedValueOnce(mockTotem) // getTotemById - totem
        .mockResolvedValueOnce({ count: 0 })
        .mockResolvedValueOnce({ count: 0 })
        .mockResolvedValueOnce(mockTotem)
        .mockResolvedValueOnce({ count: 0 })
        .mockResolvedValueOnce({ count: 0 });

      mockDb.executeRaw.mockResolvedValue({ lastInsertRowid: 1 });

      const result = await totemService.createTotem(
        {
          identifier: 'TOTEM-001',
          description: 'Totem Teste',
        },
        1
      );

      expect(result).toBeDefined();
      expect(mockDb.executeRaw).toHaveBeenCalled();
    });

    it('deve lançar erro quando identifier já existe', async () => {
      mockDb.findFirst.mockResolvedValue({ totem_id: 1 });

      await expect(
        totemService.createTotem(
          {
            identifier: 'EXISTING',
          },
          1
        )
      ).rejects.toThrow();
    });
  });

  describe('updateTotem', () => {
    it('deve atualizar totem existente', async () => {
      const mockTotem = {
        id: 1,
        identifier: 'TOTEM-001',
        description: 'Descrição Atualizada',
        status: 'online',
        active: true,
      };

      mockDb.findFirst
        .mockResolvedValueOnce({ totem_id: 1 }) // Verificar existência
        .mockResolvedValueOnce(mockTotem) // getTotemById inicial
        .mockResolvedValueOnce({ count: 2 })
        .mockResolvedValueOnce({ count: 1 })
        .mockResolvedValueOnce(mockTotem) // getTotemById final
        .mockResolvedValueOnce({ count: 2 })
        .mockResolvedValueOnce({ count: 1 });
      
      mockDb.executeRaw.mockResolvedValue({ rows: [] });

      const result = await totemService.updateTotem(
        1,
        { description: 'Descrição Atualizada' },
        1
      );

      expect(result).toBeDefined();
      expect(mockDb.executeRaw).toHaveBeenCalled();
    });

    it('deve lançar erro quando totem não existe', async () => {
      mockDb.findFirst.mockResolvedValue(null);

      await expect(
        totemService.updateTotem(999, { description: 'Teste' }, 1)
      ).rejects.toThrow();
    });
  });

  describe('deleteTotem', () => {
    it('deve deletar totem existente', async () => {
      mockDb.findFirst.mockResolvedValue({ totem_id: 1 });
      mockDb.executeRaw.mockResolvedValue({ rows: [] });

      await totemService.deleteTotem(1, 1);

      expect(mockDb.executeRaw).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE totems'),
        [1]
      );
    });
  });

  describe('processHeartbeat', () => {
    it('deve processar heartbeat e atualizar totem', async () => {
      const mockTotem = {
        id: 1,
        identifier: 'TOTEM-001',
        status: 'offline',
        lastHeartbeat: '2024-01-01',
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01',
      };

      mockDb.findFirst
        .mockResolvedValueOnce(mockTotem) // getTotemById inicial
        .mockResolvedValueOnce({ count: 0 })
        .mockResolvedValueOnce({ count: 0 })
        .mockResolvedValueOnce({ ...mockTotem, status: 'online' }) // getTotemById final
        .mockResolvedValueOnce({ count: 0 })
        .mockResolvedValueOnce({ count: 0 });

      mockDb.executeRaw.mockResolvedValue({ rows: [] });

      const result = await totemService.processHeartbeat({
        totemId: 1,
        status: 'online',
        version: '1.0.0',
      });

      expect(mockDb.executeRaw).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE totems'),
        expect.arrayContaining([1])
      );
      expect(result.status).toBe('online');
    });

    it('deve lançar erro quando totem não existe', async () => {
      mockDb.findFirst.mockResolvedValue(null);

      await expect(
        totemService.processHeartbeat({
          totemId: 999,
          status: 'online',
        })
      ).rejects.toThrow('Totem não encontrado');
    });
  });
});

