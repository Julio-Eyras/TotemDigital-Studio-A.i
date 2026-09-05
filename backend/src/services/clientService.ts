import { getDatabase } from '../config/database';
import { logError } from '../utils/loggerHelper';
import { normalizeError } from '../utils/errors';

export interface Client {
  client_id: number; // Mantido para compatibilidade - mapeia para subscriber_id
  subscriber_id?: number; // Novo campo do schema v2
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateClientRequest {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
}

export interface UpdateClientRequest {
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
  isActive?: boolean;
}

export interface ClientListResponse {
  data: Client[];
  total: number;
  page: number;
  limit: number;
}

export class ClientService {
  private get db() {
    return getDatabase();
  }

  /**
   * Listar clientes com paginação e filtros
   */
  async getAllClients(params: {
    page?: number;
    limit?: number;
    search?: string;
  }): Promise<ClientListResponse> {
    try {
      const { page = 1, limit = 10, search } = params;
      const offset = (page - 1) * limit;

      let whereClause = 'WHERE s.is_active = true';
      const queryParams: any[] = [];

      if (search) {
        whereClause += ' AND (s.name ILIKE $' + (queryParams.length + 1) + ' OR s.email ILIKE $' + (queryParams.length + 1) + ')';
        queryParams.push(`%${search}%`);
      }

      // Buscar subscribers (clientes no schema v2)
      const clients = await this.db.findMany(`
        SELECT 
          s.subscriber_id as client_id,
          s.subscriber_id,
          s.name,
          s.email,
          s.phone,
          s.address,
          s.is_active,
          s.created_at,
          s.updated_at
        FROM subscribers s
        ${whereClause.replace('c.', 's.')}
        ORDER BY s.created_at DESC
        LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}
      `, [...queryParams, limit, offset]);

      // Verificar se há totens com plataforma para esses subscribers
      // Nota (schema v2): Totems não têm subscriber_id direto.
      // Relacionamento é via campanhas do subscriber -> (campaign_totems) ou (campaign_publishers -> locals -> totems).
      const subscriberIds = clients.map(c => c.client_id || c.subscriber_id);
      if (subscriberIds.length > 0) {
        try {
          // Inferir plataforma a partir do JSONB network_info (quando disponível)
          // e mapear por subscriber_id via campanhas e targets.
          await this.db.findMany(`
            WITH subscriber_campaigns AS (
              SELECT c.campaign_id, c.subscriber_id
              FROM campaigns c
              WHERE c.is_active = true
                AND c.subscriber_id = ANY($1)
            ),
            totems_for_subscriber AS (
              -- Campanhas diretas por totem
              SELECT sc.subscriber_id, t.totem_id, t.network_info
              FROM subscriber_campaigns sc
              JOIN campaign_totems ct ON ct.campaign_id = sc.campaign_id AND ct.is_active = true
              JOIN totems t ON t.totem_id = ct.totem_id AND t.is_active = true
              
              UNION
              
              -- Campanhas por publisher/grupo -> locals -> totems
              SELECT sc.subscriber_id, t.totem_id, t.network_info
              FROM subscriber_campaigns sc
              JOIN campaign_publishers cp ON cp.campaign_id = sc.campaign_id AND cp.is_active = true
              JOIN locals l ON l.publisher_id = cp.publisher_id AND l.is_active = true
              JOIN totems t ON t.local_id = l.local_id AND t.is_active = true
            )
            SELECT DISTINCT
              subscriber_id as client_id,
              (network_info::jsonb->'hardware'->>'platform') as platform
            FROM totems_for_subscriber
            WHERE (network_info::jsonb->'hardware'->>'platform') IS NOT NULL
          `, [subscriberIds]);
} catch (platformQueryError: unknown) {
          // Essa consulta é apenas auxiliar (telemetria/analytics). Não deve quebrar a listagem de subscribers.
        }
      }

      // Contar total
      const totalResult = await this.db.findFirst(`
        SELECT COUNT(*) as total
        FROM subscribers s
        ${whereClause}
      `, queryParams);

      return {
        data: clients,
        total: parseInt(totalResult?.total || '0'),
        page,
        limit,
      };} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('Erro ao listar clientes', e.error, { params });
      throw new Error('Erro interno do servidor');
    }
  }

  /**
   * Obter cliente por ID
   */
  async getClientById(id: number): Promise<Client | null> {
    try {
      const client = await this.db.findFirst(`
        SELECT 
          s.subscriber_id as client_id,
          s.subscriber_id,
          s.name,
          s.email,
          s.phone,
          s.address,
          s.is_active,
          s.created_at,
          s.updated_at
        FROM subscribers s
        WHERE s.subscriber_id = $1
      `, [id]);

      return client;} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('Erro ao obter cliente', e.error, { id });
      throw new Error('Erro interno do servidor');
    }
  }

  /**
   * Criar novo cliente
   */
  async createClient(data: CreateClientRequest): Promise<Client> {
    try {
      const { name, email, phone, address } = data;

      // Verificar se subscriber já existe
      const existingClient = await this.db.findFirst(`
        SELECT subscriber_id FROM subscribers WHERE name = $1
      `, [name]);

      if (existingClient) {
        throw new Error('Cliente com este nome já existe');
      }

      // Criar subscriber
      const result = await this.db.executeRaw(`
        INSERT INTO subscribers (name, email, phone, address, is_active, created_at, updated_at)
        VALUES ($1, $2, $3, $4, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING subscriber_id
      `, [name, email, phone, address]);

      if (!result.rows || result.rows.length === 0) {
        throw new Error('Erro ao criar cliente');
      }

      const clientId = result.rows[0].subscriber_id;
      const newClient = await this.getClientById(clientId);

      if (!newClient) {
        throw new Error('Erro ao buscar cliente criado');
      }

      return newClient;} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('Erro ao criar cliente', e.error, { data });
      throw e.error;
    }
  }

  /**
   * Atualizar cliente
   */
  async updateClient(id: number, data: UpdateClientRequest): Promise<Client> {
    try {
      const { name, email, phone, address, isActive } = data;

      // Verificar se cliente existe
      const existingClient = await this.getClientById(id);
      if (!existingClient) {
        throw new Error('Cliente não encontrado');
      }

      // Verificar se nome já existe (se mudou)
      if (name && name !== existingClient.name) {
        const clientWithSameName = await this.db.findFirst(`
          SELECT subscriber_id FROM subscribers WHERE name = $1 AND subscriber_id != $2
        `, [name, id]);

        if (clientWithSameName) {
          throw new Error('Cliente com este nome já existe');
        }
      }

      // Preparar campos para atualização
      const updateFields: string[] = [];
      const updateParams: any[] = [];
      let paramIndex = 1;

      if (name) {
        updateFields.push(`name = $${paramIndex}`);
        updateParams.push(name);
        paramIndex++;
      }

      if (email !== undefined) {
        updateFields.push(`email = $${paramIndex}`);
        updateParams.push(email);
        paramIndex++;
      }

      if (phone !== undefined) {
        updateFields.push(`phone = $${paramIndex}`);
        updateParams.push(phone);
        paramIndex++;
      }

      if (address !== undefined) {
        updateFields.push(`address = $${paramIndex}`);
        updateParams.push(address);
        paramIndex++;
      }

      if (isActive !== undefined) {
        updateFields.push(`is_active = $${paramIndex}`);
        updateParams.push(isActive);
        paramIndex++;
      }

      updateFields.push(`updated_at = CURRENT_TIMESTAMP`);

      // Executar atualização
      await this.db.executeRaw(`
        UPDATE subscribers 
        SET ${updateFields.join(', ')}
        WHERE subscriber_id = $${paramIndex}
      `, [...updateParams, id]);

      const updatedClient = await this.getClientById(id);
      if (!updatedClient) {
        throw new Error('Erro ao buscar cliente atualizado');
      }

      return updatedClient;} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('Erro ao atualizar cliente', e.error, { id, data });
      throw e.error;
    }
  }

  /**
   * Excluir cliente (soft delete)
   */
  async deleteClient(id: number): Promise<void> {
    try {
      // Verificar se cliente existe
      const existingClient = await this.getClientById(id);
      if (!existingClient) {
        throw new Error('Cliente não encontrado');
      }

      // Soft delete - marcar como inativo
      await this.db.executeRaw(`
        UPDATE subscribers 
        SET is_active = false, updated_at = CURRENT_TIMESTAMP
        WHERE subscriber_id = $1
      `, [id]);} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('Erro ao excluir cliente', e.error, { id });
      throw e.error;
    }
  }
}

// Instância global do serviço
let clientServiceInstance: ClientService;

export function getClientService(): ClientService {
  if (!clientServiceInstance) {
    clientServiceInstance = new ClientService();
  }
  return clientServiceInstance;
}

