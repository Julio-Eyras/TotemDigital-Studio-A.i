import { getDatabase } from '../config/database';
import { logError } from '../utils/loggerHelper';

export interface Contract {
  contract_id: number;
  subscriber_id?: number; // Opcional - pode ser NULL se created_before_subscriber = true
  plan_id?: number;
  contract_number: string;
  contract_type: 'advertising' | 'subscription' | 'partnership';
  title: string;
  description?: string;
  start_date: string;
  end_date?: string;
  total_amount?: number;
  currency: string;
  payment_terms?: string;
  document_path?: string;
  document_filename?: string;
  document_mime_type?: string;
  document_size_bytes?: number;
  status: 'draft' | 'active' | 'expired' | 'terminated' | 'cancelled';
  signed_by_subscriber_at?: string;
  signed_by_tenant_at?: string;
  metadata?: any;
  created_at: string;
  updated_at: string;
  created_before_subscriber?: boolean; // Indica se foi criado antes do subscriber
  // Relacionamentos
  subscriber_name?: string;
  plan_name?: string;
}

export interface CreateContractRequest {
  subscriber_id?: number; // Opcional - pode ser NULL se created_before_subscriber = true
  plan_id?: number;
  contract_number: string;
  contract_type: 'advertising' | 'subscription' | 'partnership';
  title: string;
  description?: string;
  start_date: string;
  end_date?: string;
  total_amount?: number;
  currency?: string;
  payment_terms?: string;
  document_path?: string;
  document_filename?: string;
  document_mime_type?: string;
  document_size_bytes?: number;
  status?: 'draft' | 'active' | 'expired' | 'terminated' | 'cancelled';
  signed_by_subscriber_at?: string;
  signed_by_tenant_at?: string;
  metadata?: any;
  publisherIds?: number[]; // Publishers a serem associados ao contrato
  created_before_subscriber?: boolean; // Indica se contrato é criado antes do subscriber
}

export interface UpdateContractRequest {
  plan_id?: number;
  contract_number?: string;
  contract_type?: 'advertising' | 'subscription' | 'partnership';
  title?: string;
  description?: string;
  start_date?: string;
  end_date?: string;
  total_amount?: number;
  currency?: string;
  payment_terms?: string;
  document_path?: string;
  document_filename?: string;
  document_mime_type?: string;
  document_size_bytes?: number;
  status?: 'draft' | 'active' | 'expired' | 'terminated' | 'cancelled';
  signed_by_subscriber_at?: string;
  signed_by_tenant_at?: string;
  metadata?: any;
  publisherIds?: number[]; // Publishers a serem associados ao contrato
}

export interface ContractListResponse {
  data: Contract[];
  total: number;
  page: number;
  limit: number;
}

export class ContractService {
  private get db() {
    return getDatabase();
  }

  /**
   * Listar contratos com paginação e filtros
   */
  async getAllContracts(params: {
    page?: number;
    limit?: number;
    search?: string;
    subscriberId?: number;
    planId?: number;
    status?: string;
    contractType?: string;
    activeOnly?: boolean;
  }): Promise<ContractListResponse> {
    try {
      const { page = 1, limit = 20, search, subscriberId, planId, status, contractType, activeOnly } = params;
      const offset = (page - 1) * limit;

      let whereClause = 'WHERE 1=1';
      const queryParams: any[] = [];

      if (search) {
        whereClause += ` AND (sc.title ILIKE $${queryParams.length + 1} OR sc.contract_number ILIKE $${queryParams.length + 1} OR s.name ILIKE $${queryParams.length + 1})`;
        queryParams.push(`%${search}%`);
      }

      if (subscriberId) {
        whereClause += ` AND sc.subscriber_id = $${queryParams.length + 1}`;
        queryParams.push(subscriberId);
      }

      if (planId) {
        whereClause += ` AND sc.plan_id = $${queryParams.length + 1}`;
        queryParams.push(planId);
      }

      if (status) {
        whereClause += ` AND sc.status = $${queryParams.length + 1}`;
        queryParams.push(status);
      }

      if (contractType) {
        whereClause += ` AND sc.contract_type = $${queryParams.length + 1}`;
        queryParams.push(contractType);
      }

      if (activeOnly) {
        whereClause += ` AND sc.status = 'active'`;
        const now = new Date().toISOString().split('T')[0];
        whereClause += ` AND sc.start_date <= $${queryParams.length + 1}`;
        queryParams.push(now);
        whereClause += ` AND (sc.end_date IS NULL OR sc.end_date >= $${queryParams.length + 1})`;
        queryParams.push(now);
      }

      // Buscar contratos
      const contracts = await this.db.findMany(`
        SELECT 
          sc.contract_id,
          sc.subscriber_id,
          sc.plan_id,
          sc.contract_number,
          sc.created_before_subscriber,
          sc.contract_type,
          sc.title,
          sc.description,
          sc.start_date,
          sc.end_date,
          sc.total_amount,
          sc.currency,
          sc.payment_terms,
          sc.document_path,
          sc.document_filename,
          sc.document_mime_type,
          sc.document_size_bytes,
          sc.status,
          sc.signed_by_subscriber_at,
          sc.signed_by_tenant_at,
          sc.metadata,
          sc.created_at,
          sc.updated_at,
          s.name as subscriber_name,
          p.name as plan_name
        FROM subscriber_contracts sc
        LEFT JOIN subscribers s ON sc.subscriber_id = s.subscriber_id
        LEFT JOIN plans p ON sc.plan_id = p.plan_id
        ${whereClause}
        ORDER BY sc.created_at DESC
        LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}
      `, [...queryParams, limit, offset]);

      // Contar total
      const totalResult = await this.db.findFirst(`
        SELECT COUNT(*) as total
        FROM subscriber_contracts sc
        ${whereClause}
      `, queryParams);

      return {
        data: contracts,
        total: parseInt(totalResult?.total || '0'),
        page,
        limit,
      };
    } catch (error: any) {
      await logError('Erro ao listar contratos', error, { params });
      throw error;
    }
  }

  /**
   * Obter contrato por ID
   */
  async getContractById(id: number): Promise<Contract | null> {
    try {
      const contract = await this.db.findFirst(`
        SELECT 
          sc.contract_id,
          sc.subscriber_id,
          sc.plan_id,
          sc.contract_number,
          sc.contract_type,
          sc.title,
          sc.description,
          sc.start_date,
          sc.end_date,
          sc.total_amount,
          sc.currency,
          sc.payment_terms,
          sc.document_path,
          sc.document_filename,
          sc.document_mime_type,
          sc.document_size_bytes,
          sc.status,
          sc.signed_by_subscriber_at,
          sc.signed_by_tenant_at,
          sc.metadata,
          sc.created_at,
          sc.updated_at,
          s.name as subscriber_name,
          p.name as plan_name
        FROM subscriber_contracts sc
        LEFT JOIN subscribers s ON sc.subscriber_id = s.subscriber_id
        LEFT JOIN plans p ON sc.plan_id = p.plan_id
        WHERE sc.contract_id = $1
      `, [id]);

      return contract || null;
    } catch (error: any) {
      await logError('Erro ao buscar contrato', error, { id });
      throw error;
    }
  }

  /**
   * Criar novo contrato
   */
  async createContract(data: CreateContractRequest): Promise<Contract> {
    try {
      const {
        subscriber_id,
        plan_id,
        contract_number,
        contract_type,
        title,
        description,
        start_date,
        end_date,
        total_amount,
        currency = 'BRL',
        payment_terms,
        document_path,
        document_filename,
        document_mime_type,
        document_size_bytes,
        status = 'draft',
        signed_by_subscriber_at,
        signed_by_tenant_at,
        metadata,
        publisherIds = [],
        created_before_subscriber = false,
      } = data;

      // Validar subscriber existe (se fornecido)
      if (subscriber_id) {
        const subscriber = await this.db.findFirst(`
          SELECT subscriber_id FROM subscribers WHERE subscriber_id = $1
        `, [subscriber_id]);

        if (!subscriber) {
          throw new Error('Subscriber não encontrado');
        }
      }

      // Se subscriber_id não fornecido, created_before_subscriber deve ser true
      if (!subscriber_id && !created_before_subscriber) {
        throw new Error('Se subscriber_id não for fornecido, created_before_subscriber deve ser true');
      }

      // Validar plan existe (se fornecido)
      if (plan_id) {
        const plan = await this.db.findFirst(`
          SELECT plan_id FROM plans WHERE plan_id = $1
        `, [plan_id]);

        if (!plan) {
          throw new Error('Plano não encontrado');
        }
      }

      // Validar contract_number único
      const existingContract = await this.db.findFirst(`
        SELECT contract_id FROM subscriber_contracts WHERE contract_number = $1
      `, [contract_number]);

      if (existingContract) {
        throw new Error('Número de contrato já existe');
      }

      // Criar contrato
      const result = await this.db.executeRaw(`
        INSERT INTO subscriber_contracts (
          subscriber_id, plan_id, contract_number, contract_type, title, description,
          start_date, end_date, total_amount, currency, payment_terms,
          document_path, document_filename, document_mime_type, document_size_bytes,
          status, signed_by_subscriber_at, signed_by_tenant_at, metadata,
          created_before_subscriber, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING contract_id
      `, [
        subscriber_id || null,
        plan_id || null,
        contract_number,
        contract_type,
        title,
        description || null,
        start_date,
        end_date || null,
        total_amount || null,
        currency,
        payment_terms || null,
        document_path || null,
        document_filename || null,
        document_mime_type || null,
        document_size_bytes || null,
        status,
        signed_by_subscriber_at || null,
        signed_by_tenant_at || null,
        metadata ? JSON.stringify(metadata) : null,
        created_before_subscriber,
      ]);

      if (!result.rows || result.rows.length === 0) {
        throw new Error('Erro ao criar contrato');
      }

      const contractId = result.rows[0].contract_id;

      // Associar publishers ao contrato (via plan_publisher_access se houver plan_id)
      // Se não houver plan_id, criar acessos diretos via subscriber_publisher_access
      if (publisherIds && publisherIds.length > 0) {
        if (plan_id) {
          // Se tem plan_id, verificar se publishers estão no plano
          for (const publisherId of publisherIds) {
            const planAccess = await this.db.findFirst(`
              SELECT plan_id FROM plan_publisher_access 
              WHERE plan_id = $1 AND publisher_id = $2 AND is_allowed = true
            `, [plan_id, publisherId]);

            if (planAccess) {
              // Criar acesso via subscriber_publisher_access baseado no contrato
              await this.db.executeRaw(`
                INSERT INTO subscriber_publisher_access (
                  subscriber_id, publisher_id, contract_id, is_active, created_at, updated_at
                )
                VALUES ($1, $2, $3, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                ON CONFLICT (subscriber_id, publisher_id) 
                DO UPDATE SET contract_id = $3, is_active = true, updated_at = CURRENT_TIMESTAMP
              `, [subscriber_id, publisherId, contractId]);
            }
          }
        } else {
          // Sem plan_id, criar acessos diretos
          for (const publisherId of publisherIds) {
            await this.db.executeRaw(`
              INSERT INTO subscriber_publisher_access (
                subscriber_id, publisher_id, contract_id, is_active, created_at, updated_at
              )
              VALUES ($1, $2, $3, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
              ON CONFLICT (subscriber_id, publisher_id) 
              DO UPDATE SET contract_id = $3, is_active = true, updated_at = CURRENT_TIMESTAMP
            `, [subscriber_id, publisherId, contractId]);
          }
        }
      }

      const newContract = await this.getContractById(contractId);
      if (!newContract) {
        throw new Error('Erro ao buscar contrato criado');
      }

      return newContract;
    } catch (error: any) {
      await logError('Erro ao criar contrato', error, { data });
      throw error;
    }
  }

  /**
   * Atualizar contrato
   */
  async updateContract(id: number, data: UpdateContractRequest): Promise<Contract> {
    try {
      // Verificar se contrato existe
      const existingContract = await this.getContractById(id);
      if (!existingContract) {
        throw new Error('Contrato não encontrado');
      }

      const {
        plan_id,
        contract_number,
        contract_type,
        title,
        description,
        start_date,
        end_date,
        total_amount,
        currency,
        payment_terms,
        document_path,
        document_filename,
        document_mime_type,
        document_size_bytes,
        status,
        signed_by_subscriber_at,
        signed_by_tenant_at,
        metadata,
        publisherIds,
      } = data;

      // Validar contract_number único (se mudou)
      if (contract_number && contract_number !== existingContract.contract_number) {
        const existingContractNumber = await this.db.findFirst(`
          SELECT contract_id FROM subscriber_contracts 
          WHERE contract_number = $1 AND contract_id != $2
        `, [contract_number, id]);

        if (existingContractNumber) {
          throw new Error('Número de contrato já existe');
        }
      }

      // Preparar campos para atualização
      const updateFields: string[] = [];
      const updateParams: any[] = [];
      let paramIndex = 1;

      if (plan_id !== undefined) {
        updateFields.push(`plan_id = $${paramIndex}`);
        updateParams.push(plan_id || null);
        paramIndex++;
      }

      if (contract_number !== undefined) {
        updateFields.push(`contract_number = $${paramIndex}`);
        updateParams.push(contract_number);
        paramIndex++;
      }

      if (contract_type !== undefined) {
        updateFields.push(`contract_type = $${paramIndex}`);
        updateParams.push(contract_type);
        paramIndex++;
      }

      if (title !== undefined) {
        updateFields.push(`title = $${paramIndex}`);
        updateParams.push(title);
        paramIndex++;
      }

      if (description !== undefined) {
        updateFields.push(`description = $${paramIndex}`);
        updateParams.push(description || null);
        paramIndex++;
      }

      if (start_date !== undefined) {
        updateFields.push(`start_date = $${paramIndex}`);
        updateParams.push(start_date);
        paramIndex++;
      }

      if (end_date !== undefined) {
        updateFields.push(`end_date = $${paramIndex}`);
        updateParams.push(end_date || null);
        paramIndex++;
      }

      if (total_amount !== undefined) {
        updateFields.push(`total_amount = $${paramIndex}`);
        updateParams.push(total_amount || null);
        paramIndex++;
      }

      if (currency !== undefined) {
        updateFields.push(`currency = $${paramIndex}`);
        updateParams.push(currency);
        paramIndex++;
      }

      if (payment_terms !== undefined) {
        updateFields.push(`payment_terms = $${paramIndex}`);
        updateParams.push(payment_terms || null);
        paramIndex++;
      }

      if (document_path !== undefined) {
        updateFields.push(`document_path = $${paramIndex}`);
        updateParams.push(document_path || null);
        paramIndex++;
      }

      if (document_filename !== undefined) {
        updateFields.push(`document_filename = $${paramIndex}`);
        updateParams.push(document_filename || null);
        paramIndex++;
      }

      if (document_mime_type !== undefined) {
        updateFields.push(`document_mime_type = $${paramIndex}`);
        updateParams.push(document_mime_type || null);
        paramIndex++;
      }

      if (document_size_bytes !== undefined) {
        updateFields.push(`document_size_bytes = $${paramIndex}`);
        updateParams.push(document_size_bytes || null);
        paramIndex++;
      }

      if (status !== undefined) {
        updateFields.push(`status = $${paramIndex}`);
        updateParams.push(status);
        paramIndex++;
      }

      if (signed_by_subscriber_at !== undefined) {
        updateFields.push(`signed_by_subscriber_at = $${paramIndex}`);
        updateParams.push(signed_by_subscriber_at || null);
        paramIndex++;
      }

      if (signed_by_tenant_at !== undefined) {
        updateFields.push(`signed_by_tenant_at = $${paramIndex}`);
        updateParams.push(signed_by_tenant_at || null);
        paramIndex++;
      }

      if (metadata !== undefined) {
        updateFields.push(`metadata = $${paramIndex}`);
        updateParams.push(metadata ? JSON.stringify(metadata) : null);
        paramIndex++;
      }

      updateFields.push(`updated_at = CURRENT_TIMESTAMP`);

      // Executar atualização
      await this.db.executeRaw(`
        UPDATE subscriber_contracts 
        SET ${updateFields.join(', ')}
        WHERE contract_id = $${paramIndex}
      `, [...updateParams, id]);

      // Atualizar publishers associados se fornecido
      if (publisherIds !== undefined) {
        // Remover acessos antigos deste contrato
        await this.db.executeRaw(`
          DELETE FROM subscriber_publisher_access 
          WHERE contract_id = $1
        `, [id]);

        // Criar novos acessos
        if (publisherIds.length > 0) {
          for (const publisherId of publisherIds) {
            await this.db.executeRaw(`
              INSERT INTO subscriber_publisher_access (
                subscriber_id, publisher_id, contract_id, is_active, created_at, updated_at
              )
              VALUES ($1, $2, $3, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
              ON CONFLICT (subscriber_id, publisher_id) 
              DO UPDATE SET contract_id = $3, is_active = true, updated_at = CURRENT_TIMESTAMP
            `, [existingContract.subscriber_id, publisherId, id]);
          }
        }
      }

      const updatedContract = await this.getContractById(id);
      if (!updatedContract) {
        throw new Error('Erro ao buscar contrato atualizado');
      }

      return updatedContract;
    } catch (error: any) {
      await logError('Erro ao atualizar contrato', error, { id, data });
      throw error;
    }
  }

  /**
   * Excluir contrato (soft delete - mudar status para cancelled)
   */
  async deleteContract(id: number): Promise<void> {
    try {
      // Verificar se contrato existe
      const existingContract = await this.getContractById(id);
      if (!existingContract) {
        throw new Error('Contrato não encontrado');
      }

      // Soft delete - mudar status para cancelled
      await this.db.executeRaw(`
        UPDATE subscriber_contracts 
        SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
        WHERE contract_id = $1
      `, [id]);

      // Desativar acessos relacionados
      await this.db.executeRaw(`
        UPDATE subscriber_publisher_access 
        SET is_active = false, updated_at = CURRENT_TIMESTAMP
        WHERE contract_id = $1
      `, [id]);
    } catch (error: any) {
      await logError('Erro ao excluir contrato', error, { id });
      throw error;
    }
  }

  /**
   * Obter publishers associados a um contrato
   */
  async getContractPublishers(contractId: number): Promise<any[]> {
    try {
      const publishers = await this.db.findMany(`
        SELECT 
          p.publisher_id,
          p.name,
          p.email,
          p.phone,
          spa.is_active,
          spa.created_at as access_created_at
        FROM subscriber_publisher_access spa
        JOIN publishers p ON spa.publisher_id = p.publisher_id
        WHERE spa.contract_id = $1
        ORDER BY p.name
      `, [contractId]);

      return publishers;
    } catch (error: any) {
      await logError('Erro ao buscar publishers do contrato', error, { contractId });
      throw error;
    }
  }
}

// Singleton instance
let contractServiceInstance: ContractService | null = null;

export function getContractService(): ContractService {
  if (!contractServiceInstance) {
    contractServiceInstance = new ContractService();
  }
  return contractServiceInstance;
}
