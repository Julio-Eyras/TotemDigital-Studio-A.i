/**
 * Billing Routes - Smart Signage v2.0
 * Rotas para faturamento e cobrança
 */

import { Router } from 'express';
import { BillingService } from '../services/billingService';
import { authenticateToken, authorizeRole } from '../middleware/auth.middleware';
import { blockClientDataAccess } from '../middleware/operatorProtection.middleware';
import { logError } from '../utils/loggerHelper';
import { dateToYmd } from '../utils/businessDate';

const router = Router();

// Lazy initialization - só criar quando necessário
function getBillingService(): BillingService {
  if (!(global as any).billingServiceInstance) {
    (global as any).billingServiceInstance = new BillingService();
  }
  return (global as any).billingServiceInstance;
}

// Middleware de autenticação para todas as rotas
router.use(authenticateToken);

// Aplicar bloqueio de dados de clientes para OPERATOR
router.use(blockClientDataAccess);

/**
 * @route GET /api/billing
 * @desc Lista faturas com paginação e filtros
 * @access Private (Admin apenas - billing é restrito)
 */
router.get('/', authorizeRole(['admin', 'admin_sql', 'operador_faturamento']), async (req: any, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      clientId,
      campaignId,
      totemId,
      billingType,
      status,
      startDate,
      endDate,
      search
    } = req.query;

    // Aplicar filtro de cliente se for Client
    const filters: any = {
      clientId: req.user.role === 'client' ? req.user.clientId : (clientId ? parseInt(clientId as string) : undefined),
      campaignId: campaignId ? parseInt(campaignId as string) : undefined,
      totemId: totemId ? parseInt(totemId as string) : undefined,
      billingType: billingType as string,
      status: status as string,
      startDate: startDate as string,
      endDate: endDate as string,
      search: search as string
    };

    const result = await getBillingService().getBillings(
      parseInt(page as string),
      parseInt(limit as string),
      filters
    );

    return res.json({
      success: true,
      data: result
    });

  } catch (error: any) {
    await logError('Erro ao listar faturas', error);
    return res.status(500).json({
      success: false,
      message: 'Erro ao listar faturas',
      error: error?.message
    });
  }
});

/**
 * @route GET /api/billing/stats
 * @desc Busca estatísticas de faturamento
 * @access Private (Admin apenas - billing é restrito)
 */
router.get('/stats', authorizeRole(['admin', 'admin_sql', 'operador_faturamento']), async (_req, res) => {
  try {
    const stats = await getBillingService().getBillingStats();

    res.json({
      success: true,
      data: stats
    });

  } catch (error: any) {
    await logError('Erro ao buscar estatísticas de faturamento', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
});

/**
 * @route GET /api/billing/overdue
 * @desc Lista faturas vencidas
 * @access Private (Admin apenas - billing é restrito)
 */
router.get('/overdue', authorizeRole(['admin', 'admin_sql', 'operador_faturamento']), async (_req, res) => {
  try {
    const overdueBillings = await getBillingService().getOverdueBillings();

    res.json({
      success: true,
      data: overdueBillings
    });

  } catch (error: any) {
    await logError('Erro ao buscar faturas vencidas', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
});

/**
 * @route GET /api/billing/client/:clientId
 * @desc Lista faturas de um cliente específico
 * @access Private (Admin apenas - billing é restrito)
 */
router.get('/client/:clientId', authorizeRole(['admin', 'admin_sql', 'operador_faturamento']), async (req: any, res) => {
  try {
    const { clientId } = req.params;
    const { limit = 50 } = req.query;

    // Verificar permissão
    if (req.user.role === 'client' && req.user.clientId !== parseInt(clientId)) {
      return res.status(403).json({
        success: false,
        message: 'Acesso negado: Você só pode ver suas próprias faturas'
      });
    }

    const billings = await getBillingService().getBillingsByClient(
      parseInt(clientId),
      parseInt(limit as string)
    );

    return res.json({
      success: true,
      data: billings
    });

  } catch (error: any) {
    await logError('Erro ao buscar faturas do cliente', error);
    return res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
});

/**
 * @route GET /api/billing/:id
 * @desc Busca fatura por ID
 * @access Private (Admin apenas - billing é restrito)
 */
router.get('/:id', authorizeRole(['admin', 'admin_sql', 'operador_faturamento']), async (req: any, res) => {
  try {
    const { id } = req.params;

    const billing = await getBillingService().getBillingById(parseInt(id));

    if (!billing) {
      return res.status(404).json({
        success: false,
        message: 'Fatura não encontrada'
      });
    }

    // Verificar permissão
    if (req.user.role === 'client' && req.user.clientId !== billing.clientId) {
      return res.status(403).json({
        success: false,
        message: 'Acesso negado: Você só pode ver suas próprias faturas'
      });
    }

    return res.json({
      success: true,
      data: billing
    });

  } catch (error: any) {
    await logError('Erro ao buscar fatura', error);
    return res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
});

/**
 * @route POST /api/billing
 * @desc Cria nova fatura
 * @access Private (Admin, Manager)
 */
router.post('/', authorizeRole(['admin', 'admin_sql', 'operador_faturamento']), async (req: any, res) => {
  try {
    const billingData = req.body;

    // Remover campos undefined
    Object.keys(billingData).forEach(key => {
      if (billingData[key] === undefined) {
        delete billingData[key];
      }
    });

    // Mapear campos do frontend para o backend
    const mappedData: any = {
      clientId: billingData.clientId,
      campaignId: billingData.campaignId,
      totemId: billingData.totemId,
      billingType: billingData.billing_type || billingData.billingType,
      amount: billingData.amount,
      currency: billingData.currency || 'BRL',
      description: billingData.description,
      dueDate: billingData.due_date || billingData.dueDate,
      status: billingData.status || 'pending',
      paymentMethod: billingData.payment_method || billingData.paymentMethod,
      paymentReference: billingData.payment_reference || billingData.paymentReference,
      notes: billingData.notes,
      metadata: billingData.metadata
    };

    // Se clientId não foi fornecido, usar o do usuário autenticado ou buscar primeiro cliente
    if (!mappedData.clientId) {
      if (req.user.role === 'client' && req.user.clientId) {
        mappedData.clientId = req.user.clientId;
      } else if (req.user.role === 'admin' || req.user.role === 'admin_sql') {
        // Para admin/manager, buscar primeiro cliente ativo se não fornecido
        try {
          const firstClient = await getBillingService().getFirstActiveClient();
          if (firstClient) {
            mappedData.clientId = firstClient.client_id;
          } else {
            return res.status(400).json({
              success: false,
              message: 'Nenhum cliente encontrado. É necessário criar um cliente antes de criar faturas.'
            });
          }
        } catch (error: any) {
          return res.status(400).json({
            success: false,
            message: 'clientId é obrigatório para criar fatura'
          });
        }
      } else {
        return res.status(400).json({
          success: false,
          message: 'clientId é obrigatório para criar fatura'
        });
      }
    }

    const billing = await getBillingService().createBilling(mappedData, req.user.userId);

    return res.status(201).json({
      success: true,
      message: 'Fatura criada com sucesso',
      data: billing
    });

  } catch (error: any) {
    await logError('Erro ao criar fatura', error);
    return res.status(400).json({
      success: false,
      message: error.message || 'Erro ao criar fatura',
      error: error.message || 'Erro desconhecido'
    });
  }
});

/**
 * @route PUT /api/billing/:id
 * @desc Atualiza fatura
 * @access Private (Admin, Manager)
 */
router.put('/:id', authorizeRole(['admin', 'admin_sql', 'operador_faturamento']), async (req: any, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const billing = await getBillingService().updateBilling(
      parseInt(id),
      updateData,
      req.user.userId
    );

    return res.json({
      success: true,
      message: 'Fatura atualizada com sucesso',
      data: billing
    });

  } catch (error: any) {
    await logError('Erro ao atualizar fatura', error);
    return res.status(400).json({
      success: false,
      message: error.message || 'Erro ao atualizar fatura',
      error: error.message
    });
  }
});

/**
 * @route DELETE /api/billing/:id
 * @desc Remove fatura
 * @access Private (Admin, Manager)
 */
router.delete('/:id', authorizeRole(['admin', 'admin_sql', 'operador_faturamento']), async (req: any, res) => {
  try {
    const { id } = req.params;

    await getBillingService().deleteBilling(parseInt(id), req.user.userId);

    return res.json({
      success: true,
      message: 'Fatura removida com sucesso'
    });

  } catch (error: any) {
    await logError('Erro ao remover fatura', error);
    return res.status(400).json({
      success: false,
      message: error.message || 'Erro ao remover fatura',
      error: error.message
    });
  }
});

/**
 * @route POST /api/billing/:id/payment
 * @desc Registra pagamento de fatura
 * @access Private (Admin, Manager, Client)
 */
router.post('/:id/payment', async (req: any, res) => {
  try {
    const { id } = req.params;
    const paymentData = req.body;

    // Verificar se fatura existe e permissão
    const billing = await getBillingService().getBillingById(parseInt(id));
    if (!billing) {
      return res.status(404).json({
        success: false,
        message: 'Fatura não encontrada'
      });
    }

    if (req.user.role === 'client' && req.user.clientId !== billing.clientId) {
      return res.status(403).json({
        success: false,
        message: 'Acesso negado: Você só pode pagar suas próprias faturas'
      });
    }

    const payment = await getBillingService().recordPayment({
      billingId: parseInt(id),
      ...paymentData
    }, req.user.userId);

    return res.status(201).json({
      success: true,
      message: 'Pagamento registrado com sucesso',
      data: payment
    });

  } catch (error: any) {
    await logError('Erro ao registrar pagamento', error);
    return res.status(400).json({
      success: false,
      message: error.message || 'Erro ao registrar pagamento',
      error: error.message
    });
  }
});

/**
 * @route POST /api/billing/mark-overdue
 * @desc Marca faturas como vencidas
 * @access Private (Admin, Manager)
 */
router.post('/mark-overdue', authorizeRole(['admin', 'admin_sql', 'operador_faturamento']), async (_req, res) => {
  try {
    const count = await getBillingService().markOverdueBillings();

    res.json({
      success: true,
      message: `${count} fatura(s) marcada(s) como vencida(s)`,
      data: { count }
    });

  } catch (error: any) {
    await logError('Erro ao marcar faturas como vencidas', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
});

/**
 * @route GET /api/billing/:id/payments
 * @desc Lista pagamentos de uma fatura
 * @access Private (Admin, Manager, Client)
 */
router.get('/:id/payments', async (req: any, res) => {
  try {
    const { id } = req.params;

    // Verificar se fatura existe e permissão
    const billing = await getBillingService().getBillingById(parseInt(id));
    if (!billing) {
      return res.status(404).json({
        success: false,
        message: 'Fatura não encontrada'
      });
    }

    if (req.user.role === 'client' && req.user.clientId !== billing.clientId) {
      return res.status(403).json({
        success: false,
        message: 'Acesso negado: Você só pode ver pagamentos de suas próprias faturas'
      });
    }

    // Buscar pagamentos
    const payments = await getBillingService().getBillingPayments(parseInt(id));

    return res.json({
      success: true,
      data: payments
    });

  } catch (error: any) {
    await logError('Erro ao buscar pagamentos da fatura', error);
    return res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
});

/**
 * @route POST /api/billing/:id/cancel
 * @desc Cancela fatura
 * @access Private (Admin, Manager)
 */
router.post('/:id/cancel', authorizeRole(['admin', 'admin_sql', 'operador_faturamento']), async (req: any, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    // Verificar se fatura existe
    const billing = await getBillingService().getBillingById(parseInt(id));
    if (!billing) {
      return res.status(404).json({
        success: false,
        message: 'Fatura não encontrada'
      });
    }

    if (billing.status === 'paid') {
      return res.status(400).json({
        success: false,
        message: 'Não é possível cancelar fatura já paga'
      });
    }

    await getBillingService().updateBilling(parseInt(id), { 
      status: 'cancelled',
      notes: reason ? `Cancelada: ${reason}` : 'Cancelada'
    }, req.user.userId);

    return res.json({
      success: true,
      message: 'Fatura cancelada com sucesso'
    });

  } catch (error: any) {
    await logError('Erro ao cancelar fatura', error);
    return res.status(400).json({
      success: false,
      message: error.message || 'Erro ao cancelar fatura',
      error: error.message
    });
  }
});

/**
 * @route GET /api/billing/export
 * @desc Exporta faturas
 * @access Private (Admin, Manager)
 */
router.get('/export', authorizeRole(['admin', 'admin_sql', 'operador_faturamento']), async (req, res) => {
  try {
    const {
      clientId,
      campaignId,
      totemId,
      billingType,
      status,
      startDate,
      endDate,
      format = 'json'
    } = req.query;

    const filters = {
      clientId,
      campaignId,
      totemId,
      billingType,
      status,
      startDate,
      endDate
    };

    const result = await getBillingService().getBillings(1, 1000, {
      clientId: filters.clientId ? parseInt(filters.clientId as string) : undefined,
      campaignId: filters.campaignId ? parseInt(filters.campaignId as string) : undefined,
      totemId: filters.totemId ? parseInt(filters.totemId as string) : undefined,
      billingType: filters.billingType as string,
      status: filters.status as string,
      startDate: filters.startDate as string,
      endDate: filters.endDate as string,
      search: (filters as any).search as string
    });

    if (format === 'csv') {
      // Exportação CSV com escape de valores
      const escapeCsv = (val: any): string => {
        if (val == null) return '';
        const s = String(val);
        if (s.includes(',') || s.includes('"') || s.includes('\n')) {
          return `"${s.replace(/"/g, '""')}"`;
        }
        return s;
      };
      const headers = ['ID', 'Cliente', 'Campanha', 'Tipo', 'Valor', 'Moeda', 'Status', 'Vencimento', 'Descrição'];
      const rows = result.billings.map((b: any) => [
        b.id,
        b.clientName || b.clientId || '',
        b.campaignTitle || b.campaignId || '',
        b.billingType || '',
        b.amount ?? '',
        b.currency || 'BRL',
        b.status || '',
        b.dueDate ? dateToYmd(b.dueDate) : '',
        (b.description || '').replace(/\n/g, ' ')
      ].map(escapeCsv).join(','));
      const csvContent = '\uFEFF' + headers.join(',') + '\n' + rows;
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="billing-export.csv"');
      res.send(csvContent);
    } else {
      // Exportação JSON
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename="billing-export.json"');
      res.json(result);
    }

  } catch (error: any) {
    await logError('Erro ao exportar faturas', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
});

export default router;
