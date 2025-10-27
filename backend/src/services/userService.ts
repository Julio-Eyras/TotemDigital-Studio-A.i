/**
 * User Service - Smart Signage v2.0
 * Serviço de gerenciamento de usuários
 */

import bcrypt from 'bcryptjs';
import { getDatabase } from '../config/database';
import { AuditService } from './auditService';

export interface CreateUserRequest {
  username: string;
  password: string;
  email?: string;
  role: string;
  clientId?: number;
  isActive?: boolean;
}

export interface UpdateUserRequest {
  username?: string;
  email?: string;
  role?: string;
  clientId?: number;
  isActive?: boolean;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface UserResponse {
  id: number;
  username: string;
  email?: string;
  role: string;
  clientId?: number;
  isActive: boolean;
  lastLogin?: string;
  createdAt: string;
  updatedAt: string;
  clientName?: string;
  permissions?: string[];
}

export class UserService {
  private db = getDatabase();
  
  // Lazy initialization - só criar quando necessário
  private getAuditService(): AuditService {
    if (!(global as any).auditServiceInstance) {
      (global as any).auditServiceInstance = new AuditService();
    }
    return (global as any).auditServiceInstance;
  }

  /**
   * Lista todos os usuários (alias para getUsers)
   */
  async getAllUsers(filters?: {
    role?: string;
    clientId?: number;
    isActive?: boolean;
    search?: string;
  }): Promise<UserResponse[]> {
    const result = await this.getUsers(1, 1000, filters || {});
    return result.users;
  }

  /**
   * Lista usuários com paginação e filtros
   */
  async getUsers(
    page: number = 1,
    limit: number = 20,
    filters: {
      role?: string;
      clientId?: number;
      isActive?: boolean;
      search?: string;
    } = {}
  ): Promise<{ users: UserResponse[]; total: number; page: number; limit: number }> {
    try {
      const offset = (page - 1) * limit;
      let whereClause = 'WHERE 1=1';
      const params: any[] = [];

      // Aplicar filtros
      if (filters.role) {
        whereClause += ' AND u.role = ?';
        params.push(filters.role);
      }

      if (filters.clientId) {
        whereClause += ' AND u.client_id = ?';
        params.push(filters.clientId);
      }

      if (filters.isActive !== undefined) {
        whereClause += ' AND u.is_active = ?';
        params.push(filters.isActive ? 1 : 0);
      }

      if (filters.search) {
        whereClause += ' AND (u.username LIKE ? OR u.email LIKE ?)';
        params.push(`%${filters.search}%`, `%${filters.search}%`);
      }

      // Buscar usuários
      const users = await this.db.findMany(`
        SELECT 
          u.user_id as id,
          u.username,
          u.email,
          u.role,
          u.client_id as clientId,
          u.is_active as isActive,
          u.last_login as lastLogin,
          u.created_at as createdAt,
          u.updated_at as updatedAt,
          c.name as clientName
        FROM users u
        LEFT JOIN clients c ON u.client_id = c.client_id
        ${whereClause}
        ORDER BY u.created_at DESC
        LIMIT ? OFFSET ?
      `, [...params, limit, offset]);

      // Contar total
      const totalResult = await this.db.findFirst(`
        SELECT COUNT(*) as total
        FROM users u
        ${whereClause}
      `, params);

      const total = totalResult?.total || 0;

      // Buscar permissões para cada usuário
      const usersWithPermissions = await Promise.all(
        users.map(async (user) => {
          const permissions = await this.getUserPermissions(user.id);
          return { ...user, permissions };
        })
      );

      return {
        users: usersWithPermissions,
        total,
        page,
        limit
      };

    } catch (error: any) {
      console.error('❌ Erro ao buscar usuários:', error.message);
      throw new Error('Erro interno do servidor');
    }
  }

  /**
   * Busca usuário por ID
   */
  async getUserById(userId: number): Promise<UserResponse | null> {
    try {
      const user = await this.db.findFirst(`
        SELECT 
          u.user_id as id,
          u.username,
          u.email,
          u.role,
          u.client_id as clientId,
          u.is_active as isActive,
          u.last_login as lastLogin,
          u.created_at as createdAt,
          u.updated_at as updatedAt,
          c.name as clientName
        FROM users u
        LEFT JOIN clients c ON u.client_id = c.client_id
        WHERE u.user_id = ?
      `, [userId]);

      if (!user) {
        return null;
      }

      const permissions = await this.getUserPermissions(userId);
      return { ...user, permissions };

    } catch (error: any) {
      console.error('❌ Erro ao buscar usuário:', error.message);
      throw new Error('Erro interno do servidor');
    }
  }

  /**
   * Busca usuário por username
   */
  async getUserByUsername(username: string): Promise<UserResponse | null> {
    try {
      const user = await this.db.findFirst(`
        SELECT 
          u.user_id as id,
          u.username,
          u.email,
          u.role,
          u.client_id as clientId,
          u.is_active as isActive,
          u.last_login as lastLogin,
          u.created_at as createdAt,
          u.updated_at as updatedAt,
          c.name as clientName
        FROM users u
        LEFT JOIN clients c ON u.client_id = c.client_id
        WHERE u.username = ?
      `, [username]);

      if (!user) {
        return null;
      }

      const permissions = await this.getUserPermissions(user.id);
      return { ...user, permissions };

    } catch (error: any) {
      console.error('❌ Erro ao buscar usuário por username:', error.message);
      throw new Error('Erro interno do servidor');
    }
  }

  /**
   * Cria novo usuário
   */
  async createUser(data: CreateUserRequest, createdBy: number): Promise<UserResponse> {
    try {
      const { username, password, email, role, clientId, isActive = true } = data;

      // Verificar se username já existe
      const existingUser = await this.db.findFirst(`
        SELECT user_id FROM users WHERE username = ?
      `, [username]);

      if (existingUser) {
        throw new Error('Nome de usuário já existe');
      }

      // Hash da senha
      const saltRounds = 12;
      const passwordHash = await bcrypt.hash(password, saltRounds);

      // Criar usuário
      const result = await this.db.executeRaw(`
        INSERT INTO users (username, password_hash, email, role, client_id, is_active)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [username, passwordHash, email, role, clientId, isActive ? 1 : 0]);

      if (!result.lastInsertRowid) {
        throw new Error('Erro ao criar usuário');
      }

      // Buscar usuário criado
      const newUser = await this.getUserById(result.lastInsertRowid);
      if (!newUser) {
        throw new Error('Erro ao buscar usuário criado');
      }

      // Log de auditoria
      await this.getAuditService().log('user', 'created', createdBy, {
        userId: newUser.id,
        username: newUser.username,
        role: newUser.role
      });

      return newUser;

    } catch (error: any) {
      console.error('❌ Erro ao criar usuário:', error.message);
      throw error;
    }
  }

  /**
   * Atualiza usuário
   */
  async updateUser(userId: number, data: UpdateUserRequest, updatedBy: number): Promise<UserResponse> {
    try {
      // Verificar se usuário existe
      const existingUser = await this.getUserById(userId);
      if (!existingUser) {
        throw new Error('Usuário não encontrado');
      }

      // Verificar se username já existe (se estiver sendo alterado)
      if (data.username && data.username !== existingUser.username) {
        const usernameExists = await this.db.findFirst(`
          SELECT user_id FROM users WHERE username = ? AND user_id != ?
        `, [data.username, userId]);

        if (usernameExists) {
          throw new Error('Nome de usuário já existe');
        }
      }

      // Construir query de atualização
      const updates: string[] = [];
      const params: any[] = [];

      if (data.username !== undefined) {
        updates.push('username = ?');
        params.push(data.username);
      }

      if (data.email !== undefined) {
        updates.push('email = ?');
        params.push(data.email);
      }

      if (data.role !== undefined) {
        updates.push('role = ?');
        params.push(data.role);
      }

      if (data.clientId !== undefined) {
        updates.push('client_id = ?');
        params.push(data.clientId);
      }

      if (data.isActive !== undefined) {
        updates.push('is_active = ?');
        params.push(data.isActive ? 1 : 0);
      }

      if (updates.length === 0) {
        return existingUser;
      }

      updates.push('updated_at = CURRENT_TIMESTAMP');
      params.push(userId);

      // Atualizar usuário
      await this.db.executeRaw(`
        UPDATE users 
        SET ${updates.join(', ')}
        WHERE user_id = ?
      `, params);

      // Buscar usuário atualizado
      const updatedUser = await this.getUserById(userId);
      if (!updatedUser) {
        throw new Error('Erro ao buscar usuário atualizado');
      }

      // Log de auditoria
      await this.getAuditService().log('user', 'updated', updatedBy, {
        userId,
        changes: data
      });

      return updatedUser;

    } catch (error: any) {
      console.error('❌ Erro ao atualizar usuário:', error.message);
      throw error;
    }
  }

  /**
   * Altera senha do usuário
   */
  async changePassword(userId: number, data: ChangePasswordRequest, changedBy: number): Promise<void> {
    try {
      // Buscar usuário
      const user = await this.db.findFirst(`
        SELECT password_hash FROM users WHERE user_id = ? AND is_active = 1
      `, [userId]);

      if (!user) {
        throw new Error('Usuário não encontrado');
      }

      // Verificar senha atual
      const isValidPassword = await bcrypt.compare(data.currentPassword, user.password_hash);
      if (!isValidPassword) {
        throw new Error('Senha atual incorreta');
      }

      // Hash da nova senha
      const saltRounds = 12;
      const newPasswordHash = await bcrypt.hash(data.newPassword, saltRounds);

      // Atualizar senha
      await this.db.executeRaw(`
        UPDATE users 
        SET password_hash = ?, updated_at = CURRENT_TIMESTAMP 
        WHERE user_id = ?
      `, [newPasswordHash, userId]);

      // Log de auditoria
      await this.getAuditService().log('user', 'password_changed', changedBy, {
        userId
      });

    } catch (error: any) {
      console.error('❌ Erro ao alterar senha:', error.message);
      throw error;
    }
  }

  /**
   * Desativa usuário
   */
  async deactivateUser(userId: number, deactivatedBy: number): Promise<void> {
    try {
      // Verificar se usuário existe
      const user = await this.getUserById(userId);
      if (!user) {
        throw new Error('Usuário não encontrado');
      }

      if (!user.isActive) {
        throw new Error('Usuário já está inativo');
      }

      // Desativar usuário
      await this.db.executeRaw(`
        UPDATE users 
        SET is_active = 0, updated_at = CURRENT_TIMESTAMP 
        WHERE user_id = ?
      `, [userId]);

      // Log de auditoria
      await this.getAuditService().log('user', 'deactivated', deactivatedBy, {
        userId,
        username: user.username
      });

    } catch (error: any) {
      console.error('❌ Erro ao desativar usuário:', error.message);
      throw error;
    }
  }

  /**
   * Ativa usuário
   */
  async activateUser(userId: number, activatedBy: number): Promise<void> {
    try {
      // Verificar se usuário existe
      const user = await this.getUserById(userId);
      if (!user) {
        throw new Error('Usuário não encontrado');
      }

      if (user.isActive) {
        throw new Error('Usuário já está ativo');
      }

      // Ativar usuário
      await this.db.executeRaw(`
        UPDATE users 
        SET is_active = 1, updated_at = CURRENT_TIMESTAMP 
        WHERE user_id = ?
      `, [userId]);

      // Log de auditoria
      await this.getAuditService().log('user', 'activated', activatedBy, {
        userId,
        username: user.username
      });

    } catch (error: any) {
      console.error('❌ Erro ao ativar usuário:', error.message);
      throw error;
    }
  }

  /**
   * Remove usuário (soft delete)
   */
  async deleteUser(userId: number, deletedBy: number): Promise<void> {
    try {
      // Verificar se usuário existe
      const user = await this.getUserById(userId);
      if (!user) {
        throw new Error('Usuário não encontrado');
      }

      // Verificar se é o último admin
      if (user.role === 'admin') {
        const adminCount = await this.db.findFirst(`
          SELECT COUNT(*) as count 
          FROM users 
          WHERE role = 'admin' AND is_active = 1
        `);

        if (adminCount.count <= 1) {
          throw new Error('Não é possível remover o último administrador');
        }
      }

      // Desativar usuário (soft delete)
      await this.db.executeRaw(`
        UPDATE users 
        SET is_active = 0, updated_at = CURRENT_TIMESTAMP 
        WHERE user_id = ?
      `, [userId]);

      // Log de auditoria
      await this.getAuditService().log('user', 'deleted', deletedBy, {
        userId,
        username: user.username
      });

    } catch (error: any) {
      console.error('❌ Erro ao remover usuário:', error.message);
      throw error;
    }
  }

  /**
   * Busca permissões do usuário
   */
  async getUserPermissions(userId: number): Promise<string[]> {
    try {
      const permissions = await this.db.findMany(`
        SELECT p.name
        FROM user_roles ur
        JOIN role_permissions rp ON ur.role_id = rp.role_id
        JOIN permissions p ON rp.permission_id = p.permission_id
        WHERE ur.user_id = ?
      `, [userId]);

      return permissions.map(p => p.name);

    } catch (error: any) {
      console.error('❌ Erro ao buscar permissões:', error.message);
      return [];
    }
  }

  /**
   * Atribui role ao usuário
   */
  async assignRole(userId: number, roleId: number, assignedBy: number): Promise<void> {
    try {
      // Verificar se usuário existe
      const user = await this.getUserById(userId);
      if (!user) {
        throw new Error('Usuário não encontrado');
      }

      // Verificar se role existe
      const role = await this.db.findFirst(`
        SELECT role_id FROM roles WHERE role_id = ? AND is_active = 1
      `, [roleId]);

      if (!role) {
        throw new Error('Role não encontrada');
      }

      // Verificar se já tem a role
      const existingRole = await this.db.findFirst(`
        SELECT id FROM user_roles WHERE user_id = ? AND role_id = ?
      `, [userId, roleId]);

      if (existingRole) {
        throw new Error('Usuário já possui esta role');
      }

      // Atribuir role
      await this.db.executeRaw(`
        INSERT INTO user_roles (user_id, role_id, granted_by)
        VALUES (?, ?, ?)
      `, [userId, roleId, assignedBy]);

      // Log de auditoria
      await this.getAuditService().log('user', 'role_assigned', assignedBy, {
        userId,
        roleId
      });

    } catch (error: any) {
      console.error('❌ Erro ao atribuir role:', error.message);
      throw error;
    }
  }

  /**
   * Remove role do usuário
   */
  async removeRole(userId: number, roleId: number, removedBy: number): Promise<void> {
    try {
      // Verificar se usuário existe
      const user = await this.getUserById(userId);
      if (!user) {
        throw new Error('Usuário não encontrado');
      }

      // Verificar se tem a role
      const existingRole = await this.db.findFirst(`
        SELECT id FROM user_roles WHERE user_id = ? AND role_id = ?
      `, [userId, roleId]);

      if (!existingRole) {
        throw new Error('Usuário não possui esta role');
      }

      // Remover role
      await this.db.executeRaw(`
        DELETE FROM user_roles WHERE user_id = ? AND role_id = ?
      `, [userId, roleId]);

      // Log de auditoria
      await this.getAuditService().log('user', 'role_removed', removedBy, {
        userId,
        roleId
      });

    } catch (error: any) {
      console.error('❌ Erro ao remover role:', error.message);
      throw error;
    }
  }

  /**
   * Busca estatísticas de usuários
   */
  async getUserStats(): Promise<{
    total: number;
    active: number;
    inactive: number;
    byRole: { role: string; count: number }[];
    recentLogins: number;
  }> {
    try {
      // Total de usuários
      const totalResult = await this.db.findFirst(`
        SELECT COUNT(*) as total FROM users
      `);

      // Usuários ativos
      const activeResult = await this.db.findFirst(`
        SELECT COUNT(*) as active FROM users WHERE is_active = 1
      `);

      // Usuários inativos
      const inactiveResult = await this.db.findFirst(`
        SELECT COUNT(*) as inactive FROM users WHERE is_active = 0
      `);

      // Por role
      const byRole = await this.db.findMany(`
        SELECT role, COUNT(*) as count
        FROM users
        WHERE is_active = 1
        GROUP BY role
        ORDER BY count DESC
      `);

      // Logins recentes (últimos 7 dias)
      const recentLoginsResult = await this.db.findFirst(`
        SELECT COUNT(*) as recent
        FROM users
        WHERE last_login >= datetime('now', '-7 days')
      `);

      return {
        total: totalResult?.total || 0,
        active: activeResult?.active || 0,
        inactive: inactiveResult?.inactive || 0,
        byRole: byRole.map(r => ({ role: r.role, count: r.count })),
        recentLogins: recentLoginsResult?.recent || 0
      };

    } catch (error: any) {
      console.error('❌ Erro ao buscar estatísticas:', error.message);
      throw new Error('Erro interno do servidor');
    }
  }
}
