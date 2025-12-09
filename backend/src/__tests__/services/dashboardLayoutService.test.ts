/**
 * DashboardLayoutService Tests
 * Testes unitários para o serviço de layouts de dashboard
 */

import { DashboardLayoutService } from '../../services/dashboardLayoutService';
import { getDatabase } from '../../config/database';

// Mocks
jest.mock('../../config/database');

describe('DashboardLayoutService', () => {
  let layoutService: DashboardLayoutService;
  let mockDb: any;

  beforeEach(() => {
    mockDb = {
      executeRaw: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn()
    };
    (getDatabase as jest.Mock).mockReturnValue(mockDb);
    layoutService = new DashboardLayoutService();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createLayout', () => {
    it('deve criar layout com sucesso', async () => {
      const layoutData = {
        widgets: [],
        gridColumns: 12,
        gridRows: 8
      };
      mockDb.executeRaw.mockResolvedValueOnce({ rowCount: 0 }); // Desmarcar outros defaults
      mockDb.executeRaw.mockResolvedValueOnce({
        rows: [{
          id: 1,
          user_id: 1,
          name: 'Test Layout',
          layout_data: JSON.stringify(layoutData),
          is_default: true,
          is_shared: false,
          created_at: new Date(),
          updated_at: new Date()
        }]
      });

      const result = await layoutService.createLayout({
        userId: 1,
        name: 'Test Layout',
        layoutData,
        isDefault: true
      });

      expect(result).toBeDefined();
      expect(result.id).toBe(1);
      expect(result.name).toBe('Test Layout');
    });

    it('deve desmarcar outros layouts default ao criar um novo default', async () => {
      const layoutData = { widgets: [], gridColumns: 12, gridRows: 8 };
      mockDb.executeRaw.mockResolvedValueOnce({ rowCount: 1 }); // Desmarcar outros
      mockDb.executeRaw.mockResolvedValueOnce({
        rows: [{
          id: 1,
          user_id: 1,
          name: 'New Default',
          layout_data: JSON.stringify(layoutData),
          is_default: true,
          is_shared: false,
          created_at: new Date(),
          updated_at: new Date()
        }]
      });

      await layoutService.createLayout({
        userId: 1,
        name: 'New Default',
        layoutData,
        isDefault: true
      });

      expect(mockDb.executeRaw).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE dashboard_layouts'),
        [1]
      );
    });
  });

  describe('getUserLayouts', () => {
    it('deve retornar layouts do usuário', async () => {
      mockDb.findMany.mockResolvedValue([
        {
          id: 1,
          user_id: 1,
          name: 'Layout 1',
          layout_data: '{}',
          is_default: true,
          is_shared: false,
          created_at: new Date(),
          updated_at: new Date()
        }
      ]);

      const result = await layoutService.getUserLayouts(1);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Layout 1');
    });
  });

  describe('getDefaultLayout', () => {
    it('deve retornar layout padrão do usuário', async () => {
      mockDb.findFirst.mockResolvedValue({
        id: 1,
        user_id: 1,
        name: 'Default Layout',
        layout_data: '{}',
        is_default: true,
        is_shared: false,
        created_at: new Date(),
        updated_at: new Date()
      });

      const result = await layoutService.getDefaultLayout(1);

      expect(result).toBeDefined();
      expect(result?.name).toBe('Default Layout');
      expect(result?.isDefault).toBe(true);
    });

    it('deve retornar null se não houver layout padrão', async () => {
      mockDb.findFirst.mockResolvedValue(null);

      const result = await layoutService.getDefaultLayout(1);

      expect(result).toBeNull();
    });
  });
});

