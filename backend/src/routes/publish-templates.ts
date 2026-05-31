import { Router } from 'express';
import { body, param, validationResult } from 'express-validator';
import { authenticateToken, authorizeRole } from '../middleware/auth.middleware';
import { getPublishTemplateService } from '../services/publishTemplateService';
import { logError } from '../utils/loggerHelper';

const router = Router();

const validate = (req: any, res: any, next: any) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, error: 'Dados inválidos', details: errors.array() });
  }
  return next();
};

router.get('/featured', authenticateToken, async (_req, res) => {
  try {
    const data = await getPublishTemplateService().listFeatured();
    return res.json({ success: true, data });
  } catch (error: any) {
    await logError('Erro ao listar templates em destaque', error);
    return res.status(500).json({ success: false, error: 'Erro ao carregar templates' });
  }
});

router.get('/', authenticateToken, async (_req, res) => {
  try {
    const data = await getPublishTemplateService().listAll();
    return res.json({ success: true, data });
  } catch (error: any) {
    await logError('Erro ao listar templates de publicação', error);
    return res.status(500).json({ success: false, error: 'Erro ao carregar templates' });
  }
});

router.patch(
  '/:templateId',
  authenticateToken,
  authorizeRole(['admin', 'admin_sql']),
  param('templateId').isInt({ min: 1 }),
  body('title').optional().isString().trim().isLength({ min: 1, max: 160 }),
  body('description').optional({ nullable: true }).isString().trim().isLength({ max: 500 }),
  body('headline').optional({ nullable: true }).isString().trim().isLength({ max: 120 }),
  body('featured').optional().isBoolean(),
  body('featuredSort').optional().isInt({ min: 0, max: 999 }),
  body('recommendedDurationMs').optional().isInt({ min: 1000, max: 300000 }),
  body('accentColor').optional({ nullable: true }).isString().isLength({ max: 32 }),
  body('backgroundCss').optional({ nullable: true }).isString().isLength({ max: 500 }),
  body('preferredOrientation').optional().isIn(['portrait', 'landscape']),
  body('iconKey').optional().isString().isLength({ max: 40 }),
  body('isActive').optional().isBoolean(),
  validate,
  async (req, res) => {
    try {
      const templateId = Number(req.params.templateId);
      const data = await getPublishTemplateService().updateTemplate(templateId, req.body);
      if (!data) return res.status(404).json({ success: false, error: 'Template não encontrado' });
      return res.json({ success: true, data });
    } catch (error: any) {
      await logError('Erro ao atualizar template de publicação', error);
      return res.status(500).json({ success: false, error: 'Erro ao atualizar template' });
    }
  }
);

export default router;
