import { getDatabase } from '../config/database';
import { logError } from '../utils/loggerHelper';

export interface Subscriber {
  subscriber_id: number;
  name: string;
  contact_name?: string;
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
  contact_name?: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
  address?: string;
}

export interface UpdateSubscriberRequest {
  name?: string;
  contact_name?: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
  address?: string;
  description?: string;
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
          s.contact_name,
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
          s.contact_name,
          s.email,
          s.phone,
          s.whatsapp,
          s.address,
          s.description,
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
      const { name, contact_name, email, phone, whatsapp, address, description } = data;

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
        INSERT INTO subscribers (name, contact_name, email, phone, whatsapp, address, description, is_active, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING subscriber_id
      `, [name, contact_name, email, phone, whatsapp, address, description || null]);

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
      const { name, contact_name, email, phone, whatsapp, address, description, isActive } = data;

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

      if (contact_name !== undefined) {
        updateFields.push(`contact_name = $${paramIndex}`);
        updateParams.push(contact_name);
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

  /**
   * Listar locals de um subscriber
   */
  async getLocalsBySubscriber(subscriberId: number): Promise<any[]> {
    try {
      const locals = await this.db.findMany(`
        SELECT 
          l.local_id,
          l.name,
          l.address,
          l.city,
          l.state,
          l.zip_code,
          l.country,
          l.latitude,
          l.longitude,
          l.timezone,
          l.description,
          l.is_active,
          l.created_at,
          l.updated_at
        FROM locals l
        WHERE l.subscriber_id = $1
          AND l.is_active = true
        ORDER BY l.name
      `, [subscriberId]);

      return locals;
    } catch (error: any) {
      await logError('Erro ao buscar locals do subscriber', error, { subscriberId });
      throw new Error('Erro interno do servidor');
    }
  }

  /**
   * Listar totems de um subscriber (via locals)
   */
  async getTotemsBySubscriber(subscriberId: number): Promise<any[]> {
    try {
      const totems = await this.db.findMany(`
        SELECT 
          t.totem_id,
          t.identifier,
          t.uin,
          t.device_id,
          t.name,
          t.description,
          t.model,
          t.manufacturer,
          t.firmware_version,
          t.hardware_version,
          t.os_version,
          t.status,
          t.last_heartbeat,
          t.heartbeat_interval,
          t.network_info,
          t.capabilities,
          t.is_active,
          t.created_at,
          t.updated_at,
          l.name as local_name,
          l.local_id
        FROM totems t
        JOIN locals l ON t.local_id = l.local_id
        WHERE l.subscriber_id = $1
          AND t.is_active = true
        ORDER BY l.name, t.name
      `, [subscriberId]);

      return totems;
    } catch (error: any) {
      await logError('Erro ao buscar totems do subscriber', error, { subscriberId });
      throw new Error('Erro interno do servidor');
    }
  }

  /**
   * Listar smart TVs de um subscriber (via totems)
   */
  async getSmartTvsBySubscriber(subscriberId: number): Promise<any[]> {
    try {
      const smartTvs = await this.db.findMany(`
        SELECT 
          st.tv_id,
          st.identifier,
          st.device_id,
          st.name,
          st.brand,
          st.model,
          st.platform,
          st.firmware_version,
          st.resolution_width,
          st.resolution_height,
          st.orientation,
          st.status,
          st.last_seen,
          st.capabilities,
          st.settings,
          st.is_active,
          st.created_at,
          st.updated_at,
          t.name as totem_name,
          t.totem_id,
          t.identifier as totem_identifier,
          l.name as local_name
        FROM smart_tvs st
        JOIN totems t ON st.totem_id = t.totem_id
        JOIN locals l ON t.local_id = l.local_id
        WHERE l.subscriber_id = $1
          AND st.is_active = true
        ORDER BY l.name, t.name, st.name
      `, [subscriberId]);

      return smartTvs;
    } catch (error: any) {
      await logError('Erro ao buscar smart TVs do subscriber', error, { subscriberId });
      throw new Error('Erro interno do servidor');
    }
  }

  /**
   * Obter estatísticas de um subscriber
   */
  async getSubscriberStats(subscriberId: number): Promise<{
    localsCount: number;
    totemsCount: number;
    smartTvsCount: number;
    activeCampaignsCount: number;
    onlineTotems: number;
    playingTvs: number;
  }> {
    try {
      // Contar locals
      const localsCountResult = await this.db.findFirst(`
        SELECT COUNT(*) as count
        FROM locals
        WHERE subscriber_id = $1 AND is_active = true
      `, [subscriberId]);

      // Contar totems
      const totemsCountResult = await this.db.findFirst(`
        SELECT COUNT(*) as count
        FROM totems t
        JOIN locals l ON t.local_id = l.local_id
        WHERE l.subscriber_id = $1 AND t.is_active = true
      `, [subscriberId]);

      // Contar smart TVs
      const smartTvsCountResult = await this.db.findFirst(`
        SELECT COUNT(*) as count
        FROM smart_tvs st
        JOIN totems t ON st.totem_id = t.totem_id
        JOIN locals l ON t.local_id = l.local_id
        WHERE l.subscriber_id = $1 AND st.is_active = true
      `, [subscriberId]);

      // Contar campanhas ativas
      const campaignsCountResult = await this.db.findFirst(`
        SELECT COUNT(*) as count
        FROM campaigns
        WHERE subscriber_id = $1 
          AND is_active = true 
          AND status = 'active'
          AND (start_date IS NULL OR start_date <= CURRENT_DATE)
          AND (end_date IS NULL OR end_date >= CURRENT_DATE)
      `, [subscriberId]);

      // Contar totens online
      const onlineTotemsResult = await this.db.findFirst(`
        SELECT COUNT(*) as count
        FROM totems t
        JOIN locals l ON t.local_id = l.local_id
        WHERE l.subscriber_id = $1 
          AND t.is_active = true 
          AND t.status = 'online'
      `, [subscriberId]);

      // Contar smart TVs reproduzindo
      const playingTvsResult = await this.db.findFirst(`
        SELECT COUNT(*) as count
        FROM smart_tvs st
        JOIN totems t ON st.totem_id = t.totem_id
        JOIN locals l ON t.local_id = l.local_id
        WHERE l.subscriber_id = $1 
          AND st.is_active = true 
          AND st.status = 'playing'
      `, [subscriberId]);

      return {
        localsCount: parseInt(localsCountResult?.count || '0'),
        totemsCount: parseInt(totemsCountResult?.count || '0'),
        smartTvsCount: parseInt(smartTvsCountResult?.count || '0'),
        activeCampaignsCount: parseInt(campaignsCountResult?.count || '0'),
        onlineTotems: parseInt(onlineTotemsResult?.count || '0'),
        playingTvs: parseInt(playingTvsResult?.count || '0'),
      };
    } catch (error: any) {
      await logError('Erro ao buscar estatísticas do subscriber', error, { subscriberId });
      throw new Error('Erro interno do servidor');
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

