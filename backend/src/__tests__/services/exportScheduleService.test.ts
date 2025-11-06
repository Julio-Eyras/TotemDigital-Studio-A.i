/**
 * Export Schedule Service Tests - Smart Signage v2.1
 * Testes unitários para ExportScheduleService
 */

import { ExportScheduleService } from '../../services/exportScheduleService';
import { getDatabase } from '../../config/database';
import { exportQueryService } from '../../services/exportQueryService';

// Mock do banco de dados
jest.mock('../../config/database', () => ({
  getDatabase: jest.fn(),
}));

// Mock do exportQueryService
jest.mock('../../services/exportQueryService', () => ({
  exportQueryService: {
    getQueryById: jest.fn(),
  },
}));

// Mock do Bull queue
jest.mock('../../config/queue', () => ({
  getExportQueue: jest.fn(() => ({
    add: jest.fn().mockResolvedValue({ id: 'job-123' }),
    getRepeatableJobs: jest.fn().mockResolvedValue([]),
    removeRepeatableByKey: jest.fn().mockResolvedValue(true),
  })),
}));

describe('ExportScheduleService', () => {
  let exportScheduleService: ExportScheduleService;
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

    exportScheduleService = new ExportScheduleService();
  });

  describe('validateCronExpression', () => {
    it('deve validar expressão cron válida', () => {
      const result = exportScheduleService.validateCronExpression('0 0 * * *');

      expect(result.valid).toBe(true);
      expect(result.nextExecution).toBeInstanceOf(Date);
    });

    it('deve rejeitar expressão cron inválida', () => {
      const result = exportScheduleService.validateCronExpression('invalid-cron');

      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('createSchedule', () => {
    it('deve criar agendamento com dados válidos', async () => {
      const mockSchedule = {
        schedule_id: 1,
        name: 'Agendamento Teste',
        query_id: 1,
        cron_expression: '0 0 * * *',
        enabled: true,
        created_at: '2024-01-01',
      };

      mockDb.findFirst.mockResolvedValue(null); // Agendamento não existe
      (exportQueryService.getQueryById as jest.Mock).mockResolvedValue({ query_id: 1 });
      mockDb.executeRaw.mockResolvedValue({ rows: [mockSchedule] });

      const result = await exportScheduleService.createSchedule(
        {
          name: 'Agendamento Teste',
          queryId: 1,
          cronExpression: '0 0 * * *',
        },
        1
      );

      expect(result).toBeDefined();
      expect(result.schedule_id).toBe(1);
      expect(mockDb.executeRaw).toHaveBeenCalled();
    });

    it('deve lançar erro quando agendamento com mesmo nome já existe', async () => {
      mockDb.findFirst.mockResolvedValue({ schedule_id: 1 });

      await expect(
        exportScheduleService.createSchedule(
          {
            name: 'Agendamento Existente',
            queryId: 1,
            cronExpression: '0 0 * * *',
          },
          1
        )
      ).rejects.toThrow('já existe');
    });

    it('deve lançar erro quando query não existe', async () => {
      mockDb.findFirst.mockResolvedValue(null);
      (exportQueryService.getQueryById as jest.Mock).mockResolvedValue(null);

      await expect(
        exportScheduleService.createSchedule(
          {
            name: 'Agendamento Teste',
            queryId: 999,
            cronExpression: '0 0 * * *',
          },
          1
        )
      ).rejects.toThrow('não encontrada');
    });
  });

  describe('getScheduleById', () => {
    it('deve retornar agendamento quando encontrado', async () => {
      const mockSchedule = {
        schedule_id: 1,
        name: 'Agendamento Teste',
        query_id: 1,
        enabled: true,
      };

      mockDb.findFirst.mockResolvedValue(mockSchedule);

      const result = await exportScheduleService.getScheduleById(1);

      expect(result).toBeDefined();
      expect(result?.schedule_id).toBe(1);
    });
  });

  describe('getSchedules', () => {
    it('deve listar agendamentos com paginação', async () => {
      const mockSchedules = [
        {
          schedule_id: 1,
          name: 'Agendamento 1',
          enabled: true,
        },
      ];

      mockDb.findMany.mockResolvedValue(mockSchedules);
      mockDb.findFirst.mockResolvedValue({ total: '1' });

      const result = await exportScheduleService.getSchedules(1, 20);

      expect(result.schedules).toBeDefined();
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });
  });

  describe('updateSchedule', () => {
    it('deve atualizar agendamento existente', async () => {
      const mockSchedule = {
        schedule_id: 1,
        name: 'Agendamento Atualizado',
        cron_expression: '0 0 * * *',
        enabled: true,
      };

      mockDb.findFirst
        .mockResolvedValueOnce({ schedule_id: 1 }) // Verificar existência
        .mockResolvedValueOnce(mockSchedule); // Retornar atualizado
      
      mockDb.executeRaw.mockResolvedValue({ rows: [] });

      const result = await exportScheduleService.updateSchedule(
        1,
        {
          name: 'Agendamento Atualizado',
        },
        1
      );

      expect(result).toBeDefined();
      expect(mockDb.executeRaw).toHaveBeenCalled();
    });
  });

  describe('deleteSchedule', () => {
    it('deve deletar agendamento existente', async () => {
      mockDb.findFirst.mockResolvedValue({ schedule_id: 1 });
      mockDb.executeRaw.mockResolvedValue({ rows: [] });

      await exportScheduleService.deleteSchedule(1, 1);

      expect(mockDb.executeRaw).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM export_schedules'),
        [1]
      );
    });
  });
});

