/**
 * Reports Routes - Smart Signage v2.0
 * Rotas para relatórios e exportação
 */

import { Router } from 'express';
import { ReportsService } from '../services/reportsService';
import { authenticateToken, authorizeRole } from '../middleware/auth.middleware';
import { blockClientDataAccess } from '../middleware/operatorProtection.middleware';
import * as fs from 'fs';
import * as path from 'path';
import { logError, logWarn } from '../utils/loggerHelper';

const router = Router();

// Lazy initialization - só criar quando necessário
function getReportsService(): ReportsService {
  if (!(global as any).reportsServiceInstance) {
    (global as any).reportsServiceInstance = new ReportsService();
  }
  return (global as any).reportsServiceInstance;
}

// Middleware de autenticação para todas as rotas
router.use(authenticateToken);

// Aplicar bloqueio de dados de clientes para OPERATOR
router.use(blockClientDataAccess);

/**
 * @route GET /api/reports
 * @desc Lista relatórios com paginação e filtros
 * @access Private (Admin, Manager)
 */
router.get('/', authorizeRole(['admin', 'gerente_marketing', 'visualizador']), async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      type,
      status,
      format,
      createdBy,
      startDate,
      endDate
    } = req.query;

    const filters = {
      type: type as string,
      status: status as string,
      format: format as string,
      createdBy: createdBy ? parseInt(createdBy as string) : undefined,
      startDate: startDate as string,
      endDate: endDate as string
    };

    const result = await getReportsService().getReports(
      parseInt(page as string),
      parseInt(limit as string),
      filters
    );

    return res.json({
      success: true,
      data: result
    });

  } catch (error: any) {
    await logError('Erro ao listar relatórios', error);
    return res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
});

/**
 * @route GET /api/reports/stats
 * @desc Busca estatísticas de relatórios
 * @access Private (Admin, Manager)
 */
router.get('/stats', authorizeRole(['admin', 'gerente_marketing', 'visualizador']), async (_req, res) => {
  try {
    const stats = await getReportsService().getReportStats();

    return res.json({
      success: true,
      data: stats
    });

  } catch (error: any) {
    await logError('Erro ao buscar estatísticas de relatórios', error);
    return res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
});

/**
 * @route GET /api/reports/types
 * @desc Lista tipos de relatório disponíveis
 * @access Private (Admin, Manager, Client)
 */
router.get('/types', async (_req, res) => {
  try {
    const types = [
      {
        id: 'campaign',
        name: 'Campanhas',
        description: 'Relatório de performance de campanhas',
        icon: 'campaign',
        fields: ['title', 'status', 'start_date', 'end_date', 'playlist_count', 'totem_count']
      },
      {
        id: 'totem',
        name: 'Totems',
        description: 'Relatório de status e performance de totems',
        icon: 'tv',
        fields: ['name', 'location', 'status', 'uptime_percentage', 'last_heartbeat']
      },
      {
        id: 'client',
        name: 'Clientes',
        description: 'Relatório de clientes e suas atividades',
        icon: 'person',
        fields: ['name', 'email', 'campaign_count', 'totem_count', 'media_count']
      },
      {
        id: 'media',
        name: 'Mídia',
        description: 'Relatório de mídia e visualizações',
        icon: 'video_library',
        fields: ['title', 'media_type', 'view_count', 'duration_seconds', 'file_size']
      },
      {
        id: 'billing',
        name: 'Faturamento',
        description: 'Relatório de faturamento e pagamentos',
        icon: 'payment',
        fields: ['billing_type', 'amount', 'status', 'due_date', 'paid_at']
      },
      {
        id: 'analytics',
        name: 'Analytics',
        description: 'Relatório de analytics e métricas',
        icon: 'analytics',
        fields: ['total_views', 'total_duration', 'average_view_duration', 'unique_viewers']
      }
    ];

    return res.json({
      success: true,
      data: types
    });

  } catch (error: any) {
    await logError('Erro ao buscar tipos de relatório', error);
    return res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message || 'Erro desconhecido'
    });
  }
});

/**
 * @route GET /api/reports/:id
 * @desc Busca relatório por ID
 * @access Private (Admin, Manager, Client)
 */
router.get('/:id', async (req: any, res) => {
  try {
    const { id } = req.params;

    const report = await getReportsService().getReportById(parseInt(id));

    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Relatório não encontrado'
      });
    }

    // Verificar permissão para clientes
    if (req.user.role === 'client' && req.user.userId !== report.createdBy) {
      return res.status(403).json({
        success: false,
        message: 'Acesso negado: Você só pode ver seus próprios relatórios'
      });
    }

    return res.json({
      success: true,
      data: report
    });

  } catch (error: any) {
    await logError('Erro ao buscar relatório', error);
    return res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
});

/**
 * @route POST /api/reports
 * @desc Gera novo relatório
 * @access Private (Admin, Manager, Client)
 */
router.post('/', async (req: any, res) => {
  try {
    const reportRequest = req.body;

    // Verificar permissão para clientes
    if (req.user.role === 'client' && reportRequest.filters.clientId !== req.user.clientId) {
      return res.status(403).json({
        success: false,
        message: 'Acesso negado: Você só pode gerar relatórios para seu próprio cliente'
      });
    }

    const report = await getReportsService().generateReport(reportRequest, req.user.userId);

    return res.status(201).json({
      success: true,
      message: 'Relatório gerado com sucesso',
      data: report
    });

  } catch (error: any) {
    await logError('Erro ao gerar relatório', error);
    return res.status(400).json({
      success: false,
      message: error.message || 'Erro ao gerar relatório',
      error: error.message
    });
  }
});

/**
 * @route DELETE /api/reports/:id
 * @desc Remove relatório
 * @access Private (Admin, Manager)
 */
router.delete('/:id', authorizeRole(['admin', 'gerente_marketing']), async (req: any, res) => {
  try {
    const { id } = req.params;

    await getReportsService().deleteReport(parseInt(id), req.user.userId);

    return res.json({
      success: true,
      message: 'Relatório removido com sucesso'
    });

  } catch (error: any) {
    await logError('Erro ao remover relatório', error);
    return res.status(400).json({
      success: false,
      message: error.message || 'Erro ao remover relatório',
      error: error.message
    });
  }
});

/**
 * @route GET /api/reports/download/:id
 * @desc Download de relatório
 * @access Private (Admin, Manager, Client)
 */
router.get('/download/:id', async (req: any, res) => {
  try {
    const { id } = req.params;

    const report = await getReportsService().getReportById(parseInt(id));

    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Relatório não encontrado'
      });
    }

    // Verificar permissão para clientes
    if (req.user.role === 'client' && req.user.userId !== report.createdBy) {
      return res.status(403).json({
        success: false,
        message: 'Acesso negado: Você só pode baixar seus próprios relatórios'
      });
    }

    if (report.status !== 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Relatório ainda não foi gerado ou falhou na geração'
      });
    }

    if (!report.filePath || !fs.existsSync(report.filePath)) {
      return res.status(404).json({
        success: false,
        message: 'Arquivo do relatório não encontrado'
      });
    }

    // Verificar se expirou
    if (report.expiresAt && new Date() > new Date(report.expiresAt)) {
      return res.status(410).json({
        success: false,
        message: 'Relatório expirado'
      });
    }

    // Definir headers para download
    const fileName = `relatorio_${report.id}_${report.title.replace(/[^a-zA-Z0-9]/g, '_')}.${report.format}`;
    
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Type', report.format === 'pdf' ? 'application/pdf' : 'application/json');
    if (report.fileSize !== undefined) {
      res.setHeader('Content-Length', report.fileSize);
    }

    // Enviar arquivo
    const fileStream = fs.createReadStream(report.filePath);
    fileStream.pipe(res);
    return;

    // Incrementar contador de downloads
    try {
      await getReportsService().incrementDownloadCount(parseInt(id));
    } catch (error: any) {
      await logWarn('Erro ao incrementar contador de downloads', { error: error.message });
      // Não falhar o download se o incremento falhar
    }

  } catch (error: any) {
    await logError('Erro ao baixar relatório', error);
    return res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
});

/**
 * @route POST /api/reports/:id/regenerate
 * @desc Regenera relatório
 * @access Private (Admin, Manager, Client)
 */
router.post('/:id/regenerate', async (req: any, res) => {
  try {
    const { id } = req.params;

    const existingReport = await getReportsService().getReportById(parseInt(id));

    if (!existingReport) {
      return res.status(404).json({
        success: false,
        message: 'Relatório não encontrado'
      });
    }

    // Verificar permissão para clientes
    if (req.user.role === 'client' && req.user.userId !== existingReport.createdBy) {
      return res.status(403).json({
        success: false,
        message: 'Acesso negado: Você só pode regenerar seus próprios relatórios'
      });
    }

    // Criar novo relatório baseado no existente
    const reportRequest = {
      type: existingReport.type,
      title: `${existingReport.title} (Regenerado)`,
      description: existingReport.description,
      filters: existingReport.metadata.filters,
      format: existingReport.format,
      aiAnalysis: existingReport.metadata.aiAnalysis ? true : false
    };

    const newReport = await getReportsService().generateReport({
      ...reportRequest,
      type: reportRequest.type as 'client' | 'totem' | 'media' | 'campaign' | 'custom' | 'billing' | 'analytics'
    }, req.user?.id || req.user?.userId || 0);

    return res.status(201).json({
      success: true,
      message: 'Relatório regenerado com sucesso',
      data: newReport
    });

  } catch (error: any) {
    await logError('Erro ao regenerar relatório', error);
    return res.status(400).json({
      success: false,
      message: error.message || 'Erro ao regenerar relatório',
      error: error.message
    });
  }
});

/**
 * @route GET /api/reports/templates
 * @desc Lista templates de relatório
 * @access Private (Admin, Manager)
 */
router.get('/templates', authorizeRole(['admin', 'gerente_marketing', 'visualizador']), async (_req, res) => {
  try {
    const templates = await getReportsService().getReportStats(); // Usando método existente

    return res.json({
      success: true,
      data: templates
    });

  } catch (error: any) {
    await logError('Erro ao buscar templates de relatório', error);
    return res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
});

/**
 * @route POST /api/reports/templates
 * @desc Cria template de relatório
 * @access Private (Admin)
 */
router.post('/templates', authorizeRole(['admin']), async (req, res) => {
  try {
    const templateData = req.body;

    const template = await getReportsService().createReportTemplate({
      name: templateData.name,
      description: templateData.description,
      type: templateData.type || 'custom',
      templateConfig: templateData.templateConfig || {},
      isDefault: templateData.isDefault || false,
      isPublic: templateData.isPublic || false
    }, req.user?.id || req.user?.userId || 0);

    return res.status(201).json({
      success: true,
      message: 'Template criado com sucesso',
      data: template
    });

  } catch (error: any) {
    await logError('Erro ao criar template de relatório', error);
    return res.status(400).json({
      success: false,
      message: error.message || 'Erro ao criar template',
      error: error.message
    });
  }
});

/**
 * @route GET /api/reports/formats
 * @desc Lista formatos de relatório disponíveis
 * @access Private (Admin, Manager, Client)
 */
router.get('/formats', async (_req, res) => {
  try {
    const formats = [
      {
        id: 'pdf',
        name: 'PDF',
        description: 'Documento PDF',
        icon: 'picture_as_pdf',
        mimeType: 'application/pdf'
      },
      {
        id: 'excel',
        name: 'Excel',
        description: 'Planilha Excel',
        icon: 'table_chart',
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      },
      {
        id: 'csv',
        name: 'CSV',
        description: 'Arquivo CSV',
        icon: 'table_view',
        mimeType: 'text/csv'
      },
      {
        id: 'json',
        name: 'JSON',
        description: 'Arquivo JSON',
        icon: 'code',
        mimeType: 'application/json'
      }
    ];

    return res.json({
      success: true,
      data: formats
    });

  } catch (error: any) {
    await logError('Erro ao buscar formatos de relatório', error);
    return res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
});

/**
 * @route POST /api/reports/bulk-generate
 * @desc Gera múltiplos relatórios
 * @access Private (Admin, Manager)
 */
router.post('/bulk-generate', authorizeRole(['admin', 'gerente_marketing']), async (req, res) => {
  try {
    const { reports } = req.body;

    if (!reports || !Array.isArray(reports)) {
      return res.status(400).json({
        success: false,
        message: 'Lista de relatórios é obrigatória'
      });
    }

    const results = [];
    const errors = [];

    for (const reportRequest of reports) {
      try {
        const report = await getReportsService().generateReport(reportRequest, req.user?.id || req.user?.userId || 0);
        results.push({ success: true, report });
      } catch (error: any) {
        errors.push({ success: false, error: error.message, request: reportRequest });
      }
    }

    return res.json({
      success: true,
      message: `Processamento concluído: ${results.length} sucessos, ${errors.length} erros`,
      data: {
        results,
        errors,
        summary: {
          total: reports.length,
          successful: results.length,
          failed: errors.length
        }
      }
    });

  } catch (error: any) {
    await logError('Erro ao gerar relatórios em lote', error);
    return res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
});

/**
 * @route POST /api/reports/export/excel
 * @desc Exporta dados diretamente para Excel (sem salvar relatório)
 * @access Private (Admin, Manager, Client)
 */
router.post('/export/excel', async (req: any, res) => {
  try {
    const { type, filters, title, description } = req.body;

    // Verificar permissão para clientes
    if (req.user.role === 'client' && filters?.clientId !== req.user.clientId) {
      return res.status(403).json({
        success: false,
        message: 'Acesso negado: Você só pode exportar dados do seu próprio cliente'
      });
    }

    const reportRequest = {
      type: type || 'analytics',
      title: title || 'Export Excel',
      description: description || '',
      filters: filters || {},
      template: undefined,
      customFields: undefined,
      aiAnalysis: false
    };

    // Gerar dados do relatório
    const reportData = await getReportsService().generateReportData(reportRequest);

    // Gerar arquivo Excel temporário
    const tempDir = path.join(process.cwd(), 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const fileName = `export_${Date.now()}.xlsx`;
    const filePath = path.join(tempDir, fileName);

    await getReportsService().convertToExcel(reportData, filePath);

    // Enviar arquivo
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
    
    // Limpar arquivo após envio
    fileStream.on('end', () => {
      setTimeout(() => {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }, 1000);
    });
    return;

  } catch (error: any) {
    await logError('Erro ao exportar para Excel', error);
    return res.status(500).json({
      success: false,
      message: 'Erro ao exportar para Excel',
      error: error.message
    });
  }
});

/**
 * @route POST /api/reports/export/pdf
 * @desc Exporta dados diretamente para PDF (sem salvar relatório)
 * @access Private (Admin, Manager, Client)
 */
router.post('/export/pdf', async (req: any, res) => {
  try {
    const { type, filters, title, description } = req.body;

    // Verificar permissão para clientes
    if (req.user.role === 'client' && filters?.clientId !== req.user.clientId) {
      return res.status(403).json({
        success: false,
        message: 'Acesso negado: Você só pode exportar dados do seu próprio cliente'
      });
    }

    const reportRequest = {
      type: type || 'analytics',
      title: title || 'Export PDF',
      description: description || '',
      filters: filters || {},
      template: undefined,
      customFields: undefined,
      aiAnalysis: false
    };

    // Gerar dados do relatório
    const reportData = await getReportsService().generateReportData(reportRequest);

    // Gerar arquivo PDF temporário
    const tempDir = path.join(process.cwd(), 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const fileName = `export_${Date.now()}.pdf`;
    const filePath = path.join(tempDir, fileName);

    await getReportsService().convertToPDF(reportData, filePath, reportRequest);

    // Enviar arquivo
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
    
    // Limpar arquivo após envio
    fileStream.on('end', () => {
      setTimeout(() => {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }, 1000);
    });
    return;

  } catch (error: any) {
    await logError('Erro ao exportar para PDF', error);
    return res.status(500).json({
      success: false,
      message: 'Erro ao exportar para PDF',
      error: error.message
    });
  }
});

export default router;
