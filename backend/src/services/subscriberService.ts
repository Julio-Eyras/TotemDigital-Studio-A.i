import { getDatabase } from '../config/database';
import { logError } from '../utils/loggerHelper';

export interface Subscriber {
  subscriber_id: number;
  name: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
  address?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateSubscriberRequest {
  name: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
  address?: string;
}

export interface UpdateSubscriberRequest {
  name?: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
  address?: string;
  isActive?: boolean;
}

export interface SubscriberListResponse {
  data: Subscriber[];
  total: number;
  page: number;
  limit: number;
}

export class SubscriberService {
  private get db() {
    return getDatabase();
  }

  /**
   * Listar subscribers (anunciantes) com paginação e filtros
   */
  async getAllSubscribers(params: {
    page?: number;
    limit?: number;
    search?: string;
  }): Promise<SubscriberListResponse> {
    try {
      const { page = 1, limit = 10, search } = params;
      const offset = (page - 1) * limit;

      let whereClause = 'WHERE s.is_active = true';
      const queryParams: any[] = [];

      if (search) {
        whereClause += ' AND (s.name ILIKE $' + (queryParams.length + 1) + ' OR s.email ILIKE $' + (queryParams.length + 1) + ')';
        queryParams.push(`%${search}%`);
      }

      // Buscar subscribers
      const subscribers = await this.db.findMany(`
        SELECT 
          s.subscriber_id,
          s.name,
          s.email,
          s.phone,
          s.whatsapp,
          s.address,
          s.is_active,
          s.created_at,
          s.updated_at
        FROM subscribers s
        ${whereClause}
        ORDER BY s.created_at DESC
        LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}
      `, [...queryParams, limit, offset]);

      // Contar total
      const totalResult = await this.db.findFirst(`
        SELECT COUNT(*) as total
        FROM subscribers s
        ${whereClause}
      `, queryParams);

      return {
        data: subscribers,
        total: parseInt(totalResult?.total || '0'),
        page,
        limit,
      };
    } catch (error: any) {
      await logError('Erro ao listar subscribers', error, { params });
      throw new Error('Erro interno do servidor');
    }
  }

  /**
   * Obter subscriber por ID
   */
  async getSubscriberById(id: number): Promise<Subscriber | null> {
    try {
      const subscriber = await this.db.findFirst(`
        SELECT 
          s.subscriber_id,
          s.name,
          s.email,
          s.phone,
          s.whatsapp,
          s.address,
          s.is_active,
          s.created_at,
          s.updated_at
        FROM subscribers s
        WHERE s.subscriber_id = $1
      `, [id]);

      return subscriber;
    } catch (error: any) {
      await logError('Erro ao obter subscriber', error, { id });
      throw new Error('Erro interno do servidor');
    }
  }

  /**
   * Criar novo subscriber (anunciante)
   */
  async createSubscriber(data: CreateSubscriberRequest): Promise<Subscriber> {
    try {
      const { name, email, phone, whatsapp, address } = data;

      // Verificar se subscriber já existe
      const existingSubscriber = await this.db.findFirst(`
        SELECT subscriber_id FROM subscribers WHERE name = $1
      `, [name]);

      if (existingSubscriber) {
        throw new Error('Subscriber com este nome já existe');
      }

      // Verificar email único (se fornecido)
      if (email) {
        const existingEmail = await this.db.findFirst(`
          SELECT subscriber_id FROM subscribers WHERE email = $1
        `, [email]);

        if (existingEmail) {
          throw new Error('Subscriber com este email já existe');
        }
      }

      // Criar subscriber
      const result = await this.db.executeRaw(`
        INSERT INTO subscribers (name, email, phone, whatsapp, address, is_active, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING subscriber_id
      `, [name, email, phone, whatsapp, address]);

      if (!result.rows || result.rows.length === 0) {
        throw new Error('Erro ao criar subscriber');
      }

      const subscriberId = result.rows[0].subscriber_id;
      const newSubscriber = await this.getSubscriberById(subscriberId);

      if (!newSubscriber) {
        throw new Error('Erro ao buscar subscriber criado');
      }

      return newSubscriber;
    } catch (error: any) {
      await logError('Erro ao criar subscriber', error, { data });
      throw error;
    }
  }

  /**
   * Atualizar subscriber
   */
  async updateSubscriber(id: number, data: UpdateSubscriberRequest): Promise<Subscriber> {
    try {
      const { name, email, phone, whatsapp, address, isActive } = data;

      // Verificar se subscriber existe
      const existingSubscriber = await this.getSubscriberById(id);
      if (!existingSubscriber) {
        throw new Error('Subscriber não encontrado');
      }

      // Verificar se nome já existe (se mudou)
      if (name && name !== existingSubscriber.name) {
        const subscriberWithSameName = await this.db.findFirst(`
          SELECT subscriber_id FROM subscribers WHERE name = $1 AND subscriber_id != $2
        `, [name, id]);

        if (subscriberWithSameName) {
          throw new Error('Subscriber com este nome já existe');
        }
      }

      // Verificar se email já existe (se mudou)
      if (email && email !== existingSubscriber.email) {
        const subscriberWithSameEmail = await this.db.findFirst(`
          SELECT subscriber_id FROM subscribers WHERE email = $1 AND subscriber_id != $2
        `, [email, id]);

        if (subscriberWithSameEmail) {
          throw new Error('Subscriber com este email já existe');
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

      if (whatsapp !== undefined) {
        updateFields.push(`whatsapp = $${paramIndex}`);
        updateParams.push(whatsapp);
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

      const updatedSubscriber = await this.getSubscriberById(id);
      if (!updatedSubscriber) {
        throw new Error('Erro ao buscar subscriber atualizado');
      }

      return updatedSubscriber;
    } catch (error: any) {
      await logError('Erro ao atualizar subscriber', error, { id, data });
      throw error;
    }
  }

  /**
   * Excluir subscriber (soft delete)
   */
  async deleteSubscriber(id: number): Promise<void> {
    try {
      // Verificar se subscriber existe
      const existingSubscriber = await this.getSubscriberById(id);
      if (!existingSubscriber) {
        throw new Error('Subscriber não encontrado');
      }

      // Soft delete - marcar como inativo
      await this.db.executeRaw(`
        UPDATE subscribers 
        SET is_active = false, updated_at = CURRENT_TIMESTAMP
        WHERE subscriber_id = $1
      `, [id]);
    } catch (error: any) {
      await logError('Erro ao excluir subscriber', error, { id });
      throw error;
    }
  }
}

// Instância global do serviço
let subscriberServiceInstance: SubscriberService;

export function getSubscriberService(): SubscriberService {
  if (!subscriberServiceInstance) {
    subscriberServiceInstance = new SubscriberService();
  }
  return subscriberServiceInstance;
}

