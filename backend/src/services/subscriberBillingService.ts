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
import { transaction } from '../config/database-pg';
// import { AuditService } from './auditService'; // Não utilizado no momento
import { logError, logDebug } from '../utils/loggerHelper';
import type { PoolClient } from 'pg';

export interface CreateSubscriberBillingRequest {
  subscriberId: number;
  campaignId?: number;
  contractId?: number;
  periodStart?: string;
  periodEnd?: string;
  invoiceNumber?: string;
  billingType: 'advertisement' | 'campaign' | 'media_upload' | 'exhibition_lot' | 'totem_quantity' | 'time_based' | 'custom' | 'subscription' | 'storage';
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
  dueSoon: number;
  cancelled: number;
  totalAmount: number;
  pendingAmount: number;
  paidAmount: number;
  overdueAmount: number;
  dueSoonAmount: number;
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
      /** Quando definido, só linhas de assinantes com contrato ativo ligado a este publisher_id (organização dona). */
      linkedPublisherId?: number;
      campaignId?: number;
      billingType?: string;
      status?: string;
      /** overdue | due_soon — filtra por data de vencimento */
      dueFilter?: 'overdue' | 'due_soon';
      dueSoonDays?: number;
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

      if (filters.linkedPublisherId != null && !Number.isNaN(Number(filters.linkedPublisherId))) {
        const p = Number(filters.linkedPublisherId);
        whereClause += ` AND EXISTS (
          SELECT 1 FROM subscriber_contracts sc
          INNER JOIN plan_publisher_access ppa ON ppa.plan_id = sc.plan_id
            AND ppa.publisher_id = $${params.length + 1}
            AND ppa.is_allowed = true
            AND COALESCE(ppa.is_active, true) = true
          WHERE sc.subscriber_id = sb.subscriber_id
            AND sc.status = 'active'
            AND (sc.end_date IS NULL OR sc.end_date >= CURRENT_DATE)
            AND (sc.start_date IS NULL OR sc.start_date <= CURRENT_DATE)
        )`;
        params.push(p);
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

      if (filters.dueFilter === 'overdue') {
        whereClause += ` AND sb.payment_status IN ('pending', 'overdue')
          AND sb.due_date IS NOT NULL AND sb.due_date < CURRENT_DATE`;
      } else if (filters.dueFilter === 'due_soon') {
        const days = Math.min(Math.max(filters.dueSoonDays ?? 30, 1), 365);
        whereClause += ` AND sb.payment_status = 'pending'
          AND sb.due_date IS NOT NULL
          AND sb.due_date >= CURRENT_DATE
          AND sb.due_date <= CURRENT_DATE + ($${params.length + 1}::int * INTERVAL '1 day')`;
        params.push(days);
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
          sb.contract_id as "contractId",
          sb.period_start as "periodStart",
          sb.period_end as "periodEnd",
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
          END as "daysOverdue",
          CASE
            WHEN sb.payment_status = 'pending'
              AND sb.due_date IS NOT NULL
              AND sb.due_date >= CURRENT_DATE
              AND sb.due_date <= CURRENT_DATE + (30 * INTERVAL '1 day')
            THEN true
            ELSE false
          END as "isDueSoon",
          CASE
            WHEN sb.payment_status = 'pending'
              AND sb.due_date IS NOT NULL
              AND sb.due_date >= CURRENT_DATE
            THEN GREATEST(0, EXTRACT(DAY FROM sb.due_date - CURRENT_DATE)::int)
            ELSE NULL
          END as "daysUntilDue"
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
   * Obter fatura por ID usando client específico (para transações)
   */
  private async getBillingByIdWithClient(client: PoolClient, billingId: number): Promise<SubscriberBillingResponse | null> {
    const result = await client.query(`
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

    if (result.rows.length === 0) {
      return null;
    }

    const billing = result.rows[0];
    return {
      ...billing,
      isOverdue: billing.isOverdue || false,
      daysOverdue: billing.daysOverdue || 0
    };
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
          sb.contract_id as "contractId",
          sb.period_start as "periodStart",
          sb.period_end as "periodEnd",
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
            WHEN sb.payment_status IN ('pending', 'overdue') AND sb.due_date IS NOT NULL AND sb.due_date < CURRENT_DATE THEN true
            ELSE false
          END as "isOverdue",
          CASE 
            WHEN sb.payment_status IN ('pending', 'overdue') AND sb.due_date IS NOT NULL AND sb.due_date < CURRENT_DATE 
            THEN EXTRACT(DAY FROM CURRENT_DATE - sb.due_date)::int
            ELSE 0
          END as "daysOverdue",
          CASE
            WHEN sb.payment_status = 'pending'
              AND sb.due_date IS NOT NULL
              AND sb.due_date >= CURRENT_DATE
              AND sb.due_date <= CURRENT_DATE + (30 * INTERVAL '1 day')
            THEN true
            ELSE false
          END as "isDueSoon",
          CASE
            WHEN sb.payment_status = 'pending'
              AND sb.due_date IS NOT NULL
              AND sb.due_date >= CURRENT_DATE
            THEN GREATEST(0, EXTRACT(DAY FROM sb.due_date - CURRENT_DATE)::int)
            ELSE NULL
          END as "daysUntilDue"
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
   * Criar nova fatura para subscriber (com transação para garantir consistência)
   */
  async createBilling(data: CreateSubscriberBillingRequest): Promise<SubscriberBillingResponse> {
    return await transaction(async (client) => {
      try {
        // Validar subscriber existe (dentro da transação)
        const subscriberResult = await client.query(`
          SELECT subscriber_id FROM subscribers 
          WHERE subscriber_id = $1 AND COALESCE(is_active, true) = true
        `, [data.subscriberId]);

        if (subscriberResult.rows.length === 0) {
          throw new Error('Subscriber não encontrado ou inativo');
        }

        // Validar campaign se fornecida (dentro da transação)
        if (data.campaignId) {
          const campaignResult = await client.query(`
            SELECT campaign_id FROM campaigns 
            WHERE campaign_id = $1 AND subscriber_id = $2
          `, [data.campaignId, data.subscriberId]);

          if (campaignResult.rows.length === 0) {
            throw new Error('Campanha não encontrada ou não pertence a este subscriber');
          }
        }

        // Criar fatura (dentro da transação)
        const result = await client.query(`
          INSERT INTO subscriber_billing (
            subscriber_id, campaign_id, contract_id, period_start, period_end,
            billing_type, amount, currency, invoice_number,
            description, due_date, payment_status, payment_method, payment_reference, 
            notes, metadata, created_at, updated_at
          )
          VALUES ($1, $2, $3, $4::date, $5::date, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          RETURNING billing_id
        `, [
          data.subscriberId,
          data.campaignId || null,
          data.contractId || null,
          data.periodStart || null,
          data.periodEnd || null,
          data.billingType,
          data.amount,
          data.currency || 'BRL',
          data.invoiceNumber || null,
          data.description || '',
          data.dueDate || null,
          data.status || 'pending',
          data.paymentMethod || null,
          data.paymentReference || null,
          data.notes || null,
          data.metadata ? JSON.stringify(data.metadata) : null,
        ]);

        const billingId = result.rows[0]?.billing_id;
        if (!billingId) {
          throw new Error('Erro ao criar fatura');
        }

        await logDebug('Fatura de subscriber criada', { billingId, subscriberId: data.subscriberId });

        // Buscar fatura criada (dentro da transação)
        const billing = await this.getBillingByIdWithClient(client, billingId);
        if (!billing) {
          throw new Error('Erro ao buscar fatura criada');
        }

        return billing;
      } catch (error: any) {
        await logError('Erro ao criar fatura de subscriber', error);
        throw error;
      }
    });
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
        updateFields.push(`payment_status = $${paramIndex++}`);
        updateParams.push(data.status);

        if (data.status === 'paid' && existingBilling.status !== 'paid') {
          updateFields.push(`payment_date = CURRENT_TIMESTAMP`);
        } else if (data.status !== 'paid' && existingBilling.status === 'paid') {
          updateFields.push(`payment_date = NULL`);
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
  async getBillingStats(
    filters?: { subscriberId?: number; startDate?: string; endDate?: string; dueSoonDays?: number }
  ): Promise<SubscriberBillingStats> {
    try {
      const dueSoonDays = Math.min(Math.max(filters?.dueSoonDays ?? 30, 1), 365);
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

      const extra = whereClause.replace('WHERE 1=1', '');

      const totalResult = await this.db.findFirst(`
        SELECT COUNT(*) as total FROM subscriber_billing sb ${whereClause}
      `, params);

      const pendingResult = await this.db.findFirst(`
        SELECT COUNT(*) as count FROM subscriber_billing sb 
        WHERE sb.payment_status = 'pending' ${extra}
      `, params);

      const paidResult = await this.db.findFirst(`
        SELECT COUNT(*) as count FROM subscriber_billing sb 
        WHERE sb.payment_status = 'paid' ${extra}
      `, params);

      const overdueResult = await this.db.findFirst(`
        SELECT COUNT(*) as count FROM subscriber_billing sb 
        WHERE sb.payment_status IN ('pending', 'overdue')
          AND sb.due_date IS NOT NULL AND sb.due_date < CURRENT_DATE ${extra}
      `, params);

      const dueSoonResult = await this.db.findFirst(
        `
        SELECT COUNT(*) as count FROM subscriber_billing sb
        WHERE sb.payment_status = 'pending'
          AND sb.due_date IS NOT NULL
          AND sb.due_date >= CURRENT_DATE
          AND sb.due_date <= CURRENT_DATE + ($${params.length + 1}::int * INTERVAL '1 day')
          ${extra}
      `,
        [...params, dueSoonDays]
      );

      const cancelledResult = await this.db.findFirst(`
        SELECT COUNT(*) as count FROM subscriber_billing sb 
        WHERE sb.payment_status = 'cancelled' ${extra}
      `, params);

      const totalAmountResult = await this.db.findFirst(`
        SELECT COALESCE(SUM(amount), 0) as total FROM subscriber_billing sb ${whereClause}
      `, params);

      const pendingAmountResult = await this.db.findFirst(`
        SELECT COALESCE(SUM(amount), 0) as total FROM subscriber_billing sb 
        WHERE sb.payment_status = 'pending' ${extra}
      `, params);

      const paidAmountResult = await this.db.findFirst(`
        SELECT COALESCE(SUM(amount), 0) as total FROM subscriber_billing sb 
        WHERE sb.payment_status = 'paid' ${extra}
      `, params);

      const overdueAmountResult = await this.db.findFirst(`
        SELECT COALESCE(SUM(amount), 0) as total FROM subscriber_billing sb 
        WHERE sb.payment_status IN ('pending', 'overdue')
          AND sb.due_date IS NOT NULL AND sb.due_date < CURRENT_DATE ${extra}
      `, params);

      const dueSoonAmountResult = await this.db.findFirst(
        `
        SELECT COALESCE(SUM(amount), 0) as total FROM subscriber_billing sb
        WHERE sb.payment_status = 'pending'
          AND sb.due_date IS NOT NULL
          AND sb.due_date >= CURRENT_DATE
          AND sb.due_date <= CURRENT_DATE + ($${params.length + 1}::int * INTERVAL '1 day')
          ${extra}
      `,
        [...params, dueSoonDays]
      );

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
        dueSoon: parseInt(dueSoonResult?.count || '0'),
        cancelled: parseInt(cancelledResult?.count || '0'),
        totalAmount: parseFloat(totalAmountResult?.total || '0'),
        pendingAmount: parseFloat(pendingAmountResult?.total || '0'),
        paidAmount: parseFloat(paidAmountResult?.total || '0'),
        overdueAmount: parseFloat(overdueAmountResult?.total || '0'),
        dueSoonAmount: parseFloat(dueSoonAmountResult?.total || '0'),
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

