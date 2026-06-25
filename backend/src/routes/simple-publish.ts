import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import { authenticateToken, authorizeRole } from '../middleware/auth.middleware';
import { blockClientDataAccess } from '../middleware/operatorProtection.middleware';
import { getSimplePublishService } from '../services/simplePublishService';
import { logError } from '../utils/loggerHelper';
import { publishGuardErrorPayload, resolvePublishGuardHttpStatus } from '../utils/publishGuardHttp';

const router = Router();

router.use(authenticateToken);
router.use(blockClientDataAccess);

const SIMPLE_PUBLISH_ROLES = [
  'admin',
  'admin_sql',
  'owner_system',
  'gerente_marketing',
  'editoracao',
  'subscriber_user',
  'publisher_user',
] as const;

const validateRequest = (req: any, res: any, next: any) => {
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

function sanitizeIdList(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [];
  return [...new Set(
    raw.map((item) => Number(item)).filter((n) => Number.isInteger(n) && n > 0)
  )];
}

/**
 * @route POST /api/simple-publish
 * @desc Modo simples: publica fila de mídias em totem(ns) sem agendamento.
 */
router.post(
  '/',
  authorizeRole([...SIMPLE_PUBLISH_ROLES]),
  (req: any, res: any, next: any) => {
    if (Array.isArray(req.body?.totemIds)) {
      req.body.totemIds = sanitizeIdList(req.body.totemIds);
    }
    if (Array.isArray(req.body?.mediaIds)) {
      req.body.mediaIds = sanitizeIdList(req.body.mediaIds);
    }
    const role = String(req.user?.role || '').toLowerCase();
    if (role === 'subscriber_user') {
      const bodySub = Number(req.body?.subscriberId);
      const userSub = Number(req.user?.subscriberId);
      if (!Number.isFinite(userSub) || userSub <= 0 || bodySub !== userSub) {
        return res.status(403).json({
          success: false,
          error: 'subscriber_user só pode publicar para o próprio anunciante',
        });
      }
    }
    return next();
  },
  body('subscriberId').isInt({ min: 1 }).withMessage('subscriberId inválido'),
  body('contractId').isInt({ min: 1 }).withMessage('contractId inválido'),
  body('totemIds').isArray({ min: 1 }).withMessage('Selecione ao menos um totem'),
  body('totemIds.*').isInt({ min: 1 }).withMessage('totemId inválido'),
  body('mediaIds').isArray({ min: 1 }).withMessage('Selecione ao menos uma mídia'),
  body('mediaIds.*').isInt({ min: 1 }).withMessage('mediaId inválido'),
  body('title').optional().isString().trim().isLength({ min: 1, max: 160 }),
  body('description').optional({ nullable: true }).isString().trim().isLength({ max: 500 }),
  validateRequest,
  async (req: any, res: any) => {
    try {
      const result = await getSimplePublishService().publish(
        {
          subscriberId: Number(req.body.subscriberId),
          contractId: Number(req.body.contractId),
          totemIds: req.body.totemIds,
          mediaIds: req.body.mediaIds,
          title: req.body.title,
          description: req.body.description,
        },
        req.user?.id || req.user?.userId || 0,
        { userRole: req.user?.role }
      );

      return res.status(201).json({
        success: true,
        data: result,
        message: result.message,
      });
    } catch (error: any) {
      await logError('Erro na rota simple-publish', error);
      const payload = publishGuardErrorPayload(error);
      return res.status(resolvePublishGuardHttpStatus(error)).json({
        success: false,
        ...payload,
      });
    }
  }
);

export default router;
