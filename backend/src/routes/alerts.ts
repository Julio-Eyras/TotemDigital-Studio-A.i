/**
 * Alerts Routes
 * Rotas para gerenciamento de alertas do sistema
 * @access Private (Admin, Admin SQL)
 */

import { Router} from 'express';
import express from 'express';

import { query, param, validationResult } from 'express-validator';
import { authMiddleware, authorizeRole } from '../middleware/auth.middleware';
import { getAlertService } from '../services/alertService';
import { logError } from '../utils/loggerHelper';
import { successResponse, errorResponse } from '../utils/apiResponse';
import { normalizeError } from '../utils/errors';

const router = Router();

// Middleware de autenticação para todas as rotas
router.use(authMiddleware as any);

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
 * @route GET /api/alerts
 * @desc Lista alertas ativos
 * @access Private (Admin, Admin SQL)
 */
router.get('/',
  query('limit').optional().isInt({ min: 1, max: 100 }),
  validateRequest,
  authorizeRole(['admin', 'admin_sql']) as any,
  async (req: express.Request, res: express.Response) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
      
      const alerts = await getAlertService().getActiveAlerts(limit);

      res.json(successResponse(alerts, {
        count: alerts.length }));} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('GET /api/alerts error', error, req.query);
      res.status(500).json(errorResponse('Erro ao listar alertas', e.message));
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
  async (_req: express.Request, res: express.Response) => {
    try {
      const alerts = await getAlertService().checkAllAlerts();

      // Enviar alertas pelos canais configurados
      for (const alert of alerts) {
        const rule = getAlertService()['alertRules'].find(r => r.id === alert.ruleId);
        if (rule) {
          await getAlertService().sendAlert(alert, rule.channels);
        }
      }

      res.json(successResponse(alerts, {
        count: alerts.length, checked: new Date().toISOString() }));} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('POST /api/alerts/check error', e.error, {});
      res.status(500).json(errorResponse('Erro ao verificar alertas', e.message));
    }
  }
);

/**
 * @route POST /api/alerts/process-contract-audits
 * @desc Processa registros de contract_change_audit e envia alertas
 * @access Private (Admin, Admin SQL)
 */
router.post('/process-contract-audits',
  validateRequest,
  authorizeRole(['admin', 'admin_sql']) as any,
  async (_req: express.Request, res: express.Response) => {
    try {
      const { getContractAuditService } = await import('../services/contractAuditService');
      const results = await getContractAuditService().processPending(100);

      res.json(successResponse(results, {
        processed: results.length }));} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('POST /api/alerts/process-contract-audits error', e.error, {});
      res.status(500).json(errorResponse('Erro ao processar contract audits', e.message));
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
  async (req: express.Request, res: express.Response) => {
    try {
      const alertId = req.params.id;
      const userId = req.user!.id;

      await getAlertService().acknowledgeAlert(alertId, userId);

      res.json(successResponse({
        message: 'Alerta reconhecido com sucesso' }));} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('POST /api/alerts/:id/acknowledge error', e.error, { id: req.params.id });
      res.status(500).json(errorResponse('Erro ao reconhecer alerta', e.message));
    }
  }
);

export default router;

