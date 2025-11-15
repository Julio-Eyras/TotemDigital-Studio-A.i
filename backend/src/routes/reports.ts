/**
 * Reports Routes - Smart Signage v2.0
 * Rotas para relatórios e exportação
 */

import { Router } from 'express';
import { ReportsService } from '../services/reportsService';
import { authenticateToken, authorizeRole } from '../middleware/auth.middleware';
import * as fs from 'fs';
import * as path from 'path';

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

/**
 * @route GET /api/reports
 * @desc Lista relatórios com paginação e filtros
 * @access Private (Admin, Manager)
 */
router.get('/', authorizeRole(['admin', 'manager']), async (req, res) => {
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

    res.json({
      success: true,
      data: result
    });

  } catch (error: any) {
    console.error('❌ Erro ao listar relatórios:', error.message);
    res.status(500).json({
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
router.get('/stats', authorizeRole(['admin', 'manager']), async (req, res) => {
  try {
    const stats = await getReportsService().getReportStats();

    res.json({
      success: true,
      data: stats
    });

  } catch (error: any) {
    console.error('❌ Erro ao buscar estatísticas:', error.message);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
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

    res.json({
      success: true,
      data: report
    });

  } catch (error: any) {
    console.error('❌ Erro ao buscar relatório:', error.message);
    res.status(500).json({
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

    res.status(201).json({
      success: true,
      message: 'Relatório gerado com sucesso',
      data: report
    });

  } catch (error: any) {
    console.error('❌ Erro ao gerar relatório:', error.message);
    res.status(400).json({
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
router.delete('/:id', authorizeRole(['admin', 'manager']), async (req: any, res) => {
  try {
    const { id } = req.params;

    await getReportsService().deleteReport(parseInt(id), req.user.userId);

    res.json({
      success: true,
      message: 'Relatório removido com sucesso'
    });

  } catch (error: any) {
    console.error('❌ Erro ao remover relatório:', error.message);
    res.status(400).json({
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
    res.setHeader('Content-Length', report.fileSize);

    // Enviar arquivo
    const fileStream = fs.createReadStream(report.filePath);
    fileStream.pipe(res);

    // Incrementar contador de downloads
    try {
      await getReportsService().incrementDownloadCount(parseInt(id));
    } catch (error: any) {
      console.warn('⚠️ Erro ao incrementar contador de downloads:', error.message);
      // Não falhar o download se o incremento falhar
    }

  } catch (error: any) {
    console.error('❌ Erro ao baixar relatório:', error.message);
    res.status(500).json({
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
    }, req.user.id);

    res.status(201).json({
      success: true,
      message: 'Relatório regenerado com sucesso',
      data: newReport
    });

  } catch (error: any) {
    console.error('❌ Erro ao regenerar relatório:', error.message);
    res.status(400).json({
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
router.get('/templates', authorizeRole(['admin', 'manager']), async (req, res) => {
  try {
    const templates = await getReportsService().getReportStats(); // Usando método existente

    res.json({
      success: true,
      data: templates
    });

  } catch (error: any) {
    console.error('❌ Erro ao buscar templates:', error.message);
    res.status(500).json({
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
    }, req.user.id);

    res.status(201).json({
      success: true,
      message: 'Template criado com sucesso',
      data: template
    });

  } catch (error: any) {
    console.error('❌ Erro ao criar template:', error.message);
    res.status(400).json({
      success: false,
      message: error.message || 'Erro ao criar template',
      error: error.message
    });
  }
});

/**
 * @route GET /api/reports/types
 * @desc Lista tipos de relatório disponíveis
 * @access Private (Admin, Manager, Client)
 */
router.get('/types', async (req, res) => {
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

    res.json({
      success: true,
      data: types
    });

  } catch (error: any) {
    console.error('❌ Erro ao buscar tipos de relatório:', error.message || error);
    console.error('❌ Stack trace:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message || 'Erro desconhecido'
    });
  }
});

/**
 * @route GET /api/reports/formats
 * @desc Lista formatos de relatório disponíveis
 * @access Private (Admin, Manager, Client)
 */
router.get('/formats', async (req, res) => {
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

    res.json({
      success: true,
      data: formats
    });

  } catch (error: any) {
    console.error('❌ Erro ao buscar formatos de relatório:', error.message);
    res.status(500).json({
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
router.post('/bulk-generate', authorizeRole(['admin', 'manager']), async (req, res) => {
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
        const report = await getReportsService().generateReport(reportRequest, req.user.id);
        results.push({ success: true, report });
      } catch (error: any) {
        errors.push({ success: false, error: error.message, request: reportRequest });
      }
    }

    res.json({
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
    console.error('❌ Erro ao gerar relatórios em lote:', error.message);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
});

/**
 * Obtém tipo de conteúdo baseado no formato
 */
function getContentType(format: string): string {
  const contentTypes: { [key: string]: string } = {
    'pdf': 'application/pdf',
    'excel': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'csv': 'text/csv',
    'json': 'application/json'
  };

  return contentTypes[format] || 'application/octet-stream';
}

export default router;
