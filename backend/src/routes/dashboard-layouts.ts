/**
 * Dashboard Layouts Routes - Smart Signage Pro v3.1
 * Rotas para gerenciar layouts customizáveis de dashboard
 */

import { Router, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { authMiddleware } from '../middleware/auth.middleware';
import { getDashboardLayoutService } from '../services/dashboardLayoutService';
import { logError } from '../utils/loggerHelper';

const router = Router();

// Middleware de autenticação
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
 * @route GET /api/dashboard-layouts
 * @desc Listar layouts do usuário
 * @access Private
 */
router.get('/',
  query('includeShared').optional().isBoolean(),
  validateRequest,
  async (req: any, res: Response) => {
    try {
      const includeShared = req.query.includeShared === 'true';
      const layouts = await getDashboardLayoutService().getUserLayouts(
        req.user.id,
        includeShared
      );
      res.json({
        success: true,
        data: layouts
      });
    } catch (error: any) {
      await logError('Erro ao listar layouts', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Erro ao listar layouts'
      });
    }
  }
);

/**
 * @route GET /api/dashboard-layouts/default
 * @desc Obter layout padrão do usuário
 * @access Private
 */
router.get('/default',
  async (req: any, res: Response) => {
    try {
      const layout = await getDashboardLayoutService().getDefaultLayout(req.user.id);
      if (!layout) {
        return res.status(404).json({
          success: false,
          message: 'Nenhum layout padrão encontrado'
        });
      }
      return res.json({
        success: true,
        data: layout
      });
    } catch (error: any) {
      await logError('Erro ao buscar layout padrão', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Erro ao buscar layout padrão'
      });
    }
  }
);

/**
 * @route GET /api/dashboard-layouts/:id
 * @desc Obter layout por ID
 * @access Private
 */
router.get('/:id',
  param('id').isInt({ min: 1 }),
  validateRequest,
  async (req: any, res: Response) => {
    try {
      const layout = await getDashboardLayoutService().getLayoutById(parseInt(req.params.id));
      if (!layout) {
        return res.status(404).json({
          success: false,
          message: 'Layout não encontrado'
        });
      }
      // Verificar se usuário tem acesso (seu layout ou compartilhado)
      if (layout.userId !== req.user.id && !layout.isShared) {
        return res.status(403).json({
          success: false,
          message: 'Acesso negado'
        });
      }
      return res.json({
        success: true,
        data: layout
      });
    } catch (error: any) {
      await logError('Erro ao buscar layout', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Erro ao buscar layout'
      });
    }
  }
);

/**
 * @route POST /api/dashboard-layouts
 * @desc Criar layout
 * @access Private
 */
router.post('/',
  body('name').notEmpty().isString(),
  body('layoutData').isObject(),
  body('isDefault').optional({ nullable: true }).isBoolean(),
  body('isShared').optional({ nullable: true }).isBoolean(),
  validateRequest,
  async (req: any, res: Response) => {
    try {
      const layout = await getDashboardLayoutService().createLayout({
        userId: req.user.id,
        name: req.body.name,
        layoutData: req.body.layoutData,
        isDefault: req.body.isDefault,
        isShared: req.body.isShared
      });
      return res.status(201).json({
        success: true,
        data: layout
      });
    } catch (error: any) {
      await logError('Erro ao criar layout', error);
      return res.status(400).json({
        success: false,
        message: error.message || 'Erro ao criar layout'
      });
    }
  }
);

/**
 * @route PUT /api/dashboard-layouts/:id
 * @desc Atualizar layout
 * @access Private
 */
router.put('/:id',
  param('id').isInt({ min: 1 }),
  body('name').optional({ nullable: true }).isString(),
  body('layoutData').optional({ nullable: true }).isObject(),
  body('isDefault').optional({ nullable: true }).isBoolean(),
  body('isShared').optional({ nullable: true }).isBoolean(),
  validateRequest,
  async (req: any, res: Response) => {
    try {
      const layout = await getDashboardLayoutService().getLayoutById(parseInt(req.params.id));
      if (!layout) {
        return res.status(404).json({
          success: false,
          message: 'Layout não encontrado'
        });
      }
      // Verificar se usuário tem acesso
      if (layout.userId !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: 'Acesso negado'
        });
      }
      const updated = await getDashboardLayoutService().updateLayout(
        parseInt(req.params.id),
        req.body
      );
      return res.json({
        success: true,
        data: updated
      });
    } catch (error: any) {
      await logError('Erro ao atualizar layout', error);
      return res.status(400).json({
        success: false,
        message: error.message || 'Erro ao atualizar layout'
      });
    }
  }
);

/**
 * @route DELETE /api/dashboard-layouts/:id
 * @desc Deletar layout
 * @access Private
 */
router.delete('/:id',
  param('id').isInt({ min: 1 }),
  validateRequest,
  async (req: any, res: Response) => {
    try {
      const layout = await getDashboardLayoutService().getLayoutById(parseInt(req.params.id));
      if (!layout) {
        return res.status(404).json({
          success: false,
          message: 'Layout não encontrado'
        });
      }
      // Verificar se usuário tem acesso
      if (layout.userId !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: 'Acesso negado'
        });
      }
      await getDashboardLayoutService().deleteLayout(parseInt(req.params.id));
      return res.json({
        success: true,
        message: 'Layout deletado com sucesso'
      });
    } catch (error: any) {
      await logError('Erro ao deletar layout', error);
      return res.status(400).json({
        success: false,
        message: error.message || 'Erro ao deletar layout'
      });
    }
  }
);

export default router;

