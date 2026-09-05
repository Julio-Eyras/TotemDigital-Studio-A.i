/**
 * Advanced Schedules Routes - Smart Signage v2.1
 * Rotas para gerenciar agendamentos avançados
 */

import { Router } from 'express';
import express from 'express';

import { body, param, query, validationResult } from 'express-validator';
import { authMiddleware } from '../middleware/auth.middleware';
import { advancedScheduleService } from '../services/advancedScheduleService';
import { logError, sanitizeForLogging } from '../utils/loggerHelper';
import { assertTenantClientParamAccess } from '../utils/tenantClientAccess';
import { isAdminRole } from '../utils/tenantScope';
import { normalizeError } from '../utils/errors';

const router = Router();

async function assertAdvancedScheduleScope(req: express.Request, res: express.Response, scheduleId: number): Promise<boolean> {
  const sid = await advancedScheduleService.getSubscriberIdForSchedule(scheduleId);
  if (sid == null) {
    res.status(404).json({
      success: false,
      error: 'Agendamento não encontrado ou alvo inválido',
    });
    return false;
  }
  if (!isAdminRole(req.user?.role)) {
    try {
      await assertTenantClientParamAccess(req, sid);
} catch (rawErr: unknown) {
  const e = normalizeError(rawErr);
      if (e?.statusCode === 403) {
        res.status(403).json({
          success: false,
          message: e.message || 'Acesso negado',
        });
        return false;
      }
      throw e;
    }
  }
  return true;
}

// Middleware de validação
const validateRequest = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Dados inválidos',
      details: errors.array()
    });
  }
  return next();
};

// Aplicar autenticação em todas as rotas
router.use(authMiddleware as any);

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
  async (req: express.Request, res: express.Response) => {
    try {
      const filters: Record<string, unknown> = {};

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
      });} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('Erro ao listar agendamentos', e.error, { route: '/api/advanced-schedules', filters: req.query });
      res.status(500).json({
        success: false,
        error: 'Erro interno do servidor',
        message: e.message
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
  async (req: express.Request, res: express.Response) => {
    try {
      const scheduleId = parseInt(req.params.id, 10);
      const schedule = await advancedScheduleService.getScheduleById(scheduleId);

      if (!schedule) {
        return res.status(404).json({
          success: false,
          error: 'Agendamento não encontrado'
        });
      }

      if (!(await assertAdvancedScheduleScope(req, res, scheduleId))) {
        return;
      }

      return res.json({
        success: true,
        data: schedule
      });} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('Erro ao buscar agendamento', e.error, { route: '/api/advanced-schedules/:id', scheduleId: parseInt(req.params.id) });
      return res.status(500).json({
        success: false,
        error: 'Erro interno do servidor',
        message: e.message
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
  body('scheduleConfig').optional({ nullable: true }).isObject(),
  body('enabled').optional({ nullable: true }).isBoolean(),
  validateRequest,
  async (req: express.Request, res: express.Response) => {
    try {
      const sid = await advancedScheduleService.getSubscriberIdForScheduleTarget(
        req.body.scheduleType,
        Number(req.body.targetId)
      );
      if (sid == null) {
        return res.status(400).json({
          success: false,
          error: 'Campanha ou playlist inválida para o tipo de agendamento',
        });
      }
      if (!isAdminRole(req.user?.role)) {
        try {
          await assertTenantClientParamAccess(req, sid);
} catch (rawErr: unknown) {
  const e = normalizeError(rawErr);
          if (e?.statusCode === 403) {
            return res.status(403).json({
              success: false,
              message: e.message || 'Acesso negado',
            });
          }
          throw e;
        }
      }

      const schedule = await advancedScheduleService.createSchedule({
        name: req.body.name,
        description: req.body.description,
        scheduleType: req.body.scheduleType,
        targetId: req.body.targetId,
        cronExpression: req.body.cronExpression,
        scheduleConfig: req.body.scheduleConfig,
        enabled: req.body.enabled !== false
      }, req.user!.id);

      return res.status(201).json({
        success: true,
        message: 'Agendamento criado com sucesso',
        data: schedule
      });} catch (error: unknown) {
      const e = normalizeError(error);
      // Sanitizar dados antes de logar
      const sanitizedBody = req.body ? sanitizeForLogging(req.body) : null;
      await logError('Erro ao criar agendamento', e.error, { route: '/api/advanced-schedules', scheduleType: sanitizedBody?.scheduleType });
      return res.status(400).json({
        success: false,
        error: 'Erro ao criar agendamento',
        message: e.message
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
  body('name').optional({ nullable: true }).notEmpty(),
  body('cronExpression').optional({ nullable: true }).notEmpty(),
  body('scheduleConfig').optional({ nullable: true }).isObject(),
  body('enabled').optional({ nullable: true }).isBoolean(),
  validateRequest,
  async (req: express.Request, res: express.Response) => {
    const scheduleId = parseInt(req.params.id, 10);
    try {
      if (!(await assertAdvancedScheduleScope(req, res, scheduleId))) {
        return;
      }
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
      });} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('Erro ao atualizar agendamento', e.error, { route: '/api/advanced-schedules/:id', scheduleId });
      res.status(400).json({
        success: false,
        error: 'Erro ao atualizar agendamento',
        message: e.message
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
  async (req: express.Request, res: express.Response) => {
    const scheduleId = parseInt(req.params.id, 10);
    try {
      if (!(await assertAdvancedScheduleScope(req, res, scheduleId))) {
        return;
      }
      await advancedScheduleService.deleteSchedule(scheduleId, req.user!.id);

      res.json({
        success: true,
        message: 'Agendamento excluído com sucesso'
      });} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('Erro ao excluir agendamento', e.error, { route: '/api/advanced-schedules/:id', scheduleId });
      res.status(400).json({
        success: false,
        error: 'Erro ao excluir agendamento',
        message: e.message
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
  async (req: express.Request, res: express.Response) => {
    try {
      const cronExpression = req.body.cronExpression;
      const validation = advancedScheduleService.validateCronExpression(cronExpression);

      res.json({
        success: validation.valid,
        valid: validation.valid,
        error: validation.error,
        nextExecution: validation.nextExecution
      });} catch (error: unknown) {
      const e = normalizeError(error);
      // Sanitizar dados antes de logar
      const sanitizedBody = req.body ? sanitizeForLogging(req.body) : null;
      await logError('Erro ao validar expressão cron', e.error, { route: '/api/advanced-schedules/:id/validate', cronExpression: sanitizedBody?.cronExpression });
      res.status(500).json({
        success: false,
        error: 'Erro interno do servidor',
        message: e.message
    });
    }
  }
);

export default router;

