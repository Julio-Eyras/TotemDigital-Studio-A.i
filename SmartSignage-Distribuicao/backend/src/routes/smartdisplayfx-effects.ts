/**
 * SmartDisplayFX Effects Routes
 * Rotas CRUD para gerenciamento de efeitos FX
 * @access Private (Admin, Admin SQL, Gerente Marketing)
 */

import { Router, Response } from 'express';
import { body, query, param, validationResult } from 'express-validator';
import { authMiddleware, authorizeRole } from '../middleware/auth.middleware';
import { getFxEffectService } from '../services/fxEffectService';
import { logError } from '../utils/loggerHelper';

const router = Router();

// Middleware de autenticação para todas as rotas
router.use(authMiddleware);

const validateRequest = (req: any, res: any, next: any) => {
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
  async (req: any, res: Response) => {
    try {
      const { page, limit, search, effect_type, isActive } = req.query;
      
      const result = await getFxEffectService().getAllEffects({
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
        search: search as string | undefined,
        effect_type: effect_type as string | undefined,
        isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
      });

      res.json(result);
    } catch (error: any) {
      await logError('GET /api/smartdisplayfx/effects error', error, req.query);
      res.status(500).json({
        error: 'Erro ao listar efeitos',
        message: error.message
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
  async (_req: any, res: Response) => {
    try {
      const types = await getFxEffectService().getEffectTypes();
      res.json({ data: types });
    } catch (error: any) {
      await logError('GET /api/smartdisplayfx/effects/types error', error, {});
      res.status(500).json({
        error: 'Erro ao listar tipos de efeitos',
        message: error.message
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
  async (req: any, res: Response) => {
    try {
      const effectId = parseInt(req.params.id);
      const effect = await getFxEffectService().getEffectById(effectId);

      if (!effect) {
        return res.status(404).json({
          error: 'Efeito não encontrado'
        });
      }

      res.json({ data: effect });
    } catch (error: any) {
      await logError('GET /api/smartdisplayfx/effects/:id error', error, { id: req.params.id });
      res.status(500).json({
        error: 'Erro ao buscar efeito',
        message: error.message
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
  body('description').optional().isString(),
  body('default_params').optional().isObject(),
  body('preview_url').optional().isString(),
  body('is_active').optional().isBoolean(),
  validateRequest,
  authorizeRole(['admin', 'admin_sql']),
  async (req: any, res: Response) => {
    try {
      const effect = await getFxEffectService().createEffect(req.body);
      res.status(201).json({ data: effect });
    } catch (error: any) {
      await logError('POST /api/smartdisplayfx/effects error', error, req.body);
      res.status(500).json({
        error: 'Erro ao criar efeito',
        message: error.message
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
  body('name').optional().isString().notEmpty(),
  body('effect_type').optional().isString().notEmpty(),
  body('description').optional().isString(),
  body('default_params').optional().isObject(),
  body('preview_url').optional().isString(),
  body('is_active').optional().isBoolean(),
  validateRequest,
  authorizeRole(['admin', 'admin_sql']),
  async (req: any, res: Response) => {
    try {
      const effectId = parseInt(req.params.id);
      const effect = await getFxEffectService().updateEffect(effectId, req.body);
      res.json({ data: effect });
    } catch (error: any) {
      await logError('PUT /api/smartdisplayfx/effects/:id error', error, { id: req.params.id, body: req.body });
      if (error.message.includes('não encontrado')) {
        return res.status(404).json({
          error: error.message
        });
      }
      res.status(500).json({
        error: 'Erro ao atualizar efeito',
        message: error.message
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
  async (req: any, res: Response) => {
    try {
      const effectId = parseInt(req.params.id);
      await getFxEffectService().deleteEffect(effectId);
      res.json({ message: 'Efeito deletado com sucesso' });
    } catch (error: any) {
      await logError('DELETE /api/smartdisplayfx/effects/:id error', error, { id: req.params.id });
      if (error.message.includes('não encontrado')) {
        return res.status(404).json({
          error: error.message
        });
      }
      res.status(500).json({
        error: 'Erro ao deletar efeito',
        message: error.message
      });
    }
  }
);

export default router;

