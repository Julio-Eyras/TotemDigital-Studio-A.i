/**
 * Advanced Schedule Service Tests - Smart Signage v2.1
 * Testes unitários para AdvancedScheduleService
 */

import { AdvancedScheduleService } from '../../services/advancedScheduleService';
import { getDatabase } from '../../config/database';

// Mock do banco de dados
jest.mock('../../config/database', () => ({
  getDatabase: jest.fn(),
}));

// Mock do Bull queue
jest.mock('../../config/queue', () => ({
  getAdvancedScheduleQueue: jest.fn(() => ({
    add: jest.fn().mockResolvedValue({ id: 'job-123' }),
    getRepeatableJobs: jest.fn().mockResolvedValue([]),
    removeRepeatableByKey: jest.fn().mockResolvedValue(true),
  })),
}));

describe('AdvancedScheduleService', () => {
  let advancedScheduleService: AdvancedScheduleService;
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

    advancedScheduleService = new AdvancedScheduleService();
  });

  describe('validateCronExpression', () => {
    it('deve validar expressão cron válida', () => {
      const result = advancedScheduleService.validateCronExpression('0 0 * * *');

      expect(result.valid).toBe(true);
      expect(result.nextExecution).toBeInstanceOf(Date);
    });

    it('deve rejeitar expressão cron inválida', () => {
      const result = advancedScheduleService.validateCronExpression('invalid-cron');

      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('createSchedule', () => {
    it('deve criar agendamento para campanha', async () => {
      const mockSchedule = {
        schedule_id: 1,
        name: 'Agendamento Campanha',
        schedule_type: 'campaign',
        target_id: 1,
        cron_expression: '0 0 * * *',
        enabled: true,
        created_at: '2024-01-01',
      };

      mockDb.findFirst
        .mockResolvedValueOnce(null) // Agendamento não existe
        .mockResolvedValueOnce({ campaign_id: 1 }); // Campanha existe
      
      mockDb.executeRaw.mockResolvedValue({ rows: [mockSchedule] });

      const result = await advancedScheduleService.createSchedule(
        {
          name: 'Agendamento Campanha',
          scheduleType: 'campaign',
          targetId: 1,
          cronExpression: '0 0 * * *',
        },
        1
      );

      expect(result).toBeDefined();
      expect(result.schedule_id).toBe(1);
      expect(mockDb.executeRaw).toHaveBeenCalled();
    });

    it('deve criar agendamento para playlist', async () => {
      const mockSchedule = {
        schedule_id: 1,
        schedule_type: 'playlist',
        target_id: 1,
        enabled: true,
      };

      mockDb.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ playlist_id: 1 });
      
      mockDb.executeRaw.mockResolvedValue({ rows: [mockSchedule] });

      const result = await advancedScheduleService.createSchedule(
        {
          name: 'Agendamento Playlist',
          scheduleType: 'playlist',
          targetId: 1,
          cronExpression: '0 0 * * *',
        },
        1
      );

      expect(result).toBeDefined();
    });

    it('deve lançar erro quando campanha não existe', async () => {
      mockDb.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null); // Campanha não existe

      await expect(
        advancedScheduleService.createSchedule(
          {
            name: 'Agendamento Teste',
            scheduleType: 'campaign',
            targetId: 999,
            cronExpression: '0 0 * * *',
          },
          1
        )
      ).rejects.toThrow('não encontrada');
    });
  });

  describe('getSchedules', () => {
    it('deve listar agendamentos com paginação', async () => {
      const mockSchedules = [
        {
          schedule_id: 1,
          name: 'Agendamento 1',
          schedule_type: 'campaign',
          enabled: true,
        },
      ];

      mockDb.findMany.mockResolvedValue(mockSchedules);
      mockDb.findFirst.mockResolvedValue({ total: '1' });

      const result = await advancedScheduleService.getSchedules(1, 20);

      expect(result.schedules).toBeDefined();
      expect(result.total).toBe(1);
    });

    it('deve filtrar agendamentos por tipo', async () => {
      mockDb.findMany.mockResolvedValue([]);
      mockDb.findFirst.mockResolvedValue({ total: '0' });

      await advancedScheduleService.getSchedules(1, 20, { scheduleType: 'campaign' });

      expect(mockDb.findMany).toHaveBeenCalledWith(
        expect.stringContaining('schedule_type ='),
        expect.arrayContaining(['campaign'])
      );
    });
  });

  describe('getScheduleById', () => {
    it('deve retornar agendamento quando encontrado', async () => {
      const mockSchedule = {
        schedule_id: 1,
        name: 'Agendamento Teste',
        schedule_type: 'campaign',
        target_id: 1,
      };

      mockDb.findFirst.mockResolvedValue(mockSchedule);

      const result = await advancedScheduleService.getScheduleById(1);

      expect(result).toBeDefined();
      expect(result?.schedule_id).toBe(1);
    });
  });

  describe('updateSchedule', () => {
    it('deve atualizar agendamento existente', async () => {
      const mockSchedule = {
        schedule_id: 1,
        name: 'Agendamento Atualizado',
        schedule_type: 'campaign',
        target_id: 1,
      };

      mockDb.findFirst
        .mockResolvedValueOnce(mockSchedule) // Verificar existência
        .mockResolvedValueOnce(mockSchedule); // Retornar atualizado
      
      mockDb.executeRaw.mockResolvedValue({ rows: [] });

      const result = await advancedScheduleService.updateSchedule(
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

      await advancedScheduleService.deleteSchedule(1, 1);

      expect(mockDb.executeRaw).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM advanced_schedules'),
        [1]
      );
    });
  });
});

