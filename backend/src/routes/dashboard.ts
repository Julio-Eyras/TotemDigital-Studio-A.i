import express from 'express';
import { query } from 'express-validator';
import { validationResult } from 'express-validator';
import { authMiddleware } from '../middleware/auth.middleware';
import { getDashboardService } from '../services/dashboardService';

const router = express.Router();

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
 * @route GET /api/dashboard/stats
 * @desc Obter estatísticas do dashboard
 */
router.get('/stats', async (req: any, res: any) => {
  try {
    const stats = await getDashboardService().getDashboardStats();
    res.json(stats);
  } catch (error) {
    console.error('Erro ao obter estatísticas do dashboard:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

/**
 * @route GET /api/dashboard/activities
 * @desc Obter atividades recentes
 */
router.get('/activities',
  query('limit').optional().isInt({ min: 1, max: 50 }),
  validateRequest,
  async (req: any, res: any) => {
    try {
      const { limit = 10 } = req.query;
      const activities = await getDashboardService().getRecentActivity(parseInt(limit));
      res.json(activities);
    } catch (error) {
      console.error('Erro ao obter atividades recentes:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
);

/**
 * @route GET /api/dashboard/charts
 * @desc Obter dados para gráficos
 */
router.get('/charts', async (req: any, res: any) => {
  try {
    const charts = await getDashboardService().getUsageCharts();
    res.json(charts);
  } catch (error) {
    console.error('Erro ao obter dados dos gráficos:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

/**
 * @route GET /api/dashboard/client/:clientId/stats
 * @desc Obter estatísticas por cliente
 */
router.get('/client/:clientId/stats',
  async (req: any, res: any) => {
    try {
      const { clientId } = req.params;
      const stats = await getDashboardService().getStatsByClient(parseInt(clientId));
      res.json(stats);
    } catch (error) {
      console.error('Erro ao obter estatísticas do cliente:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
);

export default router;
