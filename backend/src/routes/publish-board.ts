import { Router } from 'express';
import { body, param, validationResult } from 'express-validator';
import { authenticateToken, authorizeRole } from '../middleware/auth.middleware';
import { blockClientDataAccess } from '../middleware/operatorProtection.middleware';
import { getPublishBoardService } from '../services/publishBoardService';
import { logError } from '../utils/loggerHelper';

const PRESETS = ['menu', 'promotion', 'ad', 'announcement', 'institutional'];

const router = Router({ mergeParams: true });

router.use(authenticateToken);
router.use(blockClientDataAccess);

const validate = (req: any, res: any, next: any) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, error: 'Dados inválidos', details: errors.array() });
  }
  return next();
};

router.get(
  '/:preset/layout',
  param('subscriberId').isInt({ min: 1 }),
  param('preset').isIn(PRESETS),
  validate,
  async (req, res) => {
    try {
      const subscriberId = Number(req.params.subscriberId);
      const preset = String(req.params.preset);
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
      const subscriberId = Number(req.params.subscriberId);
      const preset = String(req.params.preset);
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
  async (req: any, res) => {
    try {
      const subscriberId = Number(req.params.subscriberId);
      const preset = String(req.params.preset);
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

export default router;
