/**
 * Dispatcher Debug Routes
 * Rotas para debug online do dispatcher, Redis, queries e mensagens
 */

import { Router, Response } from 'express';
import { query, validationResult } from 'express-validator';
import { authMiddleware, AuthenticatedRequest, authorizeRole } from '../middleware/auth.middleware';
import { dispatcherDebugService } from '../services/dispatcherDebugService';
import { logError } from '../utils/loggerHelper';

const router = Router();

// Middleware de autenticação
router.use(authMiddleware);

// Apenas admins e operadores técnicos podem acessar debug
router.use(authorizeRole(['admin', 'admin_sql', 'owner_system', 'operador_tecnico']) as any);

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
 * @route GET /api/dispatcher-debug/redis-status
 * @desc Obter status do Redis
 * @access Private (Admin, Operador Técnico)
 */
router.get('/redis-status', async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const status = await dispatcherDebugService.getRedisStatus();
    return res.json({
      success: true,
      data: status,
    });
  } catch (error: any) {
    await logError('Erro ao obter status do Redis', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Erro interno do servidor'
    });
  }
});

/**
 * @route GET /api/dispatcher-debug/queries
 * @desc Obter logs de queries SQL
 * @access Private (Admin, Operador Técnico)
 */
router.get('/queries',
  query('limit').optional().isInt({ min: 1, max: 1000 }).withMessage('limit deve ser entre 1 e 1000'),
  query('since').optional().isISO8601().withMessage('since deve ser uma data ISO8601 válida'),
  validateRequest,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
      const since = req.query.since ? new Date(req.query.since as string) : undefined;

      const logs = dispatcherDebugService.getQueryLogs(limit, since);

      return res.json({
        success: true,
        data: logs,
        count: logs.length,
      });
    } catch (error: any) {
      await logError('Erro ao buscar logs de queries', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Erro interno do servidor'
      });
    }
  }
);

/**
 * @route GET /api/dispatcher-debug/messages
 * @desc Obter logs de mensagens do dispatcher
 * @access Private (Admin, Operador Técnico)
 */
router.get('/messages',
  query('limit').optional().isInt({ min: 1, max: 1000 }).withMessage('limit deve ser entre 1 e 1000'),
  query('since').optional().isISO8601().withMessage('since deve ser uma data ISO8601 válida'),
  query('totemId').optional().isInt().withMessage('totemId deve ser um número'),
  query('uin').optional().isString().withMessage('uin deve ser uma string'),
  validateRequest,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
      const since = req.query.since ? new Date(req.query.since as string) : undefined;
      const totemId = req.query.totemId ? parseInt(req.query.totemId as string) : undefined;
      const uin = req.query.uin as string | undefined;

      const logs = dispatcherDebugService.getMessageLogs(limit, since, totemId, uin);

      return res.json({
        success: true,
        data: logs,
        count: logs.length,
      });
    } catch (error: any) {
      await logError('Erro ao buscar logs de mensagens', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Erro interno do servidor'
      });
    }
  }
);

/**
 * @route GET /api/dispatcher-debug/logs
 * @desc Obter todos os logs de debug (unificado)
 * @access Private (Admin, Operador Técnico)
 */
router.get('/logs',
  query('limit').optional().isInt({ min: 1, max: 1000 }).withMessage('limit deve ser entre 1 e 1000'),
  query('since').optional().isISO8601().withMessage('since deve ser uma data ISO8601 válida'),
  query('type').optional().isIn(['redis', 'query', 'message', 'cache']).withMessage('type inválido'),
  validateRequest,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 200;
      const since = req.query.since ? new Date(req.query.since as string) : undefined;
      const type = req.query.type as 'redis' | 'query' | 'message' | 'cache' | undefined;

      const logs = dispatcherDebugService.getDebugLogs(limit, since, type);

      return res.json({
        success: true,
        data: logs,
        count: logs.length,
      });
    } catch (error: any) {
      await logError('Erro ao buscar logs de debug', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Erro interno do servidor'
      });
    }
  }
);

/**
 * @route GET /api/dispatcher-debug/stats
 * @desc Obter estatísticas de debug
 * @access Private (Admin, Operador Técnico)
 */
router.get('/stats', async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const stats = dispatcherDebugService.getStats();
    const redisStatus = await dispatcherDebugService.getRedisStatus();

    return res.json({
      success: true,
      data: {
        ...stats,
        redis: redisStatus,
      },
    });
  } catch (error: any) {
    await logError('Erro ao obter estatísticas', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Erro interno do servidor'
    });
  }
});

/**
 * @route POST /api/dispatcher-debug/clear
 * @desc Limpar logs de debug
 * @access Private (Admin, Operador Técnico)
 */
router.post('/clear',
  query('olderThan').optional().isISO8601().withMessage('olderThan deve ser uma data ISO8601 válida'),
  validateRequest,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const olderThan = req.query.olderThan ? new Date(req.query.olderThan as string) : undefined;
      dispatcherDebugService.clearLogs(olderThan);

      return res.json({
        success: true,
        message: 'Logs limpos com sucesso',
      });
    } catch (error: any) {
      await logError('Erro ao limpar logs', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Erro interno do servidor'
      });
    }
  }
);

export default router;
