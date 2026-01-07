/**
 * Local Service - Smart Signage v2.0
 * Serviço de gerenciamento de locals (locais físicos dos publishers)
 */

import { getDatabase } from '../config/database';
import { AuditService } from './auditService';
import { logError } from '../utils/loggerHelper';

export interface Local {
  local_id: number;
  publisher_id: number;
  name: string;
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  timezone?: string;
  description?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  publisher_name?: string; // Derivado
}

export interface CreateLocalRequest {
  publisher_id: number; // Obrigatório: local pertence a um publisher
  name: string;
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  timezone?: string;
  description?: string;
}

export interface UpdateLocalRequest {
  name?: string;
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  timezone?: string;
  description?: string;
  is_active?: boolean;
}

export interface LocalListResponse {
  data: Local[];
  total: number;
  page: number;
  limit: number;
}

export class LocalService {
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
   * Listar locals com paginação e filtros
   * @param params Parâmetros de filtro e paginação
   * @param requestPublisherId ID do publisher do usuário autenticado (para validação de ownership)
   * @param isAdmin Se o usuário é admin
   */
  async getAllLocals(
    params: {
      page?: number;
      limit?: number;
      search?: string;
      publisherId?: number;
      active_only?: boolean;
    } = {},
    requestPublisherId?: number,
    isAdmin: boolean = false
  ): Promise<LocalListResponse> {
    try {
      const { page = 1, limit = 10, search, publisherId, active_only = true } = params;
      const offset = (page - 1) * limit;

      let whereClause = 'WHERE 1=1';
      const queryParams: any[] = [];
      let paramIndex = 1;

      // Validação de ownership: não-admin só vê locals do seu publisher
      if (!isAdmin && requestPublisherId) {
        whereClause += ` AND l.publisher_id = $${paramIndex}`;
        queryParams.push(requestPublisherId);
        paramIndex++;
      } else if (publisherId) {
        // Admin pode filtrar por publisher específico
        whereClause += ` AND l.publisher_id = $${paramIndex}`;
        queryParams.push(publisherId);
        paramIndex++;
      }

      if (active_only) {
        whereClause += ` AND l.is_active = $${paramIndex}`;
        queryParams.push(true);
        paramIndex++;
      }

      if (search) {
        whereClause += ` AND (l.name ILIKE $${paramIndex} OR l.address ILIKE $${paramIndex} OR l.city ILIKE $${paramIndex})`;
        queryParams.push(`%${search}%`);
        paramIndex++;
      }

      // Buscar locals
      const locals = await this.db.findMany(`
        SELECT 
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
          p.name as publisher_name
        FROM locals l
        LEFT JOIN publishers p ON l.publisher_id = p.publisher_id
        ${whereClause}
        ORDER BY l.created_at DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `, [...queryParams, limit, offset]);

      // Contar total
      const totalResult = await this.db.findFirst(`
        SELECT COUNT(*) as total
        FROM locals l
        ${whereClause}
      `, queryParams);

      return {
        data: locals,
        total: parseInt(totalResult?.total || '0'),
        page,
        limit,
      };
    } catch (error: any) {
      await logError('Erro ao listar locals', error, { params });
      throw new Error('Erro interno do servidor');
    }
  }

  /**
   * Obter local por ID
   * @param id ID do local
   * @param requestPublisherId ID do publisher do usuário autenticado (para validação de ownership)
   * @param isAdmin Se o usuário é admin
   */
  async getLocalById(id: number, requestPublisherId?: number, isAdmin: boolean = false): Promise<Local | null> {
    try {
      const local = await this.db.findFirst(`
        SELECT 
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
          p.name as publisher_name
        FROM locals l
        LEFT JOIN publishers p ON l.publisher_id = p.publisher_id
        WHERE l.local_id = $1
      `, [id]);

      if (!local) {
        return null;
      }

      // Validação de ownership
      if (!isAdmin && requestPublisherId && local.publisher_id !== requestPublisherId) {
        throw new Error('Acesso negado: Local não pertence ao seu publisher');
      }

      return local;
    } catch (error: any) {
      await logError('Erro ao obter local', error, { id });
      throw error;
    }
  }

  /**
   * Criar novo local
   * @param data Dados do local
   * @param createdBy ID do usuário que está criando
   * @param requestPublisherId ID do publisher do usuário autenticado (para validação)
   * @param isAdmin Se o usuário é admin
   */
  async createLocal(
    data: CreateLocalRequest,
    createdBy: number,
    requestPublisherId?: number,
    isAdmin: boolean = false
  ): Promise<Local> {
    try {
      const { publisher_id, name, address, city, state, zip_code, country, latitude, longitude, timezone, description } = data;

      // Validar que tem publisher_id (obrigatório)
      if (!publisher_id) {
        throw new Error('publisher_id é obrigatório. Locais pertencem apenas a publishers.');
      }

      // Validar se publisher existe
      const publisher = await this.db.findFirst(`
        SELECT publisher_id, name FROM publishers WHERE publisher_id = $1
      `, [publisher_id]);

      if (!publisher) {
        throw new Error('Publisher não encontrado');
      }

      // Validação de ownership: não-admin só pode criar locals do seu publisher
      if (!isAdmin && requestPublisherId && publisher_id !== requestPublisherId) {
        throw new Error('Acesso negado: Você só pode criar locals para o seu próprio publisher');
      }

      // Verificar se local com mesmo nome já existe para este publisher
      const existingLocal = await this.db.findFirst(`
        SELECT local_id FROM locals WHERE name = $1 AND publisher_id = $2
      `, [name, publisher_id]);

      if (existingLocal) {
        throw new Error('Local com este nome já existe para este publisher');
      }

      // Criar local
      const result = await this.db.executeRaw(`
        INSERT INTO locals (
          publisher_id, name, address, city, state, zip_code, country,
          latitude, longitude, timezone, description, is_active,
          created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING local_id
      `, [publisher_id, name, address || null, city || null, state || null, zip_code || null, country || 'BR', latitude || null, longitude || null, timezone || 'America/Sao_Paulo', description || null]);

      if (!result.rows || result.rows.length === 0) {
        throw new Error('Erro ao criar local');
      }

      const localId = result.rows[0].local_id;
      const newLocal = await this.getLocalById(localId, requestPublisherId, isAdmin);

      if (!newLocal) {
        throw new Error('Erro ao buscar local criado');
      }

      // Log de auditoria
      await this.getAuditService().log('local', 'created', createdBy, {
        localId,
        name,
        publisher_id,
      });

      return newLocal;
    } catch (error: any) {
      await logError('Erro ao criar local', error, { data });
      throw error;
    }
  }

  /**
   * Atualizar local
   * @param id ID do local
   * @param data Dados para atualizar
   * @param updatedBy ID do usuário que está atualizando
   * @param requestPublisherId ID do publisher do usuário autenticado (para validação)
   * @param isAdmin Se o usuário é admin
   */
  async updateLocal(
    id: number,
    data: UpdateLocalRequest,
    updatedBy: number,
    requestPublisherId?: number,
    isAdmin: boolean = false
  ): Promise<Local> {
    try {
      // Verificar se local existe e validar ownership
      const existingLocal = await this.getLocalById(id, requestPublisherId, isAdmin);
      if (!existingLocal) {
        throw new Error('Local não encontrado');
      }

      // Verificar se nome já existe (se mudou)
      if (data.name && data.name !== existingLocal.name) {
        const localWithSameName = await this.db.findFirst(`
          SELECT local_id FROM locals WHERE name = $1 AND publisher_id = $2 AND local_id != $3
        `, [data.name, existingLocal.publisher_id, id]);

        if (localWithSameName) {
          throw new Error('Local com este nome já existe para este publisher');
        }
      }

      // Preparar campos para atualização
      const updateFields: string[] = [];
      const updateParams: any[] = [];
      let paramIndex = 1;

      if (data.name) {
        updateFields.push(`name = $${paramIndex}`);
        updateParams.push(data.name);
        paramIndex++;
      }

      if (data.address !== undefined) {
        updateFields.push(`address = $${paramIndex}`);
        updateParams.push(data.address || null);
        paramIndex++;
      }

      if (data.city !== undefined) {
        updateFields.push(`city = $${paramIndex}`);
        updateParams.push(data.city || null);
        paramIndex++;
      }

      if (data.state !== undefined) {
        updateFields.push(`state = $${paramIndex}`);
        updateParams.push(data.state || null);
        paramIndex++;
      }

      if (data.zip_code !== undefined) {
        updateFields.push(`zip_code = $${paramIndex}`);
        updateParams.push(data.zip_code || null);
        paramIndex++;
      }

      if (data.country !== undefined) {
        updateFields.push(`country = $${paramIndex}`);
        updateParams.push(data.country || null);
        paramIndex++;
      }

      if (data.latitude !== undefined) {
        updateFields.push(`latitude = $${paramIndex}`);
        updateParams.push(data.latitude || null);
        paramIndex++;
      }

      if (data.longitude !== undefined) {
        updateFields.push(`longitude = $${paramIndex}`);
        updateParams.push(data.longitude || null);
        paramIndex++;
      }

      if (data.timezone !== undefined) {
        updateFields.push(`timezone = $${paramIndex}`);
        updateParams.push(data.timezone || null);
        paramIndex++;
      }

      if (data.description !== undefined) {
        updateFields.push(`description = $${paramIndex}`);
        updateParams.push(data.description || null);
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
        UPDATE locals 
        SET ${updateFields.join(', ')}
        WHERE local_id = $${paramIndex}
      `, [...updateParams, id]);

      const updatedLocal = await this.getLocalById(id, requestPublisherId, isAdmin);
      if (!updatedLocal) {
        throw new Error('Erro ao buscar local atualizado');
      }

      // Log de auditoria
      await this.getAuditService().log('local', 'updated', updatedBy, {
        localId: id,
        changes: data,
      });

      return updatedLocal;
    } catch (error: any) {
      await logError('Erro ao atualizar local', error, { id, data });
      throw error;
    }
  }

  /**
   * Deletar local (soft delete)
   * @param id ID do local
   * @param deletedBy ID do usuário que está deletando
   * @param requestPublisherId ID do publisher do usuário autenticado (para validação)
   * @param isAdmin Se o usuário é admin
   */
  async deleteLocal(
    id: number,
    deletedBy: number,
    requestPublisherId?: number,
    isAdmin: boolean = false
  ): Promise<void> {
    try {
      // Verificar se local existe e validar ownership
      const existingLocal = await this.getLocalById(id, requestPublisherId, isAdmin);
      if (!existingLocal) {
        throw new Error('Local não encontrado');
      }

      // Verificar se local tem totens ativos
      const totemsCount = await this.db.findFirst(`
        SELECT COUNT(*) as count
        FROM totems
        WHERE local_id = $1 AND is_active = true
      `, [id]);

      if (parseInt(totemsCount?.count || '0') > 0) {
        throw new Error('Não é possível deletar local com totens ativos. Desative os totens primeiro.');
      }

      // Soft delete
      await this.db.executeRaw(`
        UPDATE locals 
        SET is_active = false, updated_at = CURRENT_TIMESTAMP
        WHERE local_id = $1
      `, [id]);

      // Log de auditoria
      await this.getAuditService().log('local', 'deleted', deletedBy, {
        localId: id,
        name: existingLocal.name,
      });
    } catch (error: any) {
      await logError('Erro ao deletar local', error, { id });
      throw error;
    }
  }

  /**
   * Listar totens de um local
   * @param localId ID do local
   * @param requestPublisherId ID do publisher do usuário autenticado (para validação)
   * @param isAdmin Se o usuário é admin
   */
  async getTotemsByLocal(
    localId: number,
    requestPublisherId?: number,
    isAdmin: boolean = false
  ): Promise<any[]> {
    try {
      // Verificar ownership do local primeiro
      const local = await this.getLocalById(localId, requestPublisherId, isAdmin);
      if (!local) {
        throw new Error('Local não encontrado');
      }

      const totems = await this.db.findMany(`
        SELECT 
          t.totem_id,
          t.identifier,
          t.uin,
          t.device_id,
          t.name,
          t.description,
          t.status,
          t.is_active,
          t.created_at,
          t.updated_at
        FROM totems t
        WHERE t.local_id = $1
          AND t.is_active = true
        ORDER BY t.name, t.identifier
      `, [localId]);

      return totems;
    } catch (error: any) {
      await logError('Erro ao buscar totens do local', error, { localId });
      throw error;
    }
  }
}

// Instância global do serviço
let localServiceInstance: LocalService;

export function getLocalService(): LocalService {
  if (!localServiceInstance) {
    localServiceInstance = new LocalService();
  }
  return localServiceInstance;
}

