import { getDatabase } from '../config/database';
import {

  billingIntervalLabel,
  isBillingIntervalCode,
  resolvePublisherContractBillingInterval,
} from '../utils/billingIntervals';
import { logError } from '../utils/loggerHelper';
import { todayYmd } from '../utils/businessDate';
import { normalizeError } from '../utils/errors';

export interface PublisherContract {
  contract_id: number;
  publisher_id: number;
  contract_number: string;
  contract_type: 'revenue_share' | 'subscription' | 'partnership' | 'hybrid';
  title: string;
  description?: string;
  start_date: string;
  end_date?: string;
  revenue_share_percentage?: number;
  revenue_share_rules?: unknown;
  minimum_payout_amount?: number;
  subscription_amount?: number;
  billing_interval?: string;
  subscription_interval?: string;
  currency: string;
  payment_terms?: string;
  document_path?: string;
  document_filename?: string;
  document_mime_type?: string;
  document_size_bytes?: number;
  status: 'draft' | 'active' | 'expired' | 'terminated' | 'cancelled';
  signed_by_publisher_at?: string;
  signed_by_tenant_at?: string;
  metadata?: unknown;
  created_at: string;
  updated_at: string;
  // created_before_publisher removed from schema
  // Relacionamentos
  publisher_name?: string;
}

export interface CreatePublisherContractRequest {
  publisher_id: number;
  contract_number: string;
  contract_type: 'revenue_share' | 'subscription' | 'partnership' | 'hybrid';
  title: string;
  description?: string;
  start_date: string;
  end_date?: string;
  revenue_share_percentage?: number;
  revenue_share_rules?: unknown;
  minimum_payout_amount?: number;
  subscription_amount?: number;
  billing_interval?: string;
  subscription_interval?: string;
  currency?: string;
  payment_terms?: string;
  document_path?: string;
  document_filename?: string;
  document_mime_type?: string;
  document_size_bytes?: number;
  status?: 'draft' | 'active' | 'expired' | 'terminated' | 'cancelled';
  signed_by_publisher_at?: string;
  signed_by_tenant_at?: string;
  metadata?: unknown;
  // created_before_publisher removed from API
}

export interface UpdatePublisherContractRequest {
  contract_number?: string;
  contract_type?: 'revenue_share' | 'subscription' | 'partnership' | 'hybrid';
  title?: string;
  description?: string;
  start_date?: string;
  end_date?: string;
  revenue_share_percentage?: number;
  revenue_share_rules?: unknown;
  minimum_payout_amount?: number;
  subscription_amount?: number;
  billing_interval?: string;
  subscription_interval?: string;
  currency?: string;
  payment_terms?: string;
  document_path?: string;
  document_filename?: string;
  document_mime_type?: string;
  document_size_bytes?: number;
  status?: 'draft' | 'active' | 'expired' | 'terminated' | 'cancelled';
  signed_by_publisher_at?: string;
  signed_by_tenant_at?: string;
  metadata?: unknown;
}

export interface PublisherContractListResponse {
  data: PublisherContract[];
  total: number;
  page: number;
  limit: number;
}

export class PublisherContractService {
  private get db() {
    return getDatabase();
  }

  /**
   * Listar contratos de publishers com paginação e filtros
   */
  async getAllContracts(params: {
    page?: number;
    limit?: number;
    search?: string;
    publisherId?: number;
    status?: string;
    contractType?: string;
    activeOnly?: boolean;
  }): Promise<PublisherContractListResponse> {
    try {
      const { page = 1, limit = 20, search, publisherId, status, contractType, activeOnly } = params;
      const offset = (page - 1) * limit;

      let whereClause = 'WHERE 1=1';
      const queryParams: unknown[] = [];

      if (search) {
        whereClause += ` AND (pc.title ILIKE $${queryParams.length + 1} OR pc.contract_number ILIKE $${queryParams.length + 1} OR p.name ILIKE $${queryParams.length + 1})`;
        queryParams.push(`%${search}%`);
      }

      if (publisherId) {
        whereClause += ` AND pc.publisher_id = $${queryParams.length + 1}`;
        queryParams.push(publisherId);
      }

      if (status) {
        whereClause += ` AND pc.status = $${queryParams.length + 1}`;
        queryParams.push(status);
      }

      if (contractType) {
        whereClause += ` AND pc.contract_type = $${queryParams.length + 1}`;
        queryParams.push(contractType);
      }

      if (activeOnly) {
        whereClause += ` AND pc.status = 'active'`;
        const now = todayYmd();
        whereClause += ` AND pc.start_date <= $${queryParams.length + 1}`;
        queryParams.push(now);
        whereClause += ` AND (pc.end_date IS NULL OR pc.end_date >= $${queryParams.length + 1})`;
        queryParams.push(now);
      }

      const contracts = await this.db.findMany(`
        SELECT 
          pc.contract_id,
          pc.publisher_id,
          pc.contract_number,
          pc.contract_type,
          pc.title,
          pc.description,
          pc.start_date,
          pc.end_date,
          pc.revenue_share_percentage,
          pc.revenue_share_rules,
          pc.minimum_payout_amount,
          pc.subscription_amount,
          COALESCE(pc.billing_interval, pc.subscription_interval) AS billing_interval,
          pc.subscription_interval,
          pc.currency,
          pc.payment_terms,
          pc.document_path,
          pc.document_filename,
          pc.document_mime_type,
          pc.document_size_bytes,
          pc.status,
          pc.signed_by_publisher_at,
          pc.signed_by_tenant_at,
          pc.metadata,
          pc.created_at,
          pc.updated_at,
        -- created_before_publisher removed from schema
          p.name as publisher_name
        FROM publisher_contracts pc
        LEFT JOIN publishers p ON pc.publisher_id = p.publisher_id
        ${whereClause}
        ORDER BY pc.created_at DESC
        LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}
      `, [...queryParams, limit, offset]);

      const totalResult = await this.db.findFirst(`
        SELECT COUNT(*) as total
        FROM publisher_contracts pc
        ${whereClause}
      `, queryParams);

      return {
        data: contracts,
        total: parseInt(totalResult?.total || '0'),
        page,
        limit,
      };} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('Erro ao listar contratos de publishers', e.error, { params });
      throw new Error('Erro interno do servidor');
    }
  }

  /**
   * Obter contrato de publisher por ID
   */
  async getContractById(id: number): Promise<PublisherContract | null> {
    try {
      const contract = await this.db.findFirst(`
        SELECT 
          pc.contract_id,
          pc.publisher_id,
          pc.contract_number,
          pc.contract_type,
          pc.title,
          pc.description,
          pc.start_date,
          pc.end_date,
          pc.revenue_share_percentage,
          pc.revenue_share_rules,
          pc.minimum_payout_amount,
          pc.subscription_amount,
          COALESCE(pc.billing_interval, pc.subscription_interval) AS billing_interval,
          pc.subscription_interval,
          pc.currency,
          pc.payment_terms,
          pc.document_path,
          pc.document_filename,
          pc.document_mime_type,
          pc.document_size_bytes,
          pc.status,
          pc.signed_by_publisher_at,
          pc.signed_by_tenant_at,
          pc.metadata,
          pc.created_at,
          pc.updated_at,
          -- created_before_publisher removed from schema
          p.name as publisher_name
        FROM publisher_contracts pc
        LEFT JOIN publishers p ON pc.publisher_id = p.publisher_id
        WHERE pc.contract_id = $1
      `, [id]);

      return contract || null;} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('Erro ao buscar contrato de publisher', e.error, { id });
      throw e.error;
    }
  }

  /**
   * Criar novo contrato de publisher
   */
  async createContract(data: CreatePublisherContractRequest, createdBy?: number): Promise<PublisherContract> {
    try {
      const {
        publisher_id,
        contract_number,
        contract_type,
        title,
        description,
        start_date,
        end_date,
        revenue_share_percentage,
        revenue_share_rules,
        minimum_payout_amount,
        subscription_amount,
        subscription_interval: subscriptionIntervalInput,
        billing_interval: billingIntervalInput,
        currency = 'BRL',
        payment_terms,
        document_path,
        document_filename,
        document_mime_type,
        document_size_bytes,
        status = 'draft',
        signed_by_publisher_at,
        signed_by_tenant_at,
        metadata,
      } = data;

      // Enforce publisher_id presence — pre-contract concept removed
      if (!publisher_id) {
        throw new Error('publisher_id é obrigatório para criar um contrato de publisher');
      }

      // Validar contract_number único POR PUBLISHER
      const existingContract = await this.db.findFirst(`
        SELECT contract_id 
        FROM publisher_contracts 
        WHERE publisher_id = $1 AND contract_number = $2
      `, [publisher_id, contract_number]);

      if (existingContract) {
        throw new Error('Número de contrato já existe');
      }

      const resolvedInterval = resolvePublisherContractBillingInterval({
        billing_interval: billingIntervalInput,
        subscription_interval: subscriptionIntervalInput,
      });
      if (
        (billingIntervalInput || subscriptionIntervalInput) &&
        resolvedInterval &&
        !isBillingIntervalCode(resolvedInterval)
      ) {
        throw new Error('Intervalo de cobrança inválido');
      }
      const intervalToStore = resolvedInterval;
      const paymentTermsResolved =
        payment_terms || (intervalToStore ? billingIntervalLabel(intervalToStore) : null);

      // Criar contrato
      const result = await this.db.executeRaw(`
        INSERT INTO publisher_contracts (
          publisher_id, contract_number, contract_type, title, description,
          start_date, end_date, revenue_share_percentage, revenue_share_rules,
          minimum_payout_amount, subscription_amount, billing_interval, subscription_interval,
          currency, payment_terms, document_path, document_filename,
          document_mime_type, document_size_bytes, status,
          signed_by_publisher_at, signed_by_tenant_at, metadata,
          created_by
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24)
        RETURNING contract_id
      `, [
        publisher_id || null,
        contract_number,
        contract_type,
        title,
        description || null,
        start_date,
        end_date || null,
        revenue_share_percentage || null,
        revenue_share_rules ? JSON.stringify(revenue_share_rules) : null,
        minimum_payout_amount || null,
        subscription_amount || null,
        intervalToStore,
        intervalToStore,
        currency,
        paymentTermsResolved,
        document_path || null,
        document_filename || null,
        document_mime_type || null,
        document_size_bytes || null,
        status,
        signed_by_publisher_at || null,
        signed_by_tenant_at || null,
        metadata ? JSON.stringify(metadata) : null,
        createdBy || null,
      ]);

      if (!result.rows || result.rows.length === 0) {
        throw new Error('Erro ao criar contrato');
      }

      const contractId = result.rows[0].contract_id;
      const newContract = await this.getContractById(contractId);

      if (!newContract) {
        throw new Error('Erro ao buscar contrato criado');
      }

      return newContract;} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('Erro ao criar contrato de publisher', e.error, { data });
      throw e.error;
    }
  }

  /**
   * Atualizar contrato de publisher
   */
  async updateContract(id: number, data: UpdatePublisherContractRequest): Promise<PublisherContract> {
    try {
      const updateFields: string[] = [];
      const updateParams: unknown[] = [];
      let paramIndex = 1;

      if (data.contract_number !== undefined) {
        updateFields.push(`contract_number = $${paramIndex++}`);
        updateParams.push(data.contract_number);
      }

      if (data.contract_type !== undefined) {
        updateFields.push(`contract_type = $${paramIndex++}`);
        updateParams.push(data.contract_type);
      }

      if (data.title !== undefined) {
        updateFields.push(`title = $${paramIndex++}`);
        updateParams.push(data.title);
      }

      if (data.description !== undefined) {
        updateFields.push(`description = $${paramIndex++}`);
        updateParams.push(data.description);
      }

      if (data.start_date !== undefined) {
        updateFields.push(`start_date = $${paramIndex++}`);
        updateParams.push(data.start_date);
      }

      if (data.end_date !== undefined) {
        updateFields.push(`end_date = $${paramIndex++}`);
        updateParams.push(data.end_date || null);
      }

      if (data.revenue_share_percentage !== undefined) {
        updateFields.push(`revenue_share_percentage = $${paramIndex++}`);
        updateParams.push(data.revenue_share_percentage || null);
      }

      if (data.revenue_share_rules !== undefined) {
        updateFields.push(`revenue_share_rules = $${paramIndex++}`);
        updateParams.push(data.revenue_share_rules ? JSON.stringify(data.revenue_share_rules) : null);
      }

      if (data.minimum_payout_amount !== undefined) {
        updateFields.push(`minimum_payout_amount = $${paramIndex++}`);
        updateParams.push(data.minimum_payout_amount || null);
      }

      if (data.subscription_amount !== undefined) {
        updateFields.push(`subscription_amount = $${paramIndex++}`);
        updateParams.push(data.subscription_amount || null);
      }

      if (data.billing_interval !== undefined || data.subscription_interval !== undefined) {
        const iv = resolvePublisherContractBillingInterval({
          billing_interval: data.billing_interval,
          subscription_interval: data.subscription_interval,
        });
        if (iv && !isBillingIntervalCode(iv)) {
          throw new Error('Intervalo de cobrança inválido');
        }
        updateFields.push(`billing_interval = $${paramIndex++}`);
        updateParams.push(iv);
        updateFields.push(`subscription_interval = $${paramIndex++}`);
        updateParams.push(iv);
        updateFields.push(`payment_terms = $${paramIndex++}`);
        updateParams.push(iv ? billingIntervalLabel(iv) : null);
      }

      if (data.currency !== undefined) {
        updateFields.push(`currency = $${paramIndex++}`);
        updateParams.push(data.currency);
      }

      if (data.payment_terms !== undefined) {
        updateFields.push(`payment_terms = $${paramIndex++}`);
        updateParams.push(data.payment_terms || null);
      }

      if (data.status !== undefined) {
        updateFields.push(`status = $${paramIndex++}`);
        updateParams.push(data.status);
      }

      if (data.signed_by_publisher_at !== undefined) {
        updateFields.push(`signed_by_publisher_at = $${paramIndex++}`);
        updateParams.push(data.signed_by_publisher_at || null);
      }

      if (data.signed_by_tenant_at !== undefined) {
        updateFields.push(`signed_by_tenant_at = $${paramIndex++}`);
        updateParams.push(data.signed_by_tenant_at || null);
      }

      if (data.metadata !== undefined) {
        updateFields.push(`metadata = $${paramIndex++}`);
        updateParams.push(data.metadata ? JSON.stringify(data.metadata) : null);
      }

      if (updateFields.length === 0) {
        throw new Error('Nenhum campo para atualizar');
      }

      updateFields.push(`updated_at = CURRENT_TIMESTAMP`);

      await this.db.executeRaw(`
        UPDATE publisher_contracts 
        SET ${updateFields.join(', ')}
        WHERE contract_id = $${paramIndex}
      `, [...updateParams, id]);

      const updatedContract = await this.getContractById(id);
      if (!updatedContract) {
        throw new Error('Erro ao buscar contrato atualizado');
      }

      return updatedContract;} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('Erro ao atualizar contrato de publisher', e.error, { id, data });
      throw e.error;
    }
  }

  /**
   * Excluir contrato de publisher (soft delete)
   */
  async deleteContract(id: number): Promise<void> {
    try {
      const contract = await this.getContractById(id);
      if (!contract) {
        throw new Error('Contrato não encontrado');
      }

      // Soft delete: atualizar status para cancelled
      await this.db.executeRaw(`
        UPDATE publisher_contracts 
        SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
        WHERE contract_id = $1
      `, [id]);} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('Erro ao excluir contrato de publisher', e.error, { id });
      throw e.error;
    }
  }
}

let publisherContractServiceInstance: PublisherContractService | null = null;

export function getPublisherContractService(): PublisherContractService {
  if (!publisherContractServiceInstance) {
    publisherContractServiceInstance = new PublisherContractService();
  }
  return publisherContractServiceInstance;
}
