import express from 'express';
import { query } from 'express-validator';
import { validationResult } from 'express-validator';
import { authMiddleware } from '../middleware/auth.middleware';
import { getDashboardService } from '../services/dashboardService';
import { logError } from '../utils/loggerHelper';
import { errorResponse } from '../utils/apiResponse';
import { assertTenantClientParamAccess, resolvePublisherIdFromRequest } from '../utils/tenantClientAccess';
import { isAdminRole, resolveTenantScope } from '../utils/tenantScope';
import { DISABLE_DIRECT_CAMPAIGN_TOTEM, TOTEMDIGITAL_COMPACT } from '../config/featureFlags';
import { DIRECT_CAMPAIGN_TOTEM_DISABLED_HINT } from '../constants/campaignDeliveryPolicy';

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
 * Garante que o usuário só consulte estatísticas do próprio assinante/cliente
 * ou, no caso de publisher, do próprio publisher ou de um subscriber com plano que inclui esse publisher.
 */
async function assertDashboardClientStatsAccess(req: any, requestedId: number): Promise<void> {
  await assertTenantClientParamAccess(req, requestedId, { allowPublisherViewOwnPublisherId: true });
}

/**
 * Quando o publisher consulta o próprio `publisher_id` na URL, as contagens seguem o escopo publisher;
 * caso contrário o id é tratado como `subscriber_id`.
 */
async function resolveClientStatsView(req: any, requestedId: number): Promise<'subscriber' | 'publisher'> {
  if (isAdminRole(req.user?.role)) {
    return 'subscriber';
  }

  const publisherId = await resolvePublisherIdFromRequest(req);

  if (publisherId != null && Number(requestedId) === Number(publisherId)) {
    return 'publisher';
  }
  return 'subscriber';
}

/**
 * @route GET /api/dashboard/stats
 * @desc Obter estatísticas do dashboard
 */
router.get('/stats', async (req: any, res: any) => {
  try {
    const scope = await resolveTenantScope(req);
    const stats = await getDashboardService().getDashboardStats(scope || undefined);
    res.json(stats);
  } catch (error) {
    await logError('Erro ao obter estatísticas do dashboard', error);
    res.status(500).json(errorResponse('Erro interno do servidor'));
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
      const scope = await resolveTenantScope(req);
      const activities = await getDashboardService().getRecentActivity(parseInt(limit, 10), scope || undefined);
      res.json(activities);
    } catch (error) {
      await logError('Erro ao obter atividades recentes do dashboard', error);
      res.status(500).json(errorResponse('Erro interno do servidor'));
    }
  }
);

/**
 * @route GET /api/dashboard/charts
 * @desc Obter dados para gráficos
 */
router.get('/charts', async (req: any, res: any) => {
  try {
    const scope = await resolveTenantScope(req);
    const charts = await getDashboardService().getUsageCharts(scope || undefined);
    res.json(charts);
  } catch (error) {
    await logError('Erro ao obter dados dos gráficos do dashboard', error);
    res.status(500).json(errorResponse('Erro interno do servidor'));
  }
});

/**
 * @route GET /api/dashboard/ui-context
 * @desc Sinalizadores de produto alinhados ao servidor (campanhas, modo compacto). Usado pela UI de campanhas.
 */
router.get('/ui-context', (_req: any, res: any) => {
  res.json({
    disableDirectCampaignTotem: DISABLE_DIRECT_CAMPAIGN_TOTEM,
    totemDigitalCompact: TOTEMDIGITAL_COMPACT,
    directCampaignTotemHint: DIRECT_CAMPAIGN_TOTEM_DISABLED_HINT,
  });
});

/**
 * @route GET /api/dashboard/client/:clientId/stats
 * @desc Obter estatísticas por cliente
 */
router.get('/client/:clientId/stats',
  async (req: any, res: any) => {
    try {
      const id = parseInt(req.params.clientId, 10);
      if (Number.isNaN(id) || id < 1) {
        return res.status(400).json(errorResponse('ID de cliente inválido'));
      }

      await assertDashboardClientStatsAccess(req, id);

      const view = await resolveClientStatsView(req, id);
      const stats = await getDashboardService().getStatsByClient(id, view);
      res.json(stats);
    } catch (error: any) {
      if (error?.statusCode === 403) {
        return res.status(403).json(errorResponse(error.message || 'Acesso negado'));
      }
      await logError('Erro ao obter estatísticas do cliente no dashboard', error);
      res.status(500).json(errorResponse('Erro interno do servidor'));
    }
  }
);

export default router;
