/**
 * Webhooks Routes - Smart Signage Pro v3.1
 * Rotas para gerenciar webhooks configuráveis
 */

import { Router} from 'express';
import express from 'express';

import { body, param, query, validationResult } from 'express-validator';
import { authMiddleware, authorizeRole } from '../middleware/auth.middleware';
import { getWebhookService } from '../services/webhookService';
import { logError } from '../utils/loggerHelper';
import { normalizeError } from '../utils/errors';

const router = Router();

// Middleware de autenticação
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
 * @route GET /api/webhooks
 * @desc Listar webhooks
 * @access Private (Admin)
 */
router.get('/',
  query('enabled').optional().isBoolean(),
  query('channel').optional().isString(),
  query('event').optional().isString(),
  validateRequest,
  authorizeRole(['admin', 'admin_sql']),
  async (req: express.Request, res: express.Response) => {
    try {
      const filters: Record<string, unknown> = {};
      if (req.query.enabled !== undefined) {
        filters.enabled = req.query.enabled === 'true';
      }
      if (req.query.channel) filters.channel = req.query.channel;
      if (req.query.event) filters.event = req.query.event;

      const webhooks = await getWebhookService().getAllWebhooks(filters);
      return res.json({
        success: true,
        data: webhooks
      });} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('Erro ao listar webhooks', e.error);
      return res.status(500).json({
        success: false,
        message: e.message || 'Erro ao listar webhooks'
      });
    }
  }
);

/**
 * @route GET /api/webhooks/:id
 * @desc Obter webhook por ID
 * @access Private (Admin)
 */
router.get('/:id',
  param('id').isInt({ min: 1 }),
  validateRequest,
  authorizeRole(['admin', 'admin_sql']),
  async (req: express.Request, res: express.Response) => {
    try {
      const webhook = await getWebhookService().getWebhookById(parseInt(req.params.id));
      if (!webhook) {
        return res.status(404).json({
          success: false,
          message: 'Webhook não encontrado'
        });
      }
      return res.json({
        success: true,
        data: webhook
      });} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('Erro ao buscar webhook', e.error);
      return res.status(500).json({
        success: false,
        message: e.message || 'Erro ao buscar webhook'
      });
    }
  }
);

/**
 * @route POST /api/webhooks
 * @desc Criar webhook
 * @access Private (Admin)
 */
router.post('/',
  body('name').notEmpty().isString(),
  body('url').notEmpty().isURL(),
  body('secret').optional({ nullable: true }).isString(),
  body('channels').optional({ nullable: true }).isArray(),
  body('events').optional({ nullable: true }).isArray(),
  body('enabled').optional({ nullable: true }).isBoolean(),
  body('retryCount').optional({ nullable: true }).isInt({ min: 0, max: 10 }),
  body('timeoutMs').optional({ nullable: true }).isInt({ min: 1000, max: 30000 }),
  validateRequest,
  authorizeRole(['admin', 'admin_sql']),
  async (req: express.Request, res: express.Response) => {
    try {
      const webhook = await getWebhookService().createWebhook(req.body);
      return res.status(201).json({
        success: true,
        data: webhook
      });} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('Erro ao criar webhook', e.error);
      return res.status(400).json({
        success: false,
        message: e.message || 'Erro ao criar webhook'
      });
    }
  }
);

/**
 * @route PUT /api/webhooks/:id
 * @desc Atualizar webhook
 * @access Private (Admin)
 */
router.put('/:id',
  param('id').isInt({ min: 1 }),
  body('name').optional({ nullable: true }).isString(),
  body('url').optional({ nullable: true }).isURL(),
  body('secret').optional({ nullable: true }).isString(),
  body('channels').optional({ nullable: true }).isArray(),
  body('events').optional({ nullable: true }).isArray(),
  body('enabled').optional({ nullable: true }).isBoolean(),
  body('retryCount').optional({ nullable: true }).isInt({ min: 0, max: 10 }),
  body('timeoutMs').optional({ nullable: true }).isInt({ min: 1000, max: 30000 }),
  validateRequest,
  authorizeRole(['admin', 'admin_sql']),
  async (req: express.Request, res: express.Response) => {
    try {
      const webhook = await getWebhookService().updateWebhook(parseInt(req.params.id), req.body);
      return res.json({
        success: true,
        data: webhook
      });} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('Erro ao atualizar webhook', e.error);
      return res.status(400).json({
        success: false,
        message: e.message || 'Erro ao atualizar webhook'
      });
    }
  }
);

/**
 * @route DELETE /api/webhooks/:id
 * @desc Deletar webhook
 * @access Private (Admin)
 */
router.delete('/:id',
  param('id').isInt({ min: 1 }),
  validateRequest,
  authorizeRole(['admin', 'admin_sql']),
  async (req: express.Request, res: express.Response) => {
    try {
      await getWebhookService().deleteWebhook(parseInt(req.params.id));
      return res.json({
        success: true,
        message: 'Webhook deletado com sucesso'
      });} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('Erro ao deletar webhook', e.error);
      return res.status(400).json({
        success: false,
        message: e.message || 'Erro ao deletar webhook'
      });
    }
  }
);

/**
 * @route POST /api/webhooks/:id/test
 * @desc Testar webhook
 * @access Private (Admin)
 */
router.post('/:id/test',
  param('id').isInt({ min: 1 }),
  validateRequest,
  authorizeRole(['admin', 'admin_sql']),
  async (req: express.Request, res: express.Response) => {
    try {
      const webhook = await getWebhookService().getWebhookById(parseInt(req.params.id));
      if (!webhook) {
        return res.status(404).json({
          success: false,
          message: 'Webhook não encontrado'
        });
      }

      await getWebhookService().triggerWebhook('test', {
        message: 'Teste de webhook',
        timestamp: new Date().toISOString()
      });

      return res.json({
        success: true,
        message: 'Webhook testado com sucesso'
      });} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('Erro ao testar webhook', e.error);
      return res.status(500).json({
        success: false,
        message: e.message || 'Erro ao testar webhook'
      });
    }
  }
);

export default router;

