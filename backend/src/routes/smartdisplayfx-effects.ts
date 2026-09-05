/**
 * SmartDisplayFX Effects Routes
 * Rotas CRUD para gerenciamento de efeitos FX
 * @access Private (Admin, Admin SQL, Gerente Marketing)
 */

import { Router} from 'express';
import express from 'express';

import { body, query, param, validationResult } from 'express-validator';
import { authMiddleware, authorizeRole } from '../middleware/auth.middleware';
import { getFxEffectService } from '../services/fxEffectService';
import { logError } from '../utils/loggerHelper';
import { normalizeError } from '../utils/errors';

const router = Router();

// Middleware de autenticação para todas as rotas
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
 * @route GET /api/smartdisplayfx/effects
 * @desc Lista todos os efeitos com paginação e filtros
 * @access Private (Admin, Admin SQL, Gerente Marketing)
 */
router.get('/',
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('search').optional().isString(),
  query('effect_type').optional().isString(),
  query('isActive').optional().isBoolean(),
  validateRequest,
  authorizeRole(['admin', 'admin_sql', 'gerente_marketing']),
  async (req: express.Request, res: express.Response) => {
    try {
      const { page, limit, search, effect_type, isActive } = req.query;
      
      const result = await getFxEffectService().getAllEffects({
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
        search: search as string | undefined,
        effect_type: effect_type as string | undefined,
        isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
      });

      return res.json(result);} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('GET /api/smartdisplayfx/effects error', error, req.query);
      return res.status(500).json({
        error: 'Erro ao listar efeitos',
        message: e.message
    });
    }
  }
);

/**
 * @route GET /api/smartdisplayfx/effects/types
 * @desc Lista todos os tipos de efeitos disponíveis
 * @access Private (Admin, Admin SQL, Gerente Marketing)
 */
router.get('/types',
  authorizeRole(['admin', 'admin_sql', 'gerente_marketing']),
  async (_req: express.Request, res: express.Response) => {
    try {
      const types = await getFxEffectService().getEffectTypes();
      return res.json({
        data: types });} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('GET /api/smartdisplayfx/effects/types error', e.error, {});
      return res.status(500).json({
        error: 'Erro ao listar tipos de efeitos',
        message: e.message
    });
    }
  }
);

/**
 * @route GET /api/smartdisplayfx/effects/:id
 * @desc Busca um efeito por ID
 * @access Private (Admin, Admin SQL, Gerente Marketing)
 */
router.get('/:id',
  param('id').isInt({ min: 1 }),
  validateRequest,
  authorizeRole(['admin', 'admin_sql', 'gerente_marketing']),
  async (req: express.Request, res: express.Response) => {
    try {
      const effectId = parseInt(req.params.id);
      const effect = await getFxEffectService().getEffectById(effectId);

      if (!effect) {
        return res.status(404).json({
          error: 'Efeito não encontrado'
        });
      }

      return res.json({
        data: effect });} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('GET /api/smartdisplayfx/effects/:id error', e.error, { id: req.params.id });
      return res.status(500).json({
        error: 'Erro ao buscar efeito',
        message: e.message
    });
    }
  }
);

/**
 * @route POST /api/smartdisplayfx/effects
 * @desc Cria um novo efeito
 * @access Private (Admin, Admin SQL)
 */
router.post('/',
  body('name').isString().notEmpty(),
  body('effect_type').isString().notEmpty(),
  body('description').optional({ nullable: true }).isString(),
  body('default_params').optional({ nullable: true }).isObject(),
  body('preview_url').optional({ nullable: true }).isString(),
  body('is_active').optional({ nullable: true }).isBoolean(),
  validateRequest,
  authorizeRole(['admin', 'admin_sql']),
  async (req: express.Request, res: express.Response) => {
    try {
      const effect = await getFxEffectService().createEffect(req.body);
      return res.status(201).json({
        data: effect });} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('POST /api/smartdisplayfx/effects error', error, req.body);
      return res.status(500).json({
        error: 'Erro ao criar efeito',
        message: e.message
    });
    }
  }
);

/**
 * @route PUT /api/smartdisplayfx/effects/:id
 * @desc Atualiza um efeito
 * @access Private (Admin, Admin SQL)
 */
router.put('/:id',
  param('id').isInt({ min: 1 }),
  body('name').optional({ nullable: true }).isString().notEmpty(),
  body('effect_type').optional({ nullable: true }).isString().notEmpty(),
  body('description').optional({ nullable: true }).isString(),
  body('default_params').optional({ nullable: true }).isObject(),
  body('preview_url').optional({ nullable: true }).isString(),
  body('is_active').optional({ nullable: true }).isBoolean(),
  validateRequest,
  authorizeRole(['admin', 'admin_sql']),
  async (req: express.Request, res: express.Response) => {
    try {
      const effectId = parseInt(req.params.id);
      const effect = await getFxEffectService().updateEffect(effectId, req.body);
      return res.json({
        data: effect });} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('PUT /api/smartdisplayfx/effects/:id error', e.error, { id: req.params.id, body: req.body });
      if (e.message.includes('não encontrado')) {
        return res.status(404).json({
          error: e.message
    });
      }
      return res.status(500).json({
        error: 'Erro ao atualizar efeito',
        message: e.message
      });
    }
  }
);

/**
 * @route DELETE /api/smartdisplayfx/effects/:id
 * @desc Deleta um efeito (soft delete)
 * @access Private (Admin, Admin SQL)
 */
router.delete('/:id',
  param('id').isInt({ min: 1 }),
  validateRequest,
  authorizeRole(['admin', 'admin_sql']),
  async (req: express.Request, res: express.Response) => {
    try {
      const effectId = parseInt(req.params.id);
      await getFxEffectService().deleteEffect(effectId);
      return res.json({
        message: 'Efeito deletado com sucesso' });} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('DELETE /api/smartdisplayfx/effects/:id error', e.error, { id: req.params.id });
      if (e.message.includes('não encontrado')) {
        return res.status(404).json({
          error: e.message
    });
      }
      return res.status(500).json({
        error: 'Erro ao deletar efeito',
        message: e.message
      });
    }
  }
);

export default router;

