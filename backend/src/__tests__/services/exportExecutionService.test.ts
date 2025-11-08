import { ExportExecutionService } from '../../services/exportExecutionService';
import { getDatabase } from '../../config/database';

jest.mock('../../config/database', () => ({
  getDatabase: jest.fn(),
}));

describe('ExportExecutionService', () => {
  let mockDb: any;
  let exportExecutionService: ExportExecutionService;

  beforeEach(() => {
    jest.clearAllMocks();

    mockDb = {
      findMany: jest.fn(),
      findFirst: jest.fn(),
    };

    (getDatabase as jest.Mock).mockReturnValue(mockDb);

    exportExecutionService = new ExportExecutionService();
  });

  describe('getExecutions', () => {
    it('deve retornar execuções com paginação', async () => {
      mockDb.findMany.mockResolvedValueOnce([
        {
          execution_id: 1,
          schedule_id: 10,
          query_id: 5,
          job_id: 'job-1',
          status: 'completed',
          started_at: '2025-11-07T10:00:00Z',
          completed_at: '2025-11-07T10:01:00Z',
          records_exported: 20,
          file_path: '/tmp/file.xlsx',
          file_size: 1234,
          error_message: null,
          execution_log: 'ok',
          created_at: '2025-11-07T10:00:00Z',
          schedule_name: 'Schedule Teste',
          query_name: 'Query Teste',
        },
      ]);

      mockDb.findFirst.mockResolvedValueOnce({ total: '1' });

      const result = await exportExecutionService.getExecutions({ page: 2, limit: 10 });

      expect(mockDb.findMany).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY ee.created_at DESC LIMIT ? OFFSET ?'),
        expect.arrayContaining([10, 10])
      );
      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(2);
      expect(result.limit).toBe(10);
    });

    it('deve aplicar filtros opcionais', async () => {
      mockDb.findMany.mockResolvedValueOnce([]);
      mockDb.findFirst.mockResolvedValueOnce({ total: '0' });

      await exportExecutionService.getExecutions({
        scheduleId: 1,
        queryId: 2,
        status: 'failed',
        startDate: '2025-01-01',
        endDate: '2025-12-31',
        search: 'teste',
      });

      expect(mockDb.findMany).toHaveBeenCalledWith(
        expect.stringContaining('ee.schedule_id = ?'),
        expect.arrayContaining(['%teste%', '%teste%'])
      );
    });
  });

  describe('getExecutionById', () => {
    it('deve retornar execução quando encontrada', async () => {
      mockDb.findFirst.mockResolvedValueOnce({
        execution_id: 2,
        schedule_id: null,
        query_id: 3,
        status: 'failed',
        created_at: '2025-11-07T09:00:00Z',
      });

      const execution = await exportExecutionService.getExecutionById(2);

      expect(execution).not.toBeNull();
      expect(execution?.execution_id).toBe(2);
    });

    it('deve retornar null quando não encontrada', async () => {
      mockDb.findFirst.mockResolvedValueOnce(null);

      const execution = await exportExecutionService.getExecutionById(999);

      expect(execution).toBeNull();
    });
  });

  describe('getExecutionFilePath', () => {
    it('deve retornar informações do arquivo quando disponível', async () => {
      mockDb.findFirst.mockResolvedValueOnce({
        file_path: '/tmp/export.xlsx',
        query_name: 'Query Teste',
        created_at: '2025-11-07T09:00:00Z',
      });

      const fileInfo = await exportExecutionService.getExecutionFilePath(3);

      expect(fileInfo).not.toBeNull();
      expect(fileInfo?.filePath).toBe('/tmp/export.xlsx');
      expect(fileInfo?.fileName).toContain('Query Teste');
    });

    it('deve retornar null quando arquivo não existe', async () => {
      mockDb.findFirst.mockResolvedValueOnce(null);

      const fileInfo = await exportExecutionService.getExecutionFilePath(3);

      expect(fileInfo).toBeNull();
    });
  });
});

