/**
 * Dispatcher-Totem Routes
 * Rotas para o módulo Dispatcher-Totem
 */

import { Router, Response } from 'express';
import { query, validationResult } from 'express-validator';
import { authMiddleware, AuthenticatedRequest, authorizeRole } from '../middleware/auth.middleware';
import { getDispatcherTotemService } from '../services/dispatcherTotemService';
import { logError } from '../utils/loggerHelper';
import { idParamValidator } from '../validators/common.validators';

const router = Router();

// Middleware de autenticação
router.use(authMiddleware);

const validateRequest = (req: any, res: any, next: any) => {
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
  async (req: AuthenticatedRequest, res: Response) => {
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

      return res.json({
        success: result.success,
        data: result.plan,
        candidates: result.candidates,
        fromCache: result.fromCache,
        executionTimeMs: result.executionTimeMs,
        error: result.error,
      });

    } catch (error: any) {
      await logError('Erro ao gerar plano de dispatch', error, { totemId: req.params.totemId });
      return res.status(500).json({
        success: false,
        error: error.message || 'Erro interno do servidor'
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
  async (req: AuthenticatedRequest, res: Response) => {
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
      });

    } catch (error: any) {
      await logError('Erro ao buscar histórico de dispatch', error, { totemId: req.params.totemId });
      return res.status(500).json({
        success: false,
        error: error.message || 'Erro interno do servidor'
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
  authorizeRole(['admin', 'admin_sql', 'owner_system', 'operador_tecnico', 'operador_faturamento', 'operador_comercial']) as any,
  async (req: AuthenticatedRequest, res: Response) => {
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

      return res.json({
        success: true,
        candidates: result.candidates || [],
        selectedPlan: result.plan,
        count: result.candidates?.length || 0,
      });

    } catch (error: any) {
      await logError('Erro ao buscar candidatos', error, { totemId: req.params.totemId });
      return res.status(500).json({
        success: false,
        error: error.message || 'Erro interno do servidor'
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
  authorizeRole(['admin', 'admin_sql', 'owner_system', 'operador_tecnico', 'operador_faturamento', 'operador_comercial']) as any,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const totemId = parseInt(req.params.totemId);
      const dispatcher = getDispatcherTotemService();
      const diagnostics = await dispatcher.getDiagnostics(totemId);
      return res.json({
        success: true,
        data: diagnostics,
      });
    } catch (error: any) {
      await logError('Erro ao buscar diagnostics do dispatcher', error, { totemId: req.params.totemId });
      return res.status(500).json({
        success: false,
        error: error.message || 'Erro interno do servidor',
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
  authorizeRole(['admin', 'admin_sql', 'owner_system', 'operador_tecnico', 'operador_faturamento', 'operador_comercial']) as any,
  async (_req: AuthenticatedRequest, res: Response) => {
    try {
      const dispatcher = getDispatcherTotemService();
      const config = dispatcher.getCacheConfig();

      return res.json({
        success: true,
        data: config,
      });

    } catch (error: any) {
      await logError('Erro ao obter configuração de cache', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Erro interno do servidor'
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
  authorizeRole(['admin', 'admin_sql', 'owner_system', 'operador_tecnico', 'operador_faturamento', 'operador_comercial']) as any,
  async (req: AuthenticatedRequest, res: Response) => {
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
      });

    } catch (error: any) {
      await logError('Erro ao configurar cache', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Erro interno do servidor'
      });
    }
  }
);

export default router;
