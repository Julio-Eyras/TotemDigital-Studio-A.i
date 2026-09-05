/**
 * SmartDisplayFX Telemetry Routes
 * Rotas para consulta de telemetria de execução de efeitos FX
 * @access Private (Admin, Admin SQL, Gerente Marketing, Visualizador)
 */

import { Router} from 'express';
import express from 'express';

import { query, param, body, validationResult } from 'express-validator';
import { authMiddleware, authorizeRole } from '../middleware/auth.middleware';
import { getFxTelemetryService } from '../services/fxTelemetryService';
import { logError } from '../utils/loggerHelper';
import { isMissingTableError } from '../utils/dbErrors';
import { normalizeError } from '../utils/errors';

const router = Router();

// Middleware de autenticação para todas as rotas
router.use(authMiddleware);

const validateRequest = (req: express.Request, res: express.Response, next: express.NextFunction): express.Response | void => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Dados inválidos',
      details: errors.array()
    });
  }
  next();
};

/**
 * @route GET /api/smartdisplayfx/telemetry
 * @desc Lista telemetria com paginação e filtros
 * @access Private (Admin, Admin SQL, Gerente Marketing, Visualizador)
 */
router.get('/',
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('totem_id').optional().isInt({ min: 1 }),
  query('effect_id').optional().isString(),
  query('status').optional().isString(),
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601(),
  validateRequest,
  authorizeRole(['admin', 'admin_sql', 'gerente_marketing', 'visualizador']),
  async (req: express.Request, res: express.Response) => {
    try {
      const { page, limit, totem_id, effect_id, status, startDate, endDate } = req.query;
      
      const result = await getFxTelemetryService().getAllTelemetry({
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
        totem_id: totem_id ? parseInt(totem_id as string) : undefined,
        effect_id: effect_id as string | undefined,
        status: status as string | undefined,
        startDate: startDate as string | undefined,
        endDate: endDate as string | undefined,
      });

      return res.json(result);} catch (error: unknown) {
      const e = normalizeError(error);
      if (isMissingTableError(error)) {
        return res.json({ data: [], total: 0, page: 1, limit: 50 });
    }
      await logError('GET /api/smartdisplayfx/telemetry error', error, req.query);
      return res.status(500).json({
        error: 'Erro ao listar telemetria',
        message: e.message
      });
    }
  }
);

/**
 * @route POST /api/smartdisplayfx/telemetry
 * @desc Cria uma nova entrada de telemetria FX (enviada pelos players)
 * @access Private (Player autenticado ou Admin)
 */
router.post(
  '/',
  body('totem_id').isInt({ min: 1 }).withMessage('totem_id é obrigatório e deve ser um número válido'),
  body('effect_id').isString().notEmpty().withMessage('effect_id é obrigatório'),
  body('event_id').optional({ nullable: true }).isString(),
  body('content_id').optional({ nullable: true }).isInt({ min: 1 }),
  body('planned_start_ts').optional({ nullable: true }).isISO8601(),
  body('actual_start_ts').optional({ nullable: true }).isISO8601(),
  body('ended_at').optional({ nullable: true }).isISO8601(),
  body('duration_ms').optional({ nullable: true }).isInt({ min: 1 }),
  body('avg_fps').optional({ nullable: true }).isFloat({ min: 0 }),
  body('status').optional({ nullable: true }).isString(),
  body('error_message').optional({ nullable: true }).isString(),
  body('metadata').optional({ nullable: true }).isObject(),
  validateRequest,
  async (req: express.Request, res: express.Response) => {
    try {
      const telemetryService = getFxTelemetryService();

      const telemetry = await telemetryService.createTelemetry({
        totem_id: req.body.totem_id,
        effect_id: req.body.effect_id,
        event_id: req.body.event_id,
        content_id: req.body.content_id,
        planned_start_ts: req.body.planned_start_ts,
        actual_start_ts: req.body.actual_start_ts,
        ended_at: req.body.ended_at,
        duration_ms: req.body.duration_ms,
        avg_fps: req.body.avg_fps,
        status: req.body.status,
        error_message: req.body.error_message,
        metadata: req.body.metadata,
      });

      return res.status(201).json({
        success: true,
        data: telemetry,
      });} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('POST /api/smartdisplayfx/telemetry error', error, req.body);
      return res.status(500).json({
        error: 'Erro ao criar telemetria',
        message: e.message,
    });
    }
  }
);

/**
 * @route POST /api/smartdisplayfx/telemetry/batch
 * @desc Cria múltiplas entradas de telemetria FX em batch
 * @access Private (Player autenticado ou Admin)
 */
router.post(
  '/batch',
  body('items').isArray({ min: 1 }).withMessage('items deve ser um array de telemetria'),
  body('items.*.totem_id').isInt({ min: 1 }).withMessage('totem_id é obrigatório e deve ser um número válido'),
  body('items.*.effect_id').isString().notEmpty().withMessage('effect_id é obrigatório'),
  validateRequest,
  async (req: express.Request, res: express.Response) => {
    try {
      const telemetryService = getFxTelemetryService();

      const items = req.body.items || [];

      const results = [];
      for (const item of items) {
        const telemetry = await telemetryService.createTelemetry({
          totem_id: item.totem_id,
          effect_id: item.effect_id,
          event_id: item.event_id,
          content_id: item.content_id,
          planned_start_ts: item.planned_start_ts,
          actual_start_ts: item.actual_start_ts,
          ended_at: item.ended_at,
          duration_ms: item.duration_ms,
          avg_fps: item.avg_fps,
          status: item.status,
          error_message: item.error_message,
          metadata: item.metadata,
        });
        results.push(telemetry);
      }

      return res.status(201).json({
        success: true,
        count: results.length,
        data: results,
      });} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('POST /api/smartdisplayfx/telemetry/batch error', error, req.body);
      return res.status(500).json({
        error: 'Erro ao criar telemetria em batch',
        message: e.message,
    });
    }
  }
);

/**
 * @route GET /api/smartdisplayfx/telemetry/stats
 * @desc Obtém estatísticas de telemetria
 * @access Private (Admin, Admin SQL, Gerente Marketing, Visualizador)
 */
router.get('/stats',
  query('totem_id').optional().isInt({ min: 1 }),
  query('effect_id').optional().isString(),
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601(),
  validateRequest,
  authorizeRole(['admin', 'admin_sql', 'gerente_marketing', 'visualizador']),
  async (req: express.Request, res: express.Response) => {
    try {
      const { totem_id, effect_id, startDate, endDate } = req.query;
      
      const stats = await getFxTelemetryService().getTelemetryStats({
        totem_id: totem_id ? parseInt(totem_id as string) : undefined,
        effect_id: effect_id as string | undefined,
        startDate: startDate as string | undefined,
        endDate: endDate as string | undefined,
      });

      return res.json({
        data: stats });} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('GET /api/smartdisplayfx/telemetry/stats error', error, req.query);
      return res.status(500).json({
        error: 'Erro ao obter estatísticas',
        message: e.message
    });
    }
  }
);

/**
 * @route GET /api/smartdisplayfx/telemetry/:id
 * @desc Busca uma entrada de telemetria por ID
 * @access Private (Admin, Admin SQL, Gerente Marketing, Visualizador)
 */
router.get('/:id',
  param('id').isInt({ min: 1 }),
  validateRequest,
  authorizeRole(['admin', 'admin_sql', 'gerente_marketing', 'visualizador']),
  async (req: express.Request, res: express.Response) => {
    try {
      const telemetryId = parseInt(req.params.id);
      const telemetry = await getFxTelemetryService().getTelemetryById(telemetryId);

      if (!telemetry) {
        return res.status(404).json({
          error: 'Telemetria não encontrada'
        });
      }

      return res.json({
        data: telemetry });} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('GET /api/smartdisplayfx/telemetry/:id error', e.error, { id: req.params.id });
      return res.status(500).json({
        error: 'Erro ao buscar telemetria',
        message: e.message
    });
    }
  }
);

export default router;

