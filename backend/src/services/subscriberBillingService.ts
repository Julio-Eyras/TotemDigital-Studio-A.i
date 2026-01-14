/**
 * Subscriber Billing Service - Smart Signage v2.1
 * Serviço de faturamento para subscribers (anunciantes)
 * 
 * Subscribers pagam por:
 * - Campanhas publicitárias
 * - Upload de mídias
 * - Lotes de exibições
 * - Quantidade de totens
 * - Tempo de exibição
 */

import { getDatabase } from '../config/database';
// import { AuditService } from './auditService'; // Não utilizado no momento
import { logError, logDebug } from '../utils/loggerHelper';

export interface CreateSubscriberBillingRequest {
  subscriberId: number;
  campaignId?: number;
  billingType: 'advertisement' | 'campaign' | 'media_upload' | 'exhibition_lot' | 'totem_quantity' | 'time_based' | 'custom';
  amount: number;
  currency?: string;
  description?: string;
  dueDate?: string;
  status?: 'pending' | 'paid' | 'overdue' | 'cancelled';
  paymentMethod?: string;
  paymentReference?: string;
  notes?: string;
  metadata?: any; // Para exhibition_lot, totem_quantity, time_based
}

export interface UpdateSubscriberBillingRequest {
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

export interface SubscriberBillingResponse {
  billingId: number;
  subscriberId: number;
  campaignId?: number;
  billingType: string;
  amount: number;
  currency: string;
  description: string;
  dueDate: string;
  status: string; // mapeado de payment_status
  paymentMethod?: string;
  metadata?: any;
  createdAt: string;
  updatedAt: string;
  paidAt?: string; // mapeado de payment_date
  subscriberName?: string;
  campaignTitle?: string;
  isOverdue?: boolean;
  daysOverdue?: number;
}

export interface SubscriberBillingStats {
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
  bySubscriber: { subscriberId: number; subscriberName: string; count: number; amount: number }[];
  byMonth: { month: string; count: number; amount: number }[];
}

export class SubscriberBillingService {
  private get db() {
    return getDatabase();
  }

  // Audit service - comentado temporariamente (não utilizado)
  // private getAuditService(): AuditService {
  //   if (!(global as any).auditServiceInstance) {
  //     (global as any).auditServiceInstance = new AuditService();
  //   }
  //   return (global as any).auditServiceInstance;
  // }

  /**
   * Lista faturas de subscribers com paginação e filtros
   */
  async getBillings(
    page: number = 1,
    limit: number = 20,
    filters: {
      subscriberId?: number;
      campaignId?: number;
      billingType?: string;
      status?: string;
      startDate?: string;
      endDate?: string;
      search?: string;
    } = {}
  ): Promise<{ billings: SubscriberBillingResponse[]; total: number; page: number; limit: number }> {
    try {
      const offset = (page - 1) * limit;
      let whereClause = 'WHERE 1=1';
      const params: any[] = [];

      if (filters.subscriberId) {
        whereClause += ' AND sb.subscriber_id = $' + (params.length + 1);
        params.push(filters.subscriberId);
      }

      if (filters.campaignId) {
        whereClause += ' AND sb.campaign_id = $' + (params.length + 1);
        params.push(filters.campaignId);
      }

      if (filters.billingType) {
        whereClause += ' AND sb.billing_type = $' + (params.length + 1);
        params.push(filters.billingType);
      }

      if (filters.status) {
        whereClause += ' AND sb.payment_status = $' + (params.length + 1);
        params.push(filters.status);
      }

      if (filters.startDate) {
        whereClause += ' AND sb.created_at >= $' + (params.length + 1);
        params.push(filters.startDate);
      }

      if (filters.endDate) {
        whereClause += ' AND sb.created_at <= $' + (params.length + 1);
        params.push(filters.endDate);
      }

      if (filters.search) {
        whereClause += ' AND (sb.description ILIKE $' + (params.length + 1) + ' OR s.name ILIKE $' + (params.length + 1) + ')';
        const searchParam = `%${filters.search}%`;
        params.push(searchParam);
        params.push(searchParam);
      }

      const billings = await this.db.findMany(`
        SELECT 
          sb.billing_id as "billingId",
          sb.subscriber_id as "subscriberId",
          sb.campaign_id as "campaignId",
          sb.billing_type as "billingType",
          sb.amount,
          sb.currency,
          sb.description,
          sb.due_date as "dueDate",
          sb.payment_status as "status",
          sb.payment_method as "paymentMethod",
          sb.metadata,
          sb.created_at as "createdAt",
          sb.updated_at as "updatedAt",
          sb.payment_date as "paidAt",
          s.name as "subscriberName",
          c.title as "campaignTitle",
          CASE 
            WHEN sb.payment_status = 'pending' AND sb.due_date < CURRENT_DATE THEN true
            ELSE false
          END as "isOverdue",
          CASE 
            WHEN sb.payment_status = 'pending' AND sb.due_date < CURRENT_DATE 
            THEN EXTRACT(DAY FROM CURRENT_DATE - sb.due_date)::int
            ELSE 0
          END as "daysOverdue"
        FROM subscriber_billing sb
        LEFT JOIN subscribers s ON sb.subscriber_id = s.subscriber_id
        LEFT JOIN campaigns c ON sb.campaign_id = c.campaign_id
        ${whereClause}
        ORDER BY sb.created_at DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `, [...params, limit, offset]);

      const totalResult = await this.db.findFirst(`
        SELECT COUNT(*) as total
        FROM subscriber_billing sb
        LEFT JOIN subscribers s ON sb.subscriber_id = s.subscriber_id
        ${whereClause}
      `, params);

      return {
        billings: billings.map(b => ({
          ...b,
          isOverdue: b.isOverdue || false,
          daysOverdue: b.daysOverdue || 0
        })),
        total: parseInt(totalResult?.total || '0'),
        page,
        limit
      };
    } catch (error: any) {
      await logError('Erro ao listar faturas de subscribers', error);
      throw new Error('Erro interno do servidor');
    }
  }

  /**
   * Obter fatura por ID
   */
  async getBillingById(billingId: number): Promise<SubscriberBillingResponse | null> {
    try {
      const billing = await this.db.findFirst(`
        SELECT 
          sb.billing_id as "billingId",
          sb.subscriber_id as "subscriberId",
          sb.campaign_id as "campaignId",
          sb.billing_type as "billingType",
          sb.amount,
          sb.currency,
          sb.description,
          sb.due_date as "dueDate",
          sb.payment_status as "status",
          sb.payment_method as "paymentMethod",
          sb.metadata,
          sb.created_at as "createdAt",
          sb.updated_at as "updatedAt",
          sb.payment_date as "paidAt",
          s.name as "subscriberName",
          c.title as "campaignTitle",
          CASE 
            WHEN sb.payment_status = 'pending' AND sb.due_date < CURRENT_DATE THEN true
            ELSE false
          END as "isOverdue",
          CASE 
            WHEN sb.payment_status = 'pending' AND sb.due_date < CURRENT_DATE 
            THEN EXTRACT(DAY FROM CURRENT_DATE - sb.due_date)::int
            ELSE 0
          END as "daysOverdue"
        FROM subscriber_billing sb
        LEFT JOIN subscribers s ON sb.subscriber_id = s.subscriber_id
        LEFT JOIN campaigns c ON sb.campaign_id = c.campaign_id
        WHERE sb.billing_id = $1
      `, [billingId]);

      if (!billing) {
        return null;
      }

      return {
        ...billing,
        isOverdue: billing.isOverdue || false,
        daysOverdue: billing.daysOverdue || 0
      };
    } catch (error: any) {
      await logError('Erro ao obter fatura de subscriber', error);
      throw new Error('Erro interno do servidor');
    }
  }

  /**
   * Criar nova fatura para subscriber
   */
  async createBilling(data: CreateSubscriberBillingRequest): Promise<SubscriberBillingResponse> {
    try {
      // Validar subscriber existe
      const subscriber = await this.db.findFirst(`
        SELECT subscriber_id FROM subscribers 
        WHERE subscriber_id = $1 AND COALESCE(is_active, true) = true
      `, [data.subscriberId]);

      if (!subscriber) {
        throw new Error('Subscriber não encontrado ou inativo');
      }

      // Validar campaign se fornecida
      if (data.campaignId) {
        const campaign = await this.db.findFirst(`
          SELECT campaign_id FROM campaigns 
          WHERE campaign_id = $1 AND subscriber_id = $2
        `, [data.campaignId, data.subscriberId]);

        if (!campaign) {
          throw new Error('Campanha não encontrada ou não pertence a este subscriber');
        }
      }

      const result = await this.db.executeRaw(`
        INSERT INTO subscriber_billing (
          subscriber_id, campaign_id, billing_type, amount, currency, 
          description, due_date, status, payment_method, payment_reference, 
          notes, metadata, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING billing_id
      `, [
        data.subscriberId,
        data.campaignId || null,
        data.billingType,
        data.amount,
        data.currency || 'BRL',
        data.description || '',
        data.dueDate || null,
        data.status || 'pending',
        data.paymentMethod || null,
        data.paymentReference || null,
        data.notes || null,
        data.metadata ? JSON.stringify(data.metadata) : null
      ]);

      const billingId = result[0]?.billing_id;
      if (!billingId) {
        throw new Error('Erro ao criar fatura');
      }

      await logDebug('Fatura de subscriber criada', { billingId, subscriberId: data.subscriberId });

      const billing = await this.getBillingById(billingId);
      if (!billing) {
        throw new Error('Erro ao buscar fatura criada');
      }

      return billing;
    } catch (error: any) {
      await logError('Erro ao criar fatura de subscriber', error);
      throw error;
    }
  }

  /**
   * Atualizar fatura
   */
  async updateBilling(billingId: number, data: UpdateSubscriberBillingRequest): Promise<SubscriberBillingResponse> {
    try {
      const existingBilling = await this.getBillingById(billingId);
      if (!existingBilling) {
        throw new Error('Fatura não encontrada');
      }

      const updateFields: string[] = [];
      const updateParams: any[] = [];
      let paramIndex = 1;

      if (data.amount !== undefined) {
        updateFields.push(`amount = $${paramIndex++}`);
        updateParams.push(data.amount);
      }

      if (data.currency !== undefined) {
        updateFields.push(`currency = $${paramIndex++}`);
        updateParams.push(data.currency);
      }

      if (data.description !== undefined) {
        updateFields.push(`description = $${paramIndex++}`);
        updateParams.push(data.description);
      }

      if (data.dueDate !== undefined) {
        updateFields.push(`due_date = $${paramIndex++}`);
        updateParams.push(data.dueDate);
      }

      if (data.status !== undefined) {
        updateFields.push(`status = $${paramIndex++}`);
        updateParams.push(data.status);
        
        // Se status mudou para 'paid', atualizar paid_at
        if (data.status === 'paid' && existingBilling.status !== 'paid') {
          updateFields.push(`paid_at = CURRENT_TIMESTAMP`);
        } else if (data.status !== 'paid' && existingBilling.status === 'paid') {
          updateFields.push(`paid_at = NULL`);
        }
      }

      if (data.paymentMethod !== undefined) {
        updateFields.push(`payment_method = $${paramIndex++}`);
        updateParams.push(data.paymentMethod);
      }

      if (data.paymentReference !== undefined) {
        updateFields.push(`payment_reference = $${paramIndex++}`);
        updateParams.push(data.paymentReference);
      }

      if (data.notes !== undefined) {
        updateFields.push(`notes = $${paramIndex++}`);
        updateParams.push(data.notes);
      }

      if (data.metadata !== undefined) {
        updateFields.push(`metadata = $${paramIndex++}`);
        updateParams.push(data.metadata ? JSON.stringify(data.metadata) : null);
      }

      updateFields.push(`updated_at = CURRENT_TIMESTAMP`);

      await this.db.executeRaw(`
        UPDATE subscriber_billing 
        SET ${updateFields.join(', ')}
        WHERE billing_id = $${paramIndex}
      `, [...updateParams, billingId]);

      const updatedBilling = await this.getBillingById(billingId);
      if (!updatedBilling) {
        throw new Error('Erro ao buscar fatura atualizada');
      }

      return updatedBilling;
    } catch (error: any) {
      await logError('Erro ao atualizar fatura de subscriber', error);
      throw error;
    }
  }

  /**
   * Obter estatísticas de billing de subscribers
   */
  async getBillingStats(filters?: { subscriberId?: number; startDate?: string; endDate?: string }): Promise<SubscriberBillingStats> {
    try {
      let whereClause = 'WHERE 1=1';
      const params: any[] = [];

      if (filters?.subscriberId) {
        whereClause += ' AND sb.subscriber_id = $' + (params.length + 1);
        params.push(filters.subscriberId);
      }

      if (filters?.startDate) {
        whereClause += ' AND sb.created_at >= $' + (params.length + 1);
        params.push(filters.startDate);
      }

      if (filters?.endDate) {
        whereClause += ' AND sb.created_at <= $' + (params.length + 1);
        params.push(filters.endDate);
      }

      const totalResult = await this.db.findFirst(`
        SELECT COUNT(*) as total FROM subscriber_billing sb ${whereClause}
      `, params);

      const pendingResult = await this.db.findFirst(`
        SELECT COUNT(*) as count FROM subscriber_billing sb 
        WHERE status = 'pending' ${whereClause.replace('WHERE 1=1', '')}
      `, params);

      const paidResult = await this.db.findFirst(`
        SELECT COUNT(*) as count FROM subscriber_billing sb 
        WHERE status = 'paid' ${whereClause.replace('WHERE 1=1', '')}
      `, params);

      const overdueResult = await this.db.findFirst(`
        SELECT COUNT(*) as count FROM subscriber_billing sb 
        WHERE status = 'pending' AND due_date < CURRENT_DATE ${whereClause.replace('WHERE 1=1', '')}
      `, params);

      const cancelledResult = await this.db.findFirst(`
        SELECT COUNT(*) as count FROM subscriber_billing sb 
        WHERE status = 'cancelled' ${whereClause.replace('WHERE 1=1', '')}
      `, params);

      const totalAmountResult = await this.db.findFirst(`
        SELECT COALESCE(SUM(amount), 0) as total FROM subscriber_billing sb ${whereClause}
      `, params);

      const pendingAmountResult = await this.db.findFirst(`
        SELECT COALESCE(SUM(amount), 0) as total FROM subscriber_billing sb 
        WHERE status = 'pending' ${whereClause.replace('WHERE 1=1', '')}
      `, params);

      const paidAmountResult = await this.db.findFirst(`
        SELECT COALESCE(SUM(amount), 0) as total FROM subscriber_billing sb 
        WHERE status = 'paid' ${whereClause.replace('WHERE 1=1', '')}
      `, params);

      const overdueAmountResult = await this.db.findFirst(`
        SELECT COALESCE(SUM(amount), 0) as total FROM subscriber_billing sb 
        WHERE status = 'pending' AND due_date < CURRENT_DATE ${whereClause.replace('WHERE 1=1', '')}
      `, params);

      const byType = await this.db.findMany(`
        SELECT 
          billing_type as type,
          COUNT(*) as count,
          COALESCE(SUM(amount), 0) as amount
        FROM subscriber_billing sb
        ${whereClause}
        GROUP BY billing_type
        ORDER BY count DESC
      `, params);

      const bySubscriber = await this.db.findMany(`
        SELECT 
          sb.subscriber_id as "subscriberId",
          s.name as "subscriberName",
          COUNT(*) as count,
          COALESCE(SUM(sb.amount), 0) as amount
        FROM subscriber_billing sb
        LEFT JOIN subscribers s ON sb.subscriber_id = s.subscriber_id
        ${whereClause}
        GROUP BY sb.subscriber_id, s.name
        ORDER BY count DESC
        LIMIT 10
      `, params);

      const byMonth = await this.db.findMany(`
        SELECT 
          TO_CHAR(created_at, 'YYYY-MM') as month,
          COUNT(*) as count,
          COALESCE(SUM(amount), 0) as amount
        FROM subscriber_billing sb
        ${whereClause}
        GROUP BY TO_CHAR(created_at, 'YYYY-MM')
        ORDER BY month DESC
        LIMIT 12
      `, params);

      return {
        total: parseInt(totalResult?.total || '0'),
        pending: parseInt(pendingResult?.count || '0'),
        paid: parseInt(paidResult?.count || '0'),
        overdue: parseInt(overdueResult?.count || '0'),
        cancelled: parseInt(cancelledResult?.count || '0'),
        totalAmount: parseFloat(totalAmountResult?.total || '0'),
        pendingAmount: parseFloat(pendingAmountResult?.total || '0'),
        paidAmount: parseFloat(paidAmountResult?.total || '0'),
        overdueAmount: parseFloat(overdueAmountResult?.total || '0'),
        byType: byType.map(t => ({ type: t.type, count: parseInt(t.count), amount: parseFloat(t.amount) })),
        bySubscriber: bySubscriber.map(s => ({ 
          subscriberId: s.subscriberId, 
          subscriberName: s.subscriberName || 'N/A', 
          count: parseInt(s.count), 
          amount: parseFloat(s.amount) 
        })),
        byMonth: byMonth.map(m => ({ month: m.month, count: parseInt(m.count), amount: parseFloat(m.amount) }))
      };
    } catch (error: any) {
      await logError('Erro ao buscar estatísticas de billing de subscribers', error);
      throw new Error('Erro interno do servidor');
    }
  }
}

