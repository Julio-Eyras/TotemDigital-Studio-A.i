/**
 * Plans Routes - Smart Signage v2.1
 * Rotas para gerenciamento de planos
 */

import { Router } from 'express';
import { PlanService } from '../services/planService';
import { authenticateToken, authorizeRole } from '../middleware/auth.middleware';
import { logError } from '../utils/loggerHelper';

const router = Router();

// Lazy initialization
function getPlanService(): PlanService {
  if (!(global as any).planServiceInstance) {
    (global as any).planServiceInstance = new PlanService();
  }
  return (global as any).planServiceInstance;
}

/**
 * @route GET /api/plans
 * @desc Lista todos os planos ativos
 * @access Public (para seleção de planos)
 */
router.get('/', async (_req, res) => {
  try {
    const plans = await getPlanService().getPlans(false); // Apenas ativos

    res.json({
      success: true,
      data: plans
    });

  } catch (error: any) {
    await logError('Erro ao listar planos', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
});

/**
 * @route GET /api/plans/all
 * @desc Lista todos os planos (incluindo inativos)
 * @access Private (Admin, Manager)
 */
router.get('/all', authenticateToken, authorizeRole(['admin', 'admin_sql']), async (req, res) => {
  try {
    const { includeInactive } = req.query;
    const plans = await getPlanService().getPlans(includeInactive === 'true');

    res.json({
      success: true,
      data: plans
    });

  } catch (error: any) {
    await logError('Erro ao listar todos os planos', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
});

/**
 * @route GET /api/plans/:id
 * @desc Busca plano por ID
 * @access Public
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const plan = await getPlanService().getPlanById(parseInt(id));

    if (!plan) {
      return res.status(404).json({
        success: false,
        message: 'Plano não encontrado'
      });
    }

    res.json({
      success: true,
      data: plan
    });

  } catch (error: any) {
    await logError('Erro ao buscar plano', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
});

/**
 * @route GET /api/plans/slug/:slug
 * @desc Busca plano por slug
 * @access Public
 */
router.get('/slug/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    const plan = await getPlanService().getPlanBySlug(slug);

    if (!plan) {
      return res.status(404).json({
        success: false,
        message: 'Plano não encontrado'
      });
    }

    res.json({
      success: true,
      data: plan
    });

  } catch (error: any) {
    await logError('Erro ao buscar plano por slug', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
});

/**
 * @route POST /api/plans
 * @desc Cria novo plano
 * @access Private (Admin)
 */
router.post('/', authenticateToken, authorizeRole(['admin']), async (req: any, res) => {
  try {
    const planData = req.body;

    const plan = await getPlanService().createPlan(planData);

    res.status(201).json({
      success: true,
      message: 'Plano criado com sucesso',
      data: plan
    });

  } catch (error: any) {
    await logError('Erro ao criar plano', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Erro ao criar plano',
      error: error.message
    });
  }
});

/**
 * @route PUT /api/plans/:id
 * @desc Atualiza plano
 * @access Private (Admin)
 */
router.put('/:id', authenticateToken, authorizeRole(['admin']), async (req: any, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const plan = await getPlanService().updatePlan(parseInt(id), updateData);

    res.json({
      success: true,
      message: 'Plano atualizado com sucesso',
      data: plan
    });

  } catch (error: any) {
    await logError('Erro ao atualizar plano', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Erro ao atualizar plano',
      error: error.message
    });
  }
});

/**
 * @route DELETE /api/plans/:id
 * @desc Remove plano
 * @access Private (Admin)
 */
router.delete('/:id', authenticateToken, authorizeRole(['admin']), async (req: any, res) => {
  try {
    const { id } = req.params;

    await getPlanService().deletePlan(parseInt(id));

    res.json({
      success: true,
      message: 'Plano removido com sucesso'
    });

  } catch (error: any) {
    await logError('Erro ao remover plano', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Erro ao remover plano',
      error: error.message
    });
  }
});

export default router;

