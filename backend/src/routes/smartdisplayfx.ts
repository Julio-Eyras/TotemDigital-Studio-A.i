/**
 * SmartDisplayFX Routes - Debug / Orquestração FX
 *
 * Nesta fase, expõe:
 *  - endpoint de debug para disparar manualmente um efeito FX entre totens;
 *  - endpoints para receber eventos de interação/IA via REST.
 */

import { Router } from 'express';
import express from 'express';

import { body, validationResult } from 'express-validator';
import { authMiddleware, authorizeRole } from '../middleware/auth.middleware';
import { getFxOrchestratorService, FxAiEvent, FxInteractionEvent } from '../services/fxOrchestratorService';
import { logError } from '../utils/loggerHelper';
import { getDatabase } from '../config/database';
import { normalizeError } from '../utils/errors';

const router = Router();

// Middleware de validação simples
const validateRequest = (req: express.Request, res: express.Response, next: express.NextFunction): void => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({
      success: false,
      error: 'Dados inválidos',
      details: errors.array(),
    });
    return;
  }
  next();
};

// Aplicar autenticação em todas as rotas SmartDisplayFX
// (players podem usar token JWT/Service já suportado pelo authMiddleware)
router.use(authMiddleware);

/**
 * @route POST /api/smartdisplayfx/debug/trigger-effect
 * @desc Dispara manualmente um efeito FX entre dois totens (debug)
 * @access Private (Admin/Manager)
 */
router.post(
  '/debug/trigger-effect',
  authorizeRole(['admin', 'gerente_marketing', 'visualizador']),
  body('siteId').notEmpty().withMessage('siteId é obrigatório'),
  body('fromTotemId').notEmpty().withMessage('fromTotemId é obrigatório'),
  body('toTotemId').notEmpty().withMessage('toTotemId é obrigatório'),
  body('effectId').optional({ nullable: true }).isString(),
  body('contentId').optional({ nullable: true }).isInt(),
  body('durationMs').optional({ nullable: true }).isInt({ min: 100 }),
  validateRequest,
  async (req: express.Request, res: express.Response) => {
    try {
      const { siteId, fromTotemId, toTotemId, effectId, contentId, durationMs, params } = req.body;
      const fxService = getFxOrchestratorService();

      await fxService.triggerEffect({
        siteId,
        fromTotemId,
        toTotemId,
        effectId,
        contentId: contentId ?? null,
        durationMs,
        params,
      });

      return res.json({
        success: true,
        message: 'Efeito FX disparado (debug)',
      });} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('Erro em /api/smartdisplayfx/debug/trigger-effect', e.error, {
        route: '/api/smartdisplayfx/debug/trigger-effect',
    }).catch(() => {});

      return res.status(500).json({
        success: false,
        error: 'Erro ao disparar efeito FX',
        details: e.message,
      });
    }
  }
);

/**
 * @route POST /api/smartdisplayfx/events/interaction
 * @desc Recebe evento de interação (tag, touch, gesture, facial)
 * @access Private (totem/player autenticado OU Admin)
 */
router.post(
  '/events/interaction',
  body('siteId').notEmpty().withMessage('siteId é obrigatório'),
  body('totemId').notEmpty().withMessage('totemId é obrigatório'),
  body('interactionType')
    .isIn(['tag_id', 'touch', 'gesture', 'facial_recognition'])
    .withMessage('interactionType inválido'),
  body('tagId').optional({ nullable: true }).isString(),
  body('contentId').optional({ nullable: true }).isInt(),
  body('timestamp').optional({ nullable: true }).isISO8601(),
  validateRequest,
  async (req: express.Request, res: express.Response) => {
    try {
      const fxService = getFxOrchestratorService();

      const event: FxInteractionEvent = {
        siteId: req.body.siteId,
        totemId: req.body.totemId,
        interactionType: req.body.interactionType,
        tagId: req.body.tagId,
        contentId: req.body.contentId,
        timestamp: req.body.timestamp || new Date().toISOString(),
        extra: req.body.extra,
      };

      await fxService.handleInteractionEvent(event);

      res.json({
        success: true,
        message: 'Evento de interação recebido e processado',
      });} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('Erro em /api/smartdisplayfx/events/interaction', e.error, {
        route: '/api/smartdisplayfx/events/interaction',
    }).catch(() => {});

      res.status(500).json({
        success: false,
        error: 'Erro ao processar evento de interação',
        details: e.message,
      });
    }
  }
);

/**
 * @route POST /api/smartdisplayfx/events/ai
 * @desc Recebe evento de IA de borda (perfil, atenção, humor, gesto)
 * @access Private (totem/player autenticado OU Admin)
 */
router.post(
  '/events/ai',
  body('siteId').notEmpty().withMessage('siteId é obrigatório'),
  body('totemId').notEmpty().withMessage('totemId é obrigatório'),
  body('eventId').notEmpty().withMessage('eventId é obrigatório'),
  body('eventType').notEmpty().withMessage('eventType é obrigatório'),
  body('payload').notEmpty().withMessage('payload é obrigatório'),
  body('timestamp').optional({ nullable: true }).isISO8601(),
  validateRequest,
  async (req: express.Request, res: express.Response) => {
    try {
      const fxService = getFxOrchestratorService();

      const event: FxAiEvent = {
        siteId: req.body.siteId,
        totemId: req.body.totemId,
        eventId: req.body.eventId,
        eventType: req.body.eventType,
        payload: req.body.payload,
        timestamp: req.body.timestamp || new Date().toISOString(),
      };

      await fxService.handleAiEvent(event);

      return res.json({
        success: true,
        message: 'Evento de IA recebido e processado',
      });} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('Erro em /api/smartdisplayfx/events/ai', e.error, {
        route: '/api/smartdisplayfx/events/ai',
    }).catch(() => {});

      return res.status(500).json({
        success: false,
        error: 'Erro ao processar evento de IA',
        details: e.message,
      });
    }
  }
);

/**
 * @route GET /api/smartdisplayfx/logs
 * @desc Retorna últimos eventos SmartDisplayFX (regras/efeitos) a partir de event_logs
 * @access Private (Admin/Manager)
 */
router.get(
  '/logs',
  authorizeRole(['admin', 'gerente_marketing', 'visualizador']),
  async (req: express.Request, res: express.Response) => {
    try {
      const db = getDatabase();
      const siteId = (req.query.siteId as string) || undefined;
      const type = (req.query.type as string) || undefined; // 'rule' | 'effect' | undefined
      const limitParam = parseInt((req.query.limit as string) || '50', 10);
      const limit = Number.isNaN(limitParam) ? 50 : Math.min(Math.max(limitParam, 1), 200);

      const params: unknown[] = [];
      let where = "WHERE entity_type IN ('smartdisplayfx_rule','smartdisplayfx_effect')";

      if (type === 'rule') {
        where = "WHERE entity_type = 'smartdisplayfx_rule'";
      } else if (type === 'effect') {
        where = "WHERE entity_type = 'smartdisplayfx_effect'";
      }

      if (siteId) {
        params.push(siteId);
        where += ` AND metadata->>'siteId' = $${params.length}`;
      }

      params.push(limit);

      const query = `
        SELECT
          log_id as id,
          event_type,
          entity_type,
          media_id,
          metadata,
          timestamp as created_at
        FROM event_logs
        ${where}
        ORDER BY timestamp DESC
        LIMIT $${params.length}
      `;

      const result = await db.executeRaw(query, params);

      return res.json({
        success: true,
        data: result.rows,
      });} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('Erro em /api/smartdisplayfx/logs', e.error, {
        route: '/api/smartdisplayfx/logs',
    }).catch(() => {});

      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar logs SmartDisplayFX',
        details: e.message,
      });
    }
  }
);

/**
 * @route POST /api/smartdisplayfx/timelines/generate
 * @desc Gera uma nova timeline FX para um site
 * @access Private (Admin, Admin SQL, Gerente Marketing)
 */
router.post(
  '/timelines/generate',
  authorizeRole(['admin', 'admin_sql', 'gerente_marketing']),
  body('siteId').notEmpty().withMessage('siteId é obrigatório'),
  body('durationMinutes').optional({ nullable: true }).isInt({ min: 1, max: 1440 }),
  validateRequest,
  async (req: express.Request, res: express.Response) => {
    try {
      const { siteId, durationMinutes } = req.body;
      const fxService = getFxOrchestratorService();

      const timeline = await fxService.generateTimeline(siteId, durationMinutes || 60);

      return res.json({
        success: true,
        data: timeline,
        message: 'Timeline FX gerada com sucesso'
      });} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('Erro em /api/smartdisplayfx/timelines/generate', e.error, {
        route: '/api/smartdisplayfx/timelines/generate',
    }).catch(() => {});

      return res.status(500).json({
        success: false,
        error: 'Erro ao gerar timeline FX',
        details: e.message,
      });
    }
  }
);

/**
 * @route POST /api/smartdisplayfx/sync-time
 * @desc Publica mensagem de sincronização de tempo para um site
 * @access Private (Admin, Admin SQL)
 */
router.post(
  '/sync-time',
  authorizeRole(['admin', 'admin_sql']),
  body('siteId').notEmpty().withMessage('siteId é obrigatório'),
  validateRequest,
  async (req: express.Request, res: express.Response) => {
    try {
      const { siteId } = req.body;
      const { getFxMessageBridge } = await import('../services/fxMessageBridge');
      const messageBridge = getFxMessageBridge();

      await messageBridge.publishSyncTime(siteId);

      return res.json({
        success: true,
        message: 'Mensagem de sincronização de tempo publicada'
      });} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('Erro em /api/smartdisplayfx/sync-time', e.error, {
        route: '/api/smartdisplayfx/sync-time',
    }).catch(() => {});

      return res.status(500).json({
        success: false,
        error: 'Erro ao publicar sincronização de tempo',
        details: e.message,
      });
    }
  }
);

export default router;

