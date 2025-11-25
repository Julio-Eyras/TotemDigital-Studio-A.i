/**
 * Advanced Schedules Routes - Smart Signage v2.1
 * Rotas para gerenciar agendamentos avançados
 */

import { Router, Request, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { authMiddleware } from '../middleware/auth.middleware';
import { advancedScheduleService } from '../services/advancedScheduleService';
import { logError } from '../utils/loggerHelper';

const router = Router();

// Middleware de validação
const validateRequest = (req: Request, res: Response, next: any) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Dados inválidos',
      details: errors.array()
    });
  }
  next();
};

// Aplicar autenticação em todas as rotas
router.use(authMiddleware);

/**
 * @route GET /api/advanced-schedules
 * @desc Lista agendamentos avançados
 * @access Private
 */
router.get('/',
  query('scheduleType').optional().isIn(['campaign', 'playlist', 'campaign_activation', 'playlist_generation']),
  query('targetId').optional().isInt({ min: 1 }),
  query('enabled').optional().isBoolean(),
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const filters: any = {};

      if (req.query.scheduleType) {
        filters.scheduleType = req.query.scheduleType;
      }

      if (req.query.targetId) {
        filters.targetId = parseInt(req.query.targetId as string);
      }

      if (req.query.enabled !== undefined) {
        filters.enabled = req.query.enabled === 'true';
      }

      const schedules = await advancedScheduleService.getSchedules(filters);

      res.json({
        success: true,
        data: schedules,
        count: schedules.length
      });
    } catch (error: any) {
      await logError('Erro ao listar agendamentos', error, { route: '/api/advanced-schedules', filters });
      res.status(500).json({
        success: false,
        error: 'Erro interno do servidor',
        message: error.message
      });
    }
  }
);

/**
 * @route GET /api/advanced-schedules/:id
 * @desc Busca agendamento por ID
 * @access Private
 */
router.get('/:id',
  param('id').isInt({ min: 1 }),
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const scheduleId = parseInt(req.params.id);
      const schedule = await advancedScheduleService.getScheduleById(scheduleId);

      if (!schedule) {
        return res.status(404).json({
          success: false,
          error: 'Agendamento não encontrado'
        });
      }

      res.json({
        success: true,
        data: schedule
      });
    } catch (error: any) {
      await logError('Erro ao buscar agendamento', error, { route: '/api/advanced-schedules/:id', scheduleId: parseInt(req.params.id) });
      res.status(500).json({
        success: false,
        error: 'Erro interno do servidor',
        message: error.message
      });
    }
  }
);

/**
 * @route POST /api/advanced-schedules
 * @desc Cria novo agendamento avançado
 * @access Private
 */
router.post('/',
  body('name').notEmpty().withMessage('Nome é obrigatório'),
  body('scheduleType').isIn(['campaign', 'playlist', 'campaign_activation', 'playlist_generation']).withMessage('Tipo de agendamento inválido'),
  body('targetId').isInt({ min: 1 }).withMessage('ID do target é obrigatório'),
  body('cronExpression').notEmpty().withMessage('Expressão cron é obrigatória'),
  body('scheduleConfig').optional().isObject(),
  body('enabled').optional().isBoolean(),
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const schedule = await advancedScheduleService.createSchedule({
        name: req.body.name,
        description: req.body.description,
        scheduleType: req.body.scheduleType,
        targetId: req.body.targetId,
        cronExpression: req.body.cronExpression,
        scheduleConfig: req.body.scheduleConfig,
        enabled: req.body.enabled !== false
      }, req.user!.id);

      res.status(201).json({
        success: true,
        message: 'Agendamento criado com sucesso',
        data: schedule
      });
    } catch (error: any) {
      await logError('Erro ao criar agendamento', error, { route: '/api/advanced-schedules', scheduleType: req.body.scheduleType });
      res.status(400).json({
        success: false,
        error: 'Erro ao criar agendamento',
        message: error.message
      });
    }
  }
);

/**
 * @route PUT /api/advanced-schedules/:id
 * @desc Atualiza agendamento
 * @access Private
 */
router.put('/:id',
  param('id').isInt({ min: 1 }),
  body('name').optional().notEmpty(),
  body('cronExpression').optional().notEmpty(),
  body('scheduleConfig').optional().isObject(),
  body('enabled').optional().isBoolean(),
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const scheduleId = parseInt(req.params.id);
      const schedule = await advancedScheduleService.updateSchedule(scheduleId, {
        name: req.body.name,
        description: req.body.description,
        cronExpression: req.body.cronExpression,
        scheduleConfig: req.body.scheduleConfig,
        enabled: req.body.enabled
      }, req.user!.id);

      res.json({
        success: true,
        message: 'Agendamento atualizado com sucesso',
        data: schedule
      });
    } catch (error: any) {
      await logError('Erro ao atualizar agendamento', error, { route: '/api/advanced-schedules/:id', scheduleId });
      res.status(400).json({
        success: false,
        error: 'Erro ao atualizar agendamento',
        message: error.message
      });
    }
  }
);

/**
 * @route DELETE /api/advanced-schedules/:id
 * @desc Exclui agendamento
 * @access Private
 */
router.delete('/:id',
  param('id').isInt({ min: 1 }),
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const scheduleId = parseInt(req.params.id);
      await advancedScheduleService.deleteSchedule(scheduleId, req.user!.id);

      res.json({
        success: true,
        message: 'Agendamento excluído com sucesso'
      });
    } catch (error: any) {
      await logError('Erro ao excluir agendamento', error, { route: '/api/advanced-schedules/:id', scheduleId });
      res.status(400).json({
        success: false,
        error: 'Erro ao excluir agendamento',
        message: error.message
      });
    }
  }
);

/**
 * @route POST /api/advanced-schedules/:id/validate
 * @desc Valida expressão cron
 * @access Private
 */
router.post('/:id/validate',
  param('id').optional().isInt({ min: 1 }),
  body('cronExpression').notEmpty().withMessage('Expressão cron é obrigatória'),
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const cronExpression = req.body.cronExpression;
      const validation = advancedScheduleService.validateCronExpression(cronExpression);

      res.json({
        success: validation.valid,
        valid: validation.valid,
        error: validation.error,
        nextExecution: validation.nextExecution
      });
    } catch (error: any) {
      await logError('Erro ao validar expressão cron', error, { route: '/api/advanced-schedules/:id/validate', cronExpression: req.body.cronExpression });
      res.status(500).json({
        success: false,
        error: 'Erro interno do servidor',
        message: error.message
      });
    }
  }
);

export default router;

