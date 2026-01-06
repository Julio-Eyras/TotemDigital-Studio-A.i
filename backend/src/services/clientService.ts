import { getDatabase } from '../config/database';
import { logError } from '../utils/loggerHelper';

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
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/966e3e3f-39d6-45ad-8c92-86d4ce51a1fc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'clientService.ts:50',message:'getAllClients entry',data:{params},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      const { page = 1, limit = 10, search } = params;
      const offset = (page - 1) * limit;

      let whereClause = 'WHERE s.is_active = true';
      const queryParams: any[] = [];

      if (search) {
        whereClause += ' AND (s.name ILIKE $' + (queryParams.length + 1) + ' OR s.email ILIKE $' + (queryParams.length + 1) + ')';
        queryParams.push(`%${search}%`);
      }

      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/966e3e3f-39d6-45ad-8c92-86d4ce51a1fc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'clientService.ts:62',message:'Before query execution',data:{whereClause,queryParams:queryParams.length,limit,offset},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion

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

      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/966e3e3f-39d6-45ad-8c92-86d4ce51a1fc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'clientService.ts:78',message:'After query execution',data:{clientsCount:clients.length,clients:clients.map(c=>({id:c.client_id,name:c.name}))},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion

      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/966e3e3f-39d6-45ad-8c92-86d4ce51a1fc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'clientService.ts:81',message:'Checking if totems join needed',data:{hasPlatformInfo:false,queryIncludesTotems:false},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      // #endregion

      // Verificar se há totens com plataforma para esses subscribers
      // Nota: Totems não têm mais client_id direto - usar subscriber_id via campaigns
      const subscriberIds = clients.map(c => c.client_id || c.subscriber_id);
      if (subscriberIds.length > 0) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/966e3e3f-39d6-45ad-8c92-86d4ce51a1fc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'clientService.ts:88',message:'Querying totems for platforms',data:{subscriberIds},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
        // #endregion
        try {
          // Totems não têm client_id direto - buscar via campaigns
          const totemsWithPlatform = await this.db.findMany(`
            SELECT DISTINCT
              c.subscriber_id as client_id,
              t.config::jsonb->'hardware'->>'platform' as platform
            FROM totems t
            JOIN campaigns c ON c.totem_id = t.totem_id
            WHERE c.subscriber_id = ANY($1)
            AND t.config::jsonb->'hardware'->>'platform' IS NOT NULL
          `, [subscriberIds]);
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/966e3e3f-39d6-45ad-8c92-86d4ce51a1fc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'clientService.ts:97',message:'Totems with platform found',data:{totemsCount:totemsWithPlatform.length,totemsByPlatform:totemsWithPlatform.reduce((acc:any,t:any)=>{const p=t.platform||'unknown';acc[p]=(acc[p]||0)+1;return acc;},{})},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
          // #endregion
        } catch (platformQueryError: any) {
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/966e3e3f-39d6-45ad-8c92-86d4ce51a1fc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'clientService.ts:102',message:'Error querying totems platforms',data:{error:platformQueryError.message},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
          // #endregion
        }
      }

      // Contar total
      const totalResult = await this.db.findFirst(`
        SELECT COUNT(*) as total
        FROM subscribers s
        ${whereClause}
      `, queryParams);

      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/966e3e3f-39d6-45ad-8c92-86d4ce51a1fc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'clientService.ts:110',message:'getAllClients exit',data:{total:parseInt(totalResult?.total || '0'),page,limit},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion

      return {
        data: clients,
        total: parseInt(totalResult?.total || '0'),
        page,
        limit,
      };
    } catch (error: any) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/966e3e3f-39d6-45ad-8c92-86d4ce51a1fc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'clientService.ts:120',message:'getAllClients error',data:{error:error.message,stack:error.stack},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
      // #endregion
      await logError('Erro ao listar clientes', error, { params });
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

      return client;
    } catch (error: any) {
      await logError('Erro ao obter cliente', error, { id });
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

      return newClient;
    } catch (error: any) {
      await logError('Erro ao criar cliente', error, { data });
      throw error;
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

      return updatedClient;
    } catch (error: any) {
      await logError('Erro ao atualizar cliente', error, { id, data });
      throw error;
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
      `, [id]);
    } catch (error: any) {
      await logError('Erro ao excluir cliente', error, { id });
      throw error;
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

