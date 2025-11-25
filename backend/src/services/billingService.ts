/**
 * Billing Service - Smart Signage v2.0
 * Serviço de faturamento e cobrança
 */

import { getDatabase } from '../config/database';
import { AuditService } from './auditService';
import { logError } from '../utils/loggerHelper';

export interface CreateBillingRequest {
  clientId: number;
  campaignId?: number;
  totemId?: number;
  billingType: 'subscription' | 'usage' | 'setup' | 'maintenance' | 'custom';
  amount: number;
  currency?: string;
  description?: string;
  dueDate?: string;
  status?: 'pending' | 'paid' | 'overdue' | 'cancelled';
  paymentMethod?: string;
  paymentReference?: string;
  notes?: string;
  metadata?: any;
}

export interface UpdateBillingRequest {
  amount?: number;
  currency?: string;
  description?: string;
  dueDate?: string;
  status?: 'pending' | 'paid' | 'overdue' | 'cancelled';
  paymentMethod?: string;
  paymentReference?: string;
  notes?: string;
  metadata?: any;
}

export interface BillingResponse {
  id: number;
  clientId: number;
  campaignId?: number;
  totemId?: number;
  billingType: string;
  amount: number;
  currency: string;
  description: string;
  dueDate: string;
  status: string;
  paymentMethod?: string;
  paymentReference?: string;
  notes?: string;
  metadata?: any;
  createdAt: string;
  updatedAt: string;
  paidAt?: string;
  clientName?: string;
  campaignTitle?: string;
  totemName?: string;
  isOverdue?: boolean;
  daysOverdue?: number;
}

export interface BillingStats {
  total: number;
  pending: number;
  paid: number;
  overdue: number;
  cancelled: number;
  totalAmount: number;
  pendingAmount: number;
  paidAmount: number;
  overdueAmount: number;
  byType: { type: string; count: number; amount: number }[];
  byClient: { clientId: number; clientName: string; count: number; amount: number }[];
  byMonth: { month: string; count: number; amount: number }[];
  recentActivity: {
    newBillings: number;
    paidBillings: number;
    overdueBillings: number;
  };
}

export interface PaymentRequest {
  billingId: number;
  amount: number;
  paymentMethod: string;
  paymentReference: string;
  notes?: string;
  metadata?: any;
}

export interface PaymentResponse {
  id: number;
  billingId: number;
  amount: number;
  paymentMethod: string;
  paymentReference: string;
  notes?: string;
  metadata?: any;
  createdAt: string;
  status: string;
}

export class BillingService {
  private get db() {
    return getDatabase();
  }

  /**
   * Busca o primeiro cliente ativo (para uso quando clientId não é fornecido)
   */
  async getFirstActiveClient(): Promise<{ client_id: number } | null> {
    try {
      const client = await this.db.findFirst(`
        SELECT client_id 
        FROM clients 
        WHERE COALESCE(is_active, true) = true 
        ORDER BY client_id ASC 
        LIMIT 1
      `);
      return client;
    } catch (error: any) {
      await logError('❌ Erro ao buscar primeiro cliente', error);
      return null;
    }
  }
  
  // Lazy initialization - só criar quando necessário
  private getAuditService(): AuditService {
    if (!(global as any).auditServiceInstance) {
      (global as any).auditServiceInstance = new AuditService();
    }
    return (global as any).auditServiceInstance;
  }

  /**
   * Lista faturas com paginação e filtros
   */
  async getBillings(
    page: number = 1,
    limit: number = 20,
    filters: {
      clientId?: number;
      campaignId?: number;
      totemId?: number;
      billingType?: string;
      status?: string;
      startDate?: string;
      endDate?: string;
      search?: string;
    } = {}
  ): Promise<{ billings: BillingResponse[]; total: number; page: number; limit: number }> {
    try {
      const offset = (page - 1) * limit;
      let whereClause = 'WHERE 1=1';
      const params: any[] = [];

      // Aplicar filtros
      if (filters.clientId) {
        whereClause += ' AND b.client_id = ?';
        params.push(filters.clientId);
      }

      if (filters.campaignId) {
        whereClause += ' AND b.campaign_id = ?';
        params.push(filters.campaignId);
      }

      if (filters.totemId) {
        whereClause += ' AND b.totem_id = ?';
        params.push(filters.totemId);
      }

      if (filters.billingType) {
        whereClause += ' AND b.billing_type = ?';
        params.push(filters.billingType);
      }

      if (filters.status) {
        whereClause += ' AND b.status = ?';
        params.push(filters.status);
      }

      if (filters.startDate) {
        whereClause += ' AND b.created_at >= ?';
        params.push(filters.startDate);
      }

      if (filters.endDate) {
        whereClause += ' AND b.created_at <= ?';
        params.push(filters.endDate);
      }

      if (filters.search) {
        whereClause += ' AND (b.description LIKE ? OR cl.name LIKE ?)';
        params.push(`%${filters.search}%`, `%${filters.search}%`);
      }

      // Buscar faturas
      const billings = await this.db.findMany(`
        SELECT 
          b.billing_id as id,
          b.client_id as clientId,
          b.campaign_id as campaignId,
          b.totem_id as totemId,
          b.billing_type as billingType,
          b.amount,
          b.currency,
          b.description,
          b.due_date as dueDate,
          b.status,
          b.payment_method as paymentMethod,
          b.payment_reference as paymentReference,
          b.notes,
          b.metadata,
          b.created_at as createdAt,
          b.updated_at as updatedAt,
          b.paid_at as paidAt,
          cl.name as clientName,
          c.title as campaignTitle,
          t.name as totemName
        FROM billing b
        LEFT JOIN clients cl ON b.client_id = cl.client_id
        LEFT JOIN campaigns c ON b.campaign_id = c.campaign_id
        LEFT JOIN totems t ON b.totem_id = t.totem_id
        ${whereClause}
        ORDER BY b.created_at DESC
        LIMIT ? OFFSET ?
      `, [...params, limit, offset]);

      // Contar total
      const totalResult = await this.db.findFirst(`
        SELECT COUNT(*) as total
        FROM billing b
        LEFT JOIN clients cl ON b.client_id = cl.client_id
        ${whereClause}
      `, params);

      const total = totalResult?.total || 0;

      // Processar faturas
      const billingsWithInfo = billings.map(billing => {
        const info = this.getBillingInfo(billing);
        return { ...billing, ...info };
      });

      return {
        billings: billingsWithInfo,
        total,
        page,
        limit
      };

    } catch (error: any) {
      await logError('❌ Erro ao buscar faturas', error, { filters });
      throw new Error('Erro interno do servidor');
    }
  }

  /**
   * Busca fatura por ID
   */
  async getBillingById(billingId: number): Promise<BillingResponse | null> {
    try {
      const billing = await this.db.findFirst(`
        SELECT 
          b.billing_id as id,
          b.client_id as clientId,
          b.campaign_id as campaignId,
          b.totem_id as totemId,
          b.billing_type as billingType,
          b.amount,
          b.currency,
          b.description,
          b.due_date as dueDate,
          b.status,
          b.payment_method as paymentMethod,
          b.payment_reference as paymentReference,
          b.notes,
          b.metadata,
          b.created_at as createdAt,
          b.updated_at as updatedAt,
          b.paid_at as paidAt,
          cl.name as clientName,
          c.title as campaignTitle,
          t.name as totemName
        FROM billing b
        LEFT JOIN clients cl ON b.client_id = cl.client_id
        LEFT JOIN campaigns c ON b.campaign_id = c.campaign_id
        LEFT JOIN totems t ON b.totem_id = t.totem_id
        WHERE b.billing_id = ?
      `, [billingId]);

      if (!billing) {
        return null;
      }

      const info = this.getBillingInfo(billing);
      return { ...billing, ...info };

    } catch (error: any) {
      await logError('❌ Erro ao buscar fatura', error, { billingId });
      throw new Error('Erro interno do servidor');
    }
  }

  /**
   * Cria nova fatura
   */
  async createBilling(data: CreateBillingRequest, createdBy: number): Promise<BillingResponse> {
    try {
      const {
        clientId,
        campaignId,
        totemId,
        billingType,
        amount,
        currency = 'BRL',
        description,
        dueDate,
        status = 'pending',
        paymentMethod,
        paymentReference,
        notes,
        metadata
      } = data;

      // Validar campos obrigatórios
      if (!clientId || (typeof clientId === 'number' && clientId <= 0)) {
        throw new Error('clientId é obrigatório e deve ser um número válido');
      }

      if (!billingType || (typeof billingType === 'string' && billingType.trim() === '')) {
        throw new Error('billingType é obrigatório');
      }

      if (!amount || (typeof amount === 'number' && amount <= 0)) {
        throw new Error('amount é obrigatório e deve ser maior que zero');
      }

      // Gerar descrição padrão se não fornecida
      const finalDescription = description || `Fatura ${billingType} - R$ ${amount.toFixed(2)}`;

      // Gerar data de vencimento padrão se não fornecida (30 dias a partir de hoje)
      const finalDueDate = dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      // Verificar se cliente existe
      const client = await this.db.findFirst(`
        SELECT client_id FROM clients WHERE client_id = ? AND COALESCE(is_active, true) = true
      `, [clientId]);

      if (!client) {
        throw new Error('Cliente não encontrado ou inativo');
      }

      // Verificar se campanha existe (se fornecida)
      if (campaignId) {
        const campaign = await this.db.findFirst(`
          SELECT campaign_id FROM campaigns WHERE campaign_id = ?
        `, [campaignId]);

        if (!campaign) {
          throw new Error('Campanha não encontrada');
        }
      }

      // Verificar se totem existe (se fornecido)
      if (totemId) {
        const totem = await this.db.findFirst(`
          SELECT totem_id FROM totems WHERE totem_id = ?
        `, [totemId]);

        if (!totem) {
          throw new Error('Totem não encontrado');
        }
      }

      // Criar fatura
      const result = await this.db.executeRaw(`
        INSERT INTO billing (
          client_id, campaign_id, totem_id, billing_type, amount, currency,
          description, due_date, status, payment_method, payment_reference,
          notes, metadata
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        RETURNING billing_id
      `, [
        clientId,
        campaignId,
        totemId,
        billingType,
        amount,
        currency,
        finalDescription,
        finalDueDate,
        status,
        paymentMethod,
        paymentReference,
        notes,
        metadata ? JSON.stringify(metadata) : null
      ]);

      const billingRow = result.rows?.[0];
      if (!billingRow || !billingRow.billing_id) {
        throw new Error('Erro ao criar fatura');
      }

      // Buscar fatura criada
      const newBilling = await this.getBillingById(billingRow.billing_id);
      if (!newBilling) {
        throw new Error('Erro ao buscar fatura criada');
      }

      // Log de auditoria
      await this.getAuditService().log('billing', 'created', createdBy, {
        billingId: newBilling.id,
        clientId: newBilling.clientId,
        amount: newBilling.amount,
        billingType: newBilling.billingType
      });

      return newBilling;

    } catch (error: any) {
      await logError('❌ Erro ao criar fatura', error, { clientId: data.clientId, billingType: data.billingType });
      throw error;
    }
  }

  /**
   * Atualiza fatura
   */
  async updateBilling(billingId: number, data: UpdateBillingRequest, updatedBy: number): Promise<BillingResponse> {
    try {
      // Verificar se fatura existe
      const existingBilling = await this.getBillingById(billingId);
      if (!existingBilling) {
        throw new Error('Fatura não encontrada');
      }

      // Construir query de atualização
      const updates: string[] = [];
      const params: any[] = [];

      if (data.amount !== undefined) {
        updates.push('amount = ?');
        params.push(data.amount);
      }

      if (data.currency !== undefined) {
        updates.push('currency = ?');
        params.push(data.currency);
      }

      if (data.description !== undefined) {
        updates.push('description = ?');
        params.push(data.description);
      }

      if (data.dueDate !== undefined) {
        updates.push('due_date = ?');
        params.push(data.dueDate);
      }

      if (data.status !== undefined) {
        updates.push('status = ?');
        params.push(data.status);
      }

      if (data.paymentMethod !== undefined) {
        updates.push('payment_method = ?');
        params.push(data.paymentMethod);
      }

      if (data.paymentReference !== undefined) {
        updates.push('payment_reference = ?');
        params.push(data.paymentReference);
      }

      if (data.notes !== undefined) {
        updates.push('notes = ?');
        params.push(data.notes);
      }

      if (data.metadata !== undefined) {
        updates.push('metadata = ?');
        params.push(JSON.stringify(data.metadata));
      }

      if (updates.length === 0) {
        return existingBilling;
      }

      updates.push('updated_at = CURRENT_TIMESTAMP');
      params.push(billingId);

      // Atualizar fatura
      await this.db.executeRaw(`
        UPDATE billing 
        SET ${updates.join(', ')}
        WHERE billing_id = ?
      `, params);

      // Buscar fatura atualizada
      const updatedBilling = await this.getBillingById(billingId);
      if (!updatedBilling) {
        throw new Error('Erro ao buscar fatura atualizada');
      }

      // Log de auditoria
      await this.getAuditService().log('billing', 'updated', updatedBy, {
        billingId,
        changes: data
      });

      return updatedBilling;

    } catch (error: any) {
      await logError('❌ Erro ao atualizar fatura', error, { billingId });
      throw error;
    }
  }

  /**
   * Remove fatura
   */
  async deleteBilling(billingId: number, deletedBy: number): Promise<void> {
    try {
      // Verificar se fatura existe
      const billing = await this.getBillingById(billingId);
      if (!billing) {
        throw new Error('Fatura não encontrada');
      }

      // Verificar se pode ser removida
      if (billing.status === 'paid') {
        throw new Error('Não é possível remover fatura já paga');
      }

      // Remover fatura
      await this.db.executeRaw(`
        DELETE FROM billing WHERE billing_id = ?
      `, [billingId]);

      // Log de auditoria
      await this.getAuditService().log('billing', 'deleted', deletedBy, {
        billingId,
        clientId: billing.clientId,
        amount: billing.amount
      });

    } catch (error: any) {
      await logError('❌ Erro ao remover fatura', error, { billingId });
      throw error;
    }
  }

  /**
   * Registra pagamento
   */
  async recordPayment(paymentData: PaymentRequest, recordedBy: number): Promise<PaymentResponse> {
    try {
      const {
        billingId,
        amount,
        paymentMethod,
        paymentReference,
        notes,
        metadata
      } = paymentData;

      // Verificar se fatura existe
      const billing = await this.getBillingById(billingId);
      if (!billing) {
        throw new Error('Fatura não encontrada');
      }

      if (billing.status === 'paid') {
        throw new Error('Fatura já foi paga');
      }

      // Registrar pagamento
      const insertResult = await this.db.executeRaw(`
        INSERT INTO payments (
          billing_id, amount, payment_method, payment_reference, notes, metadata
        )
        VALUES (?, ?, ?, ?, ?, ?)
        RETURNING payment_id
      `, [
        billingId,
        amount,
        paymentMethod,
        paymentReference,
        notes,
        metadata ? JSON.stringify(metadata) : null
      ]);

      const paymentRow = insertResult.rows?.[0];
      if (!paymentRow || !paymentRow.payment_id) {
        throw new Error('Erro ao registrar pagamento');
      }

      // Atualizar status da fatura
      await this.db.executeRaw(`
        UPDATE billing 
        SET status = 'paid', paid_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE billing_id = ?
      `, [billingId]);

      // Buscar pagamento criado
      const payment = await this.db.findFirst(`
        SELECT 
          payment_id as id,
          billing_id as billingId,
          amount,
          payment_method as paymentMethod,
          payment_reference as paymentReference,
          notes,
          metadata,
          created_at as createdAt,
          'completed' as status
        FROM payments
        WHERE payment_id = ?
      `, [paymentRow.payment_id]);

      if (!payment) {
        throw new Error('Erro ao buscar pagamento criado');
      }

      // Log de auditoria
      await this.getAuditService().log('billing', 'payment_recorded', recordedBy, {
        billingId,
        paymentId: payment.id,
        amount: payment.amount,
        paymentMethod: payment.paymentMethod
      });

      return payment;

    } catch (error: any) {
      await logError('❌ Erro ao registrar pagamento', error, { billingId: paymentData.billingId, amount: paymentData.amount });
      throw error;
    }
  }

  /**
   * Busca pagamentos de uma fatura
   */
  async getBillingPayments(billingId: number): Promise<any[]> {
    try {
      const payments = await this.db.findMany(`
        SELECT
          p.payment_id as id,
          p.amount,
          p.currency,
          p.payment_method as paymentMethod,
          p.payment_reference as paymentReference,
          p.payment_date as paymentDate,
          p.status,
          p.notes,
          p.created_at as createdAt
        FROM payments p
        WHERE p.billing_id = ?
        ORDER BY p.payment_date DESC
      `, [billingId]);

      return payments;
    } catch (error: any) {
      await logError('❌ Erro ao buscar pagamentos', error, { billingId });
      throw new Error('Erro interno do servidor');
    }
  }

  /**
   * Busca estatísticas de faturamento
   */
  async getBillingStats(): Promise<BillingStats> {
    try {
      // Total de faturas
      const totalResult = await this.db.findFirst(`
        SELECT COUNT(*)::int as total FROM billing
      `);

      // Por status
      const pendingResult = await this.db.findFirst(`
        SELECT COUNT(*)::int as count FROM billing WHERE status = 'pending'
      `);

      const paidResult = await this.db.findFirst(`
        SELECT COUNT(*)::int as count FROM billing WHERE status = 'paid'
      `);

      const overdueResult = await this.db.findFirst(`
        SELECT COUNT(*)::int as count FROM billing WHERE status = 'overdue'
      `);

      const cancelledResult = await this.db.findFirst(`
        SELECT COUNT(*)::int as count FROM billing WHERE status = 'cancelled'
      `);

      // Valores por status
      const pendingAmountResult = await this.db.findFirst(`
        SELECT COALESCE(SUM(amount), 0)::float as total FROM billing WHERE status = 'pending'
      `);

      const paidAmountResult = await this.db.findFirst(`
        SELECT COALESCE(SUM(amount), 0)::float as total FROM billing WHERE status = 'paid'
      `);

      const overdueAmountResult = await this.db.findFirst(`
        SELECT COALESCE(SUM(amount), 0)::float as total FROM billing WHERE status = 'overdue'
      `);

      const totalAmountResult = await this.db.findFirst(`
        SELECT COALESCE(SUM(amount), 0)::float as total FROM billing
      `);

      // Por tipo
      const byType = await this.db.findMany(`
        SELECT 
          billing_type as type, 
          COUNT(*)::int as count, 
          COALESCE(SUM(amount), 0)::float as amount
        FROM billing
        GROUP BY billing_type
        ORDER BY count DESC
      `);

      // Por cliente
      const byClient = await this.db.findMany(`
        SELECT 
          b.client_id as clientId,
          cl.name as clientName,
          COUNT(*)::int as count,
          COALESCE(SUM(b.amount), 0)::float as amount
        FROM billing b
        LEFT JOIN clients cl ON b.client_id = cl.client_id
        GROUP BY b.client_id, cl.name
        ORDER BY amount DESC
        LIMIT 10
      `);

      // Por mês
      const byMonth = await this.db.findMany(`
        SELECT 
          TO_CHAR(created_at, 'YYYY-MM') as month,
          COUNT(*)::int as count,
          COALESCE(SUM(amount), 0)::float as amount
        FROM billing
        WHERE created_at >= NOW() - INTERVAL '12 months'
        GROUP BY TO_CHAR(created_at, 'YYYY-MM')
        ORDER BY month DESC
      `);

      // Atividade recente (últimos 7 dias)
      const newBillingsResult = await this.db.findFirst(`
        SELECT COUNT(*)::int as count FROM billing WHERE created_at >= NOW() - INTERVAL '7 days'
      `);

      const paidBillingsResult = await this.db.findFirst(`
        SELECT COUNT(*)::int as count FROM billing 
        WHERE status = 'paid' AND paid_at >= NOW() - INTERVAL '7 days'
      `);

      const overdueBillingsResult = await this.db.findFirst(`
        SELECT COUNT(*)::int as count FROM billing 
        WHERE status = 'overdue' AND updated_at >= NOW() - INTERVAL '7 days'
      `);

      return {
        total: totalResult?.total || 0,
        pending: pendingResult?.count || 0,
        paid: paidResult?.count || 0,
        overdue: overdueResult?.count || 0,
        cancelled: cancelledResult?.count || 0,
        totalAmount: totalAmountResult?.total || 0,
        pendingAmount: pendingAmountResult?.total || 0,
        paidAmount: paidAmountResult?.total || 0,
        overdueAmount: overdueAmountResult?.total || 0,
        byType: byType.map(t => ({ type: t.type, count: t.count, amount: t.amount })),
        byClient: byClient.map(c => ({ clientId: c.clientId, clientName: c.clientName, count: c.count, amount: c.amount })),
        byMonth: byMonth.map(m => ({ month: m.month, count: m.count, amount: m.amount })),
        recentActivity: {
          newBillings: newBillingsResult?.count || 0,
          paidBillings: paidBillingsResult?.count || 0,
          overdueBillings: overdueBillingsResult?.count || 0
        }
      };

    } catch (error: any) {
      await logError('❌ Erro ao buscar estatísticas de faturamento', error);
      throw new Error('Erro interno do servidor');
    }
  }

  /**
   * Busca faturas vencidas
   */
  async getOverdueBillings(): Promise<BillingResponse[]> {
    try {
      const billings = await this.db.findMany(`
        SELECT 
          b.billing_id as id,
          b.client_id as clientId,
          b.campaign_id as campaignId,
          b.totem_id as totemId,
          b.billing_type as billingType,
          b.amount,
          b.currency,
          b.description,
          b.due_date as dueDate,
          b.status,
          b.payment_method as paymentMethod,
          b.payment_reference as paymentReference,
          b.notes,
          b.metadata,
          b.created_at as createdAt,
          b.updated_at as updatedAt,
          b.paid_at as paidAt,
          cl.name as clientName,
          c.title as campaignTitle,
          t.name as totemName
        FROM billing b
        LEFT JOIN clients cl ON b.client_id = cl.client_id
        LEFT JOIN campaigns c ON b.campaign_id = c.campaign_id
        LEFT JOIN totems t ON b.totem_id = t.totem_id
        WHERE b.status = 'pending' AND b.due_date < CURRENT_TIMESTAMP
        ORDER BY b.due_date ASC
      `);

      // Processar faturas
      const billingsWithInfo = billings.map(billing => {
        const info = this.getBillingInfo(billing);
        return { ...billing, ...info };
      });

      return billingsWithInfo;

    } catch (error: any) {
      await logError('❌ Erro ao buscar faturas vencidas', error);
      throw new Error('Erro interno do servidor');
    }
  }

  /**
   * Marca faturas como vencidas
   */
  async markOverdueBillings(): Promise<number> {
    try {
      const result = await this.db.executeRaw(`
        UPDATE billing 
        SET status = 'overdue', updated_at = CURRENT_TIMESTAMP
        WHERE status = 'pending' AND due_date < CURRENT_TIMESTAMP
      `);

      return result.rowCount || 0;

    } catch (error: any) {
      await logError('❌ Erro ao marcar faturas como vencidas', error);
      throw new Error('Erro interno do servidor');
    }
  }

  /**
   * Busca faturas por cliente
   */
  async getBillingsByClient(clientId: number, limit: number = 50): Promise<BillingResponse[]> {
    try {
      const billings = await this.db.findMany(`
        SELECT 
          b.billing_id as id,
          b.client_id as clientId,
          b.campaign_id as campaignId,
          b.totem_id as totemId,
          b.billing_type as billingType,
          b.amount,
          b.currency,
          b.description,
          b.due_date as dueDate,
          b.status,
          b.payment_method as paymentMethod,
          b.payment_reference as paymentReference,
          b.notes,
          b.metadata,
          b.created_at as createdAt,
          b.updated_at as updatedAt,
          b.paid_at as paidAt,
          cl.name as clientName,
          c.title as campaignTitle,
          t.name as totemName
        FROM billing b
        LEFT JOIN clients cl ON b.client_id = cl.client_id
        LEFT JOIN campaigns c ON b.campaign_id = c.campaign_id
        LEFT JOIN totems t ON b.totem_id = t.totem_id
        WHERE b.client_id = ?
        ORDER BY b.created_at DESC
        LIMIT ?
      `, [clientId, limit]);

      // Processar faturas
      const billingsWithInfo = billings.map(billing => {
        const info = this.getBillingInfo(billing);
        return { ...billing, ...info };
      });

      return billingsWithInfo;

    } catch (error: any) {
      await logError('❌ Erro ao buscar faturas por cliente', error, { clientId, limit });
      throw new Error('Erro interno do servidor');
    }
  }

  /**
   * Obtém informações da fatura
   */
  private getBillingInfo(billing: any): {
    isOverdue: boolean;
    daysOverdue: number;
  } {
    const now = new Date();
    const dueDate = new Date(billing.dueDate);

    const isOverdue = billing.status === 'pending' && now > dueDate;
    const daysOverdue = isOverdue ? Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)) : 0;

    return {
      isOverdue,
      daysOverdue
    };
  }
}

