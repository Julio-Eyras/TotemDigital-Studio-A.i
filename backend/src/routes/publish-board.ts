import { Router, type Request } from 'express';
import { body, param, validationResult } from 'express-validator';
import { authenticateToken, authorizeRole } from '../middleware/auth.middleware';
import { blockClientDataAccess } from '../middleware/operatorProtection.middleware';
import { getPublishBoardService } from '../services/publishBoardService';
import { getPublishBriefAiService } from '../services/publishBriefAiService';
import { getPublishVideoAiQueueService } from '../services/publishVideoAiQueueService';
import { getAutoPublishOrchestratorService } from '../services/autoPublishOrchestratorService';
import { getAIServiceInstance } from '../utils/globalInstances';
import { logError } from '../utils/loggerHelper';
import { assertSubscriberParamAccess } from '../middleware/subscriberParamAccess.middleware';

type PublishBoardParams = { subscriberId: string; preset: string };

const PRESETS = ['menu', 'promotion', 'ad', 'announcement', 'institutional'];

function parsePublishBoardRoute(req: { params?: unknown }): { subscriberId: number; preset: string } {
  const params = (req.params ?? {}) as PublishBoardParams;
  return {
    subscriberId: Number(params.subscriberId),
    preset: String(params.preset),
  };
}

const router = Router({ mergeParams: true });

router.use(authenticateToken);
router.use(blockClientDataAccess);
router.use(assertSubscriberParamAccess);

const validate = (req: any, res: any, next: any) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, error: 'Dados inválidos', details: errors.array() });
  }
  return next();
};

router.get('/ai-assist-status', async (_req, res) => {
  try {
    const status = await getAIServiceInstance().checkAIStatus();
    const available = status.enabled && status.status === 'online';
    return res.json({
      success: true,
      data: {
        available,
        enabled: status.enabled,
        provider: status.provider,
        status: status.status,
        message: available
          ? `Assistente de textos ativo (${status.provider}).`
          : status.message || 'Configure AI_PROVIDER e credenciais no servidor para usar sugestões de texto.',
      },
    });
  } catch (error: any) {
    await logError('Erro ao verificar status da IA para publicação', error);
    return res.json({
      success: true,
      data: {
        available: false,
        enabled: false,
        provider: 'none',
        status: 'offline',
        message: 'Assistente de textos indisponível. Configure AI_PROVIDER no servidor.',
      },
    });
  }
});

router.get(
  '/:preset/layout',
  param('subscriberId').isInt({ min: 1 }),
  param('preset').isIn(PRESETS),
  validate,
  async (req, res) => {
    try {
      const { subscriberId, preset } = parsePublishBoardRoute(req);
      const data = await getPublishBoardService().getLayout(subscriberId, preset);
      return res.json({ success: true, data });
    } catch (error: any) {
      await logError('Erro ao carregar layout do quadro', error);
      return res.status(500).json({ success: false, error: 'Erro ao carregar layout' });
    }
  }
);

router.put(
  '/:preset/layout',
  authorizeRole(['admin', 'admin_sql', 'gerente_marketing', 'editoracao']),
  param('subscriberId').isInt({ min: 1 }),
  param('preset').isIn(PRESETS),
  body('boardTitle').optional().isString().trim().isLength({ min: 1, max: 120 }),
  body('accentColor').optional().isString().isLength({ max: 32 }),
  body('preferredOrientation').optional().isIn(['portrait', 'landscape']),
  body('content').optional().isObject(),
  body('blockOrder').optional().isArray(),
  body('productOrder').optional().isArray(),
  body('showPrices').optional().isBoolean(),
  validate,
  async (req, res) => {
    try {
      const { subscriberId, preset } = parsePublishBoardRoute(req);
      const current = await getPublishBoardService().getLayout(subscriberId, preset);
      const data = await getPublishBoardService().saveLayout({
        subscriberId,
        preset: current.preset,
        boardTitle: req.body.boardTitle ?? current.boardTitle,
        accentColor: req.body.accentColor ?? current.accentColor,
        preferredOrientation: req.body.preferredOrientation ?? current.preferredOrientation,
        content: req.body.content ?? current.content,
        blockOrder: Array.isArray(req.body.blockOrder) ? req.body.blockOrder : current.blockOrder,
        productOrder: Array.isArray(req.body.productOrder)
          ? req.body.productOrder.map(Number).filter((n: number) => n > 0)
          : current.productOrder,
        showPrices: req.body.showPrices ?? current.showPrices,
      });
      return res.json({ success: true, data });
    } catch (error: any) {
      await logError('Erro ao salvar layout do quadro', error);
      return res.status(500).json({ success: false, error: 'Erro ao salvar layout' });
    }
  }
);

router.post(
  '/:preset/render',
  authorizeRole(['admin', 'admin_sql', 'gerente_marketing', 'editoracao']),
  param('subscriberId').isInt({ min: 1 }),
  param('preset').isIn(PRESETS),
  validate,
  async (req: Request & { user?: { id?: number; userId?: number; role?: string } }, res) => {
    try {
      const { subscriberId, preset } = parsePublishBoardRoute(req);
      const role = String(req.user?.role || '');
      const isAdmin = ['admin', 'admin_sql', 'owner_system'].includes(role);
      const data = await getPublishBoardService().renderToMedia(
        subscriberId,
        preset,
        Number(req.user?.id || req.user?.userId || 0),
        isAdmin
      );
      return res.status(201).json({
        success: true,
        message: 'Mídia gerada com sucesso',
        data,
      });
    } catch (error: any) {
      await logError('Erro ao gerar mídia do quadro', error);
      return res.status(400).json({
        success: false,
        error: error.message || 'Erro ao gerar mídia',
      });
    }
  }
);

router.post(
  '/:preset/preview-html',
  param('subscriberId').isInt({ min: 1 }),
  param('preset').isIn(PRESETS),
  body('boardTitle').optional().isString(),
  body('accentColor').optional().isString(),
  body('preferredOrientation').optional().isIn(['portrait', 'landscape']),
  body('content').optional().isObject(),
  body('blockOrder').optional().isArray(),
  body('productOrder').optional().isArray(),
  body('showPrices').optional().isBoolean(),
  validate,
  async (req, res) => {
    try {
      const { subscriberId, preset } = parsePublishBoardRoute(req);
      const current = await getPublishBoardService().getLayout(subscriberId, preset);
      await getPublishBoardService().saveLayout({
        subscriberId,
        preset: current.preset,
        boardTitle: req.body.boardTitle ?? current.boardTitle,
        accentColor: req.body.accentColor ?? current.accentColor,
        preferredOrientation: req.body.preferredOrientation ?? current.preferredOrientation,
        content: req.body.content ?? current.content,
        blockOrder: Array.isArray(req.body.blockOrder) ? req.body.blockOrder : current.blockOrder,
        productOrder: Array.isArray(req.body.productOrder)
          ? req.body.productOrder.map(Number).filter((n: number) => n > 0)
          : current.productOrder,
        showPrices: req.body.showPrices ?? current.showPrices,
      });
      const html = await getPublishBoardService().previewHtml(subscriberId, preset);
      return res.json({ success: true, data: { html } });
    } catch (error: any) {
      await logError('Erro ao pré-visualizar HTML', error);
      return res.status(400).json({ success: false, error: error.message || 'Erro na pré-visualização' });
    }
  }
);

router.post(
  '/:preset/render-html',
  authorizeRole(['admin', 'admin_sql', 'gerente_marketing', 'editoracao']),
  param('subscriberId').isInt({ min: 1 }),
  param('preset').isIn(PRESETS),
  validate,
  async (req: Request & { user?: { id?: number; userId?: number; role?: string } }, res) => {
    try {
      const { subscriberId, preset } = parsePublishBoardRoute(req);
      const role = String(req.user?.role || '');
      const isAdmin = ['admin', 'admin_sql', 'owner_system'].includes(role);
      const data = await getPublishBoardService().renderToMediaHtml(
        subscriberId,
        preset,
        Number(req.user?.id || req.user?.userId || 0),
        isAdmin
      );
      return res.status(201).json({
        success: true,
        message: 'Animação HTML gerada com sucesso',
        data,
      });
    } catch (error: any) {
      await logError('Erro ao gerar animação HTML do quadro', error);
      return res.status(400).json({
        success: false,
        error: error.message || 'Erro ao gerar animação HTML',
      });
    }
  }
);

router.post(
  '/:preset/suggest-copy',
  authorizeRole(['admin', 'admin_sql', 'gerente_marketing', 'editoracao']),
  param('subscriberId').isInt({ min: 1 }),
  param('preset').isIn(PRESETS),
  body('segment').optional().isString(),
  body('segmentLabel').optional().isString(),
  body('visualLanguage').optional().isString(),
  body('boardTitle').optional().isString(),
  body('content').optional().isObject(),
  validate,
  async (req: Request & { user?: { id?: number; userId?: number } }, res) => {
    try {
      const { subscriberId, preset } = parsePublishBoardRoute(req);
      const data = await getPublishBriefAiService().suggestCopy({
        subscriberId,
        userId: Number(req.user?.id || req.user?.userId || 0),
        preset: preset as any,
        segment: req.body.segment,
        segmentLabel: req.body.segmentLabel,
        visualLanguage: req.body.visualLanguage,
        boardTitle: req.body.boardTitle,
        currentContent: req.body.content,
      });
      return res.json({ success: true, data });
    } catch (error: any) {
      await logError('Erro ao sugerir textos com IA', error);
      return res.status(400).json({
        success: false,
        error: error.message || 'Erro ao sugerir textos',
      });
    }
  }
);

router.post(
  '/:preset/auto-publish',
  authorizeRole(['admin', 'admin_sql', 'gerente_marketing', 'editoracao']),
  param('subscriberId').isInt({ min: 1 }),
  param('preset').isIn(PRESETS),
  body('contractId').isInt({ min: 1 }),
  body('totemIds').isArray({ min: 1 }),
  body('totemIds.*').isInt({ min: 1 }),
  body('title').optional().isString().trim().isLength({ min: 1, max: 160 }),
  body('description').optional({ nullable: true }).isString().trim().isLength({ max: 500 }),
  body('durationMs').optional().isInt({ min: 1000, max: 300000 }),
  body('publishNow').optional().isBoolean(),
  body('useAi').optional().isBoolean(),
  body('segment').optional().isString(),
  body('segmentLabel').optional().isString(),
  body('visualLanguage').optional().isString(),
  body('boardTitle').optional().isString().trim().isLength({ min: 1, max: 120 }),
  body('accentColor').optional().isString().isLength({ max: 32 }),
  body('preferredOrientation').optional().isIn(['portrait', 'landscape']),
  body('content').optional().isObject(),
  body('blockOrder').optional().isArray(),
  body('productOrder').optional().isArray(),
  body('showPrices').optional().isBoolean(),
  validate,
  async (req: Request & { user?: { id?: number; userId?: number; role?: string } }, res) => {
    try {
      const { subscriberId, preset } = parsePublishBoardRoute(req);
      const role = String(req.user?.role || '');
      const isAdmin = ['admin', 'admin_sql', 'owner_system'].includes(role);
      const userId = Number(req.user?.id || req.user?.userId || 0);

      const result = await getAutoPublishOrchestratorService().run({
        subscriberId,
        contractId: Number(req.body.contractId),
        totemIds: req.body.totemIds,
        preset: preset as any,
        userId,
        isAdmin,
        layout: {
          boardTitle: req.body.boardTitle,
          accentColor: req.body.accentColor,
          preferredOrientation: req.body.preferredOrientation,
          content: req.body.content,
          blockOrder: req.body.blockOrder,
          productOrder: Array.isArray(req.body.productOrder)
            ? req.body.productOrder.map(Number).filter((n: number) => n > 0)
            : undefined,
          showPrices: req.body.showPrices,
        },
        segment: req.body.segment,
        segmentLabel: req.body.segmentLabel,
        visualLanguage: req.body.visualLanguage,
        useAi: req.body.useAi === true,
        title: req.body.title,
        description: req.body.description,
        durationMs: req.body.durationMs,
        publishNow: req.body.publishNow,
      });

      return res.status(201).json({
        success: true,
        message: result.message,
        data: result,
      });
    } catch (error: any) {
      await logError('Erro no auto-publish orquestrado', error);
      const message = error?.message || 'Erro ao gerar e publicar propaganda';
      const status = message.includes('Acesso negado') ? 403 : 400;
      return res.status(status).json({ success: false, error: message, message });
    }
  }
);

router.post(
  '/:preset/queue-video-ai',
  authorizeRole(['admin', 'admin_sql', 'gerente_marketing', 'editoracao']),
  param('subscriberId').isInt({ min: 1 }),
  param('preset').isIn(PRESETS),
  body('briefSummary').optional().isString(),
  validate,
  async (req: Request & { user?: { id?: number; userId?: number } }, res) => {
    try {
      const { subscriberId, preset } = parsePublishBoardRoute(req);
      const data = await getPublishVideoAiQueueService().enqueue({
        subscriberId,
        preset: preset as any,
        briefSummary: req.body.briefSummary,
        userId: Number(req.user?.id || req.user?.userId || 0),
      });
      const status = data.premiumRequired ? 403 : 202;
      return res.status(status).json({
        success: !data.premiumRequired,
        message: data.message,
        data,
      });
    } catch (error: any) {
      await logError('Erro ao enfileirar vídeo IA', error);
      return res.status(400).json({
        success: false,
        error: error.message || 'Erro ao enfileirar vídeo IA',
      });
    }
  }
);

export default router;
