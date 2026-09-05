/**
 * FxAnalyticsService - Analytics Avançado para SmartDisplayFX
 * 
 * Serviço dedicado para analytics e insights de SmartDisplayFX
 */

import { getDatabase } from '../config/database';
import { getAnalyticsCacheService } from './analyticsCacheService';
import { logError } from '../utils/loggerHelper';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { dateToYmd } from '../utils/businessDate';
import { normalizeError } from '../utils/errors';

export interface FxAnalyticsOverview {
  totalExecutions: number;
  successful: number;
  failed: number;
  successRate: number;
  avgFps: number;
  avgDuration: number;
  topEffects: Array<{
    effect_id: string;
    executions: number;
    avg_fps: number;
    avg_duration: number;
    success_rate: number;
  }>;
  topTotems: Array<{
    totem_id: number;
    name: string;
    executions: number;
    avg_fps: number;
    success_rate: number;
  }>;
  trends: Array<{
    date: string;
    executions: number;
    avg_fps: number;
    success_rate: number;
  }>;
}

export interface FxPerformanceMetrics {
  fpsDistribution: Array<{
    fps_range: string;
    count: number;
    percentage: number;
  }>;
  durationDistribution: Array<{
    duration_range: string;
    count: number;
    percentage: number;
  }>;
  performanceByHour: Array<{
    hour: number;
    executions: number;
    avg_fps: number;
    avg_duration: number;
  }>;
  performanceByDay: Array<{
    day_of_week: number;
    day_name: string;
    executions: number;
    avg_fps: number;
  }>;
}

export interface FxSiteAnalytics {
  site_id: string;
  site_name: string;
  totem_count: number;
  total_executions: number;
  avg_fps: number;
  avg_duration: number;
  successful: number;
  failed: number;
  success_rate: number;
}

export interface FxPeriodComparison {
  current: FxAnalyticsOverview;
  previous: FxAnalyticsOverview;
  changes: {
    totalExecutions: { value: number; percentage: number };
    successful: { value: number; percentage: number };
    failed: { value: number; percentage: number };
    successRate: { value: number; percentage: number };
    avgFps: { value: number; percentage: number };
    avgDuration: { value: number; percentage: number };
  };
}

export class FxAnalyticsService {
  private get db() {
    return getDatabase();
  }

  private get analyticsCache() {
    return getAnalyticsCacheService();
  }

  /**
   * Obtém overview completo de analytics (com cache)
   */
  async getOverview(params: {
    site_id?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<FxAnalyticsOverview> {
    try {
      const { startDate, endDate } = params;
      
      // Usar cache específico para analytics
      const cacheKey = this.analyticsCache.getOverviewKey(
        undefined, // clientId não aplicável para FX
        startDate,
        endDate
      );

      const cached = await this.analyticsCache.get<FxAnalyticsOverview>(cacheKey);
      if (cached) {
        return cached;
      }

      const overview = await this._fetchOverview(params);
      await this.analyticsCache.set(cacheKey, overview, 300); // 5 minutos
      return overview;} catch (error: unknown) {
        const e = normalizeError(error);

      await logError('Erro ao obter overview FX', error as Error, params);
      throw e.error;
    }
  }

  /**
   * Compara períodos de analytics
   */
  async comparePeriods(params: {
    site_id?: string;
    currentStartDate: string;
    currentEndDate: string;
    previousStartDate: string;
    previousEndDate: string;
  }): Promise<FxPeriodComparison> {
    try {
      const [current, previous] = await Promise.all([
        this.getOverview({
          site_id: params.site_id,
          startDate: params.currentStartDate,
          endDate: params.currentEndDate
        }),
        this.getOverview({
          site_id: params.site_id,
          startDate: params.previousStartDate,
          endDate: params.previousEndDate
        })
      ]);

      const changes = {
        totalExecutions: {
          value: current.totalExecutions - previous.totalExecutions,
          percentage: previous.totalExecutions > 0
            ? ((current.totalExecutions - previous.totalExecutions) / previous.totalExecutions) * 100
            : 0
        },
        successful: {
          value: current.successful - previous.successful,
          percentage: previous.successful > 0
            ? ((current.successful - previous.successful) / previous.successful) * 100
            : 0
        },
        failed: {
          value: current.failed - previous.failed,
          percentage: previous.failed > 0
            ? ((current.failed - previous.failed) / previous.failed) * 100
            : 0
        },
        successRate: {
          value: current.successRate - previous.successRate,
          percentage: previous.successRate > 0
            ? ((current.successRate - previous.successRate) / previous.successRate) * 100
            : 0
        },
        avgFps: {
          value: current.avgFps - previous.avgFps,
          percentage: previous.avgFps > 0
            ? ((current.avgFps - previous.avgFps) / previous.avgFps) * 100
            : 0
        },
        avgDuration: {
          value: current.avgDuration - previous.avgDuration,
          percentage: previous.avgDuration > 0
            ? ((current.avgDuration - previous.avgDuration) / previous.avgDuration) * 100
            : 0
        }
      };

      return {
        current,
        previous,
        changes
      };} catch (error: unknown) {
        const e = normalizeError(error);

      await logError('Erro ao comparar períodos FX', error as Error, params);
      throw e.error;
    }
  }

  /**
   * Busca overview do banco (método privado)
   */
  private async _fetchOverview(params: {
    site_id?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<FxAnalyticsOverview> {
    const { site_id, startDate, endDate } = params;
    
    let whereClause = '1=1';
    const queryParams: unknown[] = [];
    let paramIndex = 1;

    if (site_id) {
      whereClause += ` AND site_id = $${paramIndex}`;
      queryParams.push(site_id);
      paramIndex++;
    }

    if (startDate) {
      whereClause += ` AND logged_at >= $${paramIndex}`;
      queryParams.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      whereClause += ` AND logged_at <= $${paramIndex}`;
      queryParams.push(endDate);
      paramIndex++;
    }

    // Total de execuções
    const totalResult = await this.db.findFirst(`
      SELECT 
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE success = true)::int AS successful,
        COUNT(*) FILTER (WHERE success = false)::int AS failed,
        AVG(fps)::numeric(10,2) AS avg_fps,
        AVG(duration_ms)::numeric(10,2) AS avg_duration
      FROM fx_telemetry
      WHERE ${whereClause}
    `, queryParams);

    const totalExecutions = (totalResult?.total as number) || 0;
    const successful = (totalResult?.successful as number) || 0;
    const failed = (totalResult?.failed as number) || 0;
    const successRate = totalExecutions > 0 ? (successful / totalExecutions) * 100 : 0;
    const avgFps = parseFloat((totalResult?.avg_fps as string) || '0');
    const avgDuration = parseFloat((totalResult?.avg_duration as string) || '0');

    // Top efeitos
    const topEffectsResult = await this.db.findMany(`
      SELECT 
        effect_id,
        COUNT(*)::int AS executions,
        AVG(fps)::numeric(10,2) AS avg_fps,
        AVG(duration_ms)::numeric(10,2) AS avg_duration,
        (COUNT(*) FILTER (WHERE success = true)::float / COUNT(*)::float * 100)::numeric(10,2) AS success_rate
      FROM fx_telemetry
      WHERE ${whereClause}
      GROUP BY effect_id
      ORDER BY executions DESC
      LIMIT 10
    `, queryParams);

    const topEffects = topEffectsResult.map((row: Record<string, unknown>) => ({
      effect_id: row.effect_id as string,
      executions: row.executions as number,
      avg_fps: parseFloat((row.avg_fps as string) || '0'),
      avg_duration: parseFloat((row.avg_duration as string) || '0'),
      success_rate: parseFloat((row.success_rate as string) || '0')
    }));

    // Top totens
    const topTotemsResult = await this.db.findMany(`
      SELECT 
        t.totem_id,
        t.name,
        COUNT(ft.id)::int AS executions,
        AVG(ft.fps)::numeric(10,2) AS avg_fps,
        (COUNT(*) FILTER (WHERE ft.success = true)::float / COUNT(*)::float * 100)::numeric(10,2) AS success_rate
      FROM fx_telemetry ft
      JOIN totems t ON ft.totem_id = t.totem_id
      WHERE ${whereClause}
      GROUP BY t.totem_id, t.name
      ORDER BY executions DESC
      LIMIT 10
    `, queryParams);

    const topTotems = topTotemsResult.map((row: Record<string, unknown>) => ({
      totem_id: row.totem_id as number,
      name: (row.name as string) || `Totem ${row.totem_id}`,
      executions: row.executions as number,
      avg_fps: parseFloat((row.avg_fps as string) || '0'),
      success_rate: parseFloat((row.success_rate as string) || '0')
    }));

    // Trends (por dia)
    const trendsResult = await this.db.findMany(`
      SELECT 
        DATE(logged_at) AS date,
        COUNT(*)::int AS executions,
        AVG(fps)::numeric(10,2) AS avg_fps,
        (COUNT(*) FILTER (WHERE success = true)::float / COUNT(*)::float * 100)::numeric(10,2) AS success_rate
      FROM fx_telemetry
      WHERE ${whereClause}
      GROUP BY DATE(logged_at)
      ORDER BY date DESC
      LIMIT 30
    `, queryParams);

    const trends = trendsResult.map((row: Record<string, unknown>) => ({
      date: dateToYmd(row.date as Date),
      executions: row.executions as number,
      avg_fps: parseFloat((row.avg_fps as string) || '0'),
      success_rate: parseFloat((row.success_rate as string) || '0')
    }));

    return {
      totalExecutions,
      successful,
      failed,
      successRate,
      avgFps,
      avgDuration,
      topEffects,
      topTotems,
      trends
    };
  }

  /**
   * Obtém métricas de performance detalhadas
   */
  async getPerformanceMetrics(params: {
    site_id?: string;
    effect_id?: string;
    totem_id?: number;
    startDate?: string;
    endDate?: string;
  }): Promise<FxPerformanceMetrics> {
    try {
      const { site_id, effect_id, totem_id, startDate, endDate } = params;
      
      let whereClause = '1=1';
      const queryParams: unknown[] = [];
      let paramIndex = 1;

      if (site_id) {
        whereClause += ` AND site_id = $${paramIndex}`;
        queryParams.push(site_id);
        paramIndex++;
      }

      if (effect_id) {
        whereClause += ` AND effect_id = $${paramIndex}`;
        queryParams.push(effect_id);
        paramIndex++;
      }

      if (totem_id) {
        whereClause += ` AND totem_id = $${paramIndex}`;
        queryParams.push(totem_id);
        paramIndex++;
      }

      if (startDate) {
        whereClause += ` AND logged_at >= $${paramIndex}`;
        queryParams.push(startDate);
        paramIndex++;
      }

      if (endDate) {
        whereClause += ` AND logged_at <= $${paramIndex}`;
        queryParams.push(endDate);
        paramIndex++;
      }

      // Distribuição de FPS
      const fpsDistributionResult = await this.db.findMany(`
        SELECT 
          CASE
            WHEN fps < 15 THEN '< 15 FPS'
            WHEN fps < 30 THEN '15-30 FPS'
            WHEN fps < 60 THEN '30-60 FPS'
            ELSE '60+ FPS'
          END AS fps_range,
          COUNT(*)::int AS count
        FROM fx_telemetry
        WHERE ${whereClause}
        GROUP BY fps_range
        ORDER BY fps_range
      `, queryParams);

      const totalFps = fpsDistributionResult.reduce((acc, row) => acc + ((row.count as number) || 0), 0) || 1;
      const fpsDistribution = fpsDistributionResult.map((row: Record<string, unknown>) => ({
        fps_range: row.fps_range as string,
        count: row.count as number,
        percentage: Math.round((row.count as number) / totalFps * 100)
      }));

      // Distribuição de duração
      const durationDistributionResult = await this.db.findMany(`
        SELECT 
          CASE
            WHEN duration_ms < 500 THEN '< 500ms'
            WHEN duration_ms < 1000 THEN '500-1000ms'
            WHEN duration_ms < 2000 THEN '1-2s'
            ELSE '2s+'
          END AS duration_range,
          COUNT(*)::int AS count
        FROM fx_telemetry
        WHERE ${whereClause}
        GROUP BY duration_range
        ORDER BY duration_range
      `, queryParams);

      const totalDuration = durationDistributionResult.reduce((acc, row) => acc + ((row.count as number) || 0), 0) || 1;
      const durationDistribution = durationDistributionResult.map((row: Record<string, unknown>) => ({
        duration_range: row.duration_range as string,
        count: row.count as number,
        percentage: Math.round((row.count as number) / totalDuration * 100)
      }));

      // Performance por hora
      const performanceByHourResult = await this.db.findMany(`
        SELECT 
          EXTRACT(HOUR FROM logged_at)::int AS hour,
          COUNT(*)::int AS executions,
          AVG(fps)::numeric(10,2) AS avg_fps,
          AVG(duration_ms)::numeric(10,2) AS avg_duration
        FROM fx_telemetry
        WHERE ${whereClause}
        GROUP BY EXTRACT(HOUR FROM logged_at)
        ORDER BY hour
      `, queryParams);

      const performanceByHour = performanceByHourResult.map((row: Record<string, unknown>) => ({
        hour: row.hour as number,
        executions: row.executions as number,
        avg_fps: parseFloat((row.avg_fps as string) || '0'),
        avg_duration: parseFloat((row.avg_duration as string) || '0')
      }));

      // Performance por dia da semana
      const performanceByDayResult = await this.db.findMany(`
        SELECT 
          EXTRACT(DOW FROM logged_at)::int AS day_of_week,
          TO_CHAR(logged_at, 'Day') AS day_name,
          COUNT(*)::int AS executions,
          AVG(fps)::numeric(10,2) AS avg_fps
        FROM fx_telemetry
        WHERE ${whereClause}
        GROUP BY EXTRACT(DOW FROM logged_at), TO_CHAR(logged_at, 'Day')
        ORDER BY day_of_week
      `, queryParams);

      const performanceByDay = performanceByDayResult.map((row: Record<string, unknown>) => ({
        day_of_week: row.day_of_week as number,
        day_name: (row.day_name as string).trim(),
        executions: row.executions as number,
        avg_fps: parseFloat((row.avg_fps as string) || '0')
      }));

      return {
        fpsDistribution,
        durationDistribution,
        performanceByHour,
        performanceByDay
      };} catch (error: unknown) {
        const e = normalizeError(error);

      await logError('Erro ao obter métricas de performance FX', error as Error, params);
      throw e.error;
    }
  }

  /**
   * Obtém analytics por site
   */
  async getSiteAnalytics(params: {
    startDate?: string;
    endDate?: string;
  }): Promise<FxSiteAnalytics[]> {
    try {
      const { startDate, endDate } = params;
      
      let whereClause = '1=1';
      const queryParams: unknown[] = [];
      let paramIndex = 1;

      if (startDate) {
        whereClause += ` AND telem.logged_at >= $${paramIndex}`;
        queryParams.push(startDate);
        paramIndex++;
      }

      if (endDate) {
        whereClause += ` AND telem.logged_at <= $${paramIndex}`;
        queryParams.push(endDate);
        paramIndex++;
      }

      const siteStatsResult = await this.db.findMany(`
        SELECT 
          s.site_id,
          s.name AS site_name,
          COUNT(DISTINCT ts.totem_id)::int as totem_count,
          COUNT(telem.id)::int as total_executions,
          AVG(telem.fps)::numeric(10,2) as avg_fps,
          AVG(telem.duration_ms)::numeric(10,2) as avg_duration,
          COUNT(*) FILTER (WHERE telem.success = true)::int as successful,
          COUNT(*) FILTER (WHERE telem.success = false)::int as failed
        FROM fx_sites s
        LEFT JOIN fx_totem_sites ts ON ts.site_id = s.site_id
        LEFT JOIN fx_telemetry telem ON telem.totem_id = ts.totem_id ${whereClause}
        GROUP BY s.site_id, s.name
        ORDER BY total_executions DESC
      `, queryParams);

      return siteStatsResult.map((s: Record<string, unknown>) => ({
        site_id: s.site_id as string,
        site_name: s.site_name as string,
        totem_count: (s.totem_count as number) || 0,
        total_executions: (s.total_executions as number) || 0,
        avg_fps: parseFloat((s.avg_fps as string) || '0'),
        avg_duration: parseFloat((s.avg_duration as string) || '0'),
        successful: (s.successful as number) || 0,
        failed: (s.failed as number) || 0,
        success_rate: (s.total_executions as number) > 0 
          ? Number((((s.successful as number) || 0) / ((s.total_executions as number) || 1) * 100).toFixed(2))
          : 0,
      }));} catch (error: unknown) {
        const e = normalizeError(error);

      await logError('Erro em FxAnalyticsService.getSiteAnalytics', error as Error, params);
      throw e.error;
    }
  }

  /**
   * Exporta overview para Excel
   */
  async exportOverviewToExcel(params: {
    site_id?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<Buffer> {
    try {
      const overview = await this.getOverview(params);
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('FX Analytics Overview');

      // Cabeçalho
      worksheet.addRow(['SmartDisplayFX Analytics Overview']);
      worksheet.addRow(['Generated at:', new Date().toISOString()]);
      worksheet.addRow([]);

      // Estatísticas gerais
      worksheet.addRow(['Total Executions', overview.totalExecutions]);
      worksheet.addRow(['Successful', overview.successful]);
      worksheet.addRow(['Failed', overview.failed]);
      worksheet.addRow(['Success Rate', `${overview.successRate.toFixed(2)}%`]);
      worksheet.addRow(['Average FPS', overview.avgFps.toFixed(2)]);
      worksheet.addRow(['Average Duration', `${overview.avgDuration.toFixed(2)}ms`]);
      worksheet.addRow([]);

      // Top Effects
      worksheet.addRow(['Top Effects']);
      worksheet.addRow(['Effect ID', 'Executions', 'Avg FPS', 'Avg Duration', 'Success Rate']);
      overview.topEffects.forEach(effect => {
        worksheet.addRow([
          effect.effect_id,
          effect.executions,
          effect.avg_fps.toFixed(2),
          `${effect.avg_duration.toFixed(2)}ms`,
          `${effect.success_rate.toFixed(2)}%`
        ]);
      });
      worksheet.addRow([]);

      // Top Totems
      worksheet.addRow(['Top Totems']);
      worksheet.addRow(['Totem ID', 'Name', 'Executions', 'Avg FPS', 'Success Rate']);
      overview.topTotems.forEach(totem => {
        worksheet.addRow([
          totem.totem_id,
          totem.name,
          totem.executions,
          totem.avg_fps.toFixed(2),
          `${totem.success_rate.toFixed(2)}%`
        ]);
      });

      return Buffer.from(await workbook.xlsx.writeBuffer());} catch (error: unknown) {
        const e = normalizeError(error);

      await logError('Erro ao exportar overview para Excel', error as Error, params);
      throw e.error;
    }
  }

  /**
   * Exporta overview para PDF
   */
  async exportOverviewToPDF(params: {
    site_id?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<Buffer> {
    try {
      const overview = await this.getOverview(params);
      const doc = new PDFDocument({ margin: 50 });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => {});

      // Título
      doc.fontSize(20).text('SmartDisplayFX Analytics Overview', { align: 'center' });
      doc.moveDown();
      doc.fontSize(12).text(`Generated at: ${new Date().toLocaleString('pt-BR')}`, { align: 'center' });
      doc.moveDown(2);

      // Estatísticas gerais
      doc.fontSize(16).text('General Statistics');
      doc.fontSize(12);
      doc.text(`Total Executions: ${overview.totalExecutions}`);
      doc.text(`Successful: ${overview.successful}`);
      doc.text(`Failed: ${overview.failed}`);
      doc.text(`Success Rate: ${overview.successRate.toFixed(2)}%`);
      doc.text(`Average FPS: ${overview.avgFps.toFixed(2)}`);
      doc.text(`Average Duration: ${overview.avgDuration.toFixed(2)}ms`);
      doc.moveDown();

      // Top Effects
      doc.fontSize(16).text('Top Effects');
      doc.fontSize(12);
      overview.topEffects.forEach((effect, index) => {
        doc.text(`${index + 1}. ${effect.effect_id} - Executions: ${effect.executions}, FPS: ${effect.avg_fps.toFixed(2)}, Success: ${effect.success_rate.toFixed(2)}%`);
      });
      doc.moveDown();

      // Top Totems
      doc.fontSize(16).text('Top Totems');
      doc.fontSize(12);
      overview.topTotems.forEach((totem, index) => {
        doc.text(`${index + 1}. ${totem.name} (ID: ${totem.totem_id}) - Executions: ${totem.executions}, FPS: ${totem.avg_fps.toFixed(2)}, Success: ${totem.success_rate.toFixed(2)}%`);
      });

      doc.end();

      return new Promise((resolve, reject) => {
        doc.on('end', () => {
          resolve(Buffer.concat(chunks));
        });
        doc.on('error', reject);
      });} catch (error: unknown) {
        const e = normalizeError(error);

      await logError('Erro ao exportar overview para PDF', error as Error, params);
      throw e.error;
    }
  }
}

// Singleton
let fxAnalyticsServiceInstance: FxAnalyticsService | null = null;

export function getFxAnalyticsService(): FxAnalyticsService {
  if (!fxAnalyticsServiceInstance) {
    fxAnalyticsServiceInstance = new FxAnalyticsService();
  }
  return fxAnalyticsServiceInstance;
}
