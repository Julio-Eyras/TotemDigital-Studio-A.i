/**
 * Analytics Routes - Smart Signage v2.0
 * Rotas para análise e relatórios
 */

import { Router } from 'express';
import { AnalyticsService } from '../services/analyticsService';
import { TotemService } from '../services/totemService';
import { getCampaignService } from '../services/campaignService';
import { authenticateToken, authorizeRole } from '../middleware/auth.middleware';
import { blockClientDataAccess } from '../middleware/operatorProtection.middleware';
import { logError } from '../utils/loggerHelper';
import { isMissingTableError } from '../utils/dbErrors';
import { isStudioRuntime } from '../config/installationRuntime';
import { resolveCompactOwnerPublisherId } from '../utils/compactOwnerPublisher';
import { getDatabase } from '../config/database';
import { isAdminRole, resolveTenantScope } from '../utils/tenantScope';

const router = Router();

// Lazy initialization - só criar quando necessário
function getAnalyticsService(): AnalyticsService {
  if (!(global as any).analyticsServiceInstance) {
    (global as any).analyticsServiceInstance = new AnalyticsService();
  }
  return (global as any).analyticsServiceInstance;
}

function getTotemService(): TotemService {
  if (!(global as any).totemServiceInstance) {
    (global as any).totemServiceInstance = new TotemService();
  }
  return (global as any).totemServiceInstance;
}

function analyticsHttpError(statusCode: number, message: string): Error {
  const e: any = new Error(message);
  e.statusCode = statusCode;
  return e;
}

async function assertCampaignPublisherScope(campaignId: number, requestPublisherId?: number): Promise<void> {
  const campaign = await getCampaignService().getCampaignById(campaignId);
  if (!campaign) {
    throw analyticsHttpError(404, 'Campanha não encontrada');
  }
  const pubIds = (campaign.publisherIds || []).map(Number);
  if (isStudioRuntime()) {
    const ownerId = await resolveCompactOwnerPublisherId(getDatabase());
    if (!ownerId) {
      throw analyticsHttpError(403, 'Modo compacto: publisher do owner não encontrado para aplicar escopo.');
    }
    if (!pubIds.includes(Number(ownerId))) {
      throw analyticsHttpError(403, 'Acesso negado: campanha não está disponível para o publisher desta instalação.');
    }
    return;
  }
  if (!requestPublisherId || !pubIds.includes(Number(requestPublisherId))) {
    throw analyticsHttpError(403, 'Acesso negado: campanha não vinculada ao seu publisher.');
  }
}

/**
 * Garante que filtros totemId/campaignId na query não exponham dados de outro tenant.
 */
async function assertAnalyticsFiltersAllowed(
  req: any,
  opts: { totemId?: number; campaignId?: number }
): Promise<void> {
  const totemId = opts.totemId;
  const campaignId = opts.campaignId;
  if (totemId == null && campaignId == null) return;

  const role = req.user?.role || '';
  const isAdmin = isAdminRole(role);
  if (isAdmin) return;

  if (role === 'client') {
    if (campaignId != null) {
      const campaign = await getCampaignService().getCampaignById(campaignId);
      if (!campaign) throw analyticsHttpError(404, 'Campanha não encontrada');
      if (req.user?.clientId != null && Number(campaign.subscriberId) !== Number(req.user.clientId)) {
        throw analyticsHttpError(403, 'Acesso negado: Você só pode ver análises de suas próprias campanhas');
      }
    }
    if (totemId != null) {
      const totem = await getTotemService().getTotemById(totemId);
      if (!totem) throw analyticsHttpError(404, 'Totem não encontrado');
    }
    return;
  }

  const subscriberId = req.subscriberId ?? req.user?.subscriberId;
  const isSubscriberRole =
    role === 'subscriber' || role === 'subscriber_user' || req.user?.userType === 'subscriber_user';

  if (isSubscriberRole) {
    if (!subscriberId) {
      throw analyticsHttpError(403, 'Acesso negado: assinante não identificado.');
    }
    if (campaignId != null) {
      const campaign = await getCampaignService().getCampaignById(campaignId);
      if (!campaign) throw analyticsHttpError(404, 'Campanha não encontrada');
      if (Number(campaign.subscriberId) !== Number(subscriberId)) {
        throw analyticsHttpError(403, 'Acesso negado: campanha não pertence ao seu assinante.');
      }
    }
    if (totemId != null) {
      const ok = await getTotemService().isTotemAccessibleToSubscriber(totemId, Number(subscriberId));
      if (!ok) throw analyticsHttpError(403, 'Acesso negado: totem fora do escopo do seu assinante.');
    }
    return;
  }

  const requestPublisherId = req.user?.publisherId;

  if (totemId != null) {
    await getTotemService().getTotemByIdScoped(totemId, requestPublisherId, isAdmin);
  }
  if (campaignId != null) {
    await assertCampaignPublisherScope(campaignId, requestPublisherId);
  }
}

async function replyAnalyticsError(res: any, error: any, logLabel: string) {
  await logError(logLabel, error);
  const sc = error?.statusCode;
  const msg = error?.message || '';
  if (sc === 404) {
    return res.status(404).json({ success: false, message: msg || 'Não encontrado' });
  }
  if (
    sc === 403 ||
    msg.includes('Acesso negado') ||
    msg.includes('Modo compacto') ||
    msg.includes('não pertence ao seu publisher')
  ) {
    return res.status(403).json({ success: false, message: msg || 'Acesso negado' });
  }
  return res.status(500).json({ success: false, message: 'Erro interno do servidor', error: msg });
}

async function attachAnalyticsTenantScope(req: any, filters: Record<string, unknown>): Promise<void> {
  const scope = await resolveTenantScope(req);
  if (!scope) return;
  if (scope.scopedPublisherId !== undefined) {
    filters.scopedPublisherId = scope.scopedPublisherId;
  }
  if (scope.scopedSubscriberId !== undefined) {
    filters.scopedSubscriberId = scope.scopedSubscriberId;
  }
}

// Middleware de autenticação para todas as rotas
router.use(authenticateToken as any);

// Aplicar bloqueio de dados de clientes para OPERATOR
router.use(blockClientDataAccess);

/**
 * @route GET /api/analytics/dashboard
 * @desc Busca estatísticas do dashboard
 * @access Private (Admin, Manager)
 */
router.get('/dashboard', authorizeRole(['admin', 'gerente_marketing', 'visualizador']) as any, async (req, res) => {
  try {
    const scope = await resolveTenantScope(req);
    const stats = await getAnalyticsService().getDashboardStats(undefined, scope || undefined);

    res.json({
      success: true,
      data: stats
    });

  } catch (error: any) {
    await logError('Erro ao buscar estatísticas do dashboard', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
});

/**
 * @route GET /api/analytics/overview
 * @desc Busca análise geral com filtros
 * @access Private (Admin, Manager, Client)
 */
router.get('/overview', async (req: any, res) => {
  try {
    const {
      clientId,
      totemId,
      campaignId,
      startDate,
      endDate,
      groupBy
    } = req.query;

    const user = req.user || {};
    const filters: Record<string, unknown> = {
      clientId: user.role === 'client' ? (user as any).clientId : (clientId ? parseInt(clientId as string) : undefined),
      totemId: totemId ? parseInt(totemId as string) : undefined,
      campaignId: campaignId ? parseInt(campaignId as string) : undefined,
      startDate: startDate as string,
      endDate: endDate as string,
      groupBy: groupBy as 'day' | 'week' | 'month' | 'year'
    };

    await attachAnalyticsTenantScope(req, filters);

    await assertAnalyticsFiltersAllowed(req, {
      totemId: filters.totemId as number | undefined,
      campaignId: filters.campaignId as number | undefined
    });

    const analytics = await getAnalyticsService().getAnalytics(filters as any);

    return res.json({
      success: true,
      data: analytics
    });

  } catch (error: any) {
    if (isMissingTableError(error)) {
      return res.json({ success: true, data: [] });
    }
    return replyAnalyticsError(res, error, 'Erro ao buscar análise detalhada');
  }
});

/**
 * @route GET /api/analytics/report
 * @desc Gera relatório completo
 * @access Private (Admin, Manager, Client)
 */
router.get('/report', async (req: any, res) => {
  try {
    const {
      clientId,
      totemId,
      campaignId,
      startDate,
      endDate,
      groupBy
    } = req.query;

    const filters: Record<string, unknown> = {
      clientId: req.user.role === 'client' ? req.user.clientId : (clientId ? parseInt(clientId as string) : undefined),
      totemId: totemId ? parseInt(totemId as string) : undefined,
      campaignId: campaignId ? parseInt(campaignId as string) : undefined,
      startDate: startDate as string,
      endDate: endDate as string,
      groupBy: groupBy as 'day' | 'week' | 'month' | 'year'
    };

    await attachAnalyticsTenantScope(req, filters);

    await assertAnalyticsFiltersAllowed(req, {
      totemId: filters.totemId as number | undefined,
      campaignId: filters.campaignId as number | undefined
    });

    const report = await getAnalyticsService().generateReport(filters as any);

    res.json({
      success: true,
      data: report
    });

  } catch (error: any) {
    return replyAnalyticsError(res, error, 'Erro ao gerar relatório de analytics');
  }
});

/**
 * @route GET /api/analytics/campaigns/:campaignId
 * @desc Busca análise de uma campanha específica
 * @access Private (Admin, Manager, Client)
 */
router.get('/campaigns/:campaignId', async (req: any, res) => {
  try {
    const { campaignId } = req.params;
    const { startDate, endDate, groupBy } = req.query;
    const campaignIdNum = parseInt(campaignId, 10);

    await assertAnalyticsFiltersAllowed(req, { campaignId: campaignIdNum });

    const filters: Record<string, unknown> = {
      campaignId: campaignIdNum,
      startDate,
      endDate,
      groupBy
    };

    await attachAnalyticsTenantScope(req, filters);

    const analytics = await getAnalyticsService().getAnalytics(filters as any);

    return res.json({
      success: true,
      data: analytics
    });

  } catch (error: any) {
    return replyAnalyticsError(res, error, 'Erro ao buscar análise da campanha');
  }
});

/**
 * @route GET /api/analytics/totems/:totemId
 * @desc Busca análise de um totem específico
 * @access Private (Admin, Manager, Client)
 */
router.get('/totems/:totemId', async (req: any, res) => {
  try {
    const { totemId } = req.params;
    const { startDate, endDate, groupBy } = req.query;
    const idNum = parseInt(totemId, 10);

    // Escopo por publisher (exceto papel legado client — validação própria abaixo)
    let totem: Awaited<ReturnType<TotemService['getTotemById']>> | null;
    if (req.user?.role === 'client') {
      totem = await getTotemService().getTotemById(idNum);
    } else {
      const isAdmin = isAdminRole(req.user?.role);
      const requestPublisherId = req.user?.publisherId || undefined;
      totem = await getTotemService().getTotemByIdScoped(idNum, requestPublisherId, isAdmin);
    }

    if (!totem) {
      return res.status(404).json({
        success: false,
        message: 'Totem não encontrado'
      });
    }

    if (req.user.role === 'client' && req.user.clientId !== (totem as any).clientId) {
      return res.status(403).json({
        success: false,
        message: 'Acesso negado: Você só pode ver análises de seus próprios totems'
      });
    }

    const filters: Record<string, unknown> = {
      totemId: idNum,
      startDate,
      endDate,
      groupBy
    };

    await attachAnalyticsTenantScope(req, filters);

    const analytics = await getAnalyticsService().getAnalytics(filters as any);

    return res.json({
      success: true,
      data: analytics
    });

  } catch (error: any) {
    return replyAnalyticsError(res, error, 'Erro ao buscar análise do totem');
  }
});

/**
 * @route GET /api/analytics/clients/:clientId
 * @desc Busca análise de um cliente específico
 * @access Private (Admin, Manager, Client)
 */
router.get('/clients/:clientId', async (req: any, res) => {
  try {
    const { clientId } = req.params;
    const { startDate, endDate, groupBy } = req.query;

    // Verificar permissão
    if (req.user.role === 'client' && req.user.clientId !== parseInt(clientId)) {
      return res.status(403).json({
        success: false,
        message: 'Acesso negado: Você só pode ver análises de seu próprio cliente'
      });
    }

    const filters: Record<string, unknown> = {
      clientId: parseInt(clientId, 10),
      startDate,
      endDate,
      groupBy
    };

    await attachAnalyticsTenantScope(req, filters);

    const analytics = await getAnalyticsService().getAnalytics(filters as any);

    return res.json({
      success: true,
      data: analytics
    });

  } catch (error: any) {
    await logError('Erro ao buscar análise do cliente', error);
    return res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
});

/**
 * @route GET /api/analytics/performance
 * @desc Busca métricas de performance
 * @access Private (Admin, Manager)
 */
router.get('/performance', authorizeRole(['admin', 'gerente_marketing', 'visualizador']) as any, async (req, res) => {
  try {
    const { startDate, endDate, groupBy } = req.query;

    const filters: Record<string, unknown> = {
      startDate: startDate as string,
      endDate: endDate as string,
      groupBy: groupBy as 'day' | 'week' | 'month' | 'year'
    };

    await attachAnalyticsTenantScope(req, filters);

    const analytics = await getAnalyticsService().getAnalytics(filters as any);

    // Extrair apenas métricas de performance
    const performance = {
      totalViews: analytics.totalViews,
      totalDuration: analytics.totalDuration,
      averageViewDuration: analytics.averageViewDuration,
      uniqueViewers: analytics.uniqueViewers,
      peakViewingTime: analytics.peakViewingTime,
      mostViewedContent: analytics.mostViewedContent,
      viewingTrends: analytics.viewingTrends,
      campaignPerformance: analytics.campaignPerformance,
      totemPerformance: analytics.totemPerformance
    };

    res.json({
      success: true,
      data: performance
    });

  } catch (error: any) {
    await logError('Erro ao buscar métricas de performance', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
});

/**
 * @route GET /api/analytics/revenue
 * @desc Busca métricas de receita
 * @access Private (Admin, Manager)
 */
router.get('/revenue', authorizeRole(['admin', 'gerente_marketing', 'visualizador']) as any, async (req, res) => {
  try {
    const { startDate, endDate, groupBy } = req.query;

    const filters: Record<string, unknown> = {
      startDate: startDate as string,
      endDate: endDate as string,
      groupBy: groupBy as 'day' | 'week' | 'month' | 'year'
    };

    await attachAnalyticsTenantScope(req, filters);

    const analytics = await getAnalyticsService().getAnalytics(filters as any);

    res.json({
      success: true,
      data: analytics.revenue
    });

  } catch (error: any) {
    await logError('Erro ao buscar métricas de receita', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
});

/**
 * @route GET /api/analytics/trends
 * @desc Busca tendências de visualização
 * @access Private (Admin, Manager, Client)
 */
router.get('/trends', async (req: any, res) => {
  try {
    const {
      clientId,
      totemId,
      campaignId,
      startDate,
      endDate,
      groupBy
    } = req.query;

    const filters: Record<string, unknown> = {
      clientId: req.user.role === 'client' ? req.user.clientId : (clientId ? parseInt(clientId as string) : undefined),
      totemId: totemId ? parseInt(totemId as string) : undefined,
      campaignId: campaignId ? parseInt(campaignId as string) : undefined,
      startDate: startDate as string,
      endDate: endDate as string,
      groupBy: groupBy as 'day' | 'week' | 'month' | 'year'
    };

    await attachAnalyticsTenantScope(req, filters);

    await assertAnalyticsFiltersAllowed(req, {
      totemId: filters.totemId as number | undefined,
      campaignId: filters.campaignId as number | undefined
    });

    const analytics = await getAnalyticsService().getAnalytics(filters as any);

    res.json({
      success: true,
      data: {
        viewingTrends: analytics.viewingTrends,
        peakViewingTime: analytics.peakViewingTime,
        averageViewDuration: analytics.averageViewDuration
      }
    });

  } catch (error: any) {
    return replyAnalyticsError(res, error, 'Erro ao buscar tendências');
  }
});

/**
 * @route GET /api/analytics/export
 * @desc Exporta dados de análise
 * @access Private (Admin, Manager, Client)
 */
router.get('/export', async (req: any, res) => {
  try {
    const {
      clientId,
      totemId,
      campaignId,
      startDate,
      endDate,
      groupBy,
      format = 'json'
    } = req.query;

    const filters: Record<string, unknown> = {
      clientId: req.user.role === 'client' ? req.user.clientId : (clientId ? parseInt(clientId as string) : undefined),
      totemId: totemId ? parseInt(totemId as string) : undefined,
      campaignId: campaignId ? parseInt(campaignId as string) : undefined,
      startDate: startDate as string,
      endDate: endDate as string,
      groupBy: groupBy as 'day' | 'week' | 'month' | 'year'
    };

    await attachAnalyticsTenantScope(req, filters);

    await assertAnalyticsFiltersAllowed(req, {
      totemId: filters.totemId as number | undefined,
      campaignId: filters.campaignId as number | undefined
    });

    const report = await getAnalyticsService().generateReport(filters as any);

    if (format === 'csv') {
      // Implementar exportação CSV
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="analytics-report.csv"');
      
      // Converter dados para CSV (implementação simplificada)
      const csvData = 'ID,Title,Type,Format,Status,Date\n' + (report as any).id + ',' + (report as any).title + ',' + (report as any).type + ',' + (report as any).format + ',' + (report as any).status + ',' + (report as any).createdAt;
      res.send(csvData);
    } else {
      // Exportação JSON
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename="analytics-report.json"');
      res.json(report);
    }

  } catch (error: any) {
    return replyAnalyticsError(res, error, 'Erro ao exportar análise');
  }
});

/**
 * @route GET /api/analytics/alerts
 * @desc Busca alertas do sistema
 * @access Private (Admin, Manager)
 */
router.get('/alerts', authorizeRole(['admin', 'gerente_marketing', 'visualizador']) as any, async (req, res) => {
  try {
    const scope = await resolveTenantScope(req);
    const stats = await getAnalyticsService().getDashboardStats(undefined, scope || undefined);

    res.json({
      success: true,
      data: stats.alerts
    });

  } catch (error: any) {
    await logError('Erro ao buscar alertas de analytics', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
});

export default router;
