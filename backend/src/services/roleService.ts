import { getDatabase } from '../config/database';
import { logError } from '../utils/loggerHelper';

export interface Role {
  role_id: number;
  name: string;
  description?: string;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
}

export interface CreateRoleRequest {
  name: string;
  description?: string;
  is_active?: boolean;
}

export interface UpdateRoleRequest {
  name?: string;
  description?: string;
  is_active?: boolean;
}

export interface RoleListResponse {
  data: Role[];
  total: number;
  page: number;
  limit: number;
}

export class RoleService {
  private get db() {
    return getDatabase();
  }

  /**
   * Listar roles com paginação e filtros
   */
  async getAllRoles(params: {
    page?: number;
    limit?: number;
    search?: string;
    isActive?: boolean;
  }): Promise<RoleListResponse> {
    try {
      const { page = 1, limit = 20, search, isActive } = params;
      const offset = (page - 1) * limit;

      let whereClause = '1=1';
      const paramsArray: any[] = [];

      if (search) {
        const searchParamIndex = paramsArray.length + 1;
        whereClause += ` AND (name ILIKE $${searchParamIndex} OR description ILIKE $${searchParamIndex + 1})`;
        const searchTerm = `%${search}%`;
        paramsArray.push(searchTerm, searchTerm);
      }

      if (isActive !== undefined) {
        whereClause += ' AND is_active = ?';
        paramsArray.push(isActive);
      }

      // Contar total
      const countResult = await this.db.findFirst(`
        SELECT COUNT(*) as total
        FROM roles
        WHERE ${whereClause}
      `, paramsArray);

      const total = parseInt(countResult?.total || '0');

      // Buscar roles
      const roles = await this.db.findMany(`
        SELECT role_id, name, description, is_active, created_at, updated_at
        FROM roles
        WHERE ${whereClause}
        ORDER BY name ASC
        LIMIT ? OFFSET ?
      `, [...paramsArray, limit, offset]);

      return {
        data: roles.map((r: any) => ({
          role_id: r.role_id,
          name: r.name,
          description: r.description,
          is_active: r.is_active,
          created_at: r.created_at,
          updated_at: r.updated_at
        })),
        total,
        page,
        limit
      };
    } catch (error: any) {
      await logError('Erro ao listar roles', error);
      throw error;
    }
  }

  /**
   * Buscar role por ID
   */
  async getRoleById(roleId: number): Promise<Role | null> {
    try {
      const role = await this.db.findFirst(`
        SELECT role_id, name, description, is_active, created_at, updated_at
        FROM roles
        WHERE role_id = ?
      `, [roleId]);

      if (!role) return null;

      return {
        role_id: role.role_id,
        name: role.name,
        description: role.description,
        is_active: role.is_active,
        created_at: role.created_at,
        updated_at: role.updated_at
      };
    } catch (error: any) {
      await logError('Erro ao buscar role', error, { roleId });
      throw error;
    }
  }

  /**
   * Buscar role por nome
   */
  async getRoleByName(name: string): Promise<Role | null> {
    try {
      const role = await this.db.findFirst(`
        SELECT role_id, name, description, is_active, created_at, updated_at
        FROM roles
        WHERE name = ?
      `, [name]);

      if (!role) return null;

      return {
        role_id: role.role_id,
        name: role.name,
        description: role.description,
        is_active: role.is_active,
        created_at: role.created_at,
        updated_at: role.updated_at
      };
    } catch (error: any) {
      await logError('Erro ao buscar role por nome', error, { name });
      throw error;
    }
  }

  /**
   * Criar nova role
   */
  async createRole(data: CreateRoleRequest): Promise<Role> {
    try {
      // Verificar se role já existe
      const existing = await this.getRoleByName(data.name);
      if (existing) {
        throw new Error('Role com este nome já existe');
      }

      const result = await this.db.executeRaw(`
        INSERT INTO roles (name, description, is_active)
        VALUES (?, ?, ?)
        RETURNING role_id
      `, [data.name, data.description || null, data.is_active !== undefined ? data.is_active : true]);

      const insertedRole = result?.rows?.[0];
      if (!insertedRole?.role_id) {
        throw new Error('Erro ao criar role');
      }

      const newRole = await this.getRoleById(insertedRole.role_id);
      if (!newRole) {
        throw new Error('Erro ao buscar role criada');
      }

      return newRole;
    } catch (error: any) {
      await logError('Erro ao criar role', error, { data });
      throw error;
    }
  }

  /**
   * Atualizar role
   */
  async updateRole(roleId: number, data: UpdateRoleRequest): Promise<Role> {
    try {
      const existing = await this.getRoleById(roleId);
      if (!existing) {
        throw new Error('Role não encontrada');
      }

      // Se estiver alterando o nome, verificar se não existe outra role com o mesmo nome
      if (data.name && data.name !== existing.name) {
        const nameExists = await this.getRoleByName(data.name);
        if (nameExists) {
          throw new Error('Role com este nome já existe');
        }
      }

      const updates: string[] = [];
      const params: any[] = [];

      if (data.name !== undefined) {
        updates.push('name = ?');
        params.push(data.name);
      }

      if (data.description !== undefined) {
        updates.push('description = ?');
        params.push(data.description);
      }

      if (data.is_active !== undefined) {
        updates.push('is_active = ?');
        params.push(data.is_active);
      }

      if (updates.length === 0) {
        return existing;
      }

      updates.push('updated_at = CURRENT_TIMESTAMP');
      params.push(roleId);

      await this.db.executeRaw(`
        UPDATE roles
        SET ${updates.join(', ')}
        WHERE role_id = ?
      `, params);

      const updated = await this.getRoleById(roleId);
      if (!updated) {
        throw new Error('Erro ao buscar role atualizada');
      }

      return updated;
    } catch (error: any) {
      await logError('Erro ao atualizar role', error, { roleId, data });
      throw error;
    }
  }

  /**
   * Deletar role
   */
  async deleteRole(roleId: number): Promise<void> {
    try {
      const existing = await this.getRoleById(roleId);
      if (!existing) {
        throw new Error('Role não encontrada');
      }

      // Verificar se há usuários com esta role
      const usersWithRole = await this.db.findFirst(`
        SELECT COUNT(*) as count
        FROM user_roles
        WHERE role_id = ?
      `, [roleId]);

      if (parseInt(usersWithRole?.count || '0') > 0) {
        throw new Error('Não é possível deletar role que está atribuída a usuários');
      }

      await this.db.executeRaw(`
        DELETE FROM roles
        WHERE role_id = ?
      `, [roleId]);
    } catch (error: any) {
      await logError('Erro ao deletar role', error, { roleId });
      throw error;
    }
  }

  /**
   * Obter permissões de uma role
   */
  async getRolePermissions(roleId: number): Promise<any[]> {
    try {
      const permissions = await this.db.findMany(`
        SELECT 
          p.permission_id,
          p.name,
          p.resource,
          p.action,
          p.description,
          rp.created_at as assigned_at
        FROM role_permissions rp
        JOIN permissions p ON rp.permission_id = p.permission_id
        WHERE rp.role_id = ?
        ORDER BY p.resource, p.action
      `, [roleId]);

      return permissions;
    } catch (error: any) {
      await logError('Erro ao buscar permissões da role', error, { roleId });
      throw error;
    }
  }

  /**
   * Atribuir permissão a role
   */
  async assignPermissionToRole(roleId: number, permissionId: number): Promise<void> {
    try {
      // Verificar se já existe
      const existing = await this.db.findFirst(`
        SELECT id
        FROM role_permissions
        WHERE role_id = ? AND permission_id = ?
      `, [roleId, permissionId]);

      if (existing) {
        return; // Já existe, não precisa fazer nada
      }

      await this.db.executeRaw(`
        INSERT INTO role_permissions (role_id, permission_id)
        VALUES ($1, $2)
      `, [roleId, permissionId]);
    } catch (error: any) {
      await logError('Erro ao atribuir permissão à role', error, { roleId, permissionId });
      throw error;
    }
  }

  /**
   * Remover permissão de role
   */
  async removePermissionFromRole(roleId: number, permissionId: number): Promise<void> {
    try {
      await this.db.executeRaw(`
        DELETE FROM role_permissions
        WHERE role_id = ? AND permission_id = ?
      `, [roleId, permissionId]);
    } catch (error: any) {
      await logError('Erro ao remover permissão da role', error, { roleId, permissionId });
      throw error;
    }
  }

  /**
   * Atribuir múltiplas permissões a role (substitui as existentes)
   */
  async setRolePermissions(roleId: number, permissionIds: number[]): Promise<void> {
    try {
      // Remover todas as permissões existentes
      await this.db.executeRaw(`
        DELETE FROM role_permissions
        WHERE role_id = ?
      `, [roleId]);

      // Adicionar novas permissões
      if (permissionIds.length > 0) {
        const values = permissionIds.map(() => '(?, ?)').join(', ');
        const params = permissionIds.flatMap(id => [roleId, id]);
        
        await this.db.executeRaw(`
          INSERT INTO role_permissions (role_id, permission_id)
          VALUES ${values}
        `, params);
      }
    } catch (error: any) {
      await logError('Erro ao definir permissões da role', error, { roleId, permissionIds });
      throw error;
    }
  }
}

// Singleton instance
let roleServiceInstance: RoleService | null = null;

export function getRoleService(): RoleService {
  if (!roleServiceInstance) {
    roleServiceInstance = new RoleService();
  }
  return roleServiceInstance;
}

