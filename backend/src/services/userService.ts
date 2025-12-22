import { getDatabase } from '../config/database';
import { logError } from '../utils/loggerHelper';
import { Role } from '../types/roles';

export interface User {
  user_id: number;
  username: string;
  email?: string;
  name: string;
  role: 'admin' | 'user' | 'client' | 'subscriber' | 'publisher'; // Mantido para compatibilidade
  publisher_id?: number; // NOVO: FK para publishers (NULL se for tenant user)
  client_id?: number; // DEPRECADO: Mantido para compatibilidade - usar publisher_id
  user_type?: 'system_user' | 'subscriber_user' | 'publisher_user'; // NOVO
  is_tenant_user?: boolean; // NOVO: True se for admin/operador do sistema
  is_active: boolean;
  last_login?: string;
  created_at: string;
  updated_at?: string;
  publisher_name?: string; // Nome do publisher (do JOIN)
}

export interface CreateUserRequest {
  username: string;
  email?: string;
  password: string;
  name: string;
  role: 'admin' | 'user' | 'client' | 'subscriber' | 'publisher';
  publisherId?: number; // NOVO: FK para publishers
  clientId?: number; // DEPRECADO: Mantido para compatibilidade
  userType?: 'system_user' | 'subscriber_user' | 'publisher_user'; // NOVO
  isTenantUser?: boolean; // NOVO
}

export interface UpdateUserRequest {
  username?: string;
  email?: string;
  password?: string;
  name?: string;
  role?: 'admin' | 'user' | 'client' | 'subscriber' | 'publisher';
  publisherId?: number; // NOVO
  clientId?: number; // DEPRECADO
  userType?: 'system_user' | 'subscriber_user' | 'publisher_user'; // NOVO
  isTenantUser?: boolean; // NOVO
  isActive?: boolean;
}

export interface UserListResponse {
  data: User[];
  total: number;
  page: number;
  limit: number;
}

export class UserService {
  private get db() {
    return getDatabase();
  }

  /**
   * Obter roles de um usuário
   */
  async getUserRoles(userId: number): Promise<Role[]> {
    try {
      const roles = await this.db.findMany(`
        SELECT 
          r.role_id,
          r.name,
          r.description,
          r.is_active,
          ur.created_at as assigned_at,
          ur.granted_by
        FROM user_roles ur
        JOIN roles r ON ur.role_id = r.role_id
        WHERE ur.user_id = ?
        ORDER BY r.name
      `, [userId]);

      return roles;
    } catch (error: any) {
      await logError('Erro ao buscar roles do usuário', error, { userId });
      throw error;
    }
  }

  /**
   * Atribuir role a usuário
   */
  async assignRoleToUser(userId: number, roleId: number, grantedBy: number): Promise<void> {
    try {
      // Verificar se já existe
      const existing = await this.db.findFirst(`
        SELECT id
        FROM user_roles
        WHERE user_id = ? AND role_id = ?
      `, [userId, roleId]);

      if (existing) {
        return; // Já existe, não precisa fazer nada
      }

      await this.db.executeRaw(`
        INSERT INTO user_roles (user_id, role_id, granted_by)
        VALUES (?, ?, ?)
      `, [userId, roleId, grantedBy]);
    } catch (error: any) {
      await logError('Erro ao atribuir role ao usuário', error, { userId, roleId });
      throw error;
    }
  }

  /**
   * Remover role de usuário
   */
  async removeRoleFromUser(userId: number, roleId: number): Promise<void> {
    try {
      await this.db.executeRaw(`
        DELETE FROM user_roles
        WHERE user_id = ? AND role_id = ?
      `, [userId, roleId]);
    } catch (error: any) {
      await logError('Erro ao remover role do usuário', error, { userId, roleId });
      throw error;
    }
  }

  /**
   * Definir roles de usuário (substitui todas as existentes)
   */
  async setUserRoles(userId: number, roleIds: number[], grantedBy: number): Promise<void> {
    try {
      // Remover todas as roles existentes
      await this.db.executeRaw(`
        DELETE FROM user_roles
        WHERE user_id = ?
      `, [userId]);

      // Adicionar novas roles
      if (roleIds.length > 0) {
        const values = roleIds.map(() => '(?, ?, ?)').join(', ');
        const params = roleIds.flatMap(id => [userId, id, grantedBy]);
        
        await this.db.executeRaw(`
          INSERT INTO user_roles (user_id, role_id, granted_by)
          VALUES ${values}
        `, params);
      }
    } catch (error: any) {
      await logError('Erro ao definir roles do usuário', error, { userId, roleIds });
      throw error;
    }
  }

  /**
   * Listar usuários com paginação e filtros
   */
  async getAllUsers(params: {
    page?: number;
    limit?: number;
    search?: string;
    role?: string;
    publisherId?: number; // NOVO
    clientId?: number; // DEPRECADO: Mantido para compatibilidade
    userType?: 'system_user' | 'subscriber_user' | 'publisher_user';
    isTenantUser?: boolean;
  }): Promise<UserListResponse> {
    try {
      const { page = 1, limit = 10, search, role, publisherId, clientId, userType, isTenantUser } = params;
      const offset = (page - 1) * limit;

      let whereClause = 'WHERE u.is_active = true';
      const queryParams: any[] = [];

      if (search) {
        whereClause += ' AND (u.username ILIKE $' + (queryParams.length + 1) + ' OR u.name ILIKE $' + (queryParams.length + 1) + ' OR u.email ILIKE $' + (queryParams.length + 1) + ')';
        const searchParam = `%${search}%`;
        queryParams.push(searchParam);
        queryParams.push(searchParam);
        queryParams.push(searchParam);
      }

      if (role) {
        whereClause += ' AND u.role = $' + (queryParams.length + 1);
        queryParams.push(role);
      }

      // NOVO: Filtrar por publisher_id
      if (publisherId !== undefined) {
        whereClause += ' AND u.publisher_id = $' + (queryParams.length + 1);
        queryParams.push(publisherId);
      }

      // DEPRECADO: Filtrar por client_id (compatibilidade)
      if (clientId !== undefined) {
        whereClause += ' AND u.publisher_id = $' + (queryParams.length + 1);
        queryParams.push(clientId);
      }

      if (userType) {
        whereClause += ' AND u.user_type = $' + (queryParams.length + 1);
        queryParams.push(userType);
      }

      if (isTenantUser !== undefined) {
        whereClause += ' AND u.is_tenant_user = $' + (queryParams.length + 1);
        queryParams.push(isTenantUser);
      }

      // Buscar usuários - usar publishers em vez de clients
      const users = await this.db.findMany(`
        SELECT 
          u.id as user_id,
          u.username,
          u.email,
          u.name,
          u.role,
          u.publisher_id,
          u.client_id, -- Mantido para compatibilidade
          u.user_type,
          u.is_tenant_user,
          u.is_active,
          u.last_login,
          u.created_at,
          u.updated_at,
          p.name as publisher_name
        FROM users u
        LEFT JOIN publishers p ON u.publisher_id = p.publisher_id
        ${whereClause}
        ORDER BY u.created_at DESC
        LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}
      `, [...queryParams, limit, offset]);

      // Contar total
      const totalResult = await this.db.findFirst(`
        SELECT COUNT(*) as total
        FROM users u
        ${whereClause}
      `, queryParams);

      return {
        data: users,
        total: parseInt(totalResult?.total || '0'),
        page,
        limit,
      };
    } catch (error: any) {
      await logError('Erro ao listar usuários', error, { params });
      throw new Error('Erro interno do servidor');
    }
  }

  /**
   * Obter usuário por ID
   */
  async getUserById(id: number): Promise<User | null> {
    try {
      const user = await this.db.findFirst(`
        SELECT 
          u.id as user_id,
          u.username,
          u.email,
          u.name,
          u.role,
          u.publisher_id,
          u.client_id, -- Mantido para compatibilidade
          u.user_type,
          u.is_tenant_user,
          u.is_active,
          u.last_login,
          u.created_at,
          u.updated_at,
          p.name as publisher_name
        FROM users u
        LEFT JOIN publishers p ON u.publisher_id = p.publisher_id
        WHERE u.id = $1
      `, [id]);

      return user;
    } catch (error: any) {
      await logError('Erro ao obter usuário', error, { id });
      throw new Error('Erro interno do servidor');
    }
  }

  /**
   * Criar novo usuário
   */
  async createUser(data: CreateUserRequest): Promise<User> {
    try {
      const { username, email, password, name, role, publisherId, clientId, userType, isTenantUser } = data;

      // Verificar se username já existe
      const existingUser = await this.db.findFirst(`
        SELECT id FROM users WHERE username = $1
      `, [username]);

      if (existingUser) {
        throw new Error('Nome de usuário já existe');
      }

      // Determinar publisher_id e user_type
      let finalPublisherId: number | null = null;
      let finalUserType: string = 'publisher_user';
      let finalIsTenantUser: boolean = false;

      // Se isTenantUser = true, publisher_id deve ser NULL
      if (isTenantUser === true) {
        finalIsTenantUser = true;
        finalPublisherId = null;
        finalUserType = 'system_user';
      } else {
        // Usar publisherId se fornecido, senão usar clientId (compatibilidade)
        finalPublisherId = publisherId || clientId || null;
        finalUserType = userType || (finalPublisherId ? 'publisher_user' : 'system_user');
        finalIsTenantUser = false;
      }

      // Validar publisher existe se fornecido
      if (finalPublisherId) {
        const publisher = await this.db.findFirst(`
          SELECT publisher_id FROM publishers 
          WHERE publisher_id = $1 AND COALESCE(active, true) = true
        `, [finalPublisherId]);

        if (!publisher) {
          throw new Error('Publisher não encontrado ou inativo');
        }
      }

      // Hash da senha
      const bcrypt = require('bcryptjs');
      const hashedPassword = await bcrypt.hash(password, 12);

      // Criar usuário
      const result = await this.db.executeRaw(`
        INSERT INTO users (
          username, email, password_hash, name, role, 
          publisher_id, user_type, is_tenant_user,
          is_active, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING id as user_id
      `, [username, email, hashedPassword, name, role, finalPublisherId, finalUserType, finalIsTenantUser]);

      if (!result.rows || result.rows.length === 0) {
        throw new Error('Erro ao criar usuário');
      }

      const userId = result.rows[0].user_id;
      const newUser = await this.getUserById(userId);

      if (!newUser) {
        throw new Error('Erro ao buscar usuário criado');
      }

      return newUser;
    } catch (error: any) {
      await logError('Erro ao criar usuário', error, { data });
      throw error;
    }
  }

  /**
   * Atualizar usuário
   */
  async updateUser(id: number, data: UpdateUserRequest): Promise<User> {
    try {
      const { username, email, password, name, role, publisherId, clientId, userType, isTenantUser, isActive } = data;

      // Verificar se usuário existe
      const existingUser = await this.getUserById(id);
      if (!existingUser) {
        throw new Error('Usuário não encontrado');
      }

      // Verificar se username já existe (se mudou)
      if (username && username !== existingUser.username) {
        const userWithSameUsername = await this.db.findFirst(`
          SELECT id FROM users WHERE username = $1 AND id != $2
        `, [username, id]);

        if (userWithSameUsername) {
          throw new Error('Nome de usuário já existe');
        }
      }

      // Preparar campos para atualização
      const updateFields: string[] = [];
      const updateParams: any[] = [];
      let paramIndex = 1;

      if (username) {
        updateFields.push(`username = $${paramIndex++}`);
        updateParams.push(username);
      }

      if (email !== undefined) {
        updateFields.push(`email = $${paramIndex++}`);
        updateParams.push(email);
      }

      if (password) {
        const bcrypt = require('bcryptjs');
        const hashedPassword = await bcrypt.hash(password, 12);
        updateFields.push(`password_hash = $${paramIndex++}`);
        updateParams.push(hashedPassword);
      }

      if (name) {
        updateFields.push(`name = $${paramIndex++}`);
        updateParams.push(name);
      }

      if (role) {
        updateFields.push(`role = $${paramIndex++}`);
        updateParams.push(role);
      }

      // NOVO: Atualizar publisher_id
      if (publisherId !== undefined) {
        // Validar publisher existe
        if (publisherId !== null) {
          const publisher = await this.db.findFirst(`
            SELECT publisher_id FROM publishers 
            WHERE publisher_id = $1 AND COALESCE(active, true) = true
          `, [publisherId]);

          if (!publisher) {
            throw new Error('Publisher não encontrado ou inativo');
          }
        }
        updateFields.push(`publisher_id = $${paramIndex++}`);
        updateParams.push(publisherId);
      }

      // DEPRECADO: clientId (compatibilidade - mapear para publisher_id)
      if (clientId !== undefined && publisherId === undefined) {
        updateFields.push(`publisher_id = $${paramIndex++}`);
        updateParams.push(clientId);
      }

      if (userType) {
        updateFields.push(`user_type = $${paramIndex++}`);
        updateParams.push(userType);
      }

      if (isTenantUser !== undefined) {
        updateFields.push(`is_tenant_user = $${paramIndex++}`);
        updateParams.push(isTenantUser);
        
        // Se isTenantUser = true, publisher_id deve ser NULL
        if (isTenantUser === true && publisherId === undefined) {
          updateFields.push(`publisher_id = NULL`);
        }
      }

      if (isActive !== undefined) {
        updateFields.push(`is_active = $${paramIndex++}`);
        updateParams.push(isActive);
      }

      updateFields.push(`updated_at = CURRENT_TIMESTAMP`);

      // Executar atualização
      await this.db.executeRaw(`
        UPDATE users 
        SET ${updateFields.join(', ')}
        WHERE id = $${paramIndex}
      `, [...updateParams, id]);

      const updatedUser = await this.getUserById(id);
      if (!updatedUser) {
        throw new Error('Erro ao buscar usuário atualizado');
      }

      return updatedUser;
    } catch (error: any) {
      await logError('Erro ao atualizar usuário', error, { id, data });
      throw error;
    }
  }

  /**
   * Excluir usuário (soft delete)
   */
  async deleteUser(id: number): Promise<void> {
    try {
      // Verificar se usuário existe
      const existingUser = await this.getUserById(id);
      if (!existingUser) {
        throw new Error('Usuário não encontrado');
      }

      // Soft delete - marcar como inativo
      await this.db.executeRaw(`
        UPDATE users 
        SET is_active = false, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `, [id]);
    } catch (error: any) {
      await logError('Erro ao excluir usuário', error, { id });
      throw error;
    }
  }
}

// Instância global do serviço
let userServiceInstance: UserService;

export function getUserService(): UserService {
  if (!userServiceInstance) {
    userServiceInstance = new UserService();
  }
  return userServiceInstance;
}
