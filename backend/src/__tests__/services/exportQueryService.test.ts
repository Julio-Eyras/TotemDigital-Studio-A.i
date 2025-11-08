/**
 * Export Query Service Tests - Smart Signage v2.1
 * Testes unitários para ExportQueryService
 */

import { ExportQueryService } from '../../services/exportQueryService';
import { getDatabase } from '../../config/database';

// Mock do banco de dados
jest.mock('../../config/database', () => ({
  getDatabase: jest.fn(),
}));

// Mock do sqlValidatorService
jest.mock('../../services/sqlValidatorService', () => ({
  sqlValidatorService: {
    validateSQL: jest.fn().mockResolvedValue({ valid: true }),
  },
}));

describe('ExportQueryService', () => {
  let exportQueryService: ExportQueryService;
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

    exportQueryService = new ExportQueryService();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('createQuery', () => {
    it('deve criar query com dados válidos', async () => {
      const mockQuery = {
        query_id: 1,
        name: 'Query Teste',
        provider: 'PostgreSQL',
        sql_query: 'SELECT * FROM users',
        enabled: true,
        created_at: '2024-01-01',
      };

      mockDb.findFirst.mockResolvedValue(null); // Query não existe
      mockDb.executeRaw.mockResolvedValue({ rows: [mockQuery] });

      const result = await exportQueryService.createQuery(
        {
          name: 'Query Teste',
          provider: 'PostgreSQL',
          sqlQuery: 'SELECT * FROM users',
          exportConfig: {
            outputDirectory: '/tmp',
            fileName: 'export',
            format: 'xlsx',
          },
        },
        1
      );

      expect(result).toBeDefined();
      expect(result.query_id).toBe(1);
      expect(mockDb.executeRaw).toHaveBeenCalled();
    });

    it('deve lançar erro quando query com mesmo nome já existe', async () => {
      mockDb.findFirst.mockResolvedValue({ query_id: 1 });

      await expect(
        exportQueryService.createQuery(
          {
            name: 'Query Existente',
            provider: 'PostgreSQL',
            sqlQuery: 'SELECT * FROM users',
            exportConfig: {
              outputDirectory: '/tmp',
              fileName: 'export',
              format: 'xlsx',
            },
          },
          1
        )
      ).rejects.toThrow('já existe');
    });
  });

  describe('getQueryById', () => {
    it('deve retornar query quando encontrada', async () => {
      const mockQuery = {
        query_id: 1,
        name: 'Query Teste',
        provider: 'PostgreSQL',
        sql_query: 'SELECT * FROM users',
        enabled: true,
      };

      mockDb.findFirst.mockResolvedValue(mockQuery);

      const result = await exportQueryService.getQueryById(1);

      expect(result).toBeDefined();
      expect(result?.query_id).toBe(1);
    });

    it('deve retornar null quando query não encontrada', async () => {
      mockDb.findFirst.mockResolvedValue(null);

      const result = await exportQueryService.getQueryById(999);

      expect(result).toBeNull();
    });
  });

  describe('getAllQueries', () => {
    it('deve listar todas as queries', async () => {
      const mockQueries = [
        {
          query_id: 1,
          name: 'Query 1',
          provider: 'PostgreSQL',
          enabled: true,
        },
      ];

      mockDb.findMany.mockResolvedValueOnce(mockQueries);
      mockDb.findFirst.mockResolvedValueOnce({ total: '1' });

      const result = await exportQueryService.getAllQueries();

      expect(result.data).toEqual(expect.arrayContaining([
        expect.objectContaining({ query_id: 1 })
      ]));
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(25);
    });

    it('deve filtrar queries por provider', async () => {
      mockDb.findMany.mockResolvedValueOnce([]);
      mockDb.findFirst.mockResolvedValueOnce({ total: '0' });

      await exportQueryService.getAllQueries({ provider: 'PostgreSQL' });

      expect(mockDb.findMany).toHaveBeenCalledWith(
        expect.stringContaining('provider ='),
        ['PostgreSQL', 25, 0]
      );
    });
  });

  describe('updateQuery', () => {
    it('deve atualizar query existente', async () => {
      const mockQuery = {
        query_id: 1,
        name: 'Query Atualizada',
        provider: 'PostgreSQL',
        sql_query: 'SELECT * FROM users',
        enabled: true,
      };

      jest.spyOn(exportQueryService, 'getQueryById')
        .mockResolvedValueOnce({
          query_id: 1,
          name: 'Query Antiga',
          provider: 'PostgreSQL',
          sql_query: 'SELECT 1',
          enabled: true,
          export_config: JSON.stringify({ format: 'xlsx' }),
        } as any)
        .mockResolvedValueOnce(mockQuery as any);

      mockDb.findFirst.mockResolvedValue(null); // Sem duplicados
      mockDb.executeRaw.mockResolvedValue({ rows: [mockQuery] });

      const result = await exportQueryService.updateQuery(
        1,
        {
          name: 'Query Atualizada',
        },
        1
      );

      expect(result).toBeDefined();
      expect(mockDb.executeRaw).toHaveBeenCalled();
    });

    it('deve lançar erro quando query não existe', async () => {
      mockDb.findFirst.mockResolvedValue(null);

      await expect(
        exportQueryService.updateQuery(999, { name: 'Teste' }, 1)
      ).rejects.toThrow();
    });
  });

  describe('deleteQuery', () => {
    it('deve deletar query existente', async () => {
      jest.spyOn(exportQueryService, 'getQueryById').mockResolvedValue({
        query_id: 1,
        name: 'Query Teste',
        provider: 'PostgreSQL',
        sql_query: 'SELECT 1',
        enabled: true,
        export_config: JSON.stringify({ format: 'xlsx' }),
      } as any);

      mockDb.findMany.mockResolvedValue([]); // Sem agendamentos
      mockDb.executeRaw.mockResolvedValue({ rows: [] });

      await exportQueryService.deleteQuery(1, 1);

      expect(mockDb.executeRaw).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM export_queries'),
        [1]
      );
    });
  });

  describe('testConnection', () => {
    it('deve testar conexão PostgreSQL', async () => {
      mockDb.findFirst.mockResolvedValue({ id: 1 });

      const result = await exportQueryService.testConnection('PostgreSQL');

      expect(result).toBe(true);
    });
  });
});

