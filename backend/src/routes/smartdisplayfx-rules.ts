/**
 * SmartDisplayFX Rules Routes
 * Rotas CRUD para gerenciamento de regras inteligentes FX
 * @access Private (Admin, Admin SQL, Gerente Marketing)
 */

import { Router, Response } from 'express';
import { body, query, param, validationResult } from 'express-validator';
import { authMiddleware, authorizeRole } from '../middleware/auth.middleware';
import { getFxRuleService } from '../services/fxRuleService';
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
 * @route GET /api/smartdisplayfx/rules
 * @desc Lista todas as regras com paginação e filtros
 * @access Private (Admin, Admin SQL, Gerente Marketing)
 */
router.get('/',
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('search').optional().isString(),
  query('site_id').optional().isString(),
  query('isActive').optional().isBoolean(),
  validateRequest,
  authorizeRole(['admin', 'admin_sql', 'gerente_marketing']),
  async (req: any, res: Response) => {
    try {
      const { page, limit, search, site_id, isActive } = req.query;
      
      const result = await getFxRuleService().getAllRules({
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
        search: search as string | undefined,
        site_id: site_id as string | undefined,
        isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
      });

      return res.json(result);
    } catch (error: any) {
      await logError('GET /api/smartdisplayfx/rules error', error, req.query);
      return res.status(500).json({
        error: 'Erro ao listar regras',
        message: error.message
      });
    }
  }
);

/**
 * @route GET /api/smartdisplayfx/rules/site/:siteId
 * @desc Lista regras ativas para um site
 * @access Private (Admin, Admin SQL, Gerente Marketing)
 */
router.get('/site/:siteId',
  param('siteId').isString().notEmpty(),
  validateRequest,
  authorizeRole(['admin', 'admin_sql', 'gerente_marketing']),
  async (req: any, res: Response) => {
    try {
      const rules = await getFxRuleService().getActiveRulesForSite(req.params.siteId);
      return res.json({ data: rules });
    } catch (error: any) {
      await logError('GET /api/smartdisplayfx/rules/site/:siteId error', error, { siteId: req.params.siteId });
      return res.status(500).json({
        error: 'Erro ao listar regras do site',
        message: error.message
      });
    }
  }
);

/**
 * @route GET /api/smartdisplayfx/rules/:id
 * @desc Busca uma regra por ID
 * @access Private (Admin, Admin SQL, Gerente Marketing)
 */
router.get('/:id',
  param('id').isInt({ min: 1 }),
  validateRequest,
  authorizeRole(['admin', 'admin_sql', 'gerente_marketing']),
  async (req: any, res: Response) => {
    try {
      const ruleId = parseInt(req.params.id);
      const rule = await getFxRuleService().getRuleById(ruleId);

      if (!rule) {
        return res.status(404).json({
          error: 'Regra não encontrada'
        });
      }

      return res.json({ data: rule });
    } catch (error: any) {
      await logError('GET /api/smartdisplayfx/rules/:id error', error, { id: req.params.id });
      return res.status(500).json({
        error: 'Erro ao buscar regra',
        message: error.message
      });
    }
  }
);

/**
 * @route POST /api/smartdisplayfx/rules
 * @desc Cria uma nova regra
 * @access Private (Admin, Admin SQL, Gerente Marketing)
 */
router.post('/',
  body('name').isString().notEmpty(),
  body('conditions').isObject().notEmpty(),
  body('actions').isObject().notEmpty(),
  body('description').optional().isString(),
  body('site_id').optional().isString(),
  body('priority').optional().isInt(),
  body('is_active').optional().isBoolean(),
  validateRequest,
  authorizeRole(['admin', 'admin_sql', 'gerente_marketing']),
  async (req: any, res: Response) => {
    try {
      const rule = await getFxRuleService().createRule(req.body);
      return res.status(201).json({ data: rule });
    } catch (error: any) {
      await logError('POST /api/smartdisplayfx/rules error', error, req.body);
      return res.status(500).json({
        error: 'Erro ao criar regra',
        message: error.message
      });
    }
  }
);

/**
 * @route PUT /api/smartdisplayfx/rules/:id
 * @desc Atualiza uma regra
 * @access Private (Admin, Admin SQL, Gerente Marketing)
 */
router.put('/:id',
  param('id').isInt({ min: 1 }),
  body('name').optional().isString().notEmpty(),
  body('conditions').optional().isObject(),
  body('actions').optional().isObject(),
  body('description').optional().isString(),
  body('site_id').optional().isString(),
  body('priority').optional().isInt(),
  body('is_active').optional().isBoolean(),
  validateRequest,
  authorizeRole(['admin', 'admin_sql', 'gerente_marketing']),
  async (req: any, res: Response) => {
    try {
      const ruleId = parseInt(req.params.id);
      const rule = await getFxRuleService().updateRule(ruleId, req.body);
      return res.json({ data: rule });
    } catch (error: any) {
      await logError('PUT /api/smartdisplayfx/rules/:id error', error, { id: req.params.id, body: req.body });
      if (error.message.includes('não encontrada')) {
        return res.status(404).json({
          error: error.message
        });
      }
      return res.status(500).json({
        error: 'Erro ao atualizar regra',
        message: error.message
      });
    }
  }
);

/**
 * @route DELETE /api/smartdisplayfx/rules/:id
 * @desc Deleta uma regra (soft delete)
 * @access Private (Admin, Admin SQL, Gerente Marketing)
 */
router.delete('/:id',
  param('id').isInt({ min: 1 }),
  validateRequest,
  authorizeRole(['admin', 'admin_sql', 'gerente_marketing']),
  async (req: any, res: Response) => {
    try {
      const ruleId = parseInt(req.params.id);
      await getFxRuleService().deleteRule(ruleId);
      return res.json({ message: 'Regra deletada com sucesso' });
    } catch (error: any) {
      await logError('DELETE /api/smartdisplayfx/rules/:id error', error, { id: req.params.id });
      if (error.message.includes('não encontrada')) {
        return res.status(404).json({
          error: error.message
        });
      }
      return res.status(500).json({
        error: 'Erro ao deletar regra',
        message: error.message
      });
    }
  }
);

export default router;

