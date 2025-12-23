/**
 * Alerts Routes
 * Rotas para gerenciamento de alertas do sistema
 * @access Private (Admin, Admin SQL)
 */

import { Router, Response } from 'express';
import { query, param, validationResult } from 'express-validator';
import { authMiddleware, authorizeRole } from '../middleware/auth.middleware';
import { getAlertService } from '../services/alertService';
import { logError } from '../utils/loggerHelper';

const router = Router();

// Middleware de autenticação para todas as rotas
router.use(authMiddleware as any);

const validateRequest = (req: any, res: any, next: any) => {
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
 * @route GET /api/alerts
 * @desc Lista alertas ativos
 * @access Private (Admin, Admin SQL)
 */
router.get('/',
  query('limit').optional().isInt({ min: 1, max: 100 }),
  validateRequest,
  authorizeRole(['admin', 'admin_sql']) as any,
  async (req: any, res: Response) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
      
      const alerts = await getAlertService().getActiveAlerts(limit);

      res.json({
        success: true,
        data: alerts,
        count: alerts.length,
      });
    } catch (error: any) {
      await logError('GET /api/alerts error', error, req.query);
      res.status(500).json({
        error: 'Erro ao listar alertas',
        message: error.message
      });
    }
  }
);

/**
 * @route POST /api/alerts/check
 * @desc Força verificação de alertas
 * @access Private (Admin, Admin SQL)
 */
router.post('/check',
  validateRequest,
  authorizeRole(['admin', 'admin_sql']) as any,
  async (_req: any, res: Response) => {
    try {
      const alerts = await getAlertService().checkAllAlerts();

      // Enviar alertas pelos canais configurados
      for (const alert of alerts) {
        const rule = getAlertService()['alertRules'].find(r => r.id === alert.ruleId);
        if (rule) {
          await getAlertService().sendAlert(alert, rule.channels);
        }
      }

      res.json({
        success: true,
        data: alerts,
        count: alerts.length,
        checked: new Date().toISOString(),
      });
    } catch (error: any) {
      await logError('POST /api/alerts/check error', error, {});
      res.status(500).json({
        error: 'Erro ao verificar alertas',
        message: error.message
      });
    }
  }
);

/**
 * @route POST /api/alerts/:id/acknowledge
 * @desc Reconhece um alerta
 * @access Private (Admin, Admin SQL)
 */
router.post('/:id/acknowledge',
  param('id').isString().notEmpty(),
  validateRequest,
  authorizeRole(['admin', 'admin_sql']) as any,
  async (req: any, res: Response) => {
    try {
      const alertId = req.params.id;
      const userId = req.user.id;

      await getAlertService().acknowledgeAlert(alertId, userId);

      res.json({
        success: true,
        message: 'Alerta reconhecido com sucesso',
      });
    } catch (error: any) {
      await logError('POST /api/alerts/:id/acknowledge error', error, { id: req.params.id });
      res.status(500).json({
        error: 'Erro ao reconhecer alerta',
        message: error.message
      });
    }
  }
);

export default router;

