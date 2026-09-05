/**
 * Health Check Routes - Smart Signage Pro v3.1
 * Rotas para verificação avançada de saúde do sistema
 */

import { Router, Response } from 'express';

import { getHealthCheckService } from '../services/healthCheckService';
import { logError } from '../utils/loggerHelper';
import { normalizeError } from '../utils/errors';

const router = Router();

/**
 * @route GET /api/health/check
 * @desc Verificação completa de saúde do sistema
 * @access Public (para monitoramento)
 */
router.get('/check', async (_req, res: Response) => {
  try {
    const healthCheckService = getHealthCheckService();
    const health = await healthCheckService.performHealthCheck();

    const statusCode = health.status === 'healthy' ? 200 : health.status === 'degraded' ? 200 : 503;
    res.status(statusCode).json(health);} catch (error: unknown) {
    const e = normalizeError(error);
    await logError('Erro ao verificar saúde do sistema', e.error);
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: e.message
  });
  }
});

/**
 * @route GET /api/health/quick
 * @desc Verificação rápida (apenas componentes críticos)
 * @access Public (para load balancers)
 */
router.get('/quick', async (_req, res: Response) => {
  try {
    const healthCheckService = getHealthCheckService();
    const health = await healthCheckService.quickHealthCheck();

    const statusCode = health.status === 'healthy' ? 200 : 503;
    res.status(statusCode).json(health);} catch (error: unknown) {
    const e = normalizeError(error);
    await logError('Erro na verificação rápida de saúde', e.error);
    res.status(503).json({
      status: 'unhealthy',
      message: e.message
  });
  }
});

export default router;

