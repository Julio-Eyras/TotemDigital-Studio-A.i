import { Router } from 'express';
import express from 'express';

import { body, validationResult } from 'express-validator';
import { authenticateToken, authorizeRole } from '../middleware/auth.middleware';
import { blockClientDataAccess } from '../middleware/operatorProtection.middleware';
import { getQuickPublishService } from '../services/quickPublishService';
import { logError } from '../utils/loggerHelper';
import { publishGuardErrorPayload, resolvePublishGuardHttpStatus } from '../utils/publishGuardHttp';
import { normalizeError } from '../utils/errors';

const router = Router();

router.use(authenticateToken);
router.use(blockClientDataAccess);

const validateRequest = (req: express.Request, res: express.Response, next: express.NextFunction): express.Response | void => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: 'Dados inválidos',
      details: errors.array(),
    });
  }
  return next();
};

/**
 * @route POST /api/quick-publish
 * @desc Publicação rápida V3x: cria playlist/campanha/vínculos a partir de mídias existentes.
 */
function sanitizeIdList(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [];
  return [...new Set(
    raw.map((item) => Number(item)).filter((n) => Number.isInteger(n) && n > 0)
  )];
}

router.post(
  '/',
  authorizeRole(['admin', 'admin_sql', 'owner_system', 'gerente_marketing', 'editoracao']),
  (req: express.Request, _res: any, next: express.NextFunction) => {
    if (Array.isArray(req.body?.totemIds)) {
      req.body.totemIds = sanitizeIdList(req.body.totemIds);
    }
    if (Array.isArray(req.body?.mediaIds)) {
      req.body.mediaIds = sanitizeIdList(req.body.mediaIds);
    }
    return next();
  },
  body('subscriberId').isInt({ min: 1 }).withMessage('subscriberId inválido'),
  body('contractId').optional({ nullable: true }).isInt({ min: 1 }).withMessage('contractId inválido'),
  body('totemIds').isArray({ min: 1 }).withMessage('Selecione ao menos um totem'),
  body('totemIds.*').isInt({ min: 1 }).withMessage('totemId inválido'),
  body('mediaIds').isArray({ min: 1 }).withMessage('Selecione ao menos uma mídia'),
  body('mediaIds.*').isInt({ min: 1 }).withMessage('mediaId inválido'),
  body('preset').optional().isIn(['menu', 'promotion', 'ad', 'announcement', 'institutional']),
  body('title').optional().isString().trim().isLength({ min: 1, max: 160 }),
  body('description').optional({ nullable: true }).isString().trim().isLength({ max: 500 }),
  body('publishNow').optional().isBoolean(),
  body('durationMs').optional().isInt({ min: 1000, max: 300000 }),
  validateRequest,
  async (req: express.Request, res: express.Response): Promise<express.Response | void> => {
    try {
      const rawContract = req.body.contractId;
      const contractId =
        rawContract === undefined || rawContract === null || rawContract === ''
          ? null
          : Number(rawContract);
      const result = await getQuickPublishService().publish(
        {
          subscriberId: Number(req.body.subscriberId),
          contractId,
          totemIds: req.body.totemIds,
          mediaIds: req.body.mediaIds,
          preset: req.body.preset,
          title: req.body.title,
          description: req.body.description,
          publishNow: req.body.publishNow,
          durationMs: req.body.durationMs,
        },
        req.user?.id || req.user?.userId || 0,
        { userRole: req.user?.role }
      );

      return res.status(201).json({
        success: true,
        data: result,
        message: result.message,
      });} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('Erro na rota de publicação rápida', e.error);
      const payload = publishGuardErrorPayload(error);
      return res.status(resolvePublishGuardHttpStatus(error)).json({
        success: false,
        ...payload,
    });
    }
  }
);

export default router;
