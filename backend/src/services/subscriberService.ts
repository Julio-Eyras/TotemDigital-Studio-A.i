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
  contract_id: number; // Obrigatório - contrato que gerou a criação do subscriber
  contact_name?: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
  address?: string;
  description?: string;
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
   * Listar contratos ativos de um subscriber
   */
  async getActiveContracts(subscriberId: number): Promise<any[]> {
    try {
      const contracts = await this.db.findMany(`
        SELECT 
          sc.contract_id,
          sc.contract_number,
          sc.title,
          sc.description,
          sc.start_date,
          sc.end_date,
          sc.status,
          sc.total_amount,
          sc.currency,
          p.plan_id,
          p.name AS plan_name,
          p.slug AS plan_slug,
          p.price_monthly,
          p.price_yearly,
          CASE 
            WHEN sc.status = 'active' 
              AND sc.start_date <= CURRENT_DATE 
              AND (sc.end_date IS NULL OR sc.end_date >= CURRENT_DATE)
            THEN true
            ELSE false
          END AS is_valid
        FROM subscriber_contracts sc
        LEFT JOIN plans p ON sc.plan_id = p.plan_id
        WHERE sc.subscriber_id = $1
          AND sc.status = 'active'
          AND sc.start_date <= CURRENT_DATE
          AND (sc.end_date IS NULL OR sc.end_date >= CURRENT_DATE)
        ORDER BY sc.start_date DESC
      `, [subscriberId]);

      return contracts || [];
    } catch (error: any) {
      await logError('Erro ao buscar contratos ativos do subscriber', error);
      throw error;
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
   * Criar novo subscriber (anunciante) - baseado em contrato
   */
  async createSubscriber(data: CreateSubscriberRequest): Promise<Subscriber> {
    try {
      const { name, contract_id, contact_name, email, phone, whatsapp, address, description } = data;

      // Validar que o contrato existe e está válido
      const contract = await this.db.findFirst(`
        SELECT 
          contract_id, 
          subscriber_id, 
          status, 
          created_before_subscriber,
          start_date,
          end_date
        FROM subscriber_contracts 
        WHERE contract_id = $1
      `, [contract_id]);

      if (!contract) {
        throw new Error('Contrato não encontrado');
      }

      // Validar status do contrato (deve ser draft ou active)
      if (contract.status !== 'draft' && contract.status !== 'active') {
        throw new Error('Contrato deve estar em status "draft" ou "active" para criar subscriber');
      }

      // Se contrato já tem subscriber_id e não foi criado antes do subscriber, erro
      if (contract.subscriber_id && !contract.created_before_subscriber) {
        throw new Error('Contrato já está vinculado a outro subscriber');
      }

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

      // Vincular subscriber ao contrato
      await this.db.executeRaw(`
        UPDATE subscriber_contracts 
        SET subscriber_id = $1, updated_at = CURRENT_TIMESTAMP
        WHERE contract_id = $2
      `, [subscriberId, contract_id]);

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

      if (description !== undefined) {
        updateFields.push(`description = $${paramIndex}`);
        updateParams.push(description);
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
  /**
   * Listar locais acessíveis por um subscriber através de planos e contratos
   * Subscribers não possuem locais próprios - acessam locais dos publishers através de planos
   */
  async getLocalsBySubscriber(subscriberId: number): Promise<any[]> {
    try {
      const locals = await this.db.findMany(`
        SELECT DISTINCT
          l.local_id,
          l.publisher_id,
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
          l.updated_at,
          p.name as publisher_name,
          spa.access_type,
          spa.expires_at
        FROM subscriber_publisher_access spa
        JOIN publishers pub ON spa.publisher_id = pub.publisher_id
        JOIN locals l ON l.publisher_id = pub.publisher_id
        LEFT JOIN publishers p ON l.publisher_id = p.publisher_id
        WHERE spa.subscriber_id = $1
          AND spa.is_active = true
          AND (spa.expires_at IS NULL OR spa.expires_at > CURRENT_TIMESTAMP)
          AND spa.revoked_at IS NULL
          AND l.is_active = true
        ORDER BY l.name
      `, [subscriberId]);

      return locals;
    } catch (error: any) {
      await logError('Erro ao buscar locals acessíveis do subscriber', error, { subscriberId });
      throw new Error('Erro interno do servidor');
    }
  }

  /**
   * Listar totems acessíveis por um subscriber (via locais dos publishers acessíveis)
   */
  async getTotemsBySubscriber(subscriberId: number): Promise<any[]> {
    try {
      const totems = await this.db.findMany(`
        SELECT DISTINCT
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
          l.local_id,
          p.name as publisher_name
        FROM subscriber_publisher_access spa
        JOIN publishers pub ON spa.publisher_id = pub.publisher_id
        JOIN locals l ON l.publisher_id = pub.publisher_id
        JOIN totems t ON t.local_id = l.local_id
        LEFT JOIN publishers p ON l.publisher_id = p.publisher_id
        WHERE spa.subscriber_id = $1
          AND spa.is_active = true
          AND (spa.expires_at IS NULL OR spa.expires_at > CURRENT_TIMESTAMP)
          AND spa.revoked_at IS NULL
          AND l.is_active = true
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
   * Listar smart TVs acessíveis por um subscriber (via locais dos publishers acessíveis)
   */
  async getSmartTvsBySubscriber(subscriberId: number): Promise<any[]> {
    try {
      const smartTvs = await this.db.findMany(`
        SELECT DISTINCT
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
          l.name as local_name,
          p.name as publisher_name
        FROM subscriber_publisher_access spa
        JOIN publishers pub ON spa.publisher_id = pub.publisher_id
        JOIN locals l ON l.publisher_id = pub.publisher_id
        JOIN totems t ON t.local_id = l.local_id
        JOIN smart_tvs st ON st.totem_id = t.totem_id
        LEFT JOIN publishers p ON l.publisher_id = p.publisher_id
        WHERE spa.subscriber_id = $1
          AND spa.is_active = true
          AND (spa.expires_at IS NULL OR spa.expires_at > CURRENT_TIMESTAMP)
          AND spa.revoked_at IS NULL
          AND l.is_active = true
          AND t.is_active = true
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
   * Buscar planos ativos de um subscriber através dos contratos
   */
  async getActivePlans(subscriberId: number): Promise<any[]> {
    try {
      const plans = await this.db.findMany(`
        SELECT DISTINCT
          p.plan_id,
          p.name,
          p.slug,
          p.description,
          p.limits,
          p.features,
          sc.contract_id,
          sc.contract_number,
          sc.status as contract_status,
          sc.start_date,
          sc.end_date
        FROM subscriber_contracts sc
        JOIN plans p ON sc.plan_id = p.plan_id
        WHERE sc.subscriber_id = $1
          AND sc.is_active = true
          AND sc.status = 'active'
          AND (sc.end_date IS NULL OR sc.end_date >= CURRENT_DATE)
          AND p.is_active = true
        ORDER BY sc.start_date DESC
      `, [subscriberId]);

      return plans;
    } catch (error: any) {
      await logError('Erro ao buscar planos ativos do subscriber', error, { subscriberId });
      throw new Error('Erro interno do servidor');
    }
  }

  /**
   * Obter limites máximos dos planos ativos de um subscriber
   */
  async getMaxLimits(subscriberId: number): Promise<{
    medias?: number;
    playlists?: number;
    campaigns?: number;
    storage_gb?: number;
  }> {
    try {
      const plans = await this.getActivePlans(subscriberId);

      if (plans.length === 0) {
        // Se não tem planos, retornar limites infinitos (undefined = sem limite)
        return {
          medias: undefined,
          playlists: undefined,
          campaigns: undefined,
          storage_gb: undefined,
        };
      }

      // Pegar o maior limite entre todos os planos
      let maxMedias: number | undefined = undefined;
      let maxPlaylists: number | undefined = undefined;
      let maxCampaigns: number | undefined = undefined;
      let maxStorageGb: number | undefined = undefined;

      for (const plan of plans) {
        const limits = plan.limits || {};
        
        if (limits.medias !== undefined && limits.medias !== null) {
          if (maxMedias === undefined || limits.medias > maxMedias) {
            maxMedias = limits.medias;
          }
        }

        if (limits.playlists !== undefined && limits.playlists !== null) {
          if (maxPlaylists === undefined || limits.playlists > maxPlaylists) {
            maxPlaylists = limits.playlists;
          }
        }

        if (limits.campaigns !== undefined && limits.campaigns !== null) {
          if (maxCampaigns === undefined || limits.campaigns > maxCampaigns) {
            maxCampaigns = limits.campaigns;
          }
        }

        if (limits.storage_gb !== undefined && limits.storage_gb !== null) {
          if (maxStorageGb === undefined || limits.storage_gb > maxStorageGb) {
            maxStorageGb = limits.storage_gb;
          }
        }
      }

      return {
        medias: maxMedias,
        playlists: maxPlaylists,
        campaigns: maxCampaigns,
        storage_gb: maxStorageGb,
      };
    } catch (error: any) {
      await logError('Erro ao obter limites máximos', error, { subscriberId });
      throw new Error('Erro interno do servidor');
    }
  }

  /**
   * Validar limites do plano ao criar/atualizar recursos
   */
  async validatePlanLimits(
    subscriberId: number,
    resourceType: 'media' | 'playlist' | 'campaign'
  ): Promise<void> {
    try {
      const limits = await this.getMaxLimits(subscriberId);
      const limitKey = resourceType === 'media' ? 'medias' : 
                      resourceType === 'playlist' ? 'playlists' : 
                      'campaigns';
      const maxLimit = limits[limitKey];

      // Se não tem limite definido, permitir
      if (maxLimit === undefined) {
        return;
      }

      // Contar recursos atuais
      let currentCount = 0;

      if (resourceType === 'media') {
        const result = await this.db.findFirst(`
          SELECT COUNT(*) as count
          FROM medias
          WHERE subscriber_id = $1 AND is_active = true
        `, [subscriberId]);
        currentCount = parseInt(result?.count || '0');
      } else if (resourceType === 'playlist') {
        const result = await this.db.findFirst(`
          SELECT COUNT(*) as count
          FROM playlists
          WHERE subscriber_id = $1 AND is_active = true
        `, [subscriberId]);
        currentCount = parseInt(result?.count || '0');
      } else if (resourceType === 'campaign') {
        const result = await this.db.findFirst(`
          SELECT COUNT(*) as count
          FROM campaigns
          WHERE subscriber_id = $1 AND is_active = true
        `, [subscriberId]);
        currentCount = parseInt(result?.count || '0');
      }

      // Validar se não excede limite
      if (currentCount >= maxLimit) {
        throw new Error(
          `Limite de ${resourceType === 'media' ? 'mídias' : resourceType === 'playlist' ? 'playlists' : 'campanhas'} excedido. ` +
          `Limite do plano: ${maxLimit}, utilizado: ${currentCount}`
        );
      }
    } catch (error: any) {
      if (error.message.includes('Limite')) {
        throw error;
      }
      await logError('Erro ao validar limites do plano', error, { subscriberId, resourceType });
      throw new Error('Erro interno do servidor');
    }
  }

  /**
   * Validar limite de armazenamento (storage)
   */
  async validateStorageLimit(subscriberId: number, newFileSizeBytes: number): Promise<void> {
    try {
      const limits = await this.getMaxLimits(subscriberId);
      const maxStorageGB = limits.storage_gb;

      // Se não tem limite definido, permitir
      if (maxStorageGB === undefined) {
        return;
      }

      // Calcular storage atual (soma de todas as mídias)
      const currentStorageResult = await this.db.findFirst(`
        SELECT COALESCE(SUM(file_size_bytes), 0) as total_bytes
        FROM medias
        WHERE subscriber_id = $1 AND is_active = true
      `, [subscriberId]);

      const currentStorageBytes = parseInt(currentStorageResult?.total_bytes || '0');
      const newTotalBytes = currentStorageBytes + newFileSizeBytes;
      const newTotalGB = newTotalBytes / (1024 * 1024 * 1024); // Converter para GB

      // Validar se não excede limite
      if (newTotalGB > maxStorageGB) {
        const availableGB = maxStorageGB - (currentStorageBytes / (1024 * 1024 * 1024));
        throw new Error(
          `Limite de armazenamento excedido. ` +
          `Disponível: ${availableGB.toFixed(2)} GB, ` +
          `Tentativa de upload: ${(newFileSizeBytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
        );
      }
    } catch (error: any) {
      if (error.message.includes('Limite')) {
        throw error;
      }
      await logError('Erro ao validar limite de armazenamento', error, { subscriberId, newFileSizeBytes });
      throw new Error('Erro interno do servidor');
    }
  }

  /**
   * Obter contagem atual de recursos de um tipo específico
   */
  async getCurrentResourceCount(
    subscriberId: number,
    resourceType: 'media' | 'playlist' | 'campaign'
  ): Promise<number> {
    try {
      let currentCount = 0;

      if (resourceType === 'media') {
        const result = await this.db.findFirst(`
          SELECT COUNT(*) as count
          FROM medias
          WHERE subscriber_id = $1 AND is_active = true
        `, [subscriberId]);
        currentCount = parseInt(result?.count || '0');
      } else if (resourceType === 'playlist') {
        const result = await this.db.findFirst(`
          SELECT COUNT(*) as count
          FROM playlists
          WHERE subscriber_id = $1 AND is_active = true
        `, [subscriberId]);
        currentCount = parseInt(result?.count || '0');
      } else if (resourceType === 'campaign') {
        const result = await this.db.findFirst(`
          SELECT COUNT(*) as count
          FROM campaigns
          WHERE subscriber_id = $1 AND is_active = true
        `, [subscriberId]);
        currentCount = parseInt(result?.count || '0');
      }

      return currentCount;
    } catch (error: any) {
      await logError('Erro ao obter contagem de recursos', error, { subscriberId, resourceType });
      return 0;
    }
  }

  /**
   * Obter storage atual em bytes
   */
  async getCurrentStorage(subscriberId: number): Promise<number> {
    try {
      const currentStorageResult = await this.db.findFirst(`
        SELECT COALESCE(SUM(file_size_bytes), 0) as total_bytes
        FROM medias
        WHERE subscriber_id = $1 AND is_active = true
      `, [subscriberId]);

      return parseInt(currentStorageResult?.total_bytes || '0');
    } catch (error: any) {
      await logError('Erro ao obter storage atual', error, { subscriberId });
      return 0;
    }
  }

  /**
   * Validar acesso a totem (verificar se subscriber tem acesso via contratos/planos)
   */
  async validateTotemAccess(subscriberId: number, totemId: number): Promise<boolean> {
    try {
      // Buscar publisher do totem
      const totem = await this.db.findFirst(`
        SELECT t.totem_id, l.publisher_id
        FROM totems t
        JOIN locals l ON t.local_id = l.local_id
        WHERE t.totem_id = $1 AND t.is_active = true
      `, [totemId]);

      if (!totem || !totem.publisher_id) {
        return false;
      }

      const publisherId = totem.publisher_id;

      // Verificar acesso via subscriber_publisher_access
      const hasAccess = await this.db.findFirst(`
        SELECT 1
        FROM subscriber_publisher_access spa
        WHERE spa.subscriber_id = $1
          AND spa.publisher_id = $2
          AND spa.is_active = true
          AND (spa.expires_at IS NULL OR spa.expires_at > CURRENT_TIMESTAMP)
          AND spa.revoked_at IS NULL
      `, [subscriberId, publisherId]);

      return !!hasAccess;
    } catch (error: any) {
      await logError('Erro ao validar acesso a totem', error, { subscriberId, totemId });
      return false;
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

