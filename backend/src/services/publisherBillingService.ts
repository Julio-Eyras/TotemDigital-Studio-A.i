/**
 * Publisher Billing Service - Smart Signage v2.1
 * Serviço de faturamento para publishers (publicadores)
 * 
 * Publishers podem:
 * - RECEBER revenue share (% por exibir anúncios) - direction: 'outgoing'
 * - PAGAR subscription (para usar o sistema) - direction: 'incoming'
 * - Modelo híbrido (receber % E pagar subscription)
 */

import { getDatabase } from '../config/database';
// import { AuditService } from './auditService'; // Não utilizado no momento
import { logError, logDebug } from '../utils/loggerHelper';

export interface CreatePublisherBillingRequest {
  publisherId: number;
  campaignId?: number;
  totemId?: number;
  subscriptionId?: number;
  billingType: 'revenue_share' | 'payout' | 'subscription' | 'platform_fee';
  amount: number;
  currency?: string;
  direction: 'incoming' | 'outgoing'; // 'outgoing' = publisher recebe, 'incoming' = publisher paga
  revenueSharePercentage?: number; // Para revenue_share
  originalCampaignAmount?: number; // Valor original da campanha
  platformFeeAmount?: number; // Valor retido pela plataforma
  publisherShareAmount?: number; // Valor que publisher recebe
  description?: string;
  dueDate?: string;
  paymentStatus?: 'pending' | 'pending_payout' | 'paid' | 'failed' | 'refunded' | 'cancelled';
  paymentMethod?: string;
  paymentReference?: string;
  metadata?: any;
}

export interface UpdatePublisherBillingRequest {
  amount?: number;
  currency?: string;
  description?: string;
  dueDate?: string;
  paymentStatus?: 'pending' | 'pending_payout' | 'paid' | 'failed' | 'refunded' | 'cancelled';
  paymentMethod?: string;
  paymentReference?: string;
  approvedBy?: number; // Para aprovar payout
  metadata?: any;
}

export interface PublisherBillingResponse {
  billingId: number;
  publisherId: number;
  campaignId?: number;
  totemId?: number;
  subscriptionId?: number;
  billingType: string;
  amount: number;
  currency: string;
  direction: string;
  revenueSharePercentage?: number;
  originalCampaignAmount?: number;
  platformFeeAmount?: number;
  publisherShareAmount?: number;
  description: string;
  invoiceNumber?: string;
  paymentStatus: string;
  paymentDate?: string;
  dueDate?: string;
  approvedBy?: number;
  approvedAt?: string;
  paymentMethod?: string;
  paymentReference?: string;
  metadata?: any;
  createdAt: string;
  updatedAt: string;
  publisherName?: string;
  campaignTitle?: string;
  totemName?: string;
  isOverdue?: boolean;
  daysOverdue?: number;
}

export interface PublisherBillingStats {
  total: number;
  pending: number;
  paid: number;
  overdue: number;
  cancelled: number;
  totalAmount: number;
  pendingAmount: number;
  paidAmount: number;
  overdueAmount: number;
  totalOutgoing: number; // Publisher recebe
  totalIncoming: number; // Publisher paga
  byType: { type: string; count: number; amount: number }[];
  byPublisher: { publisherId: number; publisherName: string; count: number; amount: number }[];
  byMonth: { month: string; count: number; amount: number }[];
  revenueShareStats: {
    totalRevenueShare: number;
    totalPayouts: number;
    averagePercentage: number;
  };
}

export class PublisherBillingService {
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
   * Lista faturas de publishers com paginação e filtros
   */
  async getBillings(
    page: number = 1,
    limit: number = 20,
    filters: {
      publisherId?: number;
      campaignId?: number;
      totemId?: number;
      billingType?: string;
      direction?: 'incoming' | 'outgoing';
      paymentStatus?: string;
      startDate?: string;
      endDate?: string;
      search?: string;
    } = {}
  ): Promise<{ billings: PublisherBillingResponse[]; total: number; page: number; limit: number }> {
    try {
      const offset = (page - 1) * limit;
      let whereClause = 'WHERE 1=1';
      const params: any[] = [];

      if (filters.publisherId) {
        whereClause += ' AND pb.publisher_id = $' + (params.length + 1);
        params.push(filters.publisherId);
      }

      if (filters.campaignId) {
        whereClause += ' AND pb.campaign_id = $' + (params.length + 1);
        params.push(filters.campaignId);
      }

      if (filters.totemId) {
        whereClause += ' AND pb.totem_id = $' + (params.length + 1);
        params.push(filters.totemId);
      }

      if (filters.billingType) {
        whereClause += ' AND pb.billing_type = $' + (params.length + 1);
        params.push(filters.billingType);
      }

      if (filters.direction) {
        whereClause += ' AND pb.direction = $' + (params.length + 1);
        params.push(filters.direction);
      }

      if (filters.paymentStatus) {
        whereClause += ' AND pb.payment_status = $' + (params.length + 1);
        params.push(filters.paymentStatus);
      }

      if (filters.startDate) {
        whereClause += ' AND pb.created_at >= $' + (params.length + 1);
        params.push(filters.startDate);
      }

      if (filters.endDate) {
        whereClause += ' AND pb.created_at <= $' + (params.length + 1);
        params.push(filters.endDate);
      }

      if (filters.search) {
        whereClause += ' AND (pb.description ILIKE $' + (params.length + 1) + ' OR p.name ILIKE $' + (params.length + 1) + ')';
        const searchParam = `%${filters.search}%`;
        params.push(searchParam);
        params.push(searchParam);
      }

      const billings = await this.db.findMany(`
        SELECT 
          pb.billing_id as "billingId",
          pb.publisher_id as "publisherId",
          pb.campaign_id as "campaignId",
          pb.totem_id as "totemId",
          pb.subscription_id as "subscriptionId",
          pb.billing_type as "billingType",
          pb.amount,
          pb.currency,
          pb.direction,
          pb.revenue_share_percentage as "revenueSharePercentage",
          pb.original_campaign_amount as "originalCampaignAmount",
          pb.platform_fee_amount as "platformFeeAmount",
          pb.publisher_share_amount as "publisherShareAmount",
          pb.description,
          pb.invoice_number as "invoiceNumber",
          pb.payment_status as "paymentStatus",
          pb.payment_date as "paymentDate",
          pb.due_date as "dueDate",
          pb.approved_by as "approvedBy",
          pb.approved_at as "approvedAt",
          pb.payment_method as "paymentMethod",
          pb.payment_reference as "paymentReference",
          pb.metadata,
          pb.created_at as "createdAt",
          pb.updated_at as "updatedAt",
          p.name as "publisherName",
          c.title as "campaignTitle",
          t.name as "totemName",
          CASE 
            WHEN pb.payment_status IN ('pending', 'pending_payout') AND pb.due_date < CURRENT_DATE THEN true
            ELSE false
          END as "isOverdue",
          CASE 
            WHEN pb.payment_status IN ('pending', 'pending_payout') AND pb.due_date < CURRENT_DATE 
            THEN EXTRACT(DAY FROM CURRENT_DATE - pb.due_date)::int
            ELSE 0
          END as "daysOverdue"
        FROM publisher_billing pb
        LEFT JOIN publishers p ON pb.publisher_id = p.publisher_id
        LEFT JOIN campaigns c ON pb.campaign_id = c.campaign_id
        LEFT JOIN totems t ON pb.totem_id = t.totem_id
        ${whereClause}
        ORDER BY pb.created_at DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `, [...params, limit, offset]);

      const totalResult = await this.db.findFirst(`
        SELECT COUNT(*) as total
        FROM publisher_billing pb
        LEFT JOIN publishers p ON pb.publisher_id = p.publisher_id
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
      await logError('Erro ao listar faturas de publishers', error);
      throw new Error('Erro interno do servidor');
    }
  }

  /**
   * Obter fatura por ID
   */
  async getBillingById(billingId: number): Promise<PublisherBillingResponse | null> {
    try {
      const billing = await this.db.findFirst(`
        SELECT 
          pb.billing_id as "billingId",
          pb.publisher_id as "publisherId",
          pb.campaign_id as "campaignId",
          pb.totem_id as "totemId",
          pb.subscription_id as "subscriptionId",
          pb.billing_type as "billingType",
          pb.amount,
          pb.currency,
          pb.direction,
          pb.revenue_share_percentage as "revenueSharePercentage",
          pb.original_campaign_amount as "originalCampaignAmount",
          pb.platform_fee_amount as "platformFeeAmount",
          pb.publisher_share_amount as "publisherShareAmount",
          pb.description,
          pb.invoice_number as "invoiceNumber",
          pb.payment_status as "paymentStatus",
          pb.payment_date as "paymentDate",
          pb.due_date as "dueDate",
          pb.approved_by as "approvedBy",
          pb.approved_at as "approvedAt",
          pb.payment_method as "paymentMethod",
          pb.payment_reference as "paymentReference",
          pb.metadata,
          pb.created_at as "createdAt",
          pb.updated_at as "updatedAt",
          p.name as "publisherName",
          c.title as "campaignTitle",
          t.name as "totemName",
          CASE 
            WHEN pb.payment_status IN ('pending', 'pending_payout') AND pb.due_date < CURRENT_DATE THEN true
            ELSE false
          END as "isOverdue",
          CASE 
            WHEN pb.payment_status IN ('pending', 'pending_payout') AND pb.due_date < CURRENT_DATE 
            THEN EXTRACT(DAY FROM CURRENT_DATE - pb.due_date)::int
            ELSE 0
          END as "daysOverdue"
        FROM publisher_billing pb
        LEFT JOIN publishers p ON pb.publisher_id = p.publisher_id
        LEFT JOIN campaigns c ON pb.campaign_id = c.campaign_id
        LEFT JOIN totems t ON pb.totem_id = t.totem_id
        WHERE pb.billing_id = $1
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
      await logError('Erro ao obter fatura de publisher', error);
      throw new Error('Erro interno do servidor');
    }
  }

  /**
   * Criar nova fatura para publisher
   */
  async createBilling(data: CreatePublisherBillingRequest): Promise<PublisherBillingResponse> {
    try {
      // Validar publisher existe
      const publisher = await this.db.findFirst(`
        SELECT publisher_id FROM publishers 
        WHERE publisher_id = $1 AND COALESCE(active, true) = true
      `, [data.publisherId]);

      if (!publisher) {
        throw new Error('Publisher não encontrado ou inativo');
      }

      // Validar campaign se fornecida
      if (data.campaignId) {
        const campaign = await this.db.findFirst(`
          SELECT campaign_id FROM campaigns WHERE campaign_id = $1
        `, [data.campaignId]);

        if (!campaign) {
          throw new Error('Campanha não encontrada');
        }
      }

      // Validar totem se fornecido
      if (data.totemId) {
        const totem = await this.db.findFirst(`
          SELECT totem_id FROM totems WHERE totem_id = $1
        `, [data.totemId]);

        if (!totem) {
          throw new Error('Totem não encontrado');
        }
      }

      // Validar subscription se fornecida
      if (data.subscriptionId) {
        const subscription = await this.db.findFirst(`
          SELECT subscription_id FROM subscriptions 
          WHERE subscription_id = $1 AND publisher_id = $2
        `, [data.subscriptionId, data.publisherId]);

        if (!subscription) {
          throw new Error('Assinatura não encontrada ou não pertence a este publisher');
        }
      }

      // Validar revenue share se billing_type = 'revenue_share'
      if (data.billingType === 'revenue_share') {
        if (!data.revenueSharePercentage || data.revenueSharePercentage < 0 || data.revenueSharePercentage > 100) {
          throw new Error('Revenue share percentage deve estar entre 0 e 100');
        }
        if (data.direction !== 'outgoing') {
          throw new Error('Revenue share deve ter direction = outgoing');
        }
      }

      // Gerar invoice_number único
      const invoiceNumber = `PUB-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

      const result = await this.db.executeRaw(`
        INSERT INTO publisher_billing (
          publisher_id, campaign_id, totem_id, subscription_id,
          billing_type, amount, currency, direction,
          revenue_share_percentage, original_campaign_amount, platform_fee_amount, publisher_share_amount,
          description, invoice_number, payment_status, due_date,
          payment_method, payment_reference, metadata,
          created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING billing_id
      `, [
        data.publisherId,
        data.campaignId || null,
        data.totemId || null,
        data.subscriptionId || null,
        data.billingType,
        data.amount,
        data.currency || 'BRL',
        data.direction,
        data.revenueSharePercentage || null,
        data.originalCampaignAmount || null,
        data.platformFeeAmount || null,
        data.publisherShareAmount || null,
        data.description || '',
        invoiceNumber,
        data.paymentStatus || (data.direction === 'outgoing' ? 'pending_payout' : 'pending'),
        data.dueDate || null,
        data.paymentMethod || null,
        data.paymentReference || null,
        data.metadata ? JSON.stringify(data.metadata) : null
      ]);

      const billingId = result[0]?.billing_id;
      if (!billingId) {
        throw new Error('Erro ao criar fatura');
      }

      await logDebug('Fatura de publisher criada', { billingId, publisherId: data.publisherId, direction: data.direction });

      const billing = await this.getBillingById(billingId);
      if (!billing) {
        throw new Error('Erro ao buscar fatura criada');
      }

      return billing;
    } catch (error: any) {
      await logError('Erro ao criar fatura de publisher', error);
      throw error;
    }
  }

  /**
   * Aprovar payout (apenas para tenant users)
   */
  async approvePayout(billingId: number, approvedBy: number): Promise<PublisherBillingResponse> {
    try {
      const billing = await this.getBillingById(billingId);
      if (!billing) {
        throw new Error('Fatura não encontrada');
      }

      if (billing.direction !== 'outgoing') {
        throw new Error('Apenas faturas outgoing (payouts) podem ser aprovadas');
      }

      if (billing.paymentStatus === 'paid') {
        throw new Error('Fatura já foi paga');
      }

      await this.db.executeRaw(`
        UPDATE publisher_billing 
        SET 
          approved_by = $1,
          approved_at = CURRENT_TIMESTAMP,
          payment_status = 'pending_payout',
          updated_at = CURRENT_TIMESTAMP
        WHERE billing_id = $2
      `, [approvedBy, billingId]);

      await logDebug('Payout aprovado', { billingId, approvedBy });

      const updatedBilling = await this.getBillingById(billingId);
      if (!updatedBilling) {
        throw new Error('Erro ao buscar fatura atualizada');
      }

      return updatedBilling;
    } catch (error: any) {
      await logError('Erro ao aprovar payout', error);
      throw error;
    }
  }

  /**
   * Atualizar fatura
   */
  async updateBilling(billingId: number, data: UpdatePublisherBillingRequest): Promise<PublisherBillingResponse> {
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

      if (data.paymentStatus !== undefined) {
        updateFields.push(`payment_status = $${paramIndex++}`);
        updateParams.push(data.paymentStatus);
        
        // Se status mudou para 'paid', atualizar payment_date
        if (data.paymentStatus === 'paid' && existingBilling.paymentStatus !== 'paid') {
          updateFields.push(`payment_date = CURRENT_TIMESTAMP`);
        } else if (data.paymentStatus !== 'paid' && existingBilling.paymentStatus === 'paid') {
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

      if (data.approvedBy !== undefined) {
        updateFields.push(`approved_by = $${paramIndex++}`);
        updateFields.push(`approved_at = CURRENT_TIMESTAMP`);
        updateParams.push(data.approvedBy);
      }

      if (data.metadata !== undefined) {
        updateFields.push(`metadata = $${paramIndex++}`);
        updateParams.push(data.metadata ? JSON.stringify(data.metadata) : null);
      }

      updateFields.push(`updated_at = CURRENT_TIMESTAMP`);

      await this.db.executeRaw(`
        UPDATE publisher_billing 
        SET ${updateFields.join(', ')}
        WHERE billing_id = $${paramIndex}
      `, [...updateParams, billingId]);

      const updatedBilling = await this.getBillingById(billingId);
      if (!updatedBilling) {
        throw new Error('Erro ao buscar fatura atualizada');
      }

      return updatedBilling;
    } catch (error: any) {
      await logError('Erro ao atualizar fatura de publisher', error);
      throw error;
    }
  }

  /**
   * Obter estatísticas de billing de publishers
   */
  async getBillingStats(filters?: { publisherId?: number; startDate?: string; endDate?: string }): Promise<PublisherBillingStats> {
    try {
      let whereClause = 'WHERE 1=1';
      const params: any[] = [];

      if (filters?.publisherId) {
        whereClause += ' AND pb.publisher_id = $' + (params.length + 1);
        params.push(filters.publisherId);
      }

      if (filters?.startDate) {
        whereClause += ' AND pb.created_at >= $' + (params.length + 1);
        params.push(filters.startDate);
      }

      if (filters?.endDate) {
        whereClause += ' AND pb.created_at <= $' + (params.length + 1);
        params.push(filters.endDate);
      }

      const totalResult = await this.db.findFirst(`
        SELECT COUNT(*) as total FROM publisher_billing pb ${whereClause}
      `, params);

      const pendingResult = await this.db.findFirst(`
        SELECT COUNT(*) as count FROM publisher_billing pb 
        WHERE payment_status IN ('pending', 'pending_payout') ${whereClause.replace('WHERE 1=1', '')}
      `, params);

      const paidResult = await this.db.findFirst(`
        SELECT COUNT(*) as count FROM publisher_billing pb 
        WHERE payment_status = 'paid' ${whereClause.replace('WHERE 1=1', '')}
      `, params);

      const overdueResult = await this.db.findFirst(`
        SELECT COUNT(*) as count FROM publisher_billing pb 
        WHERE payment_status IN ('pending', 'pending_payout') AND due_date < CURRENT_DATE ${whereClause.replace('WHERE 1=1', '')}
      `, params);

      const cancelledResult = await this.db.findFirst(`
        SELECT COUNT(*) as count FROM publisher_billing pb 
        WHERE payment_status = 'cancelled' ${whereClause.replace('WHERE 1=1', '')}
      `, params);

      const totalAmountResult = await this.db.findFirst(`
        SELECT COALESCE(SUM(amount), 0) as total FROM publisher_billing pb ${whereClause}
      `, params);

      const pendingAmountResult = await this.db.findFirst(`
        SELECT COALESCE(SUM(amount), 0) as total FROM publisher_billing pb 
        WHERE payment_status IN ('pending', 'pending_payout') ${whereClause.replace('WHERE 1=1', '')}
      `, params);

      const paidAmountResult = await this.db.findFirst(`
        SELECT COALESCE(SUM(amount), 0) as total FROM publisher_billing pb 
        WHERE payment_status = 'paid' ${whereClause.replace('WHERE 1=1', '')}
      `, params);

      const overdueAmountResult = await this.db.findFirst(`
        SELECT COALESCE(SUM(amount), 0) as total FROM publisher_billing pb 
        WHERE payment_status IN ('pending', 'pending_payout') AND due_date < CURRENT_DATE ${whereClause.replace('WHERE 1=1', '')}
      `, params);

      const totalOutgoingResult = await this.db.findFirst(`
        SELECT COALESCE(SUM(amount), 0) as total FROM publisher_billing pb 
        WHERE direction = 'outgoing' ${whereClause.replace('WHERE 1=1', '')}
      `, params);

      const totalIncomingResult = await this.db.findFirst(`
        SELECT COALESCE(SUM(amount), 0) as total FROM publisher_billing pb 
        WHERE direction = 'incoming' ${whereClause.replace('WHERE 1=1', '')}
      `, params);

      const byType = await this.db.findMany(`
        SELECT 
          billing_type as type,
          COUNT(*) as count,
          COALESCE(SUM(amount), 0) as amount
        FROM publisher_billing pb
        ${whereClause}
        GROUP BY billing_type
        ORDER BY count DESC
      `, params);

      const byPublisher = await this.db.findMany(`
        SELECT 
          pb.publisher_id as "publisherId",
          p.name as "publisherName",
          COUNT(*) as count,
          COALESCE(SUM(pb.amount), 0) as amount
        FROM publisher_billing pb
        LEFT JOIN publishers p ON pb.publisher_id = p.publisher_id
        ${whereClause}
        GROUP BY pb.publisher_id, p.name
        ORDER BY count DESC
        LIMIT 10
      `, params);

      const byMonth = await this.db.findMany(`
        SELECT 
          TO_CHAR(created_at, 'YYYY-MM') as month,
          COUNT(*) as count,
          COALESCE(SUM(amount), 0) as amount
        FROM publisher_billing pb
        ${whereClause}
        GROUP BY TO_CHAR(created_at, 'YYYY-MM')
        ORDER BY month DESC
        LIMIT 12
      `, params);

      const revenueShareStats = await this.db.findFirst(`
        SELECT 
          COALESCE(SUM(amount), 0) as "totalRevenueShare",
          COALESCE(SUM(CASE WHEN payment_status = 'paid' THEN amount ELSE 0 END), 0) as "totalPayouts",
          COALESCE(AVG(revenue_share_percentage), 0) as "averagePercentage"
        FROM publisher_billing pb
        WHERE billing_type = 'revenue_share' ${whereClause.replace('WHERE 1=1', '')}
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
        totalOutgoing: parseFloat(totalOutgoingResult?.total || '0'),
        totalIncoming: parseFloat(totalIncomingResult?.total || '0'),
        byType: byType.map(t => ({ type: t.type, count: parseInt(t.count), amount: parseFloat(t.amount) })),
        byPublisher: byPublisher.map(p => ({ 
          publisherId: p.publisherId, 
          publisherName: p.publisherName || 'N/A', 
          count: parseInt(p.count), 
          amount: parseFloat(p.amount) 
        })),
        byMonth: byMonth.map(m => ({ month: m.month, count: parseInt(m.count), amount: parseFloat(m.amount) })),
        revenueShareStats: {
          totalRevenueShare: parseFloat(revenueShareStats?.totalRevenueShare || '0'),
          totalPayouts: parseFloat(revenueShareStats?.totalPayouts || '0'),
          averagePercentage: parseFloat(revenueShareStats?.averagePercentage || '0')
        }
      };
    } catch (error: any) {
      await logError('Erro ao buscar estatísticas de billing de publishers', error);
      throw new Error('Erro interno do servidor');
    }
  }
}

