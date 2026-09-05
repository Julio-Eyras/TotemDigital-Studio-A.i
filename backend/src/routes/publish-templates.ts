import { Router } from 'express';
import express from 'express';

import { body, param, validationResult } from 'express-validator';
import { authenticateToken, authorizeRole } from '../middleware/auth.middleware';
import { getPublishTemplateService } from '../services/publishTemplateService';
import { logError } from '../utils/loggerHelper';
import { normalizeError } from '../utils/errors';

const router = Router();

const validate = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, error: 'Dados inválidos', details: errors.array() });
  }
  return next();
};

router.get('/featured', authenticateToken, async (_req, res) => {
  try {
    const data = await getPublishTemplateService().listFeatured();
    return res.json({
      success: true, data });} catch (error: unknown) {
    const e = normalizeError(error);
    await logError('Erro ao listar templates em destaque', e.error);
    return res.status(500).json({ success: false, error: 'Erro ao carregar templates' });
  }
});

router.get('/', authenticateToken, async (_req, res) => {
  try {
    const data = await getPublishTemplateService().listAll();
    return res.json({
      success: true, data });} catch (error: unknown) {
    const e = normalizeError(error);
    await logError('Erro ao listar templates de publicação', e.error);
    return res.status(500).json({ success: false, error: 'Erro ao carregar templates' });
  }
});

router.get(
  '/:templateId',
  authenticateToken,
  param('templateId').isInt({ min: 1 }),
  validate,
  async (req, res) => {
    try {
      const templateId = Number(req.params.templateId);
      const data = await getPublishTemplateService().getById(templateId);
      if (!data) return res.status(404).json({ success: false, error: 'Template não encontrado' });
      return res.json({
        success: true, data });} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('Erro ao carregar template de publicação', e.error);
      return res.status(500).json({ success: false, error: 'Erro ao carregar template' });
    }
  }
);

router.post(
  '/',
  authenticateToken,
  authorizeRole(['admin', 'admin_sql']),
  body('preset').isIn(['menu', 'promotion', 'ad', 'announcement', 'institutional']),
  body('title').isString().trim().isLength({ min: 1, max: 160 }),
  body('segment').optional({ nullable: true }).isString().trim().isLength({ max: 40 }),
  body('description').optional({ nullable: true }).isString().trim().isLength({ max: 500 }),
  body('headline').optional({ nullable: true }).isString().trim().isLength({ max: 120 }),
  body('featured').optional().isBoolean(),
  body('featuredSort').optional().isInt({ min: 0, max: 999 }),
  body('recommendedDurationMs').optional().isInt({ min: 1000, max: 300000 }),
  body('accentColor').optional({ nullable: true }).isString().isLength({ max: 32 }),
  body('backgroundCss').optional({ nullable: true }).isString().isLength({ max: 500 }),
  body('preferredOrientation').optional().isIn(['portrait', 'landscape']),
  body('iconKey').optional().isString().isLength({ max: 40 }),
  validate,
  async (req, res) => {
    try {
      const data = await getPublishTemplateService().createTemplate(req.body);
      return res.status(201).json({
        success: true, data });} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('Erro ao criar template de publicação', e.error);
      return res.status(500).json({ success: false, error: 'Erro ao criar template' });
    }
  }
);

router.post(
  '/:templateId/duplicate',
  authenticateToken,
  authorizeRole(['admin', 'admin_sql']),
  param('templateId').isInt({ min: 1 }),
  validate,
  async (req, res) => {
    try {
      const templateId = Number(req.params.templateId);
      const data = await getPublishTemplateService().duplicateTemplate(templateId);
      if (!data) return res.status(404).json({ success: false, error: 'Template não encontrado' });
      return res.status(201).json({
        success: true, data });} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('Erro ao duplicar template de publicação', e.error);
      return res.status(500).json({ success: false, error: 'Erro ao duplicar template' });
    }
  }
);

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
      return res.json({
        success: true, data });} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('Erro ao atualizar template de publicação', e.error);
      return res.status(500).json({ success: false, error: 'Erro ao atualizar template' });
    }
  }
);

export default router;
