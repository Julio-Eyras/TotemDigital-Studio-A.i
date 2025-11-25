/**
 * Export Schedules Routes - Smart Signage v2.1
 * Rotas CRUD para agendamentos de exportação
 */

import { Router, Request, Response } from 'express';
import { exportScheduleService } from '../services/exportScheduleService';
import { authMiddleware } from '../middleware/auth.middleware';
import { authorizeRole } from '../middleware/auth.middleware';
import { logError } from '../utils/loggerHelper';

const router = Router();

// Todas as rotas requerem autenticação
router.use(authMiddleware);

/**
 * @route GET /api/export-schedules
 * @desc Lista todos os agendamentos
 * @access Private (Admin, Manager)
 */
router.get('/', authorizeRole(['admin', 'manager']), async (req: any, res: Response) => {
  try {
    const { queryId, enabled, search, page, limit } = req.query;

    const filters: any = {};
    if (queryId) filters.queryId = parseInt(queryId as string);
    if (enabled !== undefined) filters.enabled = enabled === 'true';
    if (search) filters.search = search;
    if (page) filters.page = parseInt(page as string, 10);
    if (limit) filters.limit = parseInt(limit as string, 10);

    const result = await exportScheduleService.getAllSchedules(filters);

    res.json({
      success: true,
      data: result.data,
      pagination: {
        total: result.total,
        page: result.page,
        limit: result.limit
      }
    });
  } catch (error: any) {
    await logError('Erro ao listar agendamentos de exportação', error, { filters: req.query });
    res.status(500).json({
      success: false,
      message: 'Erro ao listar agendamentos',
      error: error.message
    });
  }
});

/**
 * @route GET /api/export-schedules/:id
 * @desc Busca agendamento por ID
 * @access Private (Admin, Manager)
 */
router.get('/:id', authorizeRole(['admin', 'manager']), async (req: any, res: Response) => {
  try {
    const scheduleId = parseInt(req.params.id);

    if (isNaN(scheduleId)) {
      return res.status(400).json({
        success: false,
        message: 'ID inválido'
      });
    }

    const schedule = await exportScheduleService.getScheduleById(scheduleId);

    if (!schedule) {
      return res.status(404).json({
        success: false,
        message: 'Agendamento não encontrado'
      });
    }

    res.json({
      success: true,
      data: schedule
    });
  } catch (error: any) {
    await logError('Erro ao buscar agendamento de exportação', error, { scheduleId: req.params.id });
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar agendamento',
      error: error.message
    });
  }
});

/**
 * @route POST /api/export-schedules
 * @desc Cria novo agendamento
 * @access Private (Admin, Manager)
 */
router.post('/', authorizeRole(['admin', 'manager']), async (req: any, res: Response) => {
  try {
    const data = req.body;
    const userId = req.user.id;

    // Validar dados obrigatórios
    if (!data.name || !data.queryId || !data.cronExpression) {
      return res.status(400).json({
        success: false,
        message: 'Dados obrigatórios faltando: name, queryId, cronExpression'
      });
    }

    // Validar expressão cron
    const cronValidation = exportScheduleService.validateCronExpression(data.cronExpression);
    if (!cronValidation.valid) {
      return res.status(400).json({
        success: false,
        message: cronValidation.error || 'Expressão cron inválida'
      });
    }

    // Criar agendamento
    const schedule = await exportScheduleService.createSchedule(data, userId);

    res.status(201).json({
      success: true,
      data: schedule,
      message: 'Agendamento criado com sucesso',
      nextExecution: cronValidation.nextExecution
    });
  } catch (error: any) {
    await logError('Erro ao criar agendamento de exportação', error, { userId: req.user?.id });
    res.status(500).json({
      success: false,
      message: 'Erro ao criar agendamento',
      error: error.message
    });
  }
});

/**
 * @route PUT /api/export-schedules/:id
 * @desc Atualiza agendamento
 * @access Private (Admin, Manager)
 */
router.put('/:id', authorizeRole(['admin', 'manager']), async (req: any, res: Response) => {
  try {
    const scheduleId = parseInt(req.params.id);
    const data = req.body;
    const userId = req.user.id;

    if (isNaN(scheduleId)) {
      return res.status(400).json({
        success: false,
        message: 'ID inválido'
      });
    }

    // Validar expressão cron se estiver sendo atualizada
    if (data.cronExpression) {
      const cronValidation = exportScheduleService.validateCronExpression(data.cronExpression);
      if (!cronValidation.valid) {
        return res.status(400).json({
          success: false,
          message: cronValidation.error || 'Expressão cron inválida'
        });
      }
    }

    // Atualizar agendamento
    const schedule = await exportScheduleService.updateSchedule(scheduleId, data, userId);

    res.json({
      success: true,
      data: schedule,
      message: 'Agendamento atualizado com sucesso'
    });
  } catch (error: any) {
    await logError('Erro ao atualizar agendamento de exportação', error, { scheduleId: req.params.id, userId: req.user?.id });
    res.status(500).json({
      success: false,
      message: 'Erro ao atualizar agendamento',
      error: error.message
    });
  }
});

/**
 * @route DELETE /api/export-schedules/:id
 * @desc Exclui agendamento
 * @access Private (Admin)
 */
router.delete('/:id', authorizeRole(['admin']), async (req: any, res: Response) => {
  try {
    const scheduleId = parseInt(req.params.id);
    const userId = req.user.id;

    if (isNaN(scheduleId)) {
      return res.status(400).json({
        success: false,
        message: 'ID inválido'
      });
    }

    // Excluir agendamento
    await exportScheduleService.deleteSchedule(scheduleId, userId);

    res.json({
      success: true,
      message: 'Agendamento excluído com sucesso'
    });
  } catch (error: any) {
    await logError('Erro ao excluir agendamento de exportação', error, { scheduleId: req.params.id, userId: req.user?.id });
    res.status(500).json({
      success: false,
      message: 'Erro ao excluir agendamento',
      error: error.message
    });
  }
});

/**
 * @route POST /api/export-schedules/:id/execute-now
 * @desc Executa agendamento manualmente
 * @access Private (Admin, Manager)
 */
router.post('/:id/execute-now', authorizeRole(['admin', 'manager']), async (req: any, res: Response) => {
  try {
    const scheduleId = parseInt(req.params.id);
    const userId = req.user.id;

    if (isNaN(scheduleId)) {
      return res.status(400).json({
        success: false,
        message: 'ID inválido'
      });
    }

    // Executar agendamento
    await exportScheduleService.executeScheduleNow(scheduleId, userId);

    res.json({
      success: true,
      message: 'Execução manual iniciada com sucesso'
    });
  } catch (error: any) {
    await logError('Erro ao executar agendamento manualmente', error, { scheduleId: req.params.id, userId: req.user?.id });
    res.status(500).json({
      success: false,
      message: 'Erro ao executar agendamento',
      error: error.message
    });
  }
});

/**
 * @route POST /api/export-schedules/validate-cron
 * @desc Valida expressão cron
 * @access Private (Admin, Manager)
 */
router.post('/validate-cron', authorizeRole(['admin', 'manager']), async (req: any, res: Response) => {
  try {
    const { cronExpression } = req.body;

    if (!cronExpression) {
      return res.status(400).json({
        success: false,
        message: 'Expressão cron é obrigatória'
      });
    }

    // Validar expressão cron
    const validation = exportScheduleService.validateCronExpression(cronExpression);

    res.json({
      success: validation.valid,
      data: {
        valid: validation.valid,
        error: validation.error,
        nextExecution: validation.nextExecution
      }
    });
  } catch (error: any) {
    await logError('Erro ao validar expressão cron de exportação', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao validar expressão cron',
      error: error.message
    });
  }
});

export default router;

