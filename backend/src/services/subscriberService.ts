import { getDatabase } from '../config/database';
import { logError } from '../utils/loggerHelper';
import { getCacheService } from './cacheService';
import { StorageService } from './storageService';

export interface Subscriber {
  subscriber_id: number;
  name: string;
  contact_name?: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
  address?: string;
  category_segment?: string;
  description?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateSubscriberRequest {
  name: string;
  contract_id?: number; // Opcional - pode ser usado para vincular um pré-contrato (created_before_subscriber=true)
  contact_name?: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
  address?: string;
  category_segment?: string;
  description?: string;
}

export interface UpdateSubscriberRequest {
  name?: string;
  contact_name?: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
  address?: string;
  category_segment?: string;
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

  private get cache() {
    return getCacheService();
  }

  /**
   * Listar subscribers (anunciantes) com paginação e filtros
   */
  async getAllSubscribers(params: {
    page?: number;
    limit?: number;
    search?: string;
    is_active?: boolean;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    createdFrom?: string;
    createdTo?: string;
  }): Promise<SubscriberListResponse> {
    try {
      const { 
        page = 1, 
        limit = 10, 
        search,
        is_active,
        sortBy = 'created_at',
        sortOrder = 'desc',
        createdFrom,
        createdTo
      } = params;
      const offset = (page - 1) * limit;

      let whereClause = 'WHERE 1=1';
      const queryParams: any[] = [];
      let paramIndex = 1;

      // Filtro de status ativo/inativo
      if (is_active !== undefined) {
        whereClause += ` AND s.is_active = $${paramIndex}`;
        queryParams.push(is_active);
        paramIndex++;
      }

      // Busca em múltiplos campos
      if (search) {
        whereClause += ` AND (
          s.name ILIKE $${paramIndex} OR 
          s.email ILIKE $${paramIndex} OR 
          s.contact_name ILIKE $${paramIndex} OR 
          s.phone ILIKE $${paramIndex} OR
          s.whatsapp ILIKE $${paramIndex}
        )`;
        queryParams.push(`%${search}%`);
        paramIndex++;
      }

      // Filtro de data de criação
      if (createdFrom) {
        whereClause += ` AND s.created_at >= $${paramIndex}`;
        queryParams.push(createdFrom);
        paramIndex++;
      }
      if (createdTo) {
        whereClause += ` AND s.created_at <= $${paramIndex}`;
        queryParams.push(createdTo);
        paramIndex++;
      }

      // Validação de campo de ordenação
      const validSortFields: { [key: string]: string } = {
        'name': 's.name',
        'email': 's.email',
        'created_at': 's.created_at',
        'updated_at': 's.updated_at'
      };
      const sortField = validSortFields[sortBy] || 's.created_at';
      const orderDirection = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

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
          s.category_segment,
          s.description,
          s.is_active,
          s.created_at,
          s.updated_at
        FROM subscribers s
        ${whereClause}
        ORDER BY ${sortField} ${orderDirection}
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
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
   * Listar contratos ativos de um subscriber (status active e dentro do período)
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
   * Listar todos os contratos de um subscriber (qualquer status), para exibição na edição do anunciante.
   */
  async getSubscriberContracts(subscriberId: number, activeOnly = false): Promise<any[]> {
    try {
      const statusCondition = activeOnly
        ? `AND sc.status = 'active' AND sc.start_date <= CURRENT_DATE AND (sc.end_date IS NULL OR sc.end_date >= CURRENT_DATE)`
        : '';
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
          sc.contract_type,
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
          ${statusCondition}
        ORDER BY sc.start_date DESC, sc.contract_id DESC
      `, [subscriberId]);

      return contracts || [];
    } catch (error: any) {
      await logError('Erro ao buscar contratos do subscriber', error);
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
          s.category_segment,
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
   * - Pode ser criado sem contrato
   * - Opcionalmente pode vincular um pré-contrato (subscriber_contracts.created_before_subscriber=true)
   */
  async createSubscriber(data: CreateSubscriberRequest): Promise<Subscriber> {
    try {
      const { name, contract_id } = data;
      // Sanitizar campos opcionais: tratar '' como null, trim strings
      const contact_name = (data.contact_name && String(data.contact_name).trim() !== '') ? String(data.contact_name).trim() : null;
      const email = (data.email && String(data.email).trim() !== '') ? String(data.email).trim() : null;
      const phone = (data.phone && String(data.phone).trim() !== '') ? String(data.phone).trim() : null;
      const whatsapp = (data.whatsapp && String(data.whatsapp).trim() !== '') ? String(data.whatsapp).trim() : null;
      const address = (data.address && String(data.address).trim() !== '') ? String(data.address).trim() : null;
      const category_segment = (data.category_segment && String(data.category_segment).trim() !== '') ? String(data.category_segment).trim() : null;
      const description = (data.description && String(data.description).trim() !== '') ? String(data.description).trim() : null;

      // Validar contrato apenas se contract_id foi fornecido
      if (contract_id) {
        const contract = await this.db.findFirst(`
          SELECT 
            contract_id, 
            subscriber_id, 
            status, 
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
          throw new Error('Contrato deve estar em status "draft" ou "active" para vincular o subscriber');
        }

        // Se contrato já tem subscriber_id, erro (pré-contratos não são mais suportados)
        if (contract.subscriber_id) {
          throw new Error('Contrato já está vinculado a outro subscriber');
        }
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
        INSERT INTO subscribers (name, contact_name, email, phone, whatsapp, address, category_segment, description, is_active, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING subscriber_id
      `, [name, contact_name, email, phone, whatsapp, address, category_segment, description]);

      if (!result.rows || result.rows.length === 0) {
        throw new Error('Erro ao criar subscriber');
      }

      const subscriberId = result.rows[0].subscriber_id;

      // Vincular subscriber ao contrato (se fornecido)
      if (contract_id) {
        await this.db.executeRaw(`
          UPDATE subscriber_contracts 
          SET subscriber_id = $1,
              updated_at = CURRENT_TIMESTAMP
          WHERE contract_id = $2
        `, [subscriberId, contract_id]);
      }

      // Criar diretório de uploads do assinante (subscriber-{id}/medias) para permitir upload de mídias
      try {
        const storage = new StorageService();
        await storage.ensureSubscriberUploadDirs(subscriberId);
      } catch (dirError: any) {
        await logError('Erro ao criar diretório de uploads do assinante (assinante foi criado)', dirError, { subscriberId });
        // Não falhar a criação do assinante; o diretório pode ser criado depois ou manualmente
      }

      const newSubscriber = await this.getSubscriberById(subscriberId);

      if (!newSubscriber) {
        throw new Error('Erro ao buscar subscriber criado');
      }

      return newSubscriber;
    } catch (error: any) {
      // Capturar unique constraint violation (nome/email duplicado)
      if (error && (error.code === '23505' || (error.message && error.message.includes('duplicate key')))) {
        const msg = error.detail || error.message || '';
        if (msg.includes('name')) {
          throw new Error('Subscriber com este nome já existe');
        }
        if (msg.includes('email')) {
          throw new Error('Subscriber com este email já existe');
        }
        throw new Error('Subscriber com valores duplicados (nome/email) já existe');
      }
      await logError('Erro ao criar subscriber', error, { data });
      throw error;
    }
  }

  /**
   * Criar subscriber e subscriber_contracts numa única transação via procedure no banco.
   * contract_number é gerado no banco como SUB-{subscriber_id}.{seq}.
   * Uso: POST /api/subscribers com body { subscriber: { name, ... }, contracts: [ { plan_id?, title, ... } ] }
   */
  async createSubscriberWithContracts(payload: {
    subscriber: CreateSubscriberRequest & { is_active?: boolean };
    contracts?: Array<Record<string, unknown>>;
  }): Promise<Subscriber> {
    const db = getDatabase();
    const pSubscriber = JSON.stringify(payload.subscriber);
    const pContracts = JSON.stringify(payload.contracts ?? []);

    const row = await db.findFirst(
      `SELECT create_subscriber_with_contracts($1::jsonb, $2::jsonb) AS data`,
      [pSubscriber, pContracts]
    );
    if (!row?.data) {
      throw new Error('Erro ao criar subscriber com contratos: procedimento não retornou dados');
    }
    const data = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
    const subscriberId = data.subscriber_id;
    if (!subscriberId) {
      throw new Error('Erro ao criar subscriber com contratos: subscriber_id não retornado');
    }

    const subData = await db.findFirst(
      `SELECT subscriber_id, name, contact_name, email, phone, whatsapp, address, category_segment, description, is_active, created_at, updated_at
       FROM subscribers WHERE subscriber_id = $1`,
      [subscriberId]
    );
    if (!subData) {
      throw new Error('Erro ao buscar subscriber criado');
    }
    return subData as Subscriber;
  }

  /**
   * Atualizar subscriber
   */
  async updateSubscriber(id: number, data: UpdateSubscriberRequest): Promise<Subscriber> {
    try {
      const { name, contact_name: raw_contact_name, email: raw_email, phone: raw_phone, whatsapp: raw_whatsapp, address: raw_address, category_segment: raw_category_segment, description: raw_description, isActive } = data;
      const contact_name = (raw_contact_name !== undefined && raw_contact_name !== null && String(raw_contact_name).trim() !== '') ? String(raw_contact_name).trim() : undefined;
      const email = (raw_email !== undefined && raw_email !== null && String(raw_email).trim() !== '') ? String(raw_email).trim() : undefined;
      const phone = (raw_phone !== undefined && raw_phone !== null && String(raw_phone).trim() !== '') ? String(raw_phone).trim() : undefined;
      const whatsapp = (raw_whatsapp !== undefined && raw_whatsapp !== null && String(raw_whatsapp).trim() !== '') ? String(raw_whatsapp).trim() : undefined;
      const address = (raw_address !== undefined && raw_address !== null && String(raw_address).trim() !== '') ? String(raw_address).trim() : undefined;
      const category_segment = (raw_category_segment !== undefined && raw_category_segment !== null && String(raw_category_segment).trim() !== '') ? String(raw_category_segment).trim() : undefined;
      const description = (raw_description !== undefined && raw_description !== null && String(raw_description).trim() !== '') ? String(raw_description).trim() : undefined;

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
        updateParams.push(email || null);
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

      if (category_segment !== undefined) {
        updateFields.push(`category_segment = $${paramIndex}`);
        updateParams.push(category_segment || null);
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

      // Soft delete em cascata (lógica encapsulada no banco)
      await this.db.executeRaw(
        `SELECT deactivate_subscriber_cascade($1)`,
        [id]
      );
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
          st.smart_tv_id,
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
          st.last_heartbeat,
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
   * Com cache de 5 minutos para melhor performance
   */
  async getMaxLimits(subscriberId: number): Promise<{
    medias?: number;
    playlists?: number;
    campaigns?: number;
    storage_gb?: number;
  }> {
    try {
      // Tentar obter do cache primeiro
      const cacheKey = `subscriber:${subscriberId}:max_limits`;
      const cached = await this.cache.get<{
        medias?: number;
        playlists?: number;
        campaigns?: number;
        storage_gb?: number;
      }>(cacheKey);
      
      if (cached) {
        return cached;
      }

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

      const limits = {
        medias: maxMedias,
        playlists: maxPlaylists,
        campaigns: maxCampaigns,
        storage_gb: maxStorageGb,
      };

      // Armazenar no cache por 5 minutos (300 segundos)
      await this.cache.set(cacheKey, limits, 300);

      return limits;
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
   * Com cache de 1 minuto para melhor performance
   */
  async getCurrentResourceCount(
    subscriberId: number,
    resourceType: 'media' | 'playlist' | 'campaign'
  ): Promise<number> {
    try {
      // Tentar obter do cache primeiro
      const cacheKey = `subscriber:${subscriberId}:count:${resourceType}`;
      const cached = await this.cache.get<number>(cacheKey);
      
      if (cached !== null) {
        return cached;
      }

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

      // Armazenar no cache por 1 minuto (60 segundos)
      await this.cache.set(cacheKey, currentCount, 60);

      return currentCount;
    } catch (error: any) {
      await logError('Erro ao obter contagem de recursos', error, { subscriberId, resourceType });
      return 0;
    }
  }

  /**
   * Obter storage atual em bytes
   * Com cache de 1 minuto para melhor performance
   */
  async getCurrentStorage(subscriberId: number): Promise<number> {
    try {
      // Tentar obter do cache primeiro
      const cacheKey = `subscriber:${subscriberId}:storage`;
      const cached = await this.cache.get<number>(cacheKey);
      
      if (cached !== null) {
        return cached;
      }

      const currentStorageResult = await this.db.findFirst(`
        SELECT COALESCE(SUM(file_size_bytes), 0) as total_bytes
        FROM medias
        WHERE subscriber_id = $1 AND is_active = true
      `, [subscriberId]);

      const storageBytes = parseInt(currentStorageResult?.total_bytes || '0');

      // Armazenar no cache por 1 minuto (60 segundos)
      await this.cache.set(cacheKey, storageBytes, 60);

      return storageBytes;
    } catch (error: any) {
      await logError('Erro ao obter storage atual', error, { subscriberId });
      return 0;
    }
  }

  /**
   * Invalidar cache de limites e contagens de um subscriber
   * Chamar quando recursos são criados/atualizados/deletados
   */
  async invalidateSubscriberCache(subscriberId: number): Promise<void> {
    try {
      const patterns = [
        `subscriber:${subscriberId}:max_limits`,
        `subscriber:${subscriberId}:count:*`,
        `subscriber:${subscriberId}:storage`,
      ];

      for (const pattern of patterns) {
        await this.cache.deletePattern(pattern);
      }
    } catch (error: any) {
      // Não falhar se cache não estiver disponível
      await logError('Erro ao invalidar cache do subscriber', error, { subscriberId }).catch(() => {});
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
    media_count: number;
    playlist_count: number;
    campaign_count: number;
    storage_used_gb: number;
    storage_limit_gb?: number;
    plan_limits?: {
      medias?: number;
      playlists?: number;
      campaigns?: number;
      storage_gb?: number;
    };
  }> {
    try {
      // Subdomínio/Contrato: Subscriber acessa publishers via subscriber_publisher_access.
      // Portanto, locals/totems/smart_tvs devem ser contados via publishers acessíveis, e não por locals.subscriber_id (que não existe no schema v2).
      const publisherAccessCte = `
        WITH pubs AS (
          SELECT spa.publisher_id
          FROM subscriber_publisher_access spa
          WHERE spa.subscriber_id = $1
            AND spa.is_active = true
            AND spa.revoked_at IS NULL
            AND (spa.expires_at IS NULL OR spa.expires_at > CURRENT_TIMESTAMP)
        )
      `;

      // Contar locals
      const localsCountResult = await this.db.findFirst(`
        ${publisherAccessCte}
        SELECT COUNT(*) as count
        FROM locals l
        JOIN pubs p ON l.publisher_id = p.publisher_id
        WHERE l.is_active = true
      `, [subscriberId]);

      // Contar totems
      const totemsCountResult = await this.db.findFirst(`
        ${publisherAccessCte}
        SELECT COUNT(*) as count
        FROM totems t
        JOIN locals l ON t.local_id = l.local_id
        JOIN pubs p ON l.publisher_id = p.publisher_id
        WHERE t.is_active = true
      `, [subscriberId]);

      // Contar smart TVs
      const smartTvsCountResult = await this.db.findFirst(`
        ${publisherAccessCte}
        SELECT COUNT(*) as count
        FROM smart_tvs st
        JOIN totems t ON st.totem_id = t.totem_id
        JOIN locals l ON t.local_id = l.local_id
        JOIN pubs p ON l.publisher_id = p.publisher_id
        WHERE st.is_active = true
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
        ${publisherAccessCte}
        SELECT COUNT(*) as count
        FROM totems t
        JOIN locals l ON t.local_id = l.local_id
        JOIN pubs p ON l.publisher_id = p.publisher_id
        WHERE t.is_active = true 
          AND COALESCE(t.status, 'offline') = 'online'
      `, [subscriberId]);

      // Contar smart TVs reproduzindo
      const playingTvsResult = await this.db.findFirst(`
        ${publisherAccessCte}
        SELECT COUNT(*) as count
        FROM smart_tvs st
        JOIN totems t ON st.totem_id = t.totem_id
        JOIN locals l ON t.local_id = l.local_id
        JOIN pubs p ON l.publisher_id = p.publisher_id
        WHERE st.is_active = true 
          AND COALESCE(st.status, 'offline') = 'playing'
      `, [subscriberId]);

      // Contar mídias
      const mediaCountResult = await this.db.findFirst(`
        SELECT COUNT(*) as count
        FROM medias
        WHERE subscriber_id = $1 AND is_active = true
      `, [subscriberId]);

      // Contar playlists
      const playlistCountResult = await this.db.findFirst(`
        SELECT COUNT(*) as count
        FROM playlists
        WHERE subscriber_id = $1 AND is_active = true
      `, [subscriberId]);

      // Contar campanhas (todas, não apenas ativas)
      const campaignCountResult = await this.db.findFirst(`
        SELECT COUNT(*) as count
        FROM campaigns
        WHERE subscriber_id = $1
      `, [subscriberId]);

      // Obter storage usado
      const storageResult = await this.db.findFirst(`
        SELECT COALESCE(SUM(file_size_bytes), 0) as total_bytes
        FROM medias
        WHERE subscriber_id = $1 AND is_active = true
      `, [subscriberId]);
      const storageUsedGB = storageResult?.total_bytes ? parseFloat(storageResult.total_bytes) / (1024 * 1024 * 1024) : 0;

      // Obter limites do plano
      const maxLimits = await this.getMaxLimits(subscriberId);
      const storageLimitGB = maxLimits.storage_gb;

      return {
        localsCount: parseInt(localsCountResult?.count || '0'),
        totemsCount: parseInt(totemsCountResult?.count || '0'),
        smartTvsCount: parseInt(smartTvsCountResult?.count || '0'),
        activeCampaignsCount: parseInt(campaignsCountResult?.count || '0'),
        onlineTotems: parseInt(onlineTotemsResult?.count || '0'),
        playingTvs: parseInt(playingTvsResult?.count || '0'),
        media_count: parseInt(mediaCountResult?.count || '0'),
        playlist_count: parseInt(playlistCountResult?.count || '0'),
        campaign_count: parseInt(campaignCountResult?.count || '0'),
        storage_used_gb: storageUsedGB,
        storage_limit_gb: storageLimitGB,
        plan_limits: {
          medias: maxLimits.medias,
          playlists: maxLimits.playlists,
          campaigns: maxLimits.campaigns,
          storage_gb: maxLimits.storage_gb,
        },
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

