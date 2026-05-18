/**
 * Analytics Service - Smart Signage v2.0
 * Serviço de análise e relatórios
 */

import { getDatabase } from '../config/database';
import { logError, logWarn } from '../utils/loggerHelper';
import type { TenantScope } from '../utils/tenantScope';
import { isMissingTableError } from '../utils/dbErrors';
import { getAnalyticsCacheService } from './analyticsCacheService';

/** Totens não têm coluna `location`; usar dados do local. */
const sqlTotemLocation = (alias: string): string =>
  `COALESCE(${alias}.name, ${alias}.address, ${alias}.city, 'Não informado')`;

export interface AnalyticsFilters {
  subscriberId?: number;
  totemId?: number;
  campaignId?: number;
  startDate?: string;
  endDate?: string;
  groupBy?: 'day' | 'week' | 'month' | 'year';
  timezone?: string;
  /**
   * Escopo de tenant em agregações (execution_logs.publisher_id / locals).
   * Não enviar para visão global (admin).
   */
  scopedPublisherId?: number;
  /**
   * Escopo de assinante em agregações (execution_logs.subscriber_id / campaigns.subscriber_id).
   */
  scopedSubscriberId?: number;
}

/** @deprecated use TenantScope from utils/tenantScope */
export type DashboardStatsScope = TenantScope;

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

export function emptyAnalyticsResponse(): AnalyticsResponse {
  return {
    totalViews: 0,
    totalDuration: 0,
    averageViewDuration: 0,
    uniqueViewers: 0,
    peakViewingTime: '00:00',
    mostViewedContent: [],
    viewingTrends: [],
    deviceStats: [],
    locationStats: [],
    campaignPerformance: [],
    totemPerformance: [],
    qrCodeStats: [],
    revenue: { total: 0, bySubscriber: [], byCampaign: [] },
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
  async getDashboardStats(clientId?: number, scope?: DashboardStatsScope): Promise<DashboardStats> {
    const cacheKey = this.analyticsCache.getOverviewKey(
      clientId,
      undefined,
      undefined,
      scope?.scopedPublisherId,
      scope?.scopedSubscriberId
    );

    return this.analyticsCache.getOrSet(
      cacheKey,
      async () => {
        return this.fetchDashboardStats(scope);
      },
      300 // Cache por 5 minutos
    );
  }

  /**
   * Busca estatísticas gerais do dashboard (sem cache)
   */
  private async fetchDashboardStats(scope?: DashboardStatsScope): Promise<DashboardStats> {
    try {
      const pub = scope?.scopedPublisherId;
      const sub = scope?.scopedSubscriberId;

      if (pub != null && pub < 0) {
        return this.emptyScopedDashboard();
      }
      if (sub != null && sub < 0) {
        return this.emptyScopedDashboard();
      }

      if (pub != null) {
        return await this.fetchDashboardStatsForPublisher(pub);
      }
      if (sub != null) {
        return await this.fetchDashboardStatsForSubscriber(sub);
      }

      return await this.fetchDashboardStatsGlobal();
    } catch (error: any) {
      await logError('Erro ao buscar estatísticas do dashboard', error);
      throw new Error('Erro interno do servidor');
    }
  }

  private emptyScopedDashboard(): DashboardStats {
    return {
      overview: {
        totalClients: 0,
        totalTotems: 0,
        totalCampaigns: 0,
        totalMedia: 0,
        totalViews: 0,
        totalRevenue: 0,
        activeUsers: 0,
        systemUptime: 0
      },
      recentActivity: {
        newClients: 0,
        newCampaigns: 0,
        newMedia: 0,
        newViews: 0,
        newRevenue: 0
      },
      performance: {
        topCampaigns: [],
        topTotems: [],
        topMedia: []
      },
      alerts: []
    };
  }

  private async fetchDashboardStatsForPublisher(publisherId: number): Promise<DashboardStats> {
    const pid = publisherId;
    const recentWindow = `CURRENT_TIMESTAMP - INTERVAL '7 days'`;

    const totalClients = await this.db.findFirst(
      `
      SELECT COUNT(DISTINCT sc.subscriber_id)::int AS count
      FROM subscriber_contracts sc
      INNER JOIN plan_publisher_access ppa ON ppa.plan_id = sc.plan_id
        AND ppa.publisher_id = ?
        AND ppa.is_allowed = true
        AND COALESCE(ppa.is_active, true) = true
      WHERE sc.status = 'active'
        AND (sc.end_date IS NULL OR sc.end_date >= CURRENT_DATE)
        AND (sc.start_date IS NULL OR sc.start_date <= CURRENT_DATE)
    `,
      [pid]
    );

    const totalTotems = await this.db.findFirst(
      `
      SELECT COUNT(*)::int AS count FROM totems t
      INNER JOIN locals l ON l.local_id = t.local_id
      WHERE t.is_active = true AND l.publisher_id = ?
    `,
      [pid]
    );

    const totalCampaigns = await this.db.findFirst(
      `
      SELECT COUNT(DISTINCT cp.campaign_id)::int AS count
      FROM campaign_publishers cp
      WHERE cp.publisher_id = ? AND COALESCE(cp.is_active, true) = true
    `,
      [pid]
    );

    const totalMedia = await this.db.findFirst(
      `
      SELECT COUNT(DISTINCT el.media_id)::int AS count
      FROM execution_logs el
      WHERE el.publisher_id = ? AND el.media_id IS NOT NULL
    `,
      [pid]
    );

    const totalViews = await this.db.findFirst(
      `
      SELECT COUNT(*)::int AS count
      FROM execution_logs el
      WHERE el.event_type = 'play_end' AND el.publisher_id = ?
    `,
      [pid]
    );

    const activeUsers = await this.db.findFirst(`
      SELECT COUNT(*)::int AS count FROM users WHERE is_active = true
    `);

    const onlineTotems = await this.db.findFirst(
      `
      SELECT COUNT(*)::int AS count FROM totems t
      INNER JOIN locals l ON l.local_id = t.local_id
      WHERE t.is_active = true AND t.status = 'online' AND l.publisher_id = ?
    `,
      [pid]
    );

    const systemUptime =
      totalTotems?.count && totalTotems.count > 0
        ? Math.round(((onlineTotems?.count || 0) / totalTotems.count) * 100)
        : 0;

    const newClients = await this.db.findFirst(
      `
      SELECT COUNT(DISTINCT s.subscriber_id)::int AS count
      FROM subscribers s
      INNER JOIN subscriber_contracts sc ON sc.subscriber_id = s.subscriber_id
      INNER JOIN plan_publisher_access ppa ON ppa.plan_id = sc.plan_id
        AND ppa.publisher_id = ?
        AND ppa.is_allowed = true
        AND COALESCE(ppa.is_active, true) = true
      WHERE s.created_at >= ${recentWindow}
    `,
      [pid]
    );

    const newCampaigns = await this.db.findFirst(
      `
      SELECT COUNT(*)::int AS count
      FROM campaigns c
      INNER JOIN campaign_publishers cp ON cp.campaign_id = c.campaign_id AND cp.publisher_id = ?
      WHERE c.created_at >= ${recentWindow}
    `,
      [pid]
    );

    const newMedia = await this.db.findFirst(
      `
      SELECT COUNT(DISTINCT el.media_id)::int AS count
      FROM execution_logs el
      WHERE el.publisher_id = ? AND el.media_id IS NOT NULL AND el.timestamp >= ${recentWindow}
    `,
      [pid]
    );

    const newViews = await this.db.findFirst(
      `
      SELECT COUNT(*)::int AS count
      FROM execution_logs el
      WHERE el.event_type = 'play_end' AND el.publisher_id = ? AND el.timestamp >= ${recentWindow}
    `,
      [pid]
    );

    const topCampaigns = await this.db.findMany(
      `
      SELECT 
        c.campaign_id AS "campaignId",
        c.title,
        COUNT(CASE WHEN el.event_type = 'play_end' THEN 1 END)::int AS views,
        COALESCE(SUM((el.event_data->>'duration')::int), 0)::int AS duration
      FROM campaigns c
      INNER JOIN campaign_publishers cp ON cp.campaign_id = c.campaign_id AND cp.publisher_id = ?
      LEFT JOIN execution_logs el ON el.campaign_id = c.campaign_id AND el.event_type = 'play_end'
      GROUP BY c.campaign_id, c.title
      ORDER BY views DESC
      LIMIT 5
    `,
      [pid]
    );

    const topTotems = await this.db.findMany(
      `
      SELECT 
        t.totem_id AS "totemId",
        t.name,
        ${sqlTotemLocation('l')} AS location,
        COUNT(CASE WHEN el.event_type = 'play_end' THEN 1 END)::int AS views,
        CASE 
          WHEN COUNT(el.log_id) > 0 THEN 
            (COUNT(CASE WHEN el.event_type = 'play_end' THEN 1 END)::float / COUNT(el.log_id) * 100)
          ELSE 0
        END AS effectiveness
      FROM totems t
      INNER JOIN locals l ON l.local_id = t.local_id AND l.publisher_id = ?
      LEFT JOIN execution_logs el ON el.totem_id = t.totem_id
      WHERE t.is_active = true
      GROUP BY t.totem_id, t.name, l.name, l.address, l.city
      ORDER BY views DESC
      LIMIT 5
    `,
      [pid]
    );

    const topMedia = await this.db.findMany(
      `
      SELECT 
        m.media_id AS "mediaId",
        m.title,
        COUNT(CASE WHEN el.event_type = 'play_end' THEN 1 END)::int AS views,
        COALESCE(SUM((el.event_data->>'duration')::int), 0)::int AS duration
      FROM execution_logs el
      INNER JOIN medias m ON m.media_id = el.media_id
      WHERE el.publisher_id = ? AND el.event_type = 'play_end'
      GROUP BY m.media_id, m.title
      ORDER BY views DESC
      LIMIT 5
    `,
      [pid]
    );

    const alerts = await this.getSystemAlerts({ scopedPublisherId: pid });

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
  }

  private async fetchDashboardStatsForSubscriber(subscriberId: number): Promise<DashboardStats> {
    const sid = subscriberId;
    const recentWindow = `CURRENT_TIMESTAMP - INTERVAL '7 days'`;

    const totalClients = await this.db.findFirst(
      `
      SELECT CASE WHEN EXISTS(SELECT 1 FROM subscribers WHERE subscriber_id = ? AND is_active = true) THEN 1 ELSE 0 END::int AS count
    `,
      [sid]
    );

    const totalTotems = await this.db.findFirst(
      `
      SELECT COUNT(DISTINCT t.totem_id)::int AS count
      FROM totems t
      INNER JOIN locals l ON l.local_id = t.local_id
      INNER JOIN subscriber_contracts sc ON sc.subscriber_id = ?
        AND sc.status = 'active'
        AND (sc.end_date IS NULL OR sc.end_date >= CURRENT_DATE)
        AND (sc.start_date IS NULL OR sc.start_date <= CURRENT_DATE)
      INNER JOIN plan_publisher_access ppa ON ppa.plan_id = sc.plan_id
        AND ppa.publisher_id = l.publisher_id
        AND ppa.is_allowed = true
        AND COALESCE(ppa.is_active, true) = true
    `,
      [sid]
    );

    const totalCampaigns = await this.db.findFirst(
      `
      SELECT COUNT(*)::int AS count FROM campaigns WHERE subscriber_id = ? AND is_active = true
    `,
      [sid]
    );

    const totalMedia = await this.db.findFirst(
      `
      SELECT COUNT(*)::int AS count FROM medias WHERE subscriber_id = ?
    `,
      [sid]
    );

    const totalViews = await this.db.findFirst(
      `
      SELECT COUNT(*)::int AS count
      FROM execution_logs el
      WHERE el.event_type = 'play_end' AND el.subscriber_id = ?
    `,
      [sid]
    );

    const activeUsers = await this.db.findFirst(`
      SELECT COUNT(*)::int AS count FROM users WHERE is_active = true
    `);

    const onlineTotems = await this.db.findFirst(
      `
      SELECT COUNT(DISTINCT t.totem_id)::int AS count
      FROM totems t
      INNER JOIN locals l ON l.local_id = t.local_id
      INNER JOIN subscriber_contracts sc ON sc.subscriber_id = ?
        AND sc.status = 'active'
      INNER JOIN plan_publisher_access ppa ON ppa.plan_id = sc.plan_id AND ppa.publisher_id = l.publisher_id
      WHERE t.is_active = true AND t.status = 'online'
    `,
      [sid]
    );

    const systemUptime =
      totalTotems?.count && totalTotems.count > 0
        ? Math.round(((onlineTotems?.count || 0) / totalTotems.count) * 100)
        : 0;

    const newClients = await this.db.findFirst(
      `
      SELECT COUNT(*)::int AS count FROM subscribers WHERE subscriber_id = ? AND created_at >= ${recentWindow}
    `,
      [sid]
    );

    const newCampaigns = await this.db.findFirst(
      `
      SELECT COUNT(*)::int AS count FROM campaigns WHERE subscriber_id = ? AND created_at >= ${recentWindow}
    `,
      [sid]
    );

    const newMedia = await this.db.findFirst(
      `
      SELECT COUNT(*)::int AS count FROM medias WHERE subscriber_id = ? AND created_at >= ${recentWindow}
    `,
      [sid]
    );

    const newViews = await this.db.findFirst(
      `
      SELECT COUNT(*)::int AS count
      FROM execution_logs el
      WHERE el.event_type = 'play_end' AND el.subscriber_id = ? AND el.timestamp >= ${recentWindow}
    `,
      [sid]
    );

    const topCampaigns = await this.db.findMany(
      `
      SELECT 
        c.campaign_id AS "campaignId",
        c.title,
        COUNT(CASE WHEN el.event_type = 'play_end' THEN 1 END)::int AS views,
        COALESCE(SUM((el.event_data->>'duration')::int), 0)::int AS duration
      FROM campaigns c
      LEFT JOIN execution_logs el ON el.campaign_id = c.campaign_id AND el.event_type = 'play_end'
      WHERE c.subscriber_id = ?
      GROUP BY c.campaign_id, c.title
      ORDER BY views DESC
      LIMIT 5
    `,
      [sid]
    );

    const topTotems = await this.db.findMany(
      `
      SELECT 
        t.totem_id AS "totemId",
        t.name,
        ${sqlTotemLocation('loc')} AS location,
        COUNT(CASE WHEN el.event_type = 'play_end' THEN 1 END)::int AS views,
        CASE 
          WHEN COUNT(el.log_id) > 0 THEN 
            (COUNT(CASE WHEN el.event_type = 'play_end' THEN 1 END)::float / COUNT(el.log_id) * 100)
          ELSE 0
        END AS effectiveness
      FROM execution_logs el
      INNER JOIN totems t ON t.totem_id = el.totem_id
      LEFT JOIN locals loc ON loc.local_id = t.local_id
      WHERE el.subscriber_id = ? AND el.event_type = 'play_end'
      GROUP BY t.totem_id, t.name, loc.name, loc.address, loc.city
      ORDER BY views DESC
      LIMIT 5
    `,
      [sid]
    );

    const topMedia = await this.db.findMany(
      `
      SELECT 
        m.media_id AS "mediaId",
        m.title,
        COUNT(CASE WHEN el.event_type = 'play_end' THEN 1 END)::int AS views,
        COALESCE(SUM((el.event_data->>'duration')::int), 0)::int AS duration
      FROM medias m
      LEFT JOIN execution_logs el ON el.media_id = m.media_id AND el.event_type = 'play_end' AND el.subscriber_id = ?
      WHERE m.subscriber_id = ?
      GROUP BY m.media_id, m.title
      ORDER BY views DESC
      LIMIT 5
    `,
      [sid, sid]
    );

    const alerts = await this.getSystemAlerts({ scopedSubscriberId: sid });

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
  }

  private async fetchDashboardStatsGlobal(): Promise<DashboardStats> {
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
        ${sqlTotemLocation('loc')} AS location,
        COUNT(CASE WHEN el.event_type = 'play_end' THEN 1 END)::int AS views,
        CASE 
          WHEN COUNT(el.log_id) > 0 THEN 
            (COUNT(CASE WHEN el.event_type = 'play_end' THEN 1 END)::float / COUNT(el.log_id) * 100)
          ELSE 0
        END AS effectiveness
      FROM totems t
      LEFT JOIN locals loc ON loc.local_id = t.local_id
      LEFT JOIN execution_logs el ON el.totem_id = t.totem_id
      WHERE t.is_active = true
      GROUP BY t.totem_id, t.name, loc.name, loc.address, loc.city
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
  }

  /**
   * Busca análise detalhada com filtros (com cache de 5 minutos)
   */
  async getAnalytics(filters: AnalyticsFilters): Promise<AnalyticsResponse> {
    // Gerar chave de cache baseada nos filtros
    const cacheKey = this.generateAnalyticsCacheKey(filters);
    
    // Usar cache-aside pattern: tentar obter do cache, se não existir, buscar e armazenar
    return this.analyticsCache.getOrSet(
      cacheKey,
      async () => {
        return this.fetchAnalytics(filters);
      },
      300 // Cache por 5 minutos (300 segundos)
    );
  }

  /**
   * Gera chave de cache para analytics baseada nos filtros
   */
  private generateAnalyticsCacheKey(filters: AnalyticsFilters): string {
    const parts = ['analytics', 'detailed'];
    if (filters.subscriberId) parts.push(`subscriber:${filters.subscriberId}`);
    if (filters.scopedPublisherId !== undefined && filters.scopedPublisherId !== null) {
      parts.push(`pubScope:${filters.scopedPublisherId}`);
    }
    if (filters.scopedSubscriberId !== undefined && filters.scopedSubscriberId !== null) {
      parts.push(`subScope:${filters.scopedSubscriberId}`);
    }
    if (filters.totemId) parts.push(`totem:${filters.totemId}`);
    if (filters.campaignId) parts.push(`campaign:${filters.campaignId}`);
    if (filters.startDate) parts.push(`start:${filters.startDate}`);
    if (filters.endDate) parts.push(`end:${filters.endDate}`);
    if (filters.groupBy) parts.push(`groupBy:${filters.groupBy}`);
    return parts.join(':');
  }

  /**
   * Busca análise detalhada com filtros (sem cache - método interno)
   */
  private async fetchAnalytics(filters: AnalyticsFilters): Promise<AnalyticsResponse> {
    try {
      const {
        totemId,
        campaignId,
        startDate,
        endDate,
        groupBy = 'day',
        scopedPublisherId,
        scopedSubscriberId
      } = filters;

      let whereClause = 'WHERE 1=1';
      const params: any[] = [];

      if (totemId) {
        whereClause += ' AND el.totem_id = ?';
        params.push(totemId);
      }
      if (campaignId) {
        whereClause += ' AND el.campaign_id = ?';
        params.push(campaignId);
      }
      whereClause += ' AND el.event_type = \'play_end\'';

      if (startDate) {
        whereClause += ' AND el.timestamp >= ?';
        params.push(startDate);
      }
      if (endDate) {
        whereClause += ' AND el.timestamp <= ?';
        params.push(endDate);
      }

      if (scopedPublisherId != null && scopedPublisherId !== undefined) {
        whereClause += ' AND el.publisher_id = ?';
        params.push(scopedPublisherId);
      }
      if (scopedSubscriberId != null && scopedSubscriberId !== undefined) {
        whereClause += ' AND el.subscriber_id = ?';
        params.push(scopedSubscriberId);
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
          ${sqlTotemLocation('loc')} AS location,
          COUNT(*)::int AS views
        FROM execution_logs el
        LEFT JOIN totems t ON t.totem_id = el.totem_id
        LEFT JOIN locals loc ON loc.local_id = t.local_id
        ${whereClause}
        GROUP BY loc.name, loc.address, loc.city
        ORDER BY views DESC
      `, params);

      const totalLocationViews = locationStatsRows.reduce((acc, row) => acc + (row.views || 0), 0) || 1;
      const locationStats = locationStatsRows.map(row => ({
        location: row.location,
        views: row.views,
        percentage: Math.round((row.views / totalLocationViews) * 100)
      }));

      const campaignWhereClause = whereClause.replace(' AND el.event_type = \'play_end\'', '');
      let campaignWhereForJoin = campaignWhereClause;
      let campaignParams = [...params];
      if (scopedSubscriberId != null && scopedSubscriberId !== undefined) {
        campaignWhereForJoin += ' AND c.subscriber_id = ?';
        campaignParams.push(scopedSubscriberId);
      }

      let campaignPerformance: any[];
      if (scopedPublisherId != null && scopedPublisherId !== undefined) {
        campaignPerformance = await this.db.findMany(
          `
        SELECT 
          c.campaign_id AS "campaignId",
          c.title,
          COUNT(CASE WHEN el.event_type = 'play_end' THEN 1 END)::int AS views,
          COALESCE(SUM(CASE WHEN el.event_type = 'play_end' THEN (el.event_data->>'duration')::int ELSE 0 END), 0)::int AS duration
        FROM campaigns c
        INNER JOIN campaign_publishers cp ON cp.campaign_id = c.campaign_id AND cp.publisher_id = ? AND COALESCE(cp.is_active, true) = true
        LEFT JOIN execution_logs el ON el.campaign_id = c.campaign_id ${campaignWhereForJoin}
        GROUP BY c.campaign_id, c.title
        ORDER BY views DESC
        LIMIT 10
      `,
          [scopedPublisherId, ...campaignParams]
        );
      } else {
        campaignPerformance = await this.db.findMany(
          `
        SELECT 
          c.campaign_id AS "campaignId",
          c.title,
          COUNT(CASE WHEN el.event_type = 'play_end' THEN 1 END)::int AS views,
          COALESCE(SUM(CASE WHEN el.event_type = 'play_end' THEN (el.event_data->>'duration')::int ELSE 0 END), 0)::int AS duration
        FROM campaigns c
        LEFT JOIN execution_logs el ON el.campaign_id = c.campaign_id ${campaignWhereForJoin}
        GROUP BY c.campaign_id, c.title
        ORDER BY views DESC
        LIMIT 10
      `,
          campaignParams
        );
      }

      const totemWhereClause = whereClause.replace(' AND el.event_type = \'play_end\'', '');
      let totemPerformance: any[];
      if (scopedPublisherId != null && scopedPublisherId !== undefined) {
        totemPerformance = await this.db.findMany(
          `
        SELECT 
          t.totem_id AS "totemId",
          COALESCE(t.name, CONCAT('Totem ', t.totem_id::text)) AS name,
          ${sqlTotemLocation('loc')} AS location,
          COUNT(CASE WHEN el.event_type = 'play_end' THEN 1 END)::int AS views,
          COALESCE(SUM(CASE WHEN el.event_type = 'play_end' THEN (el.event_data->>'duration')::int ELSE 0 END), 0)::int AS duration,
          CASE 
            WHEN COUNT(el.log_id) > 0 THEN 
              (COUNT(CASE WHEN el.event_type = 'play_end' THEN 1 END)::float / COUNT(el.log_id) * 100)
            ELSE 0
          END AS effectiveness
        FROM totems t
        INNER JOIN locals loc ON loc.local_id = t.local_id AND loc.publisher_id = ?
        LEFT JOIN execution_logs el ON el.totem_id = t.totem_id ${totemWhereClause}
        GROUP BY t.totem_id, t.name, loc.name, loc.address, loc.city
        ORDER BY views DESC
        LIMIT 10
      `,
          [scopedPublisherId, ...params]
        );
      } else if (scopedSubscriberId != null && scopedSubscriberId !== undefined) {
        totemPerformance = await this.db.findMany(
          `
        SELECT 
          t.totem_id AS "totemId",
          COALESCE(t.name, CONCAT('Totem ', t.totem_id::text)) AS name,
          ${sqlTotemLocation('loc')} AS location,
          COUNT(CASE WHEN el.event_type = 'play_end' THEN 1 END)::int AS views,
          COALESCE(SUM(CASE WHEN el.event_type = 'play_end' THEN (el.event_data->>'duration')::int ELSE 0 END), 0)::int AS duration,
          CASE 
            WHEN COUNT(el.log_id) > 0 THEN 
              (COUNT(CASE WHEN el.event_type = 'play_end' THEN 1 END)::float / COUNT(el.log_id) * 100)
            ELSE 0
          END AS effectiveness
        FROM execution_logs el
        INNER JOIN totems t ON t.totem_id = el.totem_id
        LEFT JOIN locals loc ON loc.local_id = t.local_id
        ${whereClause}
        GROUP BY t.totem_id, t.name, loc.name, loc.address, loc.city
        ORDER BY views DESC
        LIMIT 10
      `,
          params
        );
      } else {
        totemPerformance = await this.db.findMany(
          `
        SELECT 
          t.totem_id AS "totemId",
          COALESCE(t.name, CONCAT('Totem ', t.totem_id::text)) AS name,
          ${sqlTotemLocation('loc')} AS location,
          COUNT(CASE WHEN el.event_type = 'play_end' THEN 1 END)::int AS views,
          COALESCE(SUM(CASE WHEN el.event_type = 'play_end' THEN (el.event_data->>'duration')::int ELSE 0 END), 0)::int AS duration,
          CASE 
            WHEN COUNT(el.log_id) > 0 THEN 
              (COUNT(CASE WHEN el.event_type = 'play_end' THEN 1 END)::float / COUNT(el.log_id) * 100)
            ELSE 0
          END AS effectiveness
        FROM totems t
        LEFT JOIN locals loc ON loc.local_id = t.local_id
        LEFT JOIN execution_logs el ON el.totem_id = t.totem_id ${totemWhereClause}
        GROUP BY t.totem_id, t.name, loc.name, loc.address, loc.city
        ORDER BY views DESC
        LIMIT 10
      `,
          params
        );
      }

      // qr_codes.campaign_id → escopo por publisher (campaign_publishers) ou assinante (campaigns.subscriber_id)
      const qrExtra: string[] = [];
      const qrBaseParams: any[] = [];
      if (startDate) {
        qrExtra.push('q.last_scan_at >= ?');
        qrBaseParams.push(startDate);
      }
      if (endDate) {
        qrExtra.push('q.last_scan_at <= ?');
        qrBaseParams.push(endDate);
      }
      if (campaignId) {
        qrExtra.push('q.campaign_id = ?');
        qrBaseParams.push(campaignId);
      }
      const qrExtraSql = qrExtra.length ? ` AND ${qrExtra.join(' AND ')}` : '';

      let qrCodeStatsRows: any[];
      if (scopedPublisherId != null && scopedPublisherId !== undefined) {
        qrCodeStatsRows = await this.db.findMany(
          `
        SELECT 
          q.qr_id AS "qrCodeId",
          COALESCE(q.title, q.content, 'QR Code') AS title,
          q.scan_count::int AS scans
        FROM qr_codes q
        INNER JOIN campaign_publishers cp ON cp.campaign_id = q.campaign_id
          AND cp.publisher_id = ?
          AND COALESCE(cp.is_active, true) = true
        WHERE q.scan_count > 0${qrExtraSql}
        ORDER BY q.scan_count DESC
        LIMIT 10
      `,
          [scopedPublisherId, ...qrBaseParams]
        );
      } else if (scopedSubscriberId != null && scopedSubscriberId !== undefined) {
        qrCodeStatsRows = await this.db.findMany(
          `
        SELECT 
          q.qr_id AS "qrCodeId",
          COALESCE(q.title, q.content, 'QR Code') AS title,
          q.scan_count::int AS scans
        FROM qr_codes q
        INNER JOIN campaigns c ON c.campaign_id = q.campaign_id AND c.subscriber_id = ?
        WHERE q.scan_count > 0${qrExtraSql}
        ORDER BY q.scan_count DESC
        LIMIT 10
      `,
          [scopedSubscriberId, ...qrBaseParams]
        );
      } else {
        qrCodeStatsRows = await this.db.findMany(
          `
        SELECT 
          q.qr_id AS "qrCodeId",
          COALESCE(q.title, q.content, 'QR Code') AS title,
          q.scan_count::int AS scans
        FROM qr_codes q
        WHERE q.scan_count > 0${qrExtraSql}
        ORDER BY q.scan_count DESC
        LIMIT 10
      `,
          qrBaseParams
        );
      }

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
      throw error;
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
          ${sqlTotemLocation('loc')} as location,
          t.uin,
          t.is_active as isActive,
          t.last_heartbeat as lastHeartbeat,
          t.created_at as createdAt
        FROM totems t
        LEFT JOIN locals loc ON loc.local_id = t.local_id
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
        bySubscriber: [],
        byCampaign: []
      };
    } catch (error: any) {
      await logError('Erro ao buscar estatísticas de receita', error);
      return {
        total: 0,
        bySubscriber: [],
        byCampaign: []
      };
    }
  }

  /**
   * Busca alertas do sistema
   */
  private async getSystemAlerts(scope?: DashboardStatsScope): Promise<{
    type: 'warning' | 'error' | 'info';
    message: string;
    timestamp: string;
  }[]> {
    try {
      const alerts = [];

      let offlineTotems: { count?: number } | null;
      if (scope?.scopedPublisherId != null && scope.scopedPublisherId > 0) {
        offlineTotems = await this.db.findFirst(
          `
        SELECT COUNT(*)::int AS count 
        FROM totems t
        INNER JOIN locals l ON l.local_id = t.local_id
        WHERE l.publisher_id = ? AND t.is_active = true 
          AND (
            t.last_heartbeat IS NULL 
            OR t.last_heartbeat < NOW() - INTERVAL '5 minutes'
          )
      `,
          [scope.scopedPublisherId]
        );
      } else if (scope?.scopedSubscriberId != null && scope.scopedSubscriberId > 0) {
        offlineTotems = await this.db.findFirst(
          `
        SELECT COUNT(DISTINCT t.totem_id)::int AS count
        FROM totems t
        INNER JOIN locals l ON l.local_id = t.local_id
        INNER JOIN subscriber_contracts sc ON sc.subscriber_id = ?
          AND sc.status = 'active'
        INNER JOIN plan_publisher_access ppa ON ppa.plan_id = sc.plan_id
          AND ppa.publisher_id = l.publisher_id
          AND ppa.is_allowed = true
          AND COALESCE(ppa.is_active, true) = true
        WHERE t.is_active = true 
          AND (
            t.last_heartbeat IS NULL 
            OR t.last_heartbeat < NOW() - INTERVAL '5 minutes'
          )
      `,
          [scope.scopedSubscriberId]
        );
      } else {
        offlineTotems = await this.db.findFirst(`
        SELECT COUNT(*)::int AS count 
        FROM totems 
        WHERE is_active = true 
          AND (
            last_heartbeat IS NULL 
            OR last_heartbeat < NOW() - INTERVAL '5 minutes'
          )
      `);
      }

      if (offlineTotems?.count && offlineTotems.count > 0) {
        alerts.push({
          type: 'warning' as const,
          message: `${offlineTotems.count} totem(s) offline`,
          timestamp: new Date().toISOString()
        });
      }

      let expiredCampaigns: { count?: number | string } | null;
      if (scope?.scopedPublisherId != null && scope.scopedPublisherId > 0) {
        expiredCampaigns = await this.db.findFirst(
          `
        SELECT COUNT(DISTINCT c.campaign_id) as count FROM campaigns c
        INNER JOIN campaign_publishers cp ON cp.campaign_id = c.campaign_id AND cp.publisher_id = ?
        WHERE c.is_active = true AND c.end_date < CURRENT_TIMESTAMP
      `,
          [scope.scopedPublisherId]
        );
      } else if (scope?.scopedSubscriberId != null && scope.scopedSubscriberId > 0) {
        expiredCampaigns = await this.db.findFirst(
          `
        SELECT COUNT(*) as count FROM campaigns 
        WHERE subscriber_id = ? AND is_active = true AND end_date < CURRENT_TIMESTAMP
      `,
          [scope.scopedSubscriberId]
        );
      } else {
        expiredCampaigns = await this.db.findFirst(`
        SELECT COUNT(*) as count FROM campaigns 
        WHERE is_active = true AND end_date < CURRENT_TIMESTAMP
      `);
      }

      if (Number(expiredCampaigns?.count) > 0) {
        alerts.push({
          type: 'info' as const,
          message: `${expiredCampaigns?.count} campanha(s) expirada(s)`,
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

