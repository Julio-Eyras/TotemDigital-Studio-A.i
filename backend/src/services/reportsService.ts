/**
 * Reports Service - Smart Signage v2.0
 * Serviço de relatórios e exportação
 */

import { getDatabase } from '../config/database';
import { AuditService } from './auditService';
import { AIService } from './aiService';
import * as fs from 'fs';
import * as path from 'path';

export interface ReportRequest {
  type: 'campaign' | 'totem' | 'client' | 'media' | 'billing' | 'analytics' | 'custom';
  title: string;
  description?: string;
  filters: {
    clientId?: number;
    campaignId?: number;
    totemId?: number;
    startDate?: string;
    endDate?: string;
    format?: 'pdf' | 'excel' | 'csv' | 'json';
    includeCharts?: boolean;
    includeDetails?: boolean;
    groupBy?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  };
  template?: string;
  customFields?: string[];
  aiAnalysis?: boolean;
}

export interface ReportResponse {
  id: number;
  type: string;
  title: string;
  description?: string;
  status: 'pending' | 'generating' | 'completed' | 'failed';
  format: string;
  filePath?: string;
  fileSize?: number;
  downloadUrl?: string;
  generatedAt?: string;
  expiresAt?: string;
  metadata: {
    filters: any;
    recordCount: number;
    generationTime: number;
    aiAnalysis?: any;
  };
  createdAt: string;
  createdBy: number;
}

export interface ReportTemplate {
  id: number;
  name: string;
  description: string;
  type: string;
  template: any;
  isDefault: boolean;
  isPublic: boolean;
  createdAt: string;
  createdBy: number;
}

export interface ReportStats {
  total: number;
  byType: { type: string; count: number }[];
  byFormat: { format: string; count: number }[];
  byStatus: { status: string; count: number }[];
  recentActivity: {
    generated: number;
    downloaded: number;
    failed: number;
  };
  storageUsed: number;
}

export class ReportsService {
  private db = getDatabase();
  
  // Lazy initialization - só criar quando necessário
  private getAuditService(): AuditService {
    if (!(global as any).auditServiceInstance) {
      (global as any).auditServiceInstance = new AuditService();
    }
    return (global as any).auditServiceInstance;
  }
  
  private getAIService(): AIService {
    if (!(global as any).aiServiceInstance) {
      (global as any).aiServiceInstance = new AIService();
    }
    return (global as any).aiServiceInstance;
  }
  private reportsDir = path.join(__dirname, '../../reports');

  constructor() {
    this.ensureReportsDirectory();
  }

  /**
   * Cria diretório de relatórios se não existir
   */
  private ensureReportsDirectory(): void {
    if (!fs.existsSync(this.reportsDir)) {
      fs.mkdirSync(this.reportsDir, { recursive: true });
    }
  }

  /**
   * Gera relatório
   */
  async generateReport(request: ReportRequest, createdBy: number): Promise<ReportResponse> {
    try {
      // Criar registro de relatório
      const result = await this.db.executeRaw(`
        INSERT INTO reports (
          type, title, description, status, format, filters, 
          template, custom_fields, ai_analysis, created_by
        )
        VALUES (?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?)
      `, [
        request.type,
        request.title,
        request.description,
        request.filters.format || 'pdf',
        JSON.stringify(request.filters),
        request.template,
        request.customFields ? JSON.stringify(request.customFields) : null,
        request.aiAnalysis ? 1 : 0,
        createdBy
      ]);

      if (!result.lastInsertRowid) {
        throw new Error('Erro ao criar registro de relatório');
      }

      const reportId = result.lastInsertRowid;

      // Atualizar status para gerando
      await this.db.executeRaw(`
        UPDATE reports SET status = 'generating' WHERE report_id = ?
      `, [reportId]);

      try {
        // Gerar relatório baseado no tipo
        const reportData = await this.generateReportData(request);
        
        // Gerar arquivo
        const fileInfo = await this.generateReportFile(reportData, request, reportId);

        // Análise com IA se solicitada
        let aiAnalysis = null;
        if (request.aiAnalysis) {
          aiAnalysis = await this.generateAIAnalysis(reportData, request);
        }

        // Atualizar relatório com sucesso
        await this.db.executeRaw(`
          UPDATE reports 
          SET 
            status = 'completed',
            file_path = ?,
            file_size = ?,
            download_url = ?,
            generated_at = CURRENT_TIMESTAMP,
            expires_at = datetime('now', '+30 days'),
            metadata = ?
          WHERE report_id = ?
        `, [
          fileInfo.filePath,
          fileInfo.fileSize,
          fileInfo.downloadUrl,
          JSON.stringify({
            filters: request.filters,
            recordCount: reportData.recordCount,
            generationTime: reportData.generationTime,
            aiAnalysis
          }),
          reportId
        ]);

        // Buscar relatório criado
        const report = await this.getReportById(reportId);
        if (!report) {
          throw new Error('Erro ao buscar relatório criado');
        }

        // Log de auditoria
        await this.getAuditService().log('report', 'generated', createdBy, {
          reportId,
          type: request.type,
          title: request.title,
          format: request.filters.format
        });

        return report;

      } catch (error: any) {
        // Atualizar status para falha
        await this.db.executeRaw(`
          UPDATE reports 
          SET status = 'failed', metadata = ?
          WHERE report_id = ?
        `, [JSON.stringify({ error: error.message }), reportId]);

        throw error;
      }

    } catch (error: any) {
      console.error('❌ Erro ao gerar relatório:', error.message);
      throw error;
    }
  }

  /**
   * Busca relatório por ID
   */
  async getReportById(reportId: number): Promise<ReportResponse | null> {
    try {
      const report = await this.db.findFirst(`
        SELECT 
          report_id as id,
          type,
          title,
          description,
          status,
          format,
          file_path as filePath,
          file_size as fileSize,
          download_url as downloadUrl,
          generated_at as generatedAt,
          expires_at as expiresAt,
          metadata,
          created_at as createdAt,
          created_by as createdBy
        FROM reports
        WHERE report_id = ?
      `, [reportId]);

      if (!report) {
        return null;
      }

      return {
        ...report,
        metadata: report.metadata ? JSON.parse(report.metadata) : {}
      };

    } catch (error: any) {
      console.error('❌ Erro ao buscar relatório:', error.message);
      throw new Error('Erro interno do servidor');
    }
  }

  /**
   * Lista relatórios com paginação e filtros
   */
  async getReports(
    page: number = 1,
    limit: number = 20,
    filters: {
      type?: string;
      status?: string;
      format?: string;
      createdBy?: number;
      startDate?: string;
      endDate?: string;
    } = {}
  ): Promise<{ reports: ReportResponse[]; total: number; page: number; limit: number }> {
    try {
      const offset = (page - 1) * limit;
      let whereClause = 'WHERE 1=1';
      const params: any[] = [];

      // Aplicar filtros
      if (filters.type) {
        whereClause += ' AND type = ?';
        params.push(filters.type);
      }

      if (filters.status) {
        whereClause += ' AND status = ?';
        params.push(filters.status);
      }

      if (filters.format) {
        whereClause += ' AND format = ?';
        params.push(filters.format);
      }

      if (filters.createdBy) {
        whereClause += ' AND created_by = ?';
        params.push(filters.createdBy);
      }

      if (filters.startDate) {
        whereClause += ' AND created_at >= ?';
        params.push(filters.startDate);
      }

      if (filters.endDate) {
        whereClause += ' AND created_at <= ?';
        params.push(filters.endDate);
      }

      // Buscar relatórios
      const reports = await this.db.findMany(`
        SELECT 
          report_id as id,
          type,
          title,
          description,
          status,
          format,
          file_path as filePath,
          file_size as fileSize,
          download_url as downloadUrl,
          generated_at as generatedAt,
          expires_at as expiresAt,
          metadata,
          created_at as createdAt,
          created_by as createdBy
        FROM reports
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
      `, [...params, limit, offset]);

      // Contar total
      const totalResult = await this.db.findFirst(`
        SELECT COUNT(*) as total FROM reports ${whereClause}
      `, params);

      const total = totalResult?.total || 0;

      // Processar relatórios
      const processedReports = reports.map(report => ({
        ...report,
        metadata: report.metadata ? JSON.parse(report.metadata) : {}
      }));

      return {
        reports: processedReports,
        total,
        page,
        limit
      };

    } catch (error: any) {
      console.error('❌ Erro ao buscar relatórios:', error.message);
      throw new Error('Erro interno do servidor');
    }
  }

  /**
   * Remove relatório
   */
  async deleteReport(reportId: number, deletedBy: number): Promise<void> {
    try {
      // Verificar se relatório existe
      const report = await this.getReportById(reportId);
      if (!report) {
        throw new Error('Relatório não encontrado');
      }

      // Remover arquivo se existir
      if (report.filePath && fs.existsSync(report.filePath)) {
        fs.unlinkSync(report.filePath);
      }

      // Remover registro do banco
      await this.db.executeRaw(`
        DELETE FROM reports WHERE report_id = ?
      `, [reportId]);

      // Log de auditoria
      await this.getAuditService().log('report', 'deleted', deletedBy, {
        reportId,
        type: report.type,
        title: report.title
      });

    } catch (error: any) {
      console.error('❌ Erro ao remover relatório:', error.message);
      throw error;
    }
  }

  /**
   * Gera dados do relatório
   */
  private async generateReportData(request: ReportRequest): Promise<any> {
    const startTime = Date.now();

    try {
      let data: any = {};

      switch (request.type) {
        case 'campaign':
          data = await this.generateCampaignReportData(request.filters);
          break;

        case 'totem':
          data = await this.generateTotemReportData(request.filters);
          break;

        case 'client':
          data = await this.generateClientReportData(request.filters);
          break;

        case 'media':
          data = await this.generateMediaReportData(request.filters);
          break;

        case 'billing':
          data = await this.generateBillingReportData(request.filters);
          break;

        case 'analytics':
          data = await this.generateAnalyticsReportData(request.filters);
          break;

        case 'custom':
          data = await this.generateCustomReportData(request);
          break;

        default:
          throw new Error(`Tipo de relatório não suportado: ${request.type}`);
      }

      return {
        ...data,
        generationTime: Date.now() - startTime,
        recordCount: this.countRecords(data)
      };

    } catch (error: any) {
      console.error('❌ Erro ao gerar dados do relatório:', error.message);
      throw error;
    }
  }

  /**
   * Gera dados de relatório de campanha
   */
  private async generateCampaignReportData(filters: any): Promise<any> {
    try {
      let whereClause = 'WHERE 1=1';
      const params: any[] = [];

      if (filters.clientId) {
        whereClause += ' AND c.client_id = ?';
        params.push(filters.clientId);
      }

      if (filters.campaignId) {
        whereClause += ' AND c.campaign_id = ?';
        params.push(filters.campaignId);
      }

      if (filters.startDate) {
        whereClause += ' AND c.created_at >= ?';
        params.push(filters.startDate);
      }

      if (filters.endDate) {
        whereClause += ' AND c.created_at <= ?';
        params.push(filters.endDate);
      }

      const campaigns = await this.db.findMany(`
        SELECT 
          c.campaign_id,
          c.title,
          c.description,
          c.campaign_type,
          c.status,
          c.is_active,
          c.start_date,
          c.end_date,
          c.created_at,
          cl.name as client_name,
          COUNT(DISTINCT p.playlist_id) as playlist_count,
          COUNT(DISTINCT ct.totem_id) as totem_count,
          COUNT(DISTINCT pi.media_id) as media_count
        FROM campaigns c
        LEFT JOIN clients cl ON c.client_id = cl.client_id
        LEFT JOIN playlists p ON c.campaign_id = p.campaign_id
        LEFT JOIN campaign_totems ct ON c.campaign_id = ct.campaign_id
        LEFT JOIN playlist_items pi ON p.playlist_id = pi.playlist_id
        ${whereClause}
        GROUP BY c.campaign_id, c.title, c.description, c.campaign_type, c.status, c.is_active, c.start_date, c.end_date, c.created_at, cl.name
        ORDER BY c.created_at DESC
      `, params);

      return {
        type: 'campaign',
        data: campaigns,
        summary: {
          total: campaigns.length,
          active: campaigns.filter(c => c.is_active).length,
          inactive: campaigns.filter(c => !c.is_active).length
        }
      };

    } catch (error: any) {
      console.error('❌ Erro ao gerar dados de relatório de campanha:', error.message);
      throw error;
    }
  }

  /**
   * Gera dados de relatório de totem
   */
  private async generateTotemReportData(filters: any): Promise<any> {
    try {
      let whereClause = 'WHERE 1=1';
      const params: any[] = [];

      if (filters.clientId) {
        whereClause += ' AND t.client_id = ?';
        params.push(filters.clientId);
      }

      if (filters.totemId) {
        whereClause += ' AND t.totem_id = ?';
        params.push(filters.totemId);
      }

      const totems = await this.db.findMany(`
        SELECT 
          t.totem_id,
          t.name,
          t.location,
          t.status,
          t.is_active,
          t.uptime_percentage,
          t.last_heartbeat,
          t.created_at,
          cl.name as client_name,
          COUNT(DISTINCT ct.campaign_id) as campaign_count
        FROM totems t
        LEFT JOIN clients cl ON t.client_id = cl.client_id
        LEFT JOIN campaign_totems ct ON t.totem_id = ct.totem_id
        ${whereClause}
        GROUP BY t.totem_id, t.name, t.location, t.status, t.is_active, t.uptime_percentage, t.last_heartbeat, t.created_at, cl.name
        ORDER BY t.created_at DESC
      `, params);

      return {
        type: 'totem',
        data: totems,
        summary: {
          total: totems.length,
          active: totems.filter(t => t.is_active).length,
          inactive: totems.filter(t => !t.is_active).length,
          averageUptime: totems.reduce((sum, t) => sum + t.uptime_percentage, 0) / totems.length
        }
      };

    } catch (error: any) {
      console.error('❌ Erro ao gerar dados de relatório de totem:', error.message);
      throw error;
    }
  }

  /**
   * Gera dados de relatório de cliente
   */
  private async generateClientReportData(filters: any): Promise<any> {
    try {
      let whereClause = 'WHERE 1=1';
      const params: any[] = [];

      if (filters.clientId) {
        whereClause += ' AND cl.client_id = ?';
        params.push(filters.clientId);
      }

      const clients = await this.db.findMany(`
        SELECT 
          cl.client_id,
          cl.name,
          cl.email,
          cl.phone,
          cl.address,
          cl.is_active,
          cl.created_at,
          COUNT(DISTINCT c.campaign_id) as campaign_count,
          COUNT(DISTINCT t.totem_id) as totem_count,
          COUNT(DISTINCT m.media_id) as media_count
        FROM clients cl
        LEFT JOIN campaigns c ON cl.client_id = c.client_id
        LEFT JOIN totems t ON cl.client_id = t.client_id
        LEFT JOIN medias m ON cl.client_id = m.client_id
        ${whereClause}
        GROUP BY cl.client_id, cl.name, cl.email, cl.phone, cl.address, cl.is_active, cl.created_at
        ORDER BY cl.created_at DESC
      `, params);

      return {
        type: 'client',
        data: clients,
        summary: {
          total: clients.length,
          active: clients.filter(c => c.is_active).length,
          inactive: clients.filter(c => !c.is_active).length
        }
      };

    } catch (error: any) {
      console.error('❌ Erro ao gerar dados de relatório de cliente:', error.message);
      throw error;
    }
  }

  /**
   * Gera dados de relatório de mídia
   */
  private async generateMediaReportData(filters: any): Promise<any> {
    try {
      let whereClause = 'WHERE 1=1';
      const params: any[] = [];

      if (filters.clientId) {
        whereClause += ' AND m.client_id = ?';
        params.push(filters.clientId);
      }

      if (filters.startDate) {
        whereClause += ' AND m.created_at >= ?';
        params.push(filters.startDate);
      }

      if (filters.endDate) {
        whereClause += ' AND m.created_at <= ?';
        params.push(filters.endDate);
      }

      const media = await this.db.findMany(`
        SELECT 
          m.media_id,
          m.title,
          m.media_type,
          m.file_size,
          m.duration_seconds,
          m.view_count,
          m.is_active,
          m.created_at,
          cl.name as client_name
        FROM medias m
        LEFT JOIN clients cl ON m.client_id = cl.client_id
        ${whereClause}
        ORDER BY m.created_at DESC
      `, params);

      return {
        type: 'media',
        data: media,
        summary: {
          total: media.length,
          active: media.filter(m => m.is_active).length,
          inactive: media.filter(m => !m.is_active).length,
          totalSize: media.reduce((sum, m) => sum + m.file_size, 0),
          totalViews: media.reduce((sum, m) => sum + m.view_count, 0)
        }
      };

    } catch (error: any) {
      console.error('❌ Erro ao gerar dados de relatório de mídia:', error.message);
      throw error;
    }
  }

  /**
   * Gera dados de relatório de faturamento
   */
  private async generateBillingReportData(filters: any): Promise<any> {
    try {
      let whereClause = 'WHERE 1=1';
      const params: any[] = [];

      if (filters.clientId) {
        whereClause += ' AND b.client_id = ?';
        params.push(filters.clientId);
      }

      if (filters.startDate) {
        whereClause += ' AND b.created_at >= ?';
        params.push(filters.startDate);
      }

      if (filters.endDate) {
        whereClause += ' AND b.created_at <= ?';
        params.push(filters.endDate);
      }

      const billing = await this.db.findMany(`
        SELECT 
          b.billing_id,
          b.billing_type,
          b.amount,
          b.currency,
          b.status,
          b.due_date,
          b.paid_at,
          b.created_at,
          cl.name as client_name,
          c.title as campaign_title
        FROM billing b
        LEFT JOIN clients cl ON b.client_id = cl.client_id
        LEFT JOIN campaigns c ON b.campaign_id = c.campaign_id
        ${whereClause}
        ORDER BY b.created_at DESC
      `, params);

      return {
        type: 'billing',
        data: billing,
        summary: {
          total: billing.length,
          totalAmount: billing.reduce((sum, b) => sum + b.amount, 0),
          paid: billing.filter(b => b.status === 'paid').length,
          pending: billing.filter(b => b.status === 'pending').length,
          overdue: billing.filter(b => b.status === 'overdue').length
        }
      };

    } catch (error: any) {
      console.error('❌ Erro ao gerar dados de relatório de faturamento:', error.message);
      throw error;
    }
  }

  /**
   * Gera dados de relatório de analytics
   */
  private async generateAnalyticsReportData(filters: any): Promise<any> {
    try {
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
      const executionLogs = await this.db.findMany(`
        SELECT 
          el.log_id,
          el.totem_id,
          el.campaign_id,
          el.media_id,
          el.executed_at,
          el.duration_seconds,
          el.status,
          el.play_success,
          t.identifier as totem_identifier,
          c.title as campaign_title,
          m.name as media_name
        FROM execution_logs el
        LEFT JOIN totems t ON el.totem_id = t.totem_id
        LEFT JOIN campaigns c ON el.campaign_id = c.campaign_id
        LEFT JOIN medias m ON el.media_id = m.media_id
        ${whereClause}
        ORDER BY el.executed_at DESC
        LIMIT 1000
      `, params);

      // Buscar estatísticas agregadas
      const stats = await this.db.findFirst(`
        SELECT 
          COUNT(*) as totalViews,
          SUM(duration_seconds) as totalDuration,
          AVG(duration_seconds) as averageViewDuration,
          COUNT(DISTINCT totem_id) as uniqueViewers,
          SUM(CASE WHEN play_success = 1 THEN 1 ELSE 0 END) as successfulPlays,
          SUM(CASE WHEN play_success = 0 THEN 1 ELSE 0 END) as failedPlays
        FROM execution_logs
        ${whereClause}
      `, params);

      // Buscar dados de analytics_sessions
      const sessions = await this.db.findMany(`
        SELECT 
          id,
          totem_id,
          session_start,
          session_end,
          total_interactions,
          avg_emotion_score,
          dominant_emotion
        FROM analytics_sessions
        ${whereClause.replace('executed_at', 'session_start')}
        ORDER BY session_start DESC
        LIMIT 500
      `, params);

      return {
        type: 'analytics',
        data: {
          executionLogs: executionLogs.map((log: any) => ({
            logId: log.log_id,
            totemId: log.totem_id,
            totemIdentifier: log.totem_identifier,
            campaignId: log.campaign_id,
            campaignTitle: log.campaign_title,
            mediaId: log.media_id,
            mediaName: log.media_name,
            executedAt: log.executed_at,
            durationSeconds: log.duration_seconds,
            status: log.status,
            playSuccess: log.play_success
          })),
          sessions: sessions.map((session: any) => ({
            sessionId: session.id,
            totemId: session.totem_id,
            sessionStart: session.session_start,
            sessionEnd: session.session_end,
            totalInteractions: session.total_interactions,
            avgEmotionScore: session.avg_emotion_score,
            dominantEmotion: session.dominant_emotion
          }))
        },
        summary: {
          totalViews: stats?.totalViews || 0,
          totalDuration: stats?.totalDuration || 0,
          averageViewDuration: stats?.averageViewDuration || 0,
          uniqueViewers: stats?.uniqueViewers || 0,
          successfulPlays: stats?.successfulPlays || 0,
          failedPlays: stats?.failedPlays || 0,
          successRate: stats?.totalViews > 0 
            ? ((stats.successfulPlays || 0) / stats.totalViews * 100).toFixed(2)
            : 0
        }
      };

    } catch (error: any) {
      console.error('❌ Erro ao gerar dados de relatório de analytics:', error.message);
      throw error;
    }
  }

  /**
   * Gera dados de relatório customizado
   */
  private async generateCustomReportData(request: ReportRequest): Promise<any> {
    try {
      // Implementar geração de relatório customizado
      // Esta é uma implementação simplificada
      return {
        type: 'custom',
        data: [],
        summary: {}
      };

    } catch (error: any) {
      console.error('❌ Erro ao gerar dados de relatório customizado:', error.message);
      throw error;
    }
  }

  /**
   * Gera arquivo do relatório
   */
  private async generateReportFile(reportData: any, request: ReportRequest, reportId: number): Promise<{
    filePath: string;
    fileSize: number;
    downloadUrl: string;
  }> {
    try {
      const format = request.filters.format || 'pdf';
      const fileName = `report_${reportId}_${Date.now()}.${format}`;
      const filePath = path.join(this.reportsDir, fileName);

      let content: string;

      switch (format) {
        case 'json':
          content = JSON.stringify(reportData, null, 2);
          break;

        case 'csv':
          content = this.convertToCSV(reportData);
          break;

        case 'excel':
          // Implementar geração de Excel
          content = this.convertToCSV(reportData); // Fallback para CSV
          break;

        case 'pdf':
          // Implementar geração de PDF
          content = this.convertToCSV(reportData); // Fallback para CSV
          break;

        default:
          throw new Error(`Formato não suportado: ${format}`);
      }

      // Salvar arquivo
      fs.writeFileSync(filePath, content, 'utf8');
      const fileSize = fs.statSync(filePath).size;

      return {
        filePath,
        fileSize,
        downloadUrl: `/api/reports/download/${reportId}`
      };

    } catch (error: any) {
      console.error('❌ Erro ao gerar arquivo do relatório:', error.message);
      throw error;
    }
  }

  /**
   * Converte dados para CSV
   */
  private convertToCSV(data: any): string {
    try {
      if (!data.data || !Array.isArray(data.data) || data.data.length === 0) {
        return 'Nenhum dado encontrado';
      }

      const headers = Object.keys(data.data[0]);
      const csvContent = [
        headers.join(','),
        ...data.data.map((row: any) => 
          headers.map(header => `"${row[header] || ''}"`).join(',')
        )
      ].join('\n');

      return csvContent;

    } catch (error: any) {
      console.error('❌ Erro ao converter para CSV:', error.message);
      return 'Erro ao converter dados para CSV';
    }
  }

  /**
   * Gera análise com IA
   */
  private async generateAIAnalysis(reportData: any, request: ReportRequest): Promise<any> {
    try {
      const prompt = `
        Analise os seguintes dados de relatório e forneça insights:
        
        Tipo: ${request.type}
        Título: ${request.title}
        Dados: ${JSON.stringify(reportData, null, 2)}
        
        Forneça:
        1. Resumo executivo
        2. Principais insights
        3. Tendências identificadas
        4. Recomendações de ação
        5. Próximos passos
      `;

      const response = await this.getAIService().processRequest({
        prompt,
        maxTokens: 1500,
        temperature: 0.6
      }, 1); // Usar ID do sistema

      return {
        analysis: response.response,
        generatedAt: new Date().toISOString(),
        tokensUsed: response.tokensUsed,
        cost: response.cost
      };

    } catch (error: any) {
      console.error('❌ Erro ao gerar análise com IA:', error.message);
      return {
        analysis: 'Erro ao gerar análise com IA',
        error: error.message
      };
    }
  }

  /**
   * Conta registros nos dados
   */
  private countRecords(data: any): number {
    if (data.data && Array.isArray(data.data)) {
      return data.data.length;
    }
    return 0;
  }

  /**
   * Busca estatísticas de relatórios
   */
  async getReportStats(): Promise<ReportStats> {
    try {
      // Total de relatórios
      const totalResult = await this.db.findFirst(`
        SELECT COUNT(*) as total FROM reports
      `);

      // Por tipo
      const byType = await this.db.findMany(`
        SELECT type, COUNT(*) as count
        FROM reports
        GROUP BY type
        ORDER BY count DESC
      `);

      // Por formato
      const byFormat = await this.db.findMany(`
        SELECT format, COUNT(*) as count
        FROM reports
        GROUP BY format
        ORDER BY count DESC
      `);

      // Por status
      const byStatus = await this.db.findMany(`
        SELECT status, COUNT(*) as count
        FROM reports
        GROUP BY status
        ORDER BY count DESC
      `);

      // Atividade recente (últimos 7 dias)
      const generatedResult = await this.db.findFirst(`
        SELECT COUNT(*) as count FROM reports 
        WHERE generated_at >= datetime('now', '-7 days')
      `);

      const downloadedResult = await this.db.findFirst(`
        SELECT COUNT(*) as count FROM reports 
        WHERE download_count > 0 AND generated_at >= datetime('now', '-7 days')
      `);

      const failedResult = await this.db.findFirst(`
        SELECT COUNT(*) as count FROM reports 
        WHERE status = 'failed' AND created_at >= datetime('now', '-7 days')
      `);

      // Uso de armazenamento
      const storageResult = await this.db.findFirst(`
        SELECT SUM(file_size) as total FROM reports 
        WHERE file_size IS NOT NULL
      `);

      return {
        total: totalResult?.total || 0,
        byType: byType.map(t => ({ type: t.type, count: t.count })),
        byFormat: byFormat.map(f => ({ format: f.format, count: f.count })),
        byStatus: byStatus.map(s => ({ status: s.status, count: s.count })),
        recentActivity: {
          generated: generatedResult?.count || 0,
          downloaded: downloadedResult?.count || 0,
          failed: failedResult?.count || 0
        },
        storageUsed: storageResult?.total || 0
      };

    } catch (error: any) {
      console.error('❌ Erro ao buscar estatísticas de relatórios:', error.message);
      throw new Error('Erro interno do servidor');
    }
  }

  /**
   * Incrementa contador de downloads de um relatório
   */
  async incrementDownloadCount(reportId: number): Promise<void> {
    try {
      await this.db.executeRaw(`
        UPDATE reports
        SET download_count = download_count + 1,
            updated_at = CURRENT_TIMESTAMP
        WHERE report_id = ?
      `, [reportId]);

      // Log de auditoria
      await this.getAuditService().log('reports', 'download', reportId, {
        reportId,
        action: 'download'
      });

    } catch (error: any) {
      console.error('❌ Erro ao incrementar contador de downloads:', error.message);
      throw new Error('Erro ao incrementar contador de downloads');
    }
  }

  /**
   * Cria template de relatório
   */
  async createReportTemplate(
    templateData: {
      name: string;
      description?: string;
      type: string;
      templateConfig: any;
      isDefault?: boolean;
      isPublic?: boolean;
    },
    createdBy: number
  ): Promise<ReportTemplate> {
    try {
      // Se for marcado como padrão, desmarcar outros templates padrão do mesmo tipo
      if (templateData.isDefault) {
        await this.db.executeRaw(`
          UPDATE report_templates
          SET is_default = false
          WHERE type = ? AND is_default = true
        `, [templateData.type]);
      }

      // Criar template
      const result = await this.db.executeRaw(`
        INSERT INTO report_templates (
          name, description, type, template_config,
          is_default, is_public, created_by
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [
        templateData.name,
        templateData.description || null,
        templateData.type,
        JSON.stringify(templateData.templateConfig),
        templateData.isDefault ? 1 : 0,
        templateData.isPublic ? 1 : 0,
        createdBy
      ]);

      if (!result.lastInsertRowid) {
        throw new Error('Erro ao criar template de relatório');
      }

      const templateId = result.lastInsertRowid;

      // Buscar template criado
      const template = await this.db.findFirst(`
        SELECT 
          template_id as id,
          name,
          description,
          type,
          template_config as template,
          is_default as isDefault,
          is_public as isPublic,
          created_at as createdAt,
          created_by as createdBy
        FROM report_templates
        WHERE template_id = ?
      `, [templateId]);

      if (!template) {
        throw new Error('Template não encontrado após criação');
      }

      // Log de auditoria
      await this.getAuditService().log('reports', 'template_created', templateId, {
        templateId,
        name: templateData.name,
        type: templateData.type
      });

      return {
        ...template,
        template: template.template ? JSON.parse(template.template) : {}
      };

    } catch (error: any) {
      console.error('❌ Erro ao criar template de relatório:', error.message);
      throw new Error('Erro ao criar template de relatório');
    }
  }

  /**
   * Lista templates de relatório
   */
  async getReportTemplates(filters: {
    type?: string;
    isPublic?: boolean;
    createdBy?: number;
  } = {}): Promise<ReportTemplate[]> {
    try {
      let whereClause = 'WHERE 1=1';
      const params: any[] = [];

      if (filters.type) {
        whereClause += ' AND type = ?';
        params.push(filters.type);
      }

      if (filters.isPublic !== undefined) {
        whereClause += ' AND (is_public = ? OR created_by = ?)';
        params.push(filters.isPublic ? 1 : 0);
        params.push(filters.createdBy || 0);
      } else if (filters.createdBy) {
        whereClause += ' AND (is_public = 1 OR created_by = ?)';
        params.push(filters.createdBy);
      }

      const templates = await this.db.findMany(`
        SELECT 
          template_id as id,
          name,
          description,
          type,
          template_config as template,
          is_default as isDefault,
          is_public as isPublic,
          created_at as createdAt,
          created_by as createdBy
        FROM report_templates
        ${whereClause}
        ORDER BY is_default DESC, created_at DESC
      `, params);

      return templates.map(t => ({
        ...t,
        template: t.template ? JSON.parse(t.template) : {}
      }));

    } catch (error: any) {
      console.error('❌ Erro ao buscar templates de relatório:', error.message);
      throw new Error('Erro ao buscar templates de relatório');
    }
  }

  /**
   * Busca template por ID
   */
  async getReportTemplateById(templateId: number): Promise<ReportTemplate | null> {
    try {
      const template = await this.db.findFirst(`
        SELECT 
          template_id as id,
          name,
          description,
          type,
          template_config as template,
          is_default as isDefault,
          is_public as isPublic,
          created_at as createdAt,
          created_by as createdBy
        FROM report_templates
        WHERE template_id = ?
      `, [templateId]);

      if (!template) {
        return null;
      }

      return {
        ...template,
        template: template.template ? JSON.parse(template.template) : {}
      };

    } catch (error: any) {
      console.error('❌ Erro ao buscar template de relatório:', error.message);
      throw new Error('Erro ao buscar template de relatório');
    }
  }
}
