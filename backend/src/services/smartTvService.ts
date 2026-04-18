/**
 * Smart TV Service - Smart Signage v2.0
 * Serviço de gerenciamento de Smart TVs (controladas pelos totens)
 */

import { getDatabase } from '../config/database';
import { AuditService } from './auditService';
import { logError } from '../utils/loggerHelper';
import { assertCompactOwnerPublisher } from '../utils/compactOwnerPublisher';

export interface SmartTv {
  smart_tv_id: number;
  totem_id: number;
  identifier: string;
  device_id?: string;
  name?: string;
  brand?: string;
  model?: string;
  platform?: string;
  firmware_version?: string;
  resolution_width?: number;
  resolution_height?: number;
  orientation?: 'landscape' | 'portrait';
  status?: string;
  last_heartbeat?: string;
  capabilities?: any; // JSONB
  settings?: any; // JSONB
  is_active: boolean;
  created_at: string;
  updated_at: string;
  totem_name?: string; // Derivado
  local_name?: string; // Derivado
  publisher_name?: string; // Derivado
  publisher_id?: number; // Derivado
}

export interface CreateSmartTvRequest {
  totem_id: number;
  contract_id?: number; // Opcional: contrato que gerou a criação (rastreabilidade)
  identifier: string;
  device_id?: string;
  name?: string;
  brand?: string;
  model?: string;
  platform?: string;
  firmware_version?: string;
  resolution_width?: number;
  resolution_height?: number;
  orientation?: 'landscape' | 'portrait';
  capabilities?: any;
  settings?: any;
}

export interface UpdateSmartTvRequest {
  identifier?: string;
  device_id?: string;
  name?: string;
  brand?: string;
  model?: string;
  platform?: string;
  firmware_version?: string;
  resolution_width?: number;
  resolution_height?: number;
  orientation?: 'landscape' | 'portrait';
  status?: string;
  capabilities?: any;
  settings?: any;
  is_active?: boolean;
}

export interface SmartTvListResponse {
  data: SmartTv[];
  total: number;
  page: number;
  limit: number;
}

export class SmartTvService {
  private get db() {
    return getDatabase();
  }

  private getAuditService(): AuditService {
    if (!(global as any).auditServiceInstance) {
      (global as any).auditServiceInstance = new AuditService();
    }
    return (global as any).auditServiceInstance;
  }

  /**
   * Listar Smart TVs com paginação e filtros
   * @param params Parâmetros de filtro e paginação
   * @param requestPublisherId ID do publisher do usuário autenticado (para validação de ownership)
   * @param isAdmin Se o usuário é admin
   */
  async getAllSmartTvs(
    params: {
      page?: number;
      limit?: number;
      search?: string;
      totemId?: number;
      publisherId?: number;
      active_only?: boolean;
    } = {},
    requestPublisherId?: number,
    isAdmin: boolean = false
  ): Promise<SmartTvListResponse> {
    try {
      const { page = 1, limit = 10, search, totemId, publisherId, active_only = true } = params;
      const offset = (page - 1) * limit;

      let whereClause = 'WHERE 1=1';
      const queryParams: any[] = [];
      let paramIndex = 1;

      // Validação de ownership: não-admin só vê Smart TVs do seu publisher
      if (!isAdmin && requestPublisherId) {
        whereClause += ` AND p.publisher_id = $${paramIndex}`;
        queryParams.push(requestPublisherId);
        paramIndex++;
      } else if (publisherId) {
        // Admin pode filtrar por publisher específico
        whereClause += ` AND p.publisher_id = $${paramIndex}`;
        queryParams.push(publisherId);
        paramIndex++;
      }

      if (totemId) {
        whereClause += ` AND st.totem_id = $${paramIndex}`;
        queryParams.push(totemId);
        paramIndex++;
      }

      if (active_only) {
        whereClause += ` AND st.is_active = $${paramIndex}`;
        queryParams.push(true);
        paramIndex++;
      }

      if (search) {
        whereClause += ` AND (st.name ILIKE $${paramIndex} OR st.identifier ILIKE $${paramIndex} OR st.brand ILIKE $${paramIndex} OR st.model ILIKE $${paramIndex})`;
        queryParams.push(`%${search}%`);
        paramIndex++;
      }

      // Buscar Smart TVs
      const smartTvs = await this.db.findMany(`
        SELECT 
          st.smart_tv_id,
          st.totem_id,
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
          t.identifier as totem_identifier,
          l.name as local_name,
          p.name as publisher_name,
          p.publisher_id
        FROM smart_tvs st
        JOIN totems t ON st.totem_id = t.totem_id
        JOIN locals l ON t.local_id = l.local_id
        JOIN publishers p ON l.publisher_id = p.publisher_id
        ${whereClause}
        ORDER BY st.created_at DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `, [...queryParams, limit, offset]);

      // Contar total
      const totalResult = await this.db.findFirst(`
        SELECT COUNT(*) as total
        FROM smart_tvs st
        JOIN totems t ON st.totem_id = t.totem_id
        JOIN locals l ON t.local_id = l.local_id
        JOIN publishers p ON l.publisher_id = p.publisher_id
        ${whereClause}
      `, queryParams);

      return {
        data: smartTvs,
        total: parseInt(totalResult?.total || '0'),
        page,
        limit,
      };
    } catch (error: any) {
      await logError('Erro ao listar Smart TVs', error, { params });
      throw new Error('Erro interno do servidor');
    }
  }

  /**
   * Obter Smart TV por ID
   * @param id ID da Smart TV
   * @param requestPublisherId ID do publisher do usuário autenticado (para validação de ownership)
   * @param isAdmin Se o usuário é admin
   */
  async getSmartTvById(id: number, requestPublisherId?: number, isAdmin: boolean = false): Promise<SmartTv | null> {
    try {
      const smartTv = await this.db.findFirst(`
        SELECT 
          st.smart_tv_id,
          st.totem_id,
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
          t.identifier as totem_identifier,
          l.name as local_name,
          p.name as publisher_name,
          p.publisher_id
        FROM smart_tvs st
        JOIN totems t ON st.totem_id = t.totem_id
        JOIN locals l ON t.local_id = l.local_id
        JOIN publishers p ON l.publisher_id = p.publisher_id
        WHERE st.smart_tv_id = $1
      `, [id]);

      if (!smartTv) {
        return null;
      }

      // Validação de ownership
      if (!isAdmin && requestPublisherId && smartTv.publisher_id !== requestPublisherId) {
        throw new Error('Acesso negado: Smart TV não pertence ao seu publisher');
      }

      return smartTv;
    } catch (error: any) {
      await logError('Erro ao obter Smart TV', error, { id });
      throw error;
    }
  }

  /**
   * Criar nova Smart TV
   * @param data Dados da Smart TV
   * @param createdBy ID do usuário que está criando
   * @param requestPublisherId ID do publisher do usuário autenticado (para validação)
   * @param isAdmin Se o usuário é admin
   */
  async createSmartTv(
    data: CreateSmartTvRequest,
    createdBy: number,
    requestPublisherId?: number,
    isAdmin: boolean = false
  ): Promise<SmartTv> {
    try {
      const { totem_id, contract_id, identifier, device_id, name, brand, model, platform, firmware_version, resolution_width, resolution_height, orientation, capabilities, settings } = data;

      // Validar se totem existe e obter publisher_id
      const totem = await this.db.findFirst(`
        SELECT 
          t.totem_id,
          t.name as totem_name,
          l.local_id,
          l.name as local_name,
          p.publisher_id,
          p.name as publisher_name
        FROM totems t
        JOIN locals l ON t.local_id = l.local_id
        JOIN publishers p ON l.publisher_id = p.publisher_id
        WHERE t.totem_id = $1
      `, [totem_id]);

      if (!totem) {
        throw new Error('Totem não encontrado');
      }

      await assertCompactOwnerPublisher(this.db, Number(totem.publisher_id), 'Smart TV');

      // Validação de ownership: não-admin só pode criar Smart TVs em totens do seu publisher
      // Se requestPublisherId não estiver definido (admin criando publisher novo), permitir
      if (!isAdmin && requestPublisherId && totem.publisher_id !== requestPublisherId) {
        throw new Error('Acesso negado: Você só pode criar Smart TVs em totens do seu próprio publisher');
      }

      // Validar contract_id se fornecido (deve existir e estar ativo)
      if (contract_id) {
        const contract = await this.db.findFirst(`
          SELECT contract_id, status, start_date, end_date
          FROM subscriber_contracts 
          WHERE contract_id = $1
          UNION ALL
          SELECT contract_id, status, start_date, end_date
          FROM publisher_contracts 
          WHERE contract_id = $1
        `, [contract_id]);

        if (!contract) {
          throw new Error('Contrato não encontrado');
        }

        if (contract.status !== 'active' && contract.status !== 'draft') {
          throw new Error('Contrato deve estar em status "active" ou "draft"');
        }

        // Validar se contrato não está expirado
        if (contract.end_date) {
          const endDate = new Date(contract.end_date);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          if (endDate < today) {
            throw new Error('Contrato está expirado');
          }
        }
      }
      // Se for admin sem publisherId (criando publisher novo), permitir criação

      // Verificar se identifier já existe
      const existingTv = await this.db.findFirst(`
        SELECT smart_tv_id FROM smart_tvs WHERE identifier = $1
      `, [identifier]);

      if (existingTv) {
        throw new Error('Smart TV com este identifier já existe');
      }

      // Verificar se device_id já existe (se fornecido)
      if (device_id) {
        const existingDevice = await this.db.findFirst(`
          SELECT smart_tv_id FROM smart_tvs WHERE device_id = $1
        `, [device_id]);

        if (existingDevice) {
          throw new Error('Smart TV com este device_id já existe');
        }
      }

      // Criar Smart TV
      const result = await this.db.executeRaw(`
        INSERT INTO smart_tvs (
          totem_id, created_via_contract_id, identifier, device_id, name, brand, model, platform,
          firmware_version, resolution_width, resolution_height, orientation,
          status, capabilities, settings, is_active,
          created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'offline', $13, $14, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING smart_tv_id
      `, [
        totem_id,
        contract_id || null,
        identifier,
        device_id || null,
        name || null,
        brand || null,
        model || null,
        platform || null,
        firmware_version || null,
        resolution_width || null,
        resolution_height || null,
        orientation || 'landscape',
        capabilities ? JSON.stringify(capabilities) : null,
        settings ? JSON.stringify(settings) : null,
      ]);

      if (!result.rows || result.rows.length === 0) {
        throw new Error('Erro ao criar Smart TV');
      }

      const tvId = result.rows[0].smart_tv_id;
      const newSmartTv = await this.getSmartTvById(tvId, requestPublisherId, isAdmin);

      if (!newSmartTv) {
        throw new Error('Erro ao buscar Smart TV criada');
      }

      // Log de auditoria
      await this.getAuditService().log('smart_tv', 'created', createdBy, {
        tvId,
        identifier,
        totem_id,
      });

      return newSmartTv;
    } catch (error: any) {
      await logError('Erro ao criar Smart TV', error, { data });
      throw error;
    }
  }

  /**
   * Atualizar Smart TV
   * @param id ID da Smart TV
   * @param data Dados para atualizar
   * @param updatedBy ID do usuário que está atualizando
   * @param requestPublisherId ID do publisher do usuário autenticado (para validação)
   * @param isAdmin Se o usuário é admin
   */
  async updateSmartTv(
    id: number,
    data: UpdateSmartTvRequest,
    updatedBy: number,
    requestPublisherId?: number,
    isAdmin: boolean = false
  ): Promise<SmartTv> {
    try {
      // Verificar se Smart TV existe e validar ownership
      const existingSmartTv = await this.getSmartTvById(id, requestPublisherId, isAdmin);
      if (!existingSmartTv) {
        throw new Error('Smart TV não encontrada');
      }

      if (existingSmartTv.publisher_id) {
        await assertCompactOwnerPublisher(this.db, Number(existingSmartTv.publisher_id), 'Smart TV');
      }

      // Verificar se identifier já existe (se mudou)
      if (data.identifier && data.identifier !== existingSmartTv.identifier) {
        const tvWithSameIdentifier = await this.db.findFirst(`
          SELECT smart_tv_id FROM smart_tvs WHERE identifier = $1 AND smart_tv_id != $2
        `, [data.identifier, id]);

        if (tvWithSameIdentifier) {
          throw new Error('Smart TV com este identifier já existe');
        }
      }

      // Verificar se device_id já existe (se mudou)
      if (data.device_id && data.device_id !== existingSmartTv.device_id) {
        const tvWithSameDevice = await this.db.findFirst(`
          SELECT smart_tv_id FROM smart_tvs WHERE device_id = $1 AND smart_tv_id != $2
        `, [data.device_id, id]);

        if (tvWithSameDevice) {
          throw new Error('Smart TV com este device_id já existe');
        }
      }

      // Preparar campos para atualização
      const updateFields: string[] = [];
      const updateParams: any[] = [];
      let paramIndex = 1;

      if (data.identifier) {
        updateFields.push(`identifier = $${paramIndex}`);
        updateParams.push(data.identifier);
        paramIndex++;
      }

      if (data.device_id !== undefined) {
        updateFields.push(`device_id = $${paramIndex}`);
        updateParams.push(data.device_id || null);
        paramIndex++;
      }

      if (data.name !== undefined) {
        updateFields.push(`name = $${paramIndex}`);
        updateParams.push(data.name || null);
        paramIndex++;
      }

      if (data.brand !== undefined) {
        updateFields.push(`brand = $${paramIndex}`);
        updateParams.push(data.brand || null);
        paramIndex++;
      }

      if (data.model !== undefined) {
        updateFields.push(`model = $${paramIndex}`);
        updateParams.push(data.model || null);
        paramIndex++;
      }

      if (data.platform !== undefined) {
        updateFields.push(`platform = $${paramIndex}`);
        updateParams.push(data.platform || null);
        paramIndex++;
      }

      if (data.firmware_version !== undefined) {
        updateFields.push(`firmware_version = $${paramIndex}`);
        updateParams.push(data.firmware_version || null);
        paramIndex++;
      }

      if (data.resolution_width !== undefined) {
        updateFields.push(`resolution_width = $${paramIndex}`);
        updateParams.push(data.resolution_width || null);
        paramIndex++;
      }

      if (data.resolution_height !== undefined) {
        updateFields.push(`resolution_height = $${paramIndex}`);
        updateParams.push(data.resolution_height || null);
        paramIndex++;
      }

      if (data.orientation !== undefined) {
        updateFields.push(`orientation = $${paramIndex}`);
        updateParams.push(data.orientation);
        paramIndex++;
      }

      if (data.status !== undefined) {
        updateFields.push(`status = $${paramIndex}`);
        updateParams.push(data.status);
        paramIndex++;
      }

      if (data.capabilities !== undefined) {
        updateFields.push(`capabilities = $${paramIndex}`);
        updateParams.push(data.capabilities ? JSON.stringify(data.capabilities) : null);
        paramIndex++;
      }

      if (data.settings !== undefined) {
        updateFields.push(`settings = $${paramIndex}`);
        updateParams.push(data.settings ? JSON.stringify(data.settings) : null);
        paramIndex++;
      }

      if (data.is_active !== undefined) {
        updateFields.push(`is_active = $${paramIndex}`);
        updateParams.push(data.is_active);
        paramIndex++;
      }

      updateFields.push(`updated_at = CURRENT_TIMESTAMP`);

      // Executar atualização
      await this.db.executeRaw(`
        UPDATE smart_tvs 
        SET ${updateFields.join(', ')}
        WHERE smart_tv_id = $${paramIndex}
      `, [...updateParams, id]);

      const updatedSmartTv = await this.getSmartTvById(id, requestPublisherId, isAdmin);
      if (!updatedSmartTv) {
        throw new Error('Erro ao buscar Smart TV atualizada');
      }

      // Log de auditoria
      await this.getAuditService().log('smart_tv', 'updated', updatedBy, {
        tvId: id,
        changes: data,
      });

      return updatedSmartTv;
    } catch (error: any) {
      await logError('Erro ao atualizar Smart TV', error, { id, data });
      throw error;
    }
  }

  /**
   * Deletar Smart TV (soft delete)
   * @param id ID da Smart TV
   * @param deletedBy ID do usuário que está deletando
   * @param requestPublisherId ID do publisher do usuário autenticado (para validação)
   * @param isAdmin Se o usuário é admin
   */
  async deleteSmartTv(
    id: number,
    deletedBy: number,
    requestPublisherId?: number,
    isAdmin: boolean = false
  ): Promise<void> {
    try {
      // Verificar se Smart TV existe e validar ownership
      const existingSmartTv = await this.getSmartTvById(id, requestPublisherId, isAdmin);
      if (!existingSmartTv) {
        throw new Error('Smart TV não encontrada');
      }

      // Soft delete
      await this.db.executeRaw(`
        UPDATE smart_tvs 
        SET is_active = false, updated_at = CURRENT_TIMESTAMP
        WHERE smart_tv_id = $1
      `, [id]);

      // Log de auditoria
      await this.getAuditService().log('smart_tv', 'deleted', deletedBy, {
        tvId: id,
        identifier: existingSmartTv.identifier,
      });
    } catch (error: any) {
      await logError('Erro ao deletar Smart TV', error, { id });
      throw error;
    }
  }

  /**
   * Listar Smart TVs de um totem
   * @param totemId ID do totem
   * @param requestPublisherId ID do publisher do usuário autenticado (para validação)
   * @param isAdmin Se o usuário é admin
   */
  async getSmartTvsByTotem(
    totemId: number,
    requestPublisherId?: number,
    isAdmin: boolean = false
  ): Promise<SmartTv[]> {
    try {
      // Verificar ownership do totem primeiro
      const totem = await this.db.findFirst(`
        SELECT 
          t.totem_id,
          l.local_id,
          p.publisher_id
        FROM totems t
        JOIN locals l ON t.local_id = l.local_id
        JOIN publishers p ON l.publisher_id = p.publisher_id
        WHERE t.totem_id = $1
      `, [totemId]);

      if (!totem) {
        throw new Error('Totem não encontrado');
      }

      // Validação de ownership
      if (!isAdmin && requestPublisherId && totem.publisher_id !== requestPublisherId) {
        throw new Error('Acesso negado: Totem não pertence ao seu publisher');
      }

      const smartTvs = await this.db.findMany(`
        SELECT 
          st.smart_tv_id,
          st.totem_id,
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
          t.identifier as totem_identifier,
          l.name as local_name,
          p.name as publisher_name,
          p.publisher_id
        FROM smart_tvs st
        JOIN totems t ON st.totem_id = t.totem_id
        JOIN locals l ON t.local_id = l.local_id
        JOIN publishers p ON l.publisher_id = p.publisher_id
        WHERE st.totem_id = $1
          AND st.is_active = true
        ORDER BY st.name, st.identifier
      `, [totemId]);

      return smartTvs;
    } catch (error: any) {
      await logError('Erro ao buscar Smart TVs do totem', error, { totemId });
      throw error;
    }
  }
}

// Instância global do serviço
let smartTvServiceInstance: SmartTvService;

export function getSmartTvService(): SmartTvService {
  if (!smartTvServiceInstance) {
    smartTvServiceInstance = new SmartTvService();
  }
  return smartTvServiceInstance;
}

