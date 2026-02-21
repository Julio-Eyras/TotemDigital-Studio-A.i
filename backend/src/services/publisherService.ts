import { getDatabase } from '../config/database';
import { logError } from '../utils/loggerHelper';

export interface Publisher {
  publisher_id: number;
  name: string;
  contact_name?: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
  category_segment?: string;
  description?: string;
  // Regra do domínio: publisher não pode ser subscriber/ambos.
  // Campos mantidos por compatibilidade com schema, mas devem ser fixos: is_subscriber=false, is_publisher=true, client_type='publisher'
  is_subscriber: boolean;
  is_publisher: boolean;
  client_type: 'subscriber' | 'publisher' | 'both';
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreatePublisherRequest {
  name: string;
  contract_id?: number; // Opcional - contrato que gerou a criação do publisher (para rastreabilidade)
  contact_name?: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
  category_segment?: string;
  description?: string;
  // Campos removidos/ignorados: publisher não pode ser subscriber/ambos
}

export interface UpdatePublisherRequest {
  name?: string;
  contact_name?: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
  category_segment?: string;
  description?: string;
  /** API/frontend pode enviar "active"; BD usa coluna is_active */
  active?: boolean;
  is_active?: boolean;
}

export interface PublisherListResponse {
  data: Publisher[];
  total: number;
  page: number;
  limit: number;
}

export class PublisherService {
  private get db() {
    return getDatabase();
  }

  /**
   * Listar publishers (publicadores) com paginação e filtros
   */
  async getAllPublishers(params: {
    page?: number;
    limit?: number;
    search?: string;
    // client_type removido: sempre listar apenas publishers "puros"
    active_only?: boolean;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    createdFrom?: string;
    createdTo?: string;
  }): Promise<PublisherListResponse> {
    try {
      const { 
        page = 1, 
        limit = 10, 
        search, 
        // active_only:
        // - true => filtrar apenas ativos
        // - false => não filtrar (incluir inativos também)
        // - undefined => default true (manter comportamento anterior)
        active_only = true,
        sortBy = 'created_at',
        sortOrder = 'desc',
        createdFrom,
        createdTo
      } = params;
      const offset = (page - 1) * limit;

      let whereClause = 'WHERE 1=1';
      // Regra do domínio: retornar apenas publishers (nunca subscribers/ambos)
      whereClause += ` AND p.is_publisher = true AND p.is_subscriber = false AND p.client_type = 'publisher'`;

      const queryParams: any[] = [];
      let paramIndex = 1;

      // Filtro de status ativo/inativo
      if (active_only === true) {
        whereClause += ` AND COALESCE(p.is_active, true) = $${paramIndex}`;
        queryParams.push(true);
        paramIndex++;
      }

      // Busca em múltiplos campos
      if (search) {
        whereClause += ` AND (
          p.name ILIKE $${paramIndex} OR 
          p.email ILIKE $${paramIndex} OR 
          p.contact_name ILIKE $${paramIndex} OR 
          p.phone ILIKE $${paramIndex} OR
          p.whatsapp ILIKE $${paramIndex} OR
          p.category_segment ILIKE $${paramIndex} OR
          p.description ILIKE $${paramIndex}
        )`;
        queryParams.push(`%${search}%`);
        paramIndex++;
      }

      // Filtro de data de criação
      if (createdFrom) {
        whereClause += ` AND p.created_at >= $${paramIndex}`;
        queryParams.push(createdFrom);
        paramIndex++;
      }
      if (createdTo) {
        whereClause += ` AND p.created_at <= $${paramIndex}`;
        queryParams.push(createdTo);
        paramIndex++;
      }

      // Validação de campo de ordenação
      const validSortFields: { [key: string]: string } = {
        'name': 'p.name',
        'email': 'p.email',
        'created_at': 'p.created_at',
        'updated_at': 'p.updated_at'
      };
      const sortField = validSortFields[sortBy] || 'p.created_at';
      const orderDirection = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

      // Buscar publishers
      const publishers = await this.db.findMany(`
        SELECT 
          p.publisher_id,
          p.name,
          p.contact_name,
          p.email,
          p.phone,
          p.whatsapp,
          p.category_segment,
          p.description,
          p.is_subscriber,
          p.is_publisher,
          p.client_type,
          p.is_active,
          p.created_at,
          p.updated_at
        FROM publishers p
        ${whereClause}
        ORDER BY ${sortField} ${orderDirection}
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `, [...queryParams, limit, offset]);

      // Contar total
      const totalResult = await this.db.findFirst(`
        SELECT COUNT(*) as total
        FROM publishers p
        ${whereClause}
      `, queryParams);

      return {
        data: publishers,
        total: parseInt(totalResult?.total || '0'),
        page,
        limit,
      };
    } catch (error: any) {
      await logError('Erro ao listar publishers', error, { params });
      throw new Error('Erro interno do servidor');
    }
  }

  /**
   * Obter publisher por ID
   */
  async getPublisherById(id: number): Promise<Publisher | null> {
    try {
      const row = await this.db.findFirst(`
        SELECT 
          p.publisher_id,
          p.name,
          p.contact_name,
          p.email,
          p.phone,
          p.whatsapp,
          p.category_segment,
          p.description,
          p.is_subscriber,
          p.is_publisher,
          p.client_type,
          p.is_active,
          p.created_at,
          p.updated_at
        FROM publishers p
        WHERE p.publisher_id = $1
      `, [id]);

      if (!row) return null;
      // Contrato da API: retornar "active" (frontend usa); coluna no BD é is_active
      return { ...row, active: !!row.is_active } as Publisher;
    } catch (error: any) {
      await logError('Erro ao obter publisher', error, { id });
      throw new Error('Erro interno do servidor');
    }
  }

  /**
   * Criar novo publisher (publicador)
   * contract_id é opcional - pode ser criado sem contrato inicial
   */
  async createPublisher(data: CreatePublisherRequest): Promise<Publisher> {
    try {
      const { 
        name, 
        contract_id,
        contact_name, 
        email, 
        phone, 
        whatsapp, 
        category_segment,
        description
      } = data;

      // Validar contrato apenas se contract_id foi fornecido
      if (contract_id) {
        const contract = await this.db.findFirst(`
          SELECT 
            contract_id, 
            publisher_id, 
            status, 
            created_before_publisher,
            start_date,
            end_date
          FROM publisher_contracts 
          WHERE contract_id = $1
        `, [contract_id]);

        if (!contract) {
          throw new Error('Contrato não encontrado');
        }

        // Validar status do contrato (deve ser draft ou active)
        if (contract.status !== 'draft' && contract.status !== 'active') {
          throw new Error('Contrato deve estar em status "draft" ou "active" para criar publisher');
        }

        // Se contrato já tem publisher_id e não foi criado antes do publisher, erro
        if (contract.publisher_id && !contract.created_before_publisher) {
          throw new Error('Contrato já está vinculado a outro publisher');
        }
      }

      // Regra do domínio: publisher é sempre publisher (nunca subscriber/ambos)
      const finalIsSubscriber = false;
      const finalIsPublisher = true;
      const finalClientType: 'publisher' = 'publisher';

      // Verificar se publisher já existe
      const existingPublisher = await this.db.findFirst(`
        SELECT publisher_id FROM publishers WHERE name = $1
      `, [name]);

      if (existingPublisher) {
        throw new Error('Publisher com este nome já existe');
      }

      // Criar publisher
      const result = await this.db.executeRaw(`
        INSERT INTO publishers (
          name, contact_name, email, phone, whatsapp, category_segment, description,
          is_subscriber, is_publisher, client_type, is_active, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING publisher_id
      `, [name, contact_name, email, phone, whatsapp, category_segment || null, description, finalIsSubscriber, finalIsPublisher, finalClientType]);

      if (!result.rows || result.rows.length === 0) {
        throw new Error('Erro ao criar publisher');
      }

      const publisherId = result.rows[0].publisher_id;

      // Vincular publisher ao contrato apenas se contract_id foi fornecido
      if (contract_id) {
        await this.db.executeRaw(`
          UPDATE publisher_contracts 
          SET publisher_id = $1, updated_at = CURRENT_TIMESTAMP
          WHERE contract_id = $2
        `, [publisherId, contract_id]);
      }

      const newPublisher = await this.getPublisherById(publisherId);

      if (!newPublisher) {
        throw new Error('Erro ao buscar publisher criado');
      }

      return newPublisher;
    } catch (error: any) {
      // Capturar unique constraint violation (nome/email duplicado)
      if (error && (error.code === '23505' || (error.message && error.message.includes('duplicate key')))) {
        // Tentar inferir qual campo
        const msg = error.detail || error.message || '';
        if (msg.includes('name')) {
          throw new Error('Publisher com este nome já existe');
        }
        if (msg.includes('email')) {
          throw new Error('Publisher com este email já existe');
        }
        throw new Error('Publisher com valores duplicados (nome/email) já existe');
      }
      await logError('Erro ao criar publisher', error, { data });
      throw error;
    }
  }

  /**
   * Criar publisher e recursos relacionados (locals, totems, smart_tvs, contracts) dentro de uma transação
   */
  async createPublisherWithResources(payload: {
    publisher: CreatePublisherRequest;
    locals?: Array<any>;
    totems?: Array<any>;
    smartTvs?: Array<any>;
    contracts?: Array<any>;
  }): Promise<Publisher> {
    // Implementação transacional usando transaction exportado do database-pg
    const { transaction } = await import('../config/database-pg');
    return await transaction(async (client) => {
      const pub = payload.publisher;
      // Inserir publisher
      const resPub = await client.query(
        `INSERT INTO publishers (name, contact_name, email, phone, whatsapp, category_segment, description, is_subscriber, is_publisher, client_type, is_active, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP) RETURNING publisher_id`,
        [pub.name, pub.contact_name, pub.email, pub.phone, pub.whatsapp, pub.category_segment || null, pub.description || null, false, true, 'publisher']
      );
      const publisherId = resPub.rows[0].publisher_id;

      const localIdMap: number[] = [];
      if (payload.locals && Array.isArray(payload.locals)) {
        for (const l of payload.locals) {
          const resLocal = await client.query(
            `INSERT INTO locals (publisher_id, name, category_segment, address, city, state, zip_code, country, latitude, longitude, timezone, description, is_active, created_at, updated_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP) RETURNING local_id`,
            [publisherId, l.name, l.category_segment || null, l.address || null, l.city || null, l.state || null, l.zip_code || null, l.country || null, l.latitude || null, l.longitude || null, l.timezone || null, l.description || null]
          );
          localIdMap.push(resLocal.rows[0].local_id);
        }
      }

      const totemIdMap: number[] = [];
      if (payload.totems && Array.isArray(payload.totems)) {
        for (const t of payload.totems) {
          const localIndex = typeof t.localIndex === 'number' ? t.localIndex : 0;
          const localId = localIdMap[localIndex];
          const resTotem = await client.query(
            `INSERT INTO totems (identifier, uin, device_id, local_id, name, description, model, manufacturer, firmware_version, hardware_version, os_version, status, last_heartbeat, heartbeat_interval, network_info, capabilities, is_active, created_at, updated_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NULL,60,$13,$14,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP) RETURNING totem_id`,
            [t.identifier || null, t.uin || null, t.deviceId || null, localId || null, t.name || null, t.description || null, t.model || null, t.manufacturer || null, t.firmwareVersion || null, t.hardwareVersion || null, t.osVersion || null, t.status || 'offline', t.network_info || '{}' , JSON.stringify(t.capabilities || {})]
          );
          totemIdMap.push(resTotem.rows[0].totem_id);
        }
      }

      if (payload.smartTvs && Array.isArray(payload.smartTvs)) {
        for (const s of payload.smartTvs) {
          const totemIndex = typeof s.totemIndex === 'number' ? s.totemIndex : 0;
          const totemId = totemIdMap[totemIndex];
          await client.query(
            `INSERT INTO smart_tvs (totem_id, identifier, device_id, name, brand, model, platform, firmware_version, resolution_width, resolution_height, orientation, status, last_heartbeat, capabilities, settings, is_active, created_at, updated_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NULL,$13,$14,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`,
            [totemId || null, s.identifier, s.device_id || null, s.name || null, s.brand || null, s.model || null, s.platform || null, s.firmware_version || null, s.resolution_width || null, s.resolution_height || null, s.orientation || 'landscape', s.status || 'offline', JSON.stringify(s.capabilities || {}), JSON.stringify(s.settings || {})]
          );
        }
      }

      if (payload.contracts && Array.isArray(payload.contracts)) {
        for (const c of payload.contracts) {
          await client.query(
            `INSERT INTO publisher_contracts (publisher_id, contract_number, contract_type, title, description, start_date, end_date, revenue_share_percentage, revenue_share_rules, minimum_payout_amount, subscription_amount, subscription_interval, currency, payment_terms, status, signed_by_publisher_at, signed_by_tenant_at, created_by, metadata, document_path, document_filename, document_mime_type, document_size_bytes, is_active, created_at, updated_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,NULL,NULL,$16,$17,$18,$19,$20,$21,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`,
            [publisherId, c.contract_number, c.contract_type || 'revenue_share', c.title || null, c.description || null, c.start_date || null, c.end_date || null, c.revenue_share_percentage || 0, JSON.stringify(c.revenue_share_rules || {}), c.minimum_payout_amount || null, c.subscription_amount || null, c.subscription_interval || null, c.currency || 'BRL', c.payment_terms || 'Mensal', c.status || 'draft', c.created_by || null, JSON.stringify(c.metadata || {}), c.document_path || null, c.document_filename || null, c.document_mime_type || null, c.document_size_bytes || null]
          );
        }
      }

      const newPublisher = await this.getPublisherById(publisherId);
      if (!newPublisher) throw new Error('Erro ao buscar publisher criado');
      return newPublisher;
    });
  }

  /**
   * Atualizar publisher
   */
  async updatePublisher(id: number, data: UpdatePublisherRequest): Promise<Publisher> {
    try {
      const { 
        name, 
        contact_name, 
        email, 
        phone, 
        whatsapp, 
        category_segment,
        description,
        active,
        is_active: isActiveReq
      } = data;
      const activeOrIsActive = active !== undefined ? active : isActiveReq;

      // Verificar se publisher existe
      const existingPublisher = await this.getPublisherById(id);
      if (!existingPublisher) {
        throw new Error('Publisher não encontrado');
      }

      // Verificar se nome já existe (se mudou)
      if (name && name !== existingPublisher.name) {
        const publisherWithSameName = await this.db.findFirst(`
          SELECT publisher_id FROM publishers WHERE name = $1 AND publisher_id != $2
        `, [name, id]);

        if (publisherWithSameName) {
          throw new Error('Publisher com este nome já existe');
        }
      }

      // Regra do domínio: corrigir/forçar publisher-only sempre que atualizar
      const finalIsSubscriber = false;
      const finalIsPublisher = true;
      const finalClientType: 'publisher' = 'publisher';

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

      // Sempre forçar os flags para o estado correto (publisher-only)
      updateFields.push(`is_subscriber = $${paramIndex}`);
      updateParams.push(finalIsSubscriber);
      paramIndex++;

      updateFields.push(`is_publisher = $${paramIndex}`);
      updateParams.push(finalIsPublisher);
      paramIndex++;

      updateFields.push(`client_type = $${paramIndex}`);
      updateParams.push(finalClientType);
      paramIndex++;

      if (activeOrIsActive !== undefined) {
        updateFields.push(`is_active = $${paramIndex}`);
        updateParams.push(!!activeOrIsActive);
        paramIndex++;
      }

      updateFields.push(`updated_at = CURRENT_TIMESTAMP`);

      // Executar atualização
      await this.db.executeRaw(`
        UPDATE publishers 
        SET ${updateFields.join(', ')}
        WHERE publisher_id = $${paramIndex}
      `, [...updateParams, id]);

      const updatedPublisher = await this.getPublisherById(id);
      if (!updatedPublisher) {
        throw new Error('Erro ao buscar publisher atualizado');
      }

      return updatedPublisher;
    } catch (error: any) {
      await logError('Erro ao atualizar publisher', error, { id, data });
      throw error;
    }
  }

  /**
   * Excluir publisher (soft delete)
   */
  async deletePublisher(id: number): Promise<void> {
    try {
      // Verificar se publisher existe
      const existingPublisher = await this.getPublisherById(id);
      if (!existingPublisher) {
        throw new Error('Publisher não encontrado');
      }

      // Soft delete - marcar como inativo
      await this.db.executeRaw(`
        UPDATE publishers 
        SET is_active = false, updated_at = CURRENT_TIMESTAMP
        WHERE publisher_id = $1
      `, [id]);
    } catch (error: any) {
      await logError('Erro ao excluir publisher', error, { id });
      throw error;
    }
  }

  /**
   * Listar locals de um publisher
   */
  async getLocalsByPublisher(publisherId: number): Promise<any[]> {
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
        WHERE l.publisher_id = $1
          AND l.is_active = true
        ORDER BY l.name
      `, [publisherId]);

      return locals;
    } catch (error: any) {
      await logError('Erro ao buscar locals do publisher', error, { publisherId });
      throw new Error('Erro interno do servidor');
    }
  }

  /**
   * Listar totems de um publisher (via locals)
   */
  async getTotemsByPublisher(publisherId: number): Promise<any[]> {
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
        WHERE l.publisher_id = $1
          AND t.is_active = true
        ORDER BY l.name, t.name
      `, [publisherId]);

      return totems;
    } catch (error: any) {
      await logError('Erro ao buscar totems do publisher', error, { publisherId });
      throw new Error('Erro interno do servidor');
    }
  }

  /**
   * Listar smart TVs de um publisher (via totems)
   */
  async getSmartTvsByPublisher(publisherId: number): Promise<any[]> {
    try {
      const smartTvs = await this.db.findMany(`
        SELECT 
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
          l.name as local_name
        FROM smart_tvs st
        JOIN totems t ON st.totem_id = t.totem_id
        JOIN locals l ON t.local_id = l.local_id
        WHERE l.publisher_id = $1
          AND st.is_active = true
        ORDER BY l.name, t.name, st.name
      `, [publisherId]);

      return smartTvs;
    } catch (error: any) {
      await logError('Erro ao buscar smart TVs do publisher', error, { publisherId });
      throw new Error('Erro interno do servidor');
    }
  }

  /**
   * Obter estatísticas de um publisher
   */
  async getPublisherStats(publisherId: number): Promise<{
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
        WHERE publisher_id = $1 AND is_active = true
      `, [publisherId]);

      // Contar totems
      const totemsCountResult = await this.db.findFirst(`
        SELECT COUNT(*) as count
        FROM totems t
        JOIN locals l ON t.local_id = l.local_id
        WHERE l.publisher_id = $1 AND t.is_active = true
      `, [publisherId]);

      // Contar smart TVs
      const smartTvsCountResult = await this.db.findFirst(`
        SELECT COUNT(*) as count
        FROM smart_tvs st
        JOIN totems t ON st.totem_id = t.totem_id
        JOIN locals l ON t.local_id = l.local_id
        WHERE l.publisher_id = $1 AND st.is_active = true
      `, [publisherId]);

      // Contar campanhas ativas (via campaign_publishers)
      const campaignsCountResult = await this.db.findFirst(`
        SELECT COUNT(DISTINCT cp.campaign_id) as count
        FROM campaign_publishers cp
        JOIN campaigns c ON cp.campaign_id = c.campaign_id
        WHERE cp.publisher_id = $1
          AND cp.is_active = true
          AND c.is_active = true
          AND c.status = 'active'
          AND (c.end_date IS NULL OR c.end_date >= CURRENT_DATE)
      `, [publisherId]);

      // Contar totens online
      const onlineTotemsResult = await this.db.findFirst(`
        SELECT COUNT(*) as count
        FROM totems t
        JOIN locals l ON t.local_id = l.local_id
        WHERE l.publisher_id = $1 
          AND t.is_active = true
          AND t.status = 'online'
      `, [publisherId]);

      // Contar Smart TVs playing
      const playingTvsResult = await this.db.findFirst(`
        SELECT COUNT(*) as count
        FROM smart_tvs st
        JOIN totems t ON st.totem_id = t.totem_id
        JOIN locals l ON t.local_id = l.local_id
        WHERE l.publisher_id = $1 
          AND st.is_active = true
          AND st.status = 'playing'
      `, [publisherId]);

      return {
        localsCount: parseInt(localsCountResult?.count || '0'),
        totemsCount: parseInt(totemsCountResult?.count || '0'),
        smartTvsCount: parseInt(smartTvsCountResult?.count || '0'),
        activeCampaignsCount: parseInt(campaignsCountResult?.count || '0'),
        onlineTotems: parseInt(onlineTotemsResult?.count || '0'),
        playingTvs: parseInt(playingTvsResult?.count || '0'),
      };
    } catch (error: any) {
      await logError('Erro ao buscar estatísticas do publisher', error, { publisherId });
      throw new Error('Erro interno do servidor');
    }
  }
}

// Instância global do serviço
let publisherServiceInstance: PublisherService;

export function getPublisherService(): PublisherService {
  if (!publisherServiceInstance) {
    publisherServiceInstance = new PublisherService();
  }
  return publisherServiceInstance;
}

