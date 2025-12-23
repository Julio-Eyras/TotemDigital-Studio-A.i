/**
 * Analytics Routes - Smart Signage v2.0
 * Rotas para análise e relatórios
 */

import { Router } from 'express';
import { AnalyticsService } from '../services/analyticsService';
import { authenticateToken, authorizeRole } from '../middleware/auth.middleware';
import { blockClientDataAccess } from '../middleware/operatorProtection.middleware';
import { logError } from '../utils/loggerHelper';

const router = Router();

// Lazy initialization - só criar quando necessário
function getAnalyticsService(): AnalyticsService {
  if (!(global as any).analyticsServiceInstance) {
    (global as any).analyticsServiceInstance = new AnalyticsService();
  }
  return (global as any).analyticsServiceInstance;
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
router.get('/dashboard', authorizeRole(['admin', 'gerente_marketing', 'visualizador']) as any, async (_req, res) => {
  try {
    const stats = await getAnalyticsService().getDashboardStats();

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

    // Aplicar filtro de cliente se for Client
    const filters = {
      clientId: req.user.role === 'client' ? req.user.clientId : (clientId ? parseInt(clientId as string) : undefined),
      totemId: totemId ? parseInt(totemId as string) : undefined,
      campaignId: campaignId ? parseInt(campaignId as string) : undefined,
      startDate: startDate as string,
      endDate: endDate as string,
      groupBy: groupBy as 'day' | 'week' | 'month' | 'year'
    };

    const analytics = await getAnalyticsService().getAnalytics(filters);

    res.json({
      success: true,
      data: analytics
    });

  } catch (error: any) {
    await logError('Erro ao buscar análise detalhada', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
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

    // Aplicar filtro de cliente se for Client
    const filters = {
      clientId: req.user.role === 'client' ? req.user.clientId : (clientId ? parseInt(clientId as string) : undefined),
      totemId: totemId ? parseInt(totemId as string) : undefined,
      campaignId: campaignId ? parseInt(campaignId as string) : undefined,
      startDate: startDate as string,
      endDate: endDate as string,
      groupBy: groupBy as 'day' | 'week' | 'month' | 'year'
    };

    const report = await getAnalyticsService().generateReport(filters);

    res.json({
      success: true,
      data: report
    });

  } catch (error: any) {
    await logError('Erro ao gerar relatório de analytics', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
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

    // Verificar se campanha existe e permissão
    const campaign = await getAnalyticsService().getCampaignById(parseInt(campaignId));
    if (!campaign) {
      return res.status(404).json({
        success: false,
        message: 'Campanha não encontrada'
      });
    }

    if (req.user.role === 'client' && req.user.clientId !== campaign.clientId) {
      return res.status(403).json({
        success: false,
        message: 'Acesso negado: Você só pode ver análises de suas próprias campanhas'
      });
    }

    const filters = {
      campaignId: parseInt(campaignId),
      startDate,
      endDate,
      groupBy
    };

    const analytics = await getAnalyticsService().getAnalytics(filters);

    return res.json({
      success: true,
      data: analytics
    });

  } catch (error: any) {
    await logError('Erro ao buscar análise da campanha', error);
    return res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
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

    // Verificar se totem existe e permissão
    const totem = await getAnalyticsService().getTotemById(parseInt(totemId));
    if (!totem) {
      return res.status(404).json({
        success: false,
        message: 'Totem não encontrado'
      });
    }

    if (req.user.role === 'client' && req.user.clientId !== totem.clientId) {
      return res.status(403).json({
        success: false,
        message: 'Acesso negado: Você só pode ver análises de seus próprios totems'
      });
    }

    const filters = {
      totemId: parseInt(totemId),
      startDate,
      endDate,
      groupBy
    };

    const analytics = await getAnalyticsService().getAnalytics(filters);

    return res.json({
      success: true,
      data: analytics
    });

  } catch (error: any) {
    await logError('Erro ao buscar análise do totem', error);
    return res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
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

    const filters = {
      clientId: parseInt(clientId),
      startDate,
      endDate,
      groupBy
    };

    const analytics = await getAnalyticsService().getAnalytics(filters);

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

    const filters = {
      startDate: startDate as string,
      endDate: endDate as string,
      groupBy: groupBy as 'day' | 'week' | 'month' | 'year'
    };

    const analytics = await getAnalyticsService().getAnalytics(filters);

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

    const filters = {
      startDate: startDate as string,
      endDate: endDate as string,
      groupBy: groupBy as 'day' | 'week' | 'month' | 'year'
    };

    const analytics = await getAnalyticsService().getAnalytics(filters);

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

    // Aplicar filtro de cliente se for Client
    const filters = {
      clientId: req.user.role === 'client' ? req.user.clientId : (clientId ? parseInt(clientId as string) : undefined),
      totemId: totemId ? parseInt(totemId as string) : undefined,
      campaignId: campaignId ? parseInt(campaignId as string) : undefined,
      startDate: startDate as string,
      endDate: endDate as string,
      groupBy: groupBy as 'day' | 'week' | 'month' | 'year'
    };

    const analytics = await getAnalyticsService().getAnalytics(filters);

    res.json({
      success: true,
      data: {
        viewingTrends: analytics.viewingTrends,
        peakViewingTime: analytics.peakViewingTime,
        averageViewDuration: analytics.averageViewDuration
      }
    });

  } catch (error: any) {
    await logError('Erro ao buscar tendências', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
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

    // Aplicar filtro de cliente se for Client
    const filters = {
      clientId: req.user.role === 'client' ? req.user.clientId : (clientId ? parseInt(clientId as string) : undefined),
      totemId: totemId ? parseInt(totemId as string) : undefined,
      campaignId: campaignId ? parseInt(campaignId as string) : undefined,
      startDate: startDate as string,
      endDate: endDate as string,
      groupBy: groupBy as 'day' | 'week' | 'month' | 'year'
    };

    const report = await getAnalyticsService().generateReport(filters);

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
    await logError('Erro ao exportar análise', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
});

/**
 * @route GET /api/analytics/alerts
 * @desc Busca alertas do sistema
 * @access Private (Admin, Manager)
 */
router.get('/alerts', authorizeRole(['admin', 'gerente_marketing', 'visualizador']) as any, async (_req, res) => {
  try {
    const stats = await getAnalyticsService().getDashboardStats();

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
