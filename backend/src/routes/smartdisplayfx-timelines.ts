/**
 * SmartDisplayFX Timelines Routes
 * Rotas CRUD para gerenciamento de timelines FX
 * @access Private (Admin, Admin SQL, Gerente Marketing)
 */

import { Router, Response } from 'express';
import { body, query, param, validationResult } from 'express-validator';
import { authMiddleware, authorizeRole } from '../middleware/auth.middleware';
import { getFxTimelineService } from '../services/fxTimelineService';
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
 * @route GET /api/smartdisplayfx/timelines
 * @desc Lista todas as timelines com paginação e filtros
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
      
      const result = await getFxTimelineService().getAllTimelines({
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
        search: search as string | undefined,
        site_id: site_id as string | undefined,
        isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
      });

      res.json(result);
    } catch (error: any) {
      await logError('GET /api/smartdisplayfx/timelines error', error, req.query);
      res.status(500).json({
        error: 'Erro ao listar timelines',
        message: error.message
      });
    }
  }
);

/**
 * @route GET /api/smartdisplayfx/timelines/site/:siteId/active
 * @desc Busca timeline ativa mais recente para um site
 * @access Private (Admin, Admin SQL, Gerente Marketing)
 */
router.get('/site/:siteId/active',
  param('siteId').isString().notEmpty(),
  validateRequest,
  authorizeRole(['admin', 'admin_sql', 'gerente_marketing']),
  async (req: any, res: Response) => {
    try {
      const timeline = await getFxTimelineService().getActiveTimelineForSite(req.params.siteId);
      
      if (!timeline) {
        return res.status(404).json({
          error: 'Nenhuma timeline ativa encontrada para este site'
        });
      }

      res.json({ data: timeline });
    } catch (error: any) {
      await logError('GET /api/smartdisplayfx/timelines/site/:siteId/active error', error, { siteId: req.params.siteId });
      res.status(500).json({
        error: 'Erro ao buscar timeline ativa',
        message: error.message
      });
    }
  }
);

/**
 * @route GET /api/smartdisplayfx/timelines/:id
 * @desc Busca uma timeline por ID
 * @access Private (Admin, Admin SQL, Gerente Marketing)
 */
router.get('/:id',
  param('id').isInt({ min: 1 }),
  validateRequest,
  authorizeRole(['admin', 'admin_sql', 'gerente_marketing']),
  async (req: any, res: Response) => {
    try {
      const timelineId = parseInt(req.params.id);
      const timeline = await getFxTimelineService().getTimelineById(timelineId);

      if (!timeline) {
        return res.status(404).json({
          error: 'Timeline não encontrada'
        });
      }

      res.json({ data: timeline });
    } catch (error: any) {
      await logError('GET /api/smartdisplayfx/timelines/:id error', error, { id: req.params.id });
      res.status(500).json({
        error: 'Erro ao buscar timeline',
        message: error.message
      });
    }
  }
);

/**
 * @route POST /api/smartdisplayfx/timelines
 * @desc Cria uma nova timeline
 * @access Private (Admin, Admin SQL, Gerente Marketing)
 */
router.post('/',
  body('site_id').isString().notEmpty(),
  body('events').isArray().notEmpty(),
  body('name').optional().isString(),
  body('version').optional().isInt({ min: 1 }),
  body('generated_at').optional().isISO8601(),
  body('starts_at').optional().isISO8601(),
  body('ends_at').optional().isISO8601(),
  body('is_active').optional().isBoolean(),
  validateRequest,
  authorizeRole(['admin', 'admin_sql', 'gerente_marketing']),
  async (req: any, res: Response) => {
    try {
      const timeline = await getFxTimelineService().createTimeline(req.body);
      res.status(201).json({ data: timeline });
    } catch (error: any) {
      await logError('POST /api/smartdisplayfx/timelines error', error, req.body);
      res.status(500).json({
        error: 'Erro ao criar timeline',
        message: error.message
      });
    }
  }
);

/**
 * @route PUT /api/smartdisplayfx/timelines/:id
 * @desc Atualiza uma timeline
 * @access Private (Admin, Admin SQL, Gerente Marketing)
 */
router.put('/:id',
  param('id').isInt({ min: 1 }),
  body('site_id').optional().isString().notEmpty(),
  body('events').optional().isArray(),
  body('name').optional().isString(),
  body('version').optional().isInt({ min: 1 }),
  body('generated_at').optional().isISO8601(),
  body('starts_at').optional().isISO8601(),
  body('ends_at').optional().isISO8601(),
  body('is_active').optional().isBoolean(),
  validateRequest,
  authorizeRole(['admin', 'admin_sql', 'gerente_marketing']),
  async (req: any, res: Response) => {
    try {
      const timelineId = parseInt(req.params.id);
      const timeline = await getFxTimelineService().updateTimeline(timelineId, req.body);
      res.json({ data: timeline });
    } catch (error: any) {
      await logError('PUT /api/smartdisplayfx/timelines/:id error', error, { id: req.params.id, body: req.body });
      if (error.message.includes('não encontrada')) {
        return res.status(404).json({
          error: error.message
        });
      }
      res.status(500).json({
        error: 'Erro ao atualizar timeline',
        message: error.message
      });
    }
  }
);

/**
 * @route DELETE /api/smartdisplayfx/timelines/:id
 * @desc Deleta uma timeline (soft delete)
 * @access Private (Admin, Admin SQL, Gerente Marketing)
 */
router.delete('/:id',
  param('id').isInt({ min: 1 }),
  validateRequest,
  authorizeRole(['admin', 'admin_sql', 'gerente_marketing']),
  async (req: any, res: Response) => {
    try {
      const timelineId = parseInt(req.params.id);
      await getFxTimelineService().deleteTimeline(timelineId);
      res.json({ message: 'Timeline deletada com sucesso' });
    } catch (error: any) {
      await logError('DELETE /api/smartdisplayfx/timelines/:id error', error, { id: req.params.id });
      if (error.message.includes('não encontrada')) {
        return res.status(404).json({
          error: error.message
        });
      }
      res.status(500).json({
        error: 'Erro ao deletar timeline',
        message: error.message
      });
    }
  }
);

export default router;

