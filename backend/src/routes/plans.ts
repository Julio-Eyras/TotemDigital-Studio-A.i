/**
 * Plans Routes - Smart Signage v2.1
 * Rotas para gerenciamento de planos
 */

import { Router } from 'express';
import express from 'express';

import { PlanService } from '../services/planService';
import { authenticateToken, authorizeRole } from '../middleware/auth.middleware';
import { logError } from '../utils/loggerHelper';
import { normalizeError } from '../utils/errors';

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

    return res.json({
      success: true,
      data: plans
    });} catch (error: unknown) {
    const e = normalizeError(error);
    await logError('Erro ao listar planos', e.error);
    return res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: e.message
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

    return res.json({
      success: true,
      data: plans
    });} catch (error: unknown) {
    const e = normalizeError(error);
    await logError('Erro ao listar todos os planos', e.error);
    return res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: e.message
  });
  }
});

/**
 * @route GET /api/plans/:id/network-topology
 * @desc Rede permitida pelo plano (locais, totens, Smart TVs)
 * @access Private
 */
router.get('/:id/network-topology', authenticateToken, async (req, res) => {
  try {
    const planId = parseInt(req.params.id, 10);
    if (!Number.isFinite(planId) || planId <= 0) {
      return res.status(400).json({ success: false, message: 'ID do plano inválido' });
    }

    const topology = await getPlanService().getPlanNetworkTopology(planId);
    return res.json({
      success: true, data: topology });} catch (error: unknown) {
    const e = normalizeError(error);
    await logError('Erro ao buscar topologia do plano', e.error);
    const status = e.message === 'Plano não encontrado' ? 404 : 500;
    return res.status(status).json({
      success: false,
      message: e.message || 'Erro interno do servidor',
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

    return res.json({
      success: true,
      data: plan
    });} catch (error: unknown) {
    const e = normalizeError(error);
    await logError('Erro ao buscar plano', e.error);
    return res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: e.message
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

    return res.json({
      success: true,
      data: plan
    });} catch (error: unknown) {
    const e = normalizeError(error);
    await logError('Erro ao buscar plano por slug', e.error);
    return res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: e.message
  });
  }
});

/**
 * @route POST /api/plans
 * @desc Cria novo plano
 * @access Private (Apenas roles administrativos - baseado em contrato)
 */
router.post('/', authenticateToken, authorizeRole(['admin', 'admin_sql', 'owner_system', 'operador_faturamento', 'operador_comercial']), async (req: express.Request, res: express.Response): Promise<express.Response | void> => {
  try {
    const planData = req.body;

    const plan = await getPlanService().createPlan(planData);

    return res.status(201).json({
      success: true,
      message: 'Plano criado com sucesso',
      data: plan
    });} catch (error: unknown) {
    const e = normalizeError(error);
    await logError('Erro ao criar plano', e.error);
    return res.status(400).json({
      success: false,
      message: e.message || 'Erro ao criar plano',
      error: e.message
  });
  }
});

/**
 * @route PUT /api/plans/:id
 * @desc Atualiza plano
 * @access Private (Admin)
 */
router.put('/:id', authenticateToken, authorizeRole(['admin']), async (req: express.Request, res: express.Response): Promise<express.Response | void> => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const plan = await getPlanService().updatePlan(parseInt(id), updateData);

    return res.json({
      success: true,
      message: 'Plano atualizado com sucesso',
      data: plan
    });} catch (error: unknown) {
    const e = normalizeError(error);
    await logError('Erro ao atualizar plano', e.error);
    return res.status(400).json({
      success: false,
      message: e.message || 'Erro ao atualizar plano',
      error: e.message
  });
  }
});

/**
 * @route DELETE /api/plans/:id
 * @desc Remove plano
 * @access Private (Admin)
 */
router.delete('/:id', authenticateToken, authorizeRole(['admin']), async (req: express.Request, res: express.Response): Promise<express.Response | void> => {
  try {
    const { id } = req.params;

    await getPlanService().deletePlan(parseInt(id));

    return res.json({
      success: true,
      message: 'Plano removido com sucesso'
    });} catch (error: unknown) {
    const e = normalizeError(error);
    await logError('Erro ao remover plano', e.error);
    return res.status(400).json({
      success: false,
      message: e.message || 'Erro ao remover plano',
      error: e.message
  });
  }
});

export default router;

