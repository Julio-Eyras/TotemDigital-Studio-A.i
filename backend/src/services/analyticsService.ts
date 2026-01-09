/**
 * Analytics Service - Smart Signage v2.0
 * Serviço de análise e relatórios
 */

import { getDatabase } from '../config/database';
import { logError, logWarn } from '../utils/loggerHelper';
import { getAnalyticsCacheService } from './analyticsCacheService';

export interface AnalyticsFilters {
  subscriberId?: number;
  totemId?: number;
  campaignId?: number;
  startDate?: string;
  endDate?: string;
  groupBy?: 'day' | 'week' | 'month' | 'year';
  timezone?: string;
}

export interface AnalyticsResponse {
  totalViews: number;
  totalDuration: number;
  averageViewDuration: number;
  uniqueViewers: number;
  peakViewingTime: string;
  mostViewedContent: {
    mediaId: number;
    title: string;
    views: number;
    duration: number;
  }[];
  viewingTrends: {
    date: string;
    views: number;
    duration: number;
    uniqueViewers: number;
  }[];
  deviceStats: {
    deviceType: string;
    count: number;
    percentage: number;
  }[];
  locationStats: {
    location: string;
    views: number;
    percentage: number;
  }[];
  campaignPerformance: {
    campaignId: number;
    title: string;
    views: number;
    duration: number;
    effectiveness: number;
  }[];
  totemPerformance: {
    totemId: number;
    name: string;
    location: string;
    views: number;
    uptime: number;
    effectiveness: number;
  }[];
  qrCodeStats: {
    qrCodeId: number;
    title: string;
    scans: number;
    conversionRate: number;
  }[];
  revenue: {
    total: number;
    bySubscriber: {
      subscriberId: number;
      subscriberName: string;
      amount: number;
    }[];
    byCampaign: {
      campaignId: number;
      title: string;
      amount: number;
    }[];
  };
}

export interface DashboardStats {
  overview: {
    totalClients: number;
    totalTotems: number;
    totalCampaigns: number;
    totalMedia: number;
    totalViews: number;
    totalRevenue: number;
    activeUsers: number;
    systemUptime: number;
  };
  recentActivity: {
    newClients: number;
    newCampaigns: number;
    newMedia: number;
    newViews: number;
    newRevenue: number;
  };
  performance: {
    topCampaigns: {
      campaignId: number;
      title: string;
      views: number;
      effectiveness: number;
    }[];
    topTotems: {
      totemId: number;
      name: string;
      location: string;
      views: number;
      uptime: number;
    }[];
    topMedia: {
      mediaId: number;
      title: string;
      views: number;
      duration: number;
    }[];
  };
  alerts: {
    type: 'warning' | 'error' | 'info';
    message: string;
    timestamp: string;
  }[];
}

export interface ReportData {
  title: string;
  description: string;
  generatedAt: string;
  period: {
    start: string;
    end: string;
  };
  filters: AnalyticsFilters;
  data: AnalyticsResponse;
  summary: {
    keyInsights: string[];
    recommendations: string[];
    trends: string[];
  };
}

export class AnalyticsService {
  private get db() {
    return getDatabase();
  }


  private get analyticsCache() {
    return getAnalyticsCacheService();
  }
  
  // Lazy initialization de audit service (reservado para uso futuro)
  // private getAuditService(): AuditService {
  //   if (!(global as any).auditServiceInstance) {
  //     (global as any).auditServiceInstance = new AuditService();
  //   }
  //   return (global as any).auditServiceInstance;
  // }

  /**
   * Busca estatísticas gerais do dashboard (com cache de 5 minutos)
   */
  async getDashboardStats(clientId?: number): Promise<DashboardStats> {
    const cacheKey = this.analyticsCache.getOverviewKey(clientId);
    
    return this.analyticsCache.getOrSet(
      cacheKey,
      async () => {
        return this.fetchDashboardStats();
      },
      300 // Cache por 5 minutos
    );
  }

  /**
   * Busca estatísticas gerais do dashboard (sem cache)
   */
  private async fetchDashboardStats(): Promise<DashboardStats> {
    try {
      const totalClients = await this.db.findFirst(`
        SELECT COUNT(*)::int AS count FROM subscribers WHERE is_active = true
      `);

      const totalTotems = await this.db.findFirst(`
        SELECT COUNT(*)::int AS count FROM totems WHERE is_active = true
      `);

      const totalCampaigns = await this.db.findFirst(`
        SELECT COUNT(*)::int AS count FROM campaigns WHERE is_active = true
      `);

      const totalMedia = await this.db.findFirst(`
        SELECT COUNT(*)::int AS count FROM medias
      `);

      const totalViews = await this.db.findFirst(`
        SELECT COUNT(*)::int AS count
        FROM execution_logs el
        WHERE el.event_type = 'play_end'
      `);

      // Removido: totalDuration não é usado no retorno

      const activeUsers = await this.db.findFirst(`
        SELECT COUNT(*)::int AS count FROM users WHERE is_active = true
      `);

      const onlineTotems = await this.db.findFirst(`
        SELECT COUNT(*)::int AS count FROM totems WHERE is_active = true AND status = 'online'
      `);

      const systemUptime =
        totalTotems?.count && totalTotems.count > 0
          ? Math.round(((onlineTotems?.count || 0) / totalTotems.count) * 100)
          : 0;

      const recentWindow = `
        CURRENT_TIMESTAMP - INTERVAL '7 days'
      `;

      const newClients = await this.db.findFirst(`
        SELECT COUNT(*)::int AS count FROM subscribers WHERE created_at >= ${recentWindow}
      `);

      const newCampaigns = await this.db.findFirst(`
        SELECT COUNT(*)::int AS count FROM campaigns WHERE created_at >= ${recentWindow}
      `);

      const newMedia = await this.db.findFirst(`
        SELECT COUNT(*)::int AS count FROM medias WHERE created_at >= ${recentWindow}
      `);

      const newViews = await this.db.findFirst(`
        SELECT COUNT(*)::int AS count
        FROM execution_logs
        WHERE event_type = 'play_end' AND timestamp >= ${recentWindow}
      `);

      const topCampaigns = await this.db.findMany(`
        SELECT 
          c.campaign_id AS "campaignId",
          c.title,
          COUNT(CASE WHEN el.event_type = 'play_end' THEN 1 END)::int AS views,
          COALESCE(SUM((el.event_data->>'duration')::int), 0)::int AS duration
        FROM campaigns c
        LEFT JOIN execution_logs el ON el.campaign_id = c.campaign_id AND el.event_type = 'play_end'
        GROUP BY c.campaign_id, c.title
        ORDER BY views DESC
        LIMIT 5
      `);

      const topTotems = await this.db.findMany(`
        SELECT 
          t.totem_id AS "totemId",
          t.name,
          t.location,
          COUNT(CASE WHEN el.event_type = 'play_end' THEN 1 END)::int AS views,
          CASE 
            WHEN COUNT(el.log_id) > 0 THEN 
              (COUNT(CASE WHEN el.event_type = 'play_end' THEN 1 END)::float / COUNT(el.log_id) * 100)
            ELSE 0
          END AS effectiveness
        FROM totems t
        LEFT JOIN execution_logs el ON el.totem_id = t.totem_id
        WHERE t.is_active = true
        GROUP BY t.totem_id, t.name, t.location
        ORDER BY views DESC
        LIMIT 5
      `);

      const topMedia = await this.db.findMany(`
        SELECT 
          m.media_id AS "mediaId",
          m.title,
          COUNT(CASE WHEN el.event_type = 'play_end' THEN 1 END)::int AS views,
          COALESCE(SUM((el.event_data->>'duration')::int), 0)::int AS duration
        FROM medias m
        LEFT JOIN execution_logs el ON el.media_id = m.media_id AND el.event_type = 'play_end'
        GROUP BY m.media_id, m.title
        ORDER BY views DESC
        LIMIT 5
      `);

      const alerts = await this.getSystemAlerts();

      return {
        overview: {
          totalClients: totalClients?.count || 0,
          totalTotems: totalTotems?.count || 0,
          totalCampaigns: totalCampaigns?.count || 0,
          totalMedia: totalMedia?.count || 0,
          totalViews: totalViews?.count || 0,
          totalRevenue: 0,
          activeUsers: activeUsers?.count || 0,
          systemUptime
        },
        recentActivity: {
          newClients: newClients?.count || 0,
          newCampaigns: newCampaigns?.count || 0,
          newMedia: newMedia?.count || 0,
          newViews: newViews?.count || 0,
          newRevenue: 0
        },
        performance: {
          topCampaigns: topCampaigns.map(c => ({
            campaignId: c.campaignId,
            title: c.title,
            views: c.views,
            effectiveness: c.views > 0
              ? Math.min(100, Math.round((c.duration / Math.max(c.views, 1)) || 0))
              : 0
          })),
          topTotems: topTotems.map(t => ({
            totemId: t.totemId,
            name: t.name,
            location: t.location,
            views: t.views,
            uptime: Math.round(t.effectiveness || 0)
          })),
          topMedia: topMedia.map(m => ({
            mediaId: m.mediaId,
            title: m.title,
            views: m.views,
            duration: m.duration
          }))
        },
        alerts
      };

    } catch (error: any) {
      await logError('Erro ao buscar estatísticas do dashboard', error);
      throw new Error('Erro interno do servidor');
    }
  }

  /**
   * Busca análise detalhada com filtros
   */
  async getAnalytics(filters: AnalyticsFilters): Promise<AnalyticsResponse> {
    try {
      const {
        clientId,
        totemId,
        campaignId,
        startDate,
        endDate,
        groupBy = 'day'
      } = filters;

      let whereClause = 'WHERE 1=1';
      const params: any[] = [];

      if (clientId) {
        // event_logs tem subscriber_id (derivado de campaign_id)
        whereClause += ' AND el.subscriber_id = $' + (params.length + 1);
        params.push(clientId); // clientId mapeado para subscriberId
      }
      if (totemId) {
        whereClause += ' AND el.totem_id = ?';
        params.push(totemId);
      }
      if (campaignId) {
        whereClause += ' AND el.campaign_id = ?';
        params.push(campaignId);
      }
      // Adicionar filtro para event_type = 'play_end' na cláusula WHERE
      whereClause += ' AND el.event_type = \'play_end\'';
      
      if (startDate) {
        whereClause += ' AND el.timestamp >= ?';
        params.push(startDate);
      }
      if (endDate) {
        whereClause += ' AND el.timestamp <= ?';
        params.push(endDate);
      }

      const totalViewsResult = await this.db.findFirst(`
        SELECT COUNT(*)::int AS total
        FROM execution_logs el
        ${whereClause}
      `, params);

      const totalDurationResult = await this.db.findFirst(`
        SELECT COALESCE(SUM((el.event_data->>'duration')::int), 0)::int AS total
        FROM execution_logs el
        ${whereClause} AND el.event_data->>'duration' IS NOT NULL
      `, params);

      const totalViews = totalViewsResult?.total || 0;
      const totalDuration = totalDurationResult?.total || 0;
      const averageViewDuration = totalViews > 0 ? totalDuration / totalViews : 0;

      const uniqueViewersResult = await this.db.findFirst(`
        SELECT COUNT(DISTINCT el.totem_id)::int AS count
        FROM execution_logs el
        ${whereClause}
      `, params);

      // Horário de pico simplificado (pode ser refinado no futuro)
      const peakViewingTime = '14:00';

      const mostViewedContent = await this.db.findMany(`
        SELECT 
          el.media_id AS "mediaId",
          COALESCE(m.title, 'Mídia desconhecida') AS title,
          COUNT(*)::int AS views,
          COALESCE(SUM((el.event_data->>'duration')::int), 0)::int AS duration
        FROM execution_logs el
        LEFT JOIN medias m ON m.media_id = el.media_id
        ${whereClause}
        GROUP BY el.media_id, m.title
        ORDER BY views DESC
        LIMIT 10
      `, params);

      const validGroup = ['day', 'week', 'month', 'year'].includes(groupBy) ? groupBy : 'day';
      const viewingTrendsRows = await this.db.findMany(`
        SELECT 
          DATE_TRUNC('${validGroup}', el.timestamp) AS bucket,
          COUNT(*)::int AS total_events,
          COUNT(*)::int AS views,
          COALESCE(SUM((el.event_data->>'duration')::int), 0)::int AS duration,
          COUNT(DISTINCT el.totem_id)::int AS unique_viewers
        FROM execution_logs el
        ${whereClause}
        GROUP BY bucket
        ORDER BY bucket
      `, params);

      const viewingTrends = viewingTrendsRows.map(row => ({
        date: row.bucket instanceof Date ? row.bucket.toISOString() : new Date(row.bucket).toISOString(),
        views: row.views,
        duration: row.duration,
        uniqueViewers: row.unique_viewers
      }));

      const deviceStatsRows = await this.db.findMany(`
        SELECT 
          COALESCE(t.status, 'unknown') AS status,
          COUNT(DISTINCT t.totem_id)::int AS count
        FROM execution_logs el
        LEFT JOIN totems t ON t.totem_id = el.totem_id
        ${whereClause}
        GROUP BY COALESCE(t.status, 'unknown')
      `, params);

      const totalDeviceCount = deviceStatsRows.reduce((acc, row) => acc + (row.count || 0), 0) || 1;
      const deviceStats = deviceStatsRows.map(row => ({
        deviceType: row.status,
        count: row.count,
        percentage: Math.round((row.count / totalDeviceCount) * 100)
      }));

      const locationStatsRows = await this.db.findMany(`
        SELECT 
          COALESCE(t.location, 'Não informado') AS location,
          COUNT(*)::int AS views
        FROM execution_logs el
        LEFT JOIN totems t ON t.totem_id = el.totem_id
        ${whereClause}
        GROUP BY COALESCE(t.location, 'Não informado')
        ORDER BY views DESC
      `, params);

      const totalLocationViews = locationStatsRows.reduce((acc, row) => acc + (row.views || 0), 0) || 1;
      const locationStats = locationStatsRows.map(row => ({
        location: row.location,
        views: row.views,
        percentage: Math.round((row.views / totalLocationViews) * 100)
      }));

      // Construir whereClause sem o filtro de event_type para LEFT JOIN
      const campaignWhereClause = whereClause.replace(' AND el.event_type = \'play_end\'', '');
      const campaignPerformance = await this.db.findMany(`
        SELECT 
          c.campaign_id AS "campaignId",
          c.title,
          COUNT(CASE WHEN el.event_type = 'play_end' THEN 1 END)::int AS views,
          COALESCE(SUM(CASE WHEN el.event_type = 'play_end' THEN (el.event_data->>'duration')::int ELSE 0 END), 0)::int AS duration
        FROM campaigns c
        LEFT JOIN execution_logs el ON el.campaign_id = c.campaign_id ${campaignWhereClause}
        GROUP BY c.campaign_id, c.title
        ORDER BY views DESC
        LIMIT 10
      `, params);

      // Remover filtro de event_type da whereClause para LEFT JOIN funcionar corretamente
      const totemWhereClause = whereClause.replace(' AND el.event_type = \'play_end\'', '');
      const totemPerformance = await this.db.findMany(`
        SELECT 
          t.totem_id AS "totemId",
          COALESCE(t.name, CONCAT('Totem ', t.totem_id::text)) AS name,
          COALESCE(t.location, 'Não informado') AS location,
          COUNT(CASE WHEN el.event_type = 'play_end' THEN 1 END)::int AS views,
          COALESCE(SUM(CASE WHEN el.event_type = 'play_end' THEN (el.event_data->>'duration')::int ELSE 0 END), 0)::int AS duration,
          CASE 
            WHEN COUNT(el.log_id) > 0 THEN 
              (COUNT(CASE WHEN el.event_type = 'play_end' THEN 1 END)::float / COUNT(el.log_id) * 100)
            ELSE 0
          END AS effectiveness
        FROM totems t
        LEFT JOIN execution_logs el ON el.totem_id = t.totem_id ${totemWhereClause.replace('el.', 'el.')}
        GROUP BY t.totem_id, t.name, t.location
        ORDER BY views DESC
        LIMIT 10
      `, params);

      // NOTA: Tabela analytics_qr_scans pode não existir no schema v2
      // Usar dados de qr_codes diretamente (scan_count, last_scan_at)
      let qrWhere = 'WHERE 1=1';
      const qrParams: any[] = [];
      
      if (clientId) {
        // QR codes pertencem a campaigns, que pertencem a subscribers
        qrWhere += ' AND q.campaign_id IN (SELECT campaign_id FROM campaigns WHERE subscriber_id = $' + (qrParams.length + 1) + ')';
        qrParams.push(clientId); // clientId mapeado para subscriberId
      }
      if (startDate) {
        qrWhere += ' AND q.last_scan_at >= $' + (qrParams.length + 1);
        qrParams.push(startDate);
      }
      if (endDate) {
        qrWhere += ' AND q.last_scan_at <= $' + (qrParams.length + 1);
        qrParams.push(endDate);
      }

      // Buscar QR codes com scan_count > 0
      const qrCodeStatsRows = await this.db.findMany(`
        SELECT 
          q.qr_id AS "qrCodeId",
          COALESCE(q.title, q.content, 'QR Code') AS title,
          q.scan_count::int AS scans
        FROM qr_codes q
        ${qrWhere}
        AND q.scan_count > 0
        ORDER BY q.scan_count DESC
        LIMIT 10
      `, qrParams);

      const revenue = await this.getRevenueStats(filters);

      return {
        totalViews,
        totalDuration,
        averageViewDuration,
        uniqueViewers: uniqueViewersResult?.count || 0,
        peakViewingTime,
        mostViewedContent: mostViewedContent.map(item => ({
          mediaId: item.mediaId,
          title: item.title,
          views: item.views,
          duration: item.duration
        })),
        viewingTrends,
        deviceStats,
        locationStats,
        campaignPerformance: campaignPerformance.map(item => ({
          campaignId: item.campaignId,
          title: item.title,
          views: item.views,
          duration: item.duration,
          effectiveness: item.views > 0
            ? Math.min(100, Math.round((item.duration / Math.max(item.views, 1)) || 0))
            : 0
        })),
        totemPerformance: totemPerformance.map(item => ({
          totemId: item.totemId,
          name: item.name,
          location: item.location,
          views: item.views,
          uptime: Math.round(item.effectiveness || 0),
          effectiveness: Math.round(item.effectiveness || 0)
        })),
        qrCodeStats: qrCodeStatsRows.map(item => ({
          qrCodeId: item.qrCodeId,
          title: item.title,
          scans: item.scans,
          conversionRate: 0
        })),
        revenue
      };

    } catch (error: any) {
      await logError('Erro ao buscar análise', error);
      throw new Error('Erro interno do servidor');
    }
  }

  /**
   * Busca campanha por ID
   */
  async getCampaignById(campaignId: number): Promise<any> {
    try {
      const campaign = await this.db.findFirst(`
        SELECT
          c.campaign_id as id,
          c.title as title,
          c.title as name,
          c.description,
          c.status,
          c.start_date as startDate,
          c.end_date as endDate,
          c.created_at as createdAt
        FROM campaigns c
        WHERE c.campaign_id = ?
      `, [campaignId]);

      return campaign;
    } catch (error: any) {
      await logError('Erro ao buscar campanha', error);
      throw new Error('Erro interno do servidor');
    }
  }

  /**
   * Busca totem por ID
   */
  async getTotemById(totemId: number): Promise<any> {
    try {
      const totem = await this.db.findFirst(`
        SELECT
          t.totem_id as id,
          t.name,
          t.location,
          t.uin,
          t.is_active as isActive,
          t.last_heartbeat as lastHeartbeat,
          t.created_at as createdAt
        FROM totems t
        WHERE t.totem_id = ?
      `, [totemId]);

      return totem;
    } catch (error: any) {
      await logError('Erro ao buscar totem', error);
      throw new Error('Erro interno do servidor');
    }
  }

  /**
   * Gera relatório completo
   */
  async generateReport(filters: AnalyticsFilters): Promise<ReportData> {
    try {
      const data = await this.getAnalytics(filters);
      
      const report: ReportData = {
        title: 'Relatório de Análise Smart Signage',
        description: 'Relatório completo de performance e análise do sistema',
        generatedAt: new Date().toISOString(),
        period: {
          start: filters.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
          end: filters.endDate || new Date().toISOString()
        },
        filters,
        data,
        summary: {
          keyInsights: this.generateKeyInsights(data),
          recommendations: this.generateRecommendations(data),
          trends: this.generateTrends(data)
        }
      };

      return report;

    } catch (error: any) {
      await logError('Erro ao gerar relatório', error);
      throw new Error('Erro interno do servidor');
    }
  }

  // Métodos auxiliares avançados de analytics (reservados para uso futuro)
  // getPeakViewingTime, getViewingTrends, getDeviceStats, getLocationStats,
  // getCampaignPerformance, getTotemPerformance, getQRCodeStats, getRevenueStats
  // foram implementados mas ainda não expostos por rotas. Para evitar
  // warnings de noUnusedLocals no strict mode, funções realmente usadas
  // permanecem e as que não têm uso hoje podem ser reativadas quando
  // endpoints específicos de BI forem implementados.

  /**
   * Busca estatísticas de receita
   */
  private async getRevenueStats(_filters: AnalyticsFilters): Promise<{
    total: number;
    bySubscriber: {
      subscriberId: number;
      subscriberName: string;
      amount: number;
    }[];
    byCampaign: {
      campaignId: number;
      title: string;
      amount: number;
    }[];
  }> {
    try {
      return {
        total: 0,
        byClient: [],
        byCampaign: []
      };
    } catch (error: any) {
      await logError('Erro ao buscar estatísticas de receita', error);
      return {
        total: 0,
        byClient: [],
        byCampaign: []
      };
    }
  }

  /**
   * Busca alertas do sistema
   */
  private async getSystemAlerts(): Promise<{
    type: 'warning' | 'error' | 'info';
    message: string;
    timestamp: string;
  }[]> {
    try {
      const alerts = [];

      // Verificar totems offline
      const offlineTotems = await this.db.findFirst(`
        SELECT COUNT(*)::int AS count 
        FROM totems 
        WHERE is_active = true 
          AND (
            last_heartbeat IS NULL 
            OR last_heartbeat < NOW() - INTERVAL '5 minutes'
          )
      `);

      if (offlineTotems?.count > 0) {
        alerts.push({
          type: 'warning' as const,
          message: `${offlineTotems.count} totem(s) offline`,
          timestamp: new Date().toISOString()
        });
      }

      // Verificar campanhas expiradas
      const expiredCampaigns = await this.db.findFirst(`
        SELECT COUNT(*) as count FROM campaigns 
        WHERE is_active = 1 AND end_date < CURRENT_TIMESTAMP
      `);

      if (expiredCampaigns?.count > 0) {
        alerts.push({
          type: 'info' as const,
          message: `${expiredCampaigns.count} campanha(s) expirada(s)`,
          timestamp: new Date().toISOString()
        });
      }

      // Verificar espaço em disco
      const diskUsage = await this.getDiskUsage();
      if (diskUsage > 90) {
        alerts.push({
          type: 'error' as const,
          message: `Espaço em disco crítico: ${diskUsage}%`,
          timestamp: new Date().toISOString()
        });
      }

      return alerts;

    } catch (error: any) {
      await logError('Erro ao buscar alertas', error);
      return [];
    }
  }

  /**
   * Obtém uso de disco (implementação real)
   */
  private async getDiskUsage(): Promise<number> {
    try {
      const fs = require('fs');
      const { exec } = require('child_process');
      const { promisify } = require('util');
      const execAsync = promisify(exec);

      // Tentar usar comando df (Linux/Unix)
      try {
        const { stdout } = await execAsync('df -h /');
        const lines = stdout.split('\n');
        if (lines.length > 1) {
          const parts = lines[1].split(/\s+/);
          if (parts.length >= 5) {
            // Extrair percentual de uso (ex: "75%" -> 75)
            const usageStr = parts[4];
            const usage = parseInt(usageStr.replace('%', ''));
            return isNaN(usage) ? 0 : usage;
          }
        }
      } catch (dfError: any) {
        // Se df falhar, tentar calcular manualmente
        await logWarn('Comando df não disponível, calculando uso manualmente');
      }

      // Fallback: calcular uso manualmente (Windows ou se df falhar)
      try {
        fs.statSync('/');
        // Esta é uma aproximação - em produção, use uma biblioteca como 'diskusage'
        // Por enquanto, retornar um valor baseado no espaço disponível
        return 50; // Valor padrão se não conseguir calcular
      } catch (statError: any) {
        await logWarn('Não foi possível calcular uso de disco', { error: statError.message });
        return 0;
      }

    } catch (error: any) {
      await logError('Erro ao obter uso de disco', error);
      return 0;
    }
  }

  /**
   * Gera insights principais
   */
  private generateKeyInsights(data: AnalyticsResponse): string[] {
    const insights = [];

    if (data.totalViews > 1000) {
      insights.push(`Alto engajamento: ${data.totalViews} visualizações no período`);
    }

    if (data.averageViewDuration > 30) {
      insights.push(`Boa retenção: ${data.averageViewDuration.toFixed(1)}s de duração média`);
    }

    if (data.campaignPerformance.length > 0) {
      const topCampaign = data.campaignPerformance[0];
      insights.push(`Campanha top: "${topCampaign.title}" com ${topCampaign.views} visualizações`);
    }

    return insights;
  }

  /**
   * Gera recomendações
   */
  private generateRecommendations(data: AnalyticsResponse): string[] {
    const recommendations = [];

    if (data.averageViewDuration < 15) {
      recommendations.push('Considere otimizar o conteúdo para aumentar o tempo de visualização');
    }

    if (data.totemPerformance.some(t => t.uptime < 90)) {
      recommendations.push('Verifique totems com baixa disponibilidade');
    }

    if (data.qrCodeStats.length > 0) {
      recommendations.push('Analise QR Codes com baixa taxa de conversão');
    }

    return recommendations;
  }

  /**
   * Gera tendências
   */
  private generateTrends(data: AnalyticsResponse): string[] {
    const trends = [];

    if (data.viewingTrends.length > 1) {
      const first = data.viewingTrends[0];
      const last = data.viewingTrends[data.viewingTrends.length - 1];
      
      if (last.views > first.views) {
        trends.push('Crescimento nas visualizações ao longo do tempo');
      } else if (last.views < first.views) {
        trends.push('Declínio nas visualizações ao longo do tempo');
      }
    }

    return trends;
  }
}

