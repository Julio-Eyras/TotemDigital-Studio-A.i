/**
 * Dispatcher-Totem Routes
 * Rotas para o módulo Dispatcher-Totem
 */

import { Router } from 'express';
import express from 'express';

import { query, body, validationResult } from 'express-validator';
import { authMiddleware, AuthenticatedRequest, authorizeRole } from '../middleware/auth.middleware';
import { getDispatcherTotemService } from '../services/dispatcherTotemService';
import { logError } from '../utils/loggerHelper';
import { idParamValidator } from '../validators/common.validators';
import { isStudioRuntime } from '../config/installationRuntime';
import { isTotemSimpleModeEnabled } from '../services/totemSimpleModeService';
import { assertDispatcherTotemScope } from '../middleware/dispatcherTotemScope.middleware';
import { normalizeError } from '../utils/errors';

const router = Router();

// Middleware de autenticação
router.use(authMiddleware);

const DISPATCHER_TOTEM_TECH_ROLES = isStudioRuntime()
  ? (['admin', 'admin_sql', 'owner_system', 'operador_tecnico', 'operador_faturamento', 'operador_comercial', 'publisher_user'] as const)
  : (['admin', 'admin_sql', 'owner_system', 'operador_tecnico', 'operador_faturamento', 'operador_comercial'] as const);

const validateRequest = (req: express.Request, res: express.Response, next: express.NextFunction): express.Response | void => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Dados inválidos',
      details: errors.array()
    });
  }
  return next();
};

/**
 * @route GET /api/dispatcher-totem/:totemId/dispatch
 * @desc Obter plano de exibição para um totem em um momento específico
 * @access Private
 */
router.get('/:totemId/dispatch',
  ...idParamValidator('totemId'),
  query('timestamp').optional().isISO8601().withMessage('timestamp deve ser uma data ISO8601 válida'),
  query('timezone').optional().isString().withMessage('timezone deve ser uma string'),
  query('skipCache').optional().isBoolean().withMessage('skipCache deve ser um booleano'),
  query('includeCandidates').optional().isBoolean().withMessage('includeCandidates deve ser um booleano'),
  validateRequest,
  assertDispatcherTotemScope as any,
  async (req: AuthenticatedRequest, res: express.Response) => {
    try {
      const totemId = parseInt(req.params.totemId);
      const timestamp = req.query.timestamp ? new Date(req.query.timestamp as string) : undefined;
      const timezone = req.query.timezone as string | undefined;
      const skipCache = req.query.skipCache === 'true';
      const includeCandidates = req.query.includeCandidates === 'true';

      const dispatcher = getDispatcherTotemService();
      const result = await dispatcher.dispatch(
        { totemId, timestamp, timezone },
        { skipCache, includeCandidates }
      );

      const simpleMode = await isTotemSimpleModeEnabled(totemId);

      return res.json({
        success: result.success,
        data: result.plan,
        candidates: result.candidates,
        fromCache: result.fromCache,
        executionTimeMs: result.executionTimeMs,
        error: result.error,
        simpleMode,
        planSimpleMode: result.plan?.metadata?.simpleMode === true,
      });} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('Erro ao gerar plano de dispatch', e.error, { totemId: req.params.totemId });
      return res.status(500).json({
        success: false,
        error: e.message || 'Erro interno do servidor'
    });
    }
  }
);

/**
 * @route POST /api/dispatcher-totem/:totemId/dispatch-batch
 * @desc Vários planos de exibição (mesma lógica de GET /dispatch) num único pedido
 * @access Private
 */
router.post('/:totemId/dispatch-batch',
  ...idParamValidator('totemId'),
  body('timestamps')
    .isArray({ min: 1, max: 48 })
    .withMessage('timestamps deve ser um array com 1 a 48 datas ISO8601'),
  body('timestamps.*')
    .isISO8601()
    .withMessage('Cada entrada de timestamps deve ser ISO8601'),
  body('timezone').optional({ nullable: true }).isString().withMessage('timezone deve ser uma string'),
  body('skipCache').optional({ nullable: true }).isBoolean().withMessage('skipCache deve ser um booleano'),
  body('includeCandidates').optional({ nullable: true }).isBoolean().withMessage('includeCandidates deve ser um booleano'),
  validateRequest,
  assertDispatcherTotemScope as any,
  async (req: AuthenticatedRequest, res: express.Response) => {
    try {
      const totemId = parseInt(req.params.totemId, 10);
      const { timestamps, timezone, skipCache, includeCandidates } = req.body as {
        timestamps: string[];
        timezone?: string;
        skipCache?: boolean;
        includeCandidates?: boolean;
      };
      const dates = timestamps.map((s) => new Date(s));
      const dispatcher = getDispatcherTotemService();
      const rows = await dispatcher.dispatchBatch(
        totemId,
        dates,
        {
          skipCache: skipCache === true,
          includeCandidates: includeCandidates === true,
        },
        timezone
      );

      return res.json({
        success: true,
        results: rows.map((row) => ({
          timestamp: row.timestamp,
          success: row.success,
          data: row.plan,
          fromCache: row.fromCache,
          executionTimeMs: row.executionTimeMs,
          error: row.error,
        })),
      });} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('Erro ao gerar planos de dispatch em lote', e.error, { totemId: req.params.totemId });
      return res.status(500).json({
        success: false,
        error: e.message || 'Erro interno do servidor',
    });
    }
  }
);

/**
 * @route GET /api/dispatcher-totem/:totemId/history
 * @desc Obter histórico de decisões do dispatcher
 * @access Private
 */
router.get('/:totemId/history',
  ...idParamValidator('totemId'),
  query('startDate').isISO8601().withMessage('startDate deve ser uma data ISO8601 válida'),
  query('endDate').isISO8601().withMessage('endDate deve ser uma data ISO8601 válida'),
  validateRequest,
  assertDispatcherTotemScope as any,
  async (req: AuthenticatedRequest, res: express.Response) => {
    try {
      const totemId = parseInt(req.params.totemId);
      const startDate = new Date(req.query.startDate as string);
      const endDate = new Date(req.query.endDate as string);

      const dispatcher = getDispatcherTotemService();
      const history = await dispatcher.getDispatchHistory(totemId, startDate, endDate);

      return res.json({
        success: true,
        data: history,
        count: history.length,
      });} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('Erro ao buscar histórico de dispatch', e.error, { totemId: req.params.totemId });
      return res.status(500).json({
        success: false,
        error: e.message || 'Erro interno do servidor'
    });
    }
  }
);

/**
 * @route GET /api/dispatcher-totem/:totemId/candidates
 * @desc Debug: ver quais agendamentos são candidatos em um momento
 * @access Private (Admin, Admin SQL)
 */
router.get('/:totemId/candidates',
  ...idParamValidator('totemId'),
  query('timestamp').optional().isISO8601().withMessage('timestamp deve ser uma data ISO8601 válida'),
  query('timezone').optional().isString().withMessage('timezone deve ser uma string'),
  validateRequest,
  authorizeRole([...DISPATCHER_TOTEM_TECH_ROLES]) as any,
  assertDispatcherTotemScope as any,
  async (req: AuthenticatedRequest, res: express.Response) => {
    try {
      const totemId = parseInt(req.params.totemId);
      const timestamp = req.query.timestamp ? new Date(req.query.timestamp as string) : undefined;
      const timezone = req.query.timezone as string | undefined;

      const dispatcher = getDispatcherTotemService();
      const result = await dispatcher.dispatch(
        { totemId, timestamp, timezone },
        // Sempre ignorar cache em /candidates (debug), para garantir consistência e evitar cache sem candidates.
        { includeCandidates: true, skipCache: true }
      );

      const simpleMode = await isTotemSimpleModeEnabled(totemId);

      return res.json({
        success: true,
        candidates: result.candidates || [],
        selectedPlan: result.plan,
        count: result.candidates?.length || 0,
        simpleMode,
        planSimpleMode: result.plan?.metadata?.simpleMode === true,
      });} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('Erro ao buscar candidatos', e.error, { totemId: req.params.totemId });
      return res.status(500).json({
        success: false,
        error: e.message || 'Erro interno do servidor'
    });
    }
  }
);

/**
 * @route GET /api/dispatcher-totem/:totemId/diagnostics
 * @desc Debug: métricas para entender por que o dispatcher não encontra candidatos
 * @access Private (Admin, Admin SQL)
 */
router.get(
  '/:totemId/diagnostics',
  ...idParamValidator('totemId'),
  validateRequest,
  authorizeRole([...DISPATCHER_TOTEM_TECH_ROLES]) as any,
  assertDispatcherTotemScope as any,
  async (req: AuthenticatedRequest, res: express.Response) => {
    try {
      const totemId = parseInt(req.params.totemId);
      const dispatcher = getDispatcherTotemService();
      const diagnostics = await dispatcher.getDiagnostics(totemId);
      return res.json({
        success: true,
        data: diagnostics,
      });} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('Erro ao buscar diagnostics do dispatcher', e.error, { totemId: req.params.totemId });
      return res.status(500).json({
        success: false,
        error: e.message || 'Erro interno do servidor',
    });
    }
  }
);

/**
 * @route GET /api/dispatcher-totem/cache/config
 * @desc Obter configuração de cache atual
 * @access Private (Admin, Admin SQL)
 */
router.get('/cache/config',
  authorizeRole([...DISPATCHER_TOTEM_TECH_ROLES]) as any,
  async (_req: AuthenticatedRequest, res: express.Response) => {
    try {
      const dispatcher = getDispatcherTotemService();
      const config = dispatcher.getCacheConfig();

      return res.json({
        success: true,
        data: config,
      });} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('Erro ao obter configuração de cache', e.error);
      return res.status(500).json({
        success: false,
        error: e.message || 'Erro interno do servidor'
    });
    }
  }
);

/**
 * @route POST /api/dispatcher-totem/cache/config
 * @desc Configurar cache do dispatcher
 * @access Private (Admin, Admin SQL)
 */
router.post('/cache/config',
  authorizeRole([...DISPATCHER_TOTEM_TECH_ROLES]) as any,
  async (req: AuthenticatedRequest, res: express.Response) => {
    try {
      const { enabled, ttlSeconds, maxSize } = req.body;

      if (enabled !== undefined && typeof enabled !== 'boolean') {
        return res.status(400).json({
          success: false,
          error: 'enabled deve ser um booleano'
        });
      }

      if (ttlSeconds !== undefined && (typeof ttlSeconds !== 'number' || ttlSeconds < 0)) {
        return res.status(400).json({
          success: false,
          error: 'ttlSeconds deve ser um número >= 0'
        });
      }

      const dispatcher = getDispatcherTotemService();
      dispatcher.setCacheConfig({ enabled, ttlSeconds, maxSize });

      const newConfig = dispatcher.getCacheConfig();

      return res.json({
        success: true,
        data: newConfig,
        message: 'Configuração de cache atualizada com sucesso'
      });} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('Erro ao configurar cache', e.error);
      return res.status(500).json({
        success: false,
        error: e.message || 'Erro interno do servidor'
    });
    }
  }
);

export default router;
