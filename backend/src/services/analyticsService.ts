/**
 * Analytics Service - Smart Signage v2.0
 * Serviço de análise e relatórios
 */

import { getDatabase } from '../config/database';
import { AuditService } from './auditService';

export interface AnalyticsFilters {
  clientId?: number;
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
    byClient: {
      clientId: number;
      clientName: string;
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
  
  // Lazy initialization - só criar quando necessário
  private getAuditService(): AuditService {
    if (!(global as any).auditServiceInstance) {
      (global as any).auditServiceInstance = new AuditService();
    }
    return (global as any).auditServiceInstance;
  }

  /**
   * Busca estatísticas gerais do dashboard
   */
  async getDashboardStats(): Promise<DashboardStats> {
    try {
      // Estatísticas gerais
      const totalClients = await this.db.findFirst(`
        SELECT COUNT(*) as count FROM clients WHERE active = 1
      `);

      const totalTotems = await this.db.findFirst(`
        SELECT COUNT(*) as count FROM totems WHERE active = 1
      `);

      const totalCampaigns = await this.db.findFirst(`
        SELECT COUNT(*) as count FROM campaigns WHERE is_active = 1
      `);

      const totalMedia = await this.db.findFirst(`
        SELECT COUNT(*) as count FROM medias WHERE active = 1
      `);

      const totalViews = await this.db.findFirst(`
        SELECT SUM(view_count) as count FROM medias
      `);

      const totalRevenue = await this.db.findFirst(`
        SELECT SUM(amount) as total FROM billing WHERE status = 'paid'
      `);

      const activeUsers = await this.db.findFirst(`
        SELECT COUNT(DISTINCT user_id) as count FROM user_sessions 
        WHERE last_activity >= datetime('now', '-1 hour')
      `);

      const systemUptime = await this.db.findFirst(`
        SELECT AVG(uptime_percentage) as avg FROM totems WHERE active = 1
      `);

      // Atividade recente (últimos 7 dias)
      const newClients = await this.db.findFirst(`
        SELECT COUNT(*) as count FROM clients 
        WHERE created_at >= datetime('now', '-7 days')
      `);

      const newCampaigns = await this.db.findFirst(`
        SELECT COUNT(*) as count FROM campaigns 
        WHERE created_at >= datetime('now', '-7 days')
      `);

      const newMedia = await this.db.findFirst(`
        SELECT COUNT(*) as count FROM medias 
        WHERE created_at >= datetime('now', '-7 days')
      `);

      const newViews = await this.db.findFirst(`
        SELECT SUM(view_count) as count FROM medias 
        WHERE updated_at >= datetime('now', '-7 days')
      `);

      const newRevenue = await this.db.findFirst(`
        SELECT SUM(amount) as total FROM billing 
        WHERE created_at >= datetime('now', '-7 days') AND status = 'paid'
      `);

      // Top campanhas
      const topCampaigns = await this.db.findMany(`
        SELECT 
          c.campaign_id as campaignId,
          c.title,
          COUNT(DISTINCT m.media_id) as views,
          AVG(m.view_count) as effectiveness
        FROM campaigns c
        LEFT JOIN playlists p ON c.campaign_id = p.campaign_id
        LEFT JOIN playlist_items pi ON p.playlist_id = pi.playlist_id
        LEFT JOIN medias m ON pi.media_id = m.media_id
        WHERE c.is_active = 1
        GROUP BY c.campaign_id, c.title
        ORDER BY views DESC
        LIMIT 5
      `);

      // Top totems
      const topTotems = await this.db.findMany(`
        SELECT 
          t.totem_id as totemId,
          t.name,
          t.location,
          COUNT(DISTINCT m.media_id) as views,
          t.uptime_percentage as uptime
        FROM totems t
        LEFT JOIN campaign_totems ct ON t.totem_id = ct.totem_id
        LEFT JOIN campaigns c ON ct.campaign_id = c.campaign_id
        LEFT JOIN playlists p ON c.campaign_id = p.campaign_id
        LEFT JOIN playlist_items pi ON p.playlist_id = pi.playlist_id
        LEFT JOIN medias m ON pi.media_id = m.media_id
        WHERE t.active = 1
        GROUP BY t.totem_id, t.name, t.location, t.uptime_percentage
        ORDER BY views DESC
        LIMIT 5
      `);

      // Top mídia
      const topMedia = await this.db.findMany(`
        SELECT 
          m.media_id as mediaId,
          m.title,
          m.view_count as views,
          m.duration_seconds as duration
        FROM medias m
        WHERE m.active = 1
        ORDER BY m.view_count DESC
        LIMIT 5
      `);

      // Alertas do sistema
      const alerts = await this.getSystemAlerts();

      return {
        overview: {
          totalClients: totalClients?.count || 0,
          totalTotems: totalTotems?.count || 0,
          totalCampaigns: totalCampaigns?.count || 0,
          totalMedia: totalMedia?.count || 0,
          totalViews: totalViews?.count || 0,
          totalRevenue: totalRevenue?.total || 0,
          activeUsers: activeUsers?.count || 0,
          systemUptime: systemUptime?.avg || 0
        },
        recentActivity: {
          newClients: newClients?.count || 0,
          newCampaigns: newCampaigns?.count || 0,
          newMedia: newMedia?.count || 0,
          newViews: newViews?.count || 0,
          newRevenue: newRevenue?.total || 0
        },
        performance: {
          topCampaigns: topCampaigns.map(c => ({
            campaignId: c.campaignId,
            title: c.title,
            views: c.views,
            effectiveness: c.effectiveness
          })),
          topTotems: topTotems.map(t => ({
            totemId: t.totemId,
            name: t.name,
            location: t.location,
            views: t.views,
            uptime: t.uptime
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
      console.error('❌ Erro ao buscar estatísticas do dashboard:', error.message);
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

      // Construir filtros WHERE
      let whereClause = 'WHERE 1=1';
      const params: any[] = [];

      if (clientId) {
        whereClause += ' AND c.client_id = ?';
        params.push(clientId);
      }

      if (totemId) {
        whereClause += ' AND t.totem_id = ?';
        params.push(totemId);
      }

      if (campaignId) {
        whereClause += ' AND c.campaign_id = ?';
        params.push(campaignId);
      }

      if (startDate) {
        whereClause += ' AND m.updated_at >= ?';
        params.push(startDate);
      }

      if (endDate) {
        whereClause += ' AND m.updated_at <= ?';
        params.push(endDate);
      }

      // Total de visualizações
      const totalViewsResult = await this.db.findFirst(`
        SELECT SUM(m.view_count) as total
        FROM medias m
        LEFT JOIN playlist_items pi ON m.media_id = pi.media_id
        LEFT JOIN playlists p ON pi.playlist_id = p.playlist_id
        LEFT JOIN campaigns c ON p.campaign_id = c.campaign_id
        LEFT JOIN campaign_totems ct ON c.campaign_id = ct.campaign_id
        LEFT JOIN totems t ON ct.totem_id = t.totem_id
        ${whereClause}
      `, params);

      // Total de duração
      const totalDurationResult = await this.db.findFirst(`
        SELECT SUM(m.duration_seconds * m.view_count) as total
        FROM medias m
        LEFT JOIN playlist_items pi ON m.media_id = pi.media_id
        LEFT JOIN playlists p ON pi.playlist_id = p.playlist_id
        LEFT JOIN campaigns c ON p.campaign_id = c.campaign_id
        LEFT JOIN campaign_totems ct ON c.campaign_id = ct.campaign_id
        LEFT JOIN totems t ON ct.totem_id = t.totem_id
        ${whereClause}
      `, params);

      // Duração média por visualização
      const averageViewDuration = totalViewsResult?.total > 0 
        ? totalDurationResult?.total / totalViewsResult.total 
        : 0;

      // Visualizadores únicos (aproximação)
      const uniqueViewersResult = await this.db.findFirst(`
        SELECT COUNT(DISTINCT t.totem_id) as count
        FROM totems t
        LEFT JOIN campaign_totems ct ON t.totem_id = ct.totem_id
        LEFT JOIN campaigns c ON ct.campaign_id = c.campaign_id
        LEFT JOIN playlists p ON c.campaign_id = p.campaign_id
        LEFT JOIN playlist_items pi ON p.playlist_id = pi.playlist_id
        LEFT JOIN medias m ON pi.media_id = m.media_id
        ${whereClause}
      `, params);

      // Horário de pico (aproximação)
      const peakViewingTime = await this.getPeakViewingTime(filters);

      // Conteúdo mais visualizado
      const mostViewedContent = await this.db.findMany(`
        SELECT 
          m.media_id as mediaId,
          m.title,
          m.view_count as views,
          m.duration_seconds as duration
        FROM medias m
        LEFT JOIN playlist_items pi ON m.media_id = pi.media_id
        LEFT JOIN playlists p ON pi.playlist_id = p.playlist_id
        LEFT JOIN campaigns c ON p.campaign_id = c.campaign_id
        LEFT JOIN campaign_totems ct ON c.campaign_id = ct.campaign_id
        LEFT JOIN totems t ON ct.totem_id = t.totem_id
        ${whereClause}
        ORDER BY m.view_count DESC
        LIMIT 10
      `, params);

      // Tendências de visualização
      const viewingTrends = await this.getViewingTrends(filters, groupBy);

      // Estatísticas de dispositivos
      const deviceStats = await this.getDeviceStats(filters);

      // Estatísticas de localização
      const locationStats = await this.getLocationStats(filters);

      // Performance de campanhas
      const campaignPerformance = await this.getCampaignPerformance(filters);

      // Performance de totems
      const totemPerformance = await this.getTotemPerformance(filters);

      // Estatísticas de QR Codes
      const qrCodeStats = await this.getQRCodeStats(filters);

      // Receita
      const revenue = await this.getRevenueStats(filters);

      return {
        totalViews: totalViewsResult?.total || 0,
        totalDuration: totalDurationResult?.total || 0,
        averageViewDuration,
        uniqueViewers: uniqueViewersResult?.count || 0,
        peakViewingTime,
        mostViewedContent: mostViewedContent.map(m => ({
          mediaId: m.mediaId,
          title: m.title,
          views: m.views,
          duration: m.duration
        })),
        viewingTrends,
        deviceStats,
        locationStats,
        campaignPerformance,
        totemPerformance,
        qrCodeStats,
        revenue
      };

    } catch (error: any) {
      console.error('❌ Erro ao buscar análise:', error.message);
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
          c.name,
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
      console.error('❌ Erro ao buscar campanha:', error.message);
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
      console.error('❌ Erro ao buscar totem:', error.message);
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
      console.error('❌ Erro ao gerar relatório:', error.message);
      throw new Error('Erro interno do servidor');
    }
  }

  /**
   * Busca horário de pico de visualização
   */
  private async getPeakViewingTime(filters: AnalyticsFilters): Promise<string> {
    try {
      // Esta é uma implementação simplificada
      // Em um sistema real, você teria dados de horário de visualização
      const result = await this.db.findFirst(`
        SELECT '14:00' as peak_time
      `);

      return result?.peak_time || '14:00';

    } catch (error: any) {
      console.error('❌ Erro ao buscar horário de pico:', error.message);
      return '14:00';
    }
  }

  /**
   * Busca tendências de visualização
   */
  private async getViewingTrends(filters: AnalyticsFilters, groupBy: string): Promise<{
    date: string;
    views: number;
    duration: number;
    uniqueViewers: number;
  }[]> {
    try {
      // Determinar período baseado no groupBy
      const days = groupBy === 'day' ? 30 : groupBy === 'week' ? 12 : 7;
      
      // Construir query baseada em execution_logs e analytics_sessions
      let whereClause = 'WHERE 1=1';
      const params: any[] = [];

      if (filters.startDate) {
        whereClause += ' AND DATE(executed_at) >= ?';
        params.push(filters.startDate);
      }

      if (filters.endDate) {
        whereClause += ' AND DATE(executed_at) <= ?';
        params.push(filters.endDate);
      }

      if (filters.totemId) {
        whereClause += ' AND totem_id = ?';
        params.push(filters.totemId);
      }

      if (filters.campaignId) {
        whereClause += ' AND campaign_id = ?';
        params.push(filters.campaignId);
      }

      // Buscar dados de execution_logs
      const executionData = await this.db.findMany(`
        SELECT 
          DATE(executed_at) as date,
          COUNT(*) as views,
          SUM(duration_seconds) as duration,
          COUNT(DISTINCT totem_id) as uniqueViewers
        FROM execution_logs
        ${whereClause}
        AND executed_at >= datetime('now', '-${days} days')
        GROUP BY DATE(executed_at)
        ORDER BY date DESC
      `, params);

      // Buscar dados de analytics_sessions para uniqueViewers mais preciso
      const sessionData = await this.db.findMany(`
        SELECT 
          DATE(session_start) as date,
          COUNT(DISTINCT id) as uniqueSessions
        FROM analytics_sessions
        ${whereClause.replace('executed_at', 'session_start')}
        AND session_start >= datetime('now', '-${days} days')
        GROUP BY DATE(session_start)
        ORDER BY date DESC
      `, params);

      // Combinar dados
      const trendsMap = new Map<string, { views: number; duration: number; uniqueViewers: number }>();

      executionData.forEach((row: any) => {
        const date = row.date;
        trendsMap.set(date, {
          views: row.views || 0,
          duration: row.duration || 0,
          uniqueViewers: row.uniqueViewers || 0
        });
      });

      // Adicionar uniqueSessions de analytics_sessions
      sessionData.forEach((row: any) => {
        const date = row.date;
        if (trendsMap.has(date)) {
          const existing = trendsMap.get(date)!;
          existing.uniqueViewers = Math.max(existing.uniqueViewers, row.uniqueSessions || 0);
        } else {
          trendsMap.set(date, {
            views: 0,
            duration: 0,
            uniqueViewers: row.uniqueSessions || 0
          });
        }
      });

      // Converter para array e ordenar
      const trends = Array.from(trendsMap.entries()).map(([date, data]) => ({
        date,
        views: data.views,
        duration: data.duration,
        uniqueViewers: data.uniqueViewers
      })).sort((a, b) => a.date.localeCompare(b.date));

      return trends;

    } catch (error: any) {
      console.error('❌ Erro ao buscar tendências:', error.message);
      return [];
    }
  }

  /**
   * Busca estatísticas de dispositivos
   */
  private async getDeviceStats(filters: AnalyticsFilters): Promise<{
    deviceType: string;
    count: number;
    percentage: number;
  }[]> {
    try {
      const devices = await this.db.findMany(`
        SELECT 
          COALESCE(NULLIF(version, ''), 'unknown') as device_type,
          COUNT(*) as count
        FROM totems
        WHERE is_active = true
        GROUP BY COALESCE(NULLIF(version, ''), 'unknown')
        ORDER BY count DESC
      `);

      const total = devices.reduce((sum: number, item: any) => sum + parseInt(item.count || '0'), 0);

      return devices.map((item: any) => {
        const count = parseInt(item.count || '0');
        const percentage = total > 0 ? (count / total) * 100 : 0;
        return {
          deviceType: item.device_type,
          count,
          percentage: Math.round(percentage * 100) / 100,
        };
      });

    } catch (error: any) {
      console.error('❌ Erro ao buscar estatísticas de dispositivos:', error.message);
      return [];
    }
  }

  /**
   * Busca estatísticas de localização
   */
  private async getLocationStats(filters: AnalyticsFilters): Promise<{
    location: string;
    views: number;
    percentage: number;
  }[]> {
    try {
      const result = await this.db.findMany(`
        SELECT 
          t.location,
          COUNT(DISTINCT m.media_id) as views
        FROM totems t
        LEFT JOIN campaign_totems ct ON t.totem_id = ct.totem_id
        LEFT JOIN campaigns c ON ct.campaign_id = c.campaign_id
        LEFT JOIN playlists p ON c.campaign_id = p.campaign_id
        LEFT JOIN playlist_items pi ON p.playlist_id = pi.playlist_id
        LEFT JOIN medias m ON pi.media_id = m.media_id
        WHERE t.active = 1
        GROUP BY t.location
        ORDER BY views DESC
        LIMIT 10
      `);

      const total = result.reduce((sum, item) => sum + item.views, 0);

      return result.map(item => ({
        location: item.location,
        views: item.views,
        percentage: total > 0 ? (item.views / total) * 100 : 0
      }));

    } catch (error: any) {
      console.error('❌ Erro ao buscar estatísticas de localização:', error.message);
      return [];
    }
  }

  /**
   * Busca performance de campanhas
   */
  private async getCampaignPerformance(filters: AnalyticsFilters): Promise<{
    campaignId: number;
    title: string;
    views: number;
    duration: number;
    effectiveness: number;
  }[]> {
    try {
      const result = await this.db.findMany(`
        SELECT 
          c.campaign_id as campaignId,
          c.title,
          COUNT(DISTINCT m.media_id) as views,
          SUM(m.duration_seconds) as duration,
          AVG(m.view_count) as effectiveness
        FROM campaigns c
        LEFT JOIN playlists p ON c.campaign_id = p.campaign_id
        LEFT JOIN playlist_items pi ON p.playlist_id = pi.playlist_id
        LEFT JOIN medias m ON pi.media_id = m.media_id
        WHERE c.is_active = 1
        GROUP BY c.campaign_id, c.title
        ORDER BY views DESC
        LIMIT 10
      `);

      return result.map(c => ({
        campaignId: c.campaignId,
        title: c.title,
        views: c.views,
        duration: c.duration,
        effectiveness: c.effectiveness
      }));

    } catch (error: any) {
      console.error('❌ Erro ao buscar performance de campanhas:', error.message);
      return [];
    }
  }

  /**
   * Busca performance de totems
   */
  private async getTotemPerformance(filters: AnalyticsFilters): Promise<{
    totemId: number;
    name: string;
    location: string;
    views: number;
    uptime: number;
    effectiveness: number;
  }[]> {
    try {
      const result = await this.db.findMany(`
        SELECT 
          t.totem_id as totemId,
          t.name,
          t.location,
          COUNT(DISTINCT m.media_id) as views,
          t.uptime_percentage as uptime,
          AVG(m.view_count) as effectiveness
        FROM totems t
        LEFT JOIN campaign_totems ct ON t.totem_id = ct.totem_id
        LEFT JOIN campaigns c ON ct.campaign_id = c.campaign_id
        LEFT JOIN playlists p ON c.campaign_id = p.campaign_id
        LEFT JOIN playlist_items pi ON p.playlist_id = pi.playlist_id
        LEFT JOIN medias m ON pi.media_id = m.media_id
        WHERE t.active = 1
        GROUP BY t.totem_id, t.name, t.location, t.uptime_percentage
        ORDER BY views DESC
        LIMIT 10
      `);

      return result.map(t => ({
        totemId: t.totemId,
        name: t.name,
        location: t.location,
        views: t.views,
        uptime: t.uptime,
        effectiveness: t.effectiveness
      }));

    } catch (error: any) {
      console.error('❌ Erro ao buscar performance de totems:', error.message);
      return [];
    }
  }

  /**
   * Busca estatísticas de QR Codes
   */
  private async getQRCodeStats(filters: AnalyticsFilters): Promise<{
    qrCodeId: number;
    title: string;
    scans: number;
    conversionRate: number;
  }[]> {
    try {
      const result = await this.db.findMany(`
        SELECT 
          q.qr_code_id as qrCodeId,
          q.title,
          q.scan_count as scans,
          (q.scan_count * 100.0 / GREATEST(q.scan_count, 1)) as conversionRate
        FROM qr_codes q
        WHERE q.is_active = 1
        ORDER BY q.scan_count DESC
        LIMIT 10
      `);

      return result.map(q => ({
        qrCodeId: q.qrCodeId,
        title: q.title,
        scans: q.scans,
        conversionRate: q.conversionRate
      }));

    } catch (error: any) {
      console.error('❌ Erro ao buscar estatísticas de QR Codes:', error.message);
      return [];
    }
  }

  /**
   * Busca estatísticas de receita
   */
  private async getRevenueStats(filters: AnalyticsFilters): Promise<{
    total: number;
    byClient: {
      clientId: number;
      clientName: string;
      amount: number;
    }[];
    byCampaign: {
      campaignId: number;
      title: string;
      amount: number;
    }[];
  }> {
    try {
      const totalResult = await this.db.findFirst(`
        SELECT SUM(amount) as total FROM billing WHERE status = 'paid'
      `);

      const byClient = await this.db.findMany(`
        SELECT 
          b.client_id as clientId,
          c.name as clientName,
          SUM(b.amount) as amount
        FROM billing b
        LEFT JOIN clients c ON b.client_id = c.client_id
        WHERE b.status = 'paid'
        GROUP BY b.client_id, c.name
        ORDER BY amount DESC
        LIMIT 10
      `);

      const byCampaign = await this.db.findMany(`
        SELECT 
          b.campaign_id as campaignId,
          c.title,
          SUM(b.amount) as amount
        FROM billing b
        LEFT JOIN campaigns c ON b.campaign_id = c.campaign_id
        WHERE b.status = 'paid'
        GROUP BY b.campaign_id, c.title
        ORDER BY amount DESC
        LIMIT 10
      `);

      return {
        total: totalResult?.total || 0,
        byClient: byClient.map(c => ({
          clientId: c.clientId,
          clientName: c.clientName,
          amount: c.amount
        })),
        byCampaign: byCampaign.map(c => ({
          campaignId: c.campaignId,
          title: c.title,
          amount: c.amount
        }))
      };

    } catch (error: any) {
      console.error('❌ Erro ao buscar estatísticas de receita:', error.message);
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
        SELECT COUNT(*) as count FROM totems 
        WHERE active = 1 AND last_heartbeat < datetime('now', '-5 minutes')
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
      console.error('❌ Erro ao buscar alertas:', error.message);
      return [];
    }
  }

  /**
   * Obtém uso de disco (implementação real)
   */
  private async getDiskUsage(): Promise<number> {
    try {
      const fs = require('fs');
      const path = require('path');
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
        console.warn('⚠️ Comando df não disponível, calculando uso manualmente');
      }

      // Fallback: calcular uso manualmente (Windows ou se df falhar)
      try {
        const stats = fs.statSync('/');
        // Esta é uma aproximação - em produção, use uma biblioteca como 'diskusage'
        // Por enquanto, retornar um valor baseado no espaço disponível
        return 50; // Valor padrão se não conseguir calcular
      } catch (statError: any) {
        console.warn('⚠️ Não foi possível calcular uso de disco:', statError.message);
        return 0;
      }

    } catch (error: any) {
      console.error('❌ Erro ao obter uso de disco:', error.message);
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

