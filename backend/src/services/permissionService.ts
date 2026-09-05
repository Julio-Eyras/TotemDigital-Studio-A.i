import { getDatabase } from '../config/database';
import { logError } from '../utils/loggerHelper';
import { normalizeError } from '../utils/errors';

export interface Permission {
  permission_id: number;
  name: string;
  resource: string;
  action: string;
  description?: string;
  created_at: string;
}

export interface CreatePermissionRequest {
  name: string;
  resource: string;
  action: string;
  description?: string;
}

export interface UpdatePermissionRequest {
  name?: string;
  resource?: string;
  action?: string;
  description?: string;
}

export interface PermissionListResponse {
  data: Permission[];
  total: number;
  page: number;
  limit: number;
}

export class PermissionService {
  private get db() {
    return getDatabase();
  }

  /**
   * Listar permissions com paginação e filtros
   */
  async getAllPermissions(params: {
    page?: number;
    limit?: number;
    search?: string;
    resource?: string;
    action?: string;
  }): Promise<PermissionListResponse> {
    try {
      const { page = 1, limit = 20, search, resource, action } = params;
      const offset = (page - 1) * limit;

      let whereClause = '1=1';
      const paramsArray: any[] = [];

      if (search) {
        whereClause += ' AND (name ILIKE ? OR description ILIKE ? OR resource ILIKE ?)';
        const searchTerm = `%${search}%`;
        paramsArray.push(searchTerm, searchTerm, searchTerm);
      }

      if (resource) {
        whereClause += ' AND resource = ?';
        paramsArray.push(resource);
      }

      if (action) {
        whereClause += ' AND action = ?';
        paramsArray.push(action);
      }

      // Contar total
      const countResult = await this.db.findFirst(`
        SELECT COUNT(*) as total
        FROM permissions
        WHERE ${whereClause}
      `, paramsArray);

      const total = parseInt(countResult?.total || '0');

      // Buscar permissions
      const permissions = await this.db.findMany(`
        SELECT permission_id, name, resource, action, description, created_at
        FROM permissions
        WHERE ${whereClause}
        ORDER BY resource, action
        LIMIT ? OFFSET ?
      `, [...paramsArray, limit, offset]);

      return {
        data: permissions.map((p: any) => ({
          permission_id: p.permission_id,
          name: p.name,
          resource: p.resource,
          action: p.action,
          description: p.description,
          created_at: p.created_at
        })),
        total,
        page,
        limit
      };} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('Erro ao listar permissions', e.error);
      throw e.error;
    }
  }

  /**
   * Buscar permission por ID
   */
  async getPermissionById(permissionId: number): Promise<Permission | null> {
    try {
      const permission = await this.db.findFirst(`
        SELECT permission_id, name, resource, action, description, created_at
        FROM permissions
        WHERE permission_id = ?
      `, [permissionId]);

      if (!permission) return null;

      return {
        permission_id: permission.permission_id,
        name: permission.name,
        resource: permission.resource,
        action: permission.action,
        description: permission.description,
        created_at: permission.created_at
      };} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('Erro ao buscar permission', e.error, { permissionId });
      throw e.error;
    }
  }

  /**
   * Buscar permission por nome
   */
  async getPermissionByName(name: string): Promise<Permission | null> {
    try {
      const permission = await this.db.findFirst(`
        SELECT permission_id, name, resource, action, description, created_at
        FROM permissions
        WHERE name = ?
      `, [name]);

      if (!permission) return null;

      return {
        permission_id: permission.permission_id,
        name: permission.name,
        resource: permission.resource,
        action: permission.action,
        description: permission.description,
        created_at: permission.created_at
      };} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('Erro ao buscar permission por nome', e.error, { name });
      throw e.error;
    }
  }

  /**
   * Criar nova permission
   */
  async createPermission(data: CreatePermissionRequest): Promise<Permission> {
    try {
      // Verificar se permission já existe
      const existing = await this.getPermissionByName(data.name);
      if (existing) {
        throw new Error('Permission com este nome já existe');
      }

      const result = await this.db.executeRaw(`
        INSERT INTO permissions (name, resource, action, description)
        VALUES (?, ?, ?, ?)
        RETURNING permission_id
      `, [data.name, data.resource, data.action, data.description || null]);

      const insertedPermission = result?.rows?.[0];
      if (!insertedPermission?.permission_id) {
        throw new Error('Erro ao criar permission');
      }

      const newPermission = await this.getPermissionById(insertedPermission.permission_id);
      if (!newPermission) {
        throw new Error('Erro ao buscar permission criada');
      }

      return newPermission;} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('Erro ao criar permission', e.error, { data });
      throw e.error;
    }
  }

  /**
   * Atualizar permission
   */
  async updatePermission(permissionId: number, data: UpdatePermissionRequest): Promise<Permission> {
    try {
      const existing = await this.getPermissionById(permissionId);
      if (!existing) {
        throw new Error('Permission não encontrada');
      }

      // Se estiver alterando o nome, verificar se não existe outra permission com o mesmo nome
      if (data.name && data.name !== existing.name) {
        const nameExists = await this.getPermissionByName(data.name);
        if (nameExists) {
          throw new Error('Permission com este nome já existe');
        }
      }

      const updates: string[] = [];
      const params: unknown[] = [];

      if (data.name !== undefined) {
        updates.push('name = ?');
        params.push(data.name);
      }

      if (data.resource !== undefined) {
        updates.push('resource = ?');
        params.push(data.resource);
      }

      if (data.action !== undefined) {
        updates.push('action = ?');
        params.push(data.action);
      }

      if (data.description !== undefined) {
        updates.push('description = ?');
        params.push(data.description);
      }

      if (updates.length === 0) {
        return existing;
      }

      params.push(permissionId);

      await this.db.executeRaw(`
        UPDATE permissions
        SET ${updates.join(', ')}
        WHERE permission_id = ?
      `, params);

      const updated = await this.getPermissionById(permissionId);
      if (!updated) {
        throw new Error('Erro ao buscar permission atualizada');
      }

      return updated;} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('Erro ao atualizar permission', e.error, { permissionId, data });
      throw e.error;
    }
  }

  /**
   * Deletar permission
   */
  async deletePermission(permissionId: number): Promise<void> {
    try {
      const existing = await this.getPermissionById(permissionId);
      if (!existing) {
        throw new Error('Permission não encontrada');
      }

      // Verificar se há roles com esta permission
      const rolesWithPermission = await this.db.findFirst(`
        SELECT COUNT(*) as count
        FROM role_permissions
        WHERE permission_id = ?
      `, [permissionId]);

      if (parseInt(rolesWithPermission?.count || '0') > 0) {
        throw new Error('Não é possível deletar permission que está atribuída a roles');
      }

      await this.db.executeRaw(`
        DELETE FROM permissions
        WHERE permission_id = ?
      `, [permissionId]);} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('Erro ao deletar permission', e.error, { permissionId });
      throw e.error;
    }
  }

  /**
   * Obter recursos únicos
   */
  async getResources(): Promise<string[]> {
    try {
      const resources = await this.db.findMany(`
        SELECT DISTINCT resource
        FROM permissions
        ORDER BY resource
      `);

      return resources.map((r: any) => r.resource);} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('Erro ao buscar recursos', e.error);
      throw e.error;
    }
  }

  /**
   * Obter ações únicas
   */
  async getActions(): Promise<string[]> {
    try {
      const actions = await this.db.findMany(`
        SELECT DISTINCT action
        FROM permissions
        ORDER BY action
      `);

      return actions.map((a: any) => a.action);} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('Erro ao buscar ações', e.error);
      throw e.error;
    }
  }
}

// Singleton instance
let permissionServiceInstance: PermissionService | null = null;

export function getPermissionService(): PermissionService {
  if (!permissionServiceInstance) {
    permissionServiceInstance = new PermissionService();
  }
  return permissionServiceInstance;
}

