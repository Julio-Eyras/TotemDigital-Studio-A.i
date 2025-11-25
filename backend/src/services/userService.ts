import { getDatabase } from '../config/database';
import { logError } from '../utils/loggerHelper';

export interface User {
  user_id: number;
  username: string;
  email?: string;
  name: string;
  role: 'admin' | 'user' | 'client';
  client_id?: number;
  is_active: boolean;
  last_login?: string;
  created_at: string;
  updated_at?: string;
}

export interface CreateUserRequest {
  username: string;
  email?: string;
  password: string;
  name: string;
  role: 'admin' | 'user' | 'client';
  clientId?: number;
}

export interface UpdateUserRequest {
  username?: string;
  email?: string;
  password?: string;
  name?: string;
  role?: 'admin' | 'user' | 'client';
  clientId?: number;
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
   * Listar usuários com paginação e filtros
   */
  async getAllUsers(params: {
    page?: number;
    limit?: number;
    search?: string;
    role?: string;
    clientId?: number;
  }): Promise<UserListResponse> {
    try {
      const { page = 1, limit = 10, search, role, clientId } = params;
      const offset = (page - 1) * limit;

      let whereClause = 'WHERE u.is_active = true';
      const queryParams: any[] = [];

      if (search) {
        whereClause += ' AND (u.username ILIKE $' + (queryParams.length + 1) + ' OR u.name ILIKE $' + (queryParams.length + 1) + ' OR u.email ILIKE $' + (queryParams.length + 1) + ')';
        queryParams.push(`%${search}%`);
      }

      if (role) {
        whereClause += ' AND u.role = $' + (queryParams.length + 1);
        queryParams.push(role);
      }

      if (clientId) {
        whereClause += ' AND u.client_id = $' + (queryParams.length + 1);
        queryParams.push(clientId);
      }

      // Buscar usuários
      const users = await this.db.findMany(`
        SELECT 
          u.id as user_id,
          u.username,
          u.email,
          u.name,
          u.role,
          u.client_id,
          u.is_active,
          u.last_login,
          u.created_at,
          u.updated_at,
          c.name as client_name
        FROM users u
        LEFT JOIN clients c ON u.client_id = c.client_id
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
          u.client_id,
          u.is_active,
          u.last_login,
          u.created_at,
          u.updated_at,
          c.name as client_name
        FROM users u
        LEFT JOIN clients c ON u.client_id = c.client_id
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
      const { username, email, password, name, role, clientId } = data;

      // Verificar se username já existe
      const existingUser = await this.db.findFirst(`
        SELECT id FROM users WHERE username = $1
      `, [username]);

      if (existingUser) {
        throw new Error('Nome de usuário já existe');
      }

      // Hash da senha
      const bcrypt = require('bcryptjs');
      const hashedPassword = await bcrypt.hash(password, 12);

      // Criar usuário
      const result = await this.db.executeRaw(`
        INSERT INTO users (username, email, password_hash, name, role, client_id, is_active, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING id as user_id
      `, [username, email, hashedPassword, name, role, clientId]);

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
      const { username, email, password, name, role, clientId, isActive } = data;

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
        updateFields.push(`username = $${paramIndex}`);
        updateParams.push(username);
        paramIndex++;
      }

      if (email !== undefined) {
        updateFields.push(`email = $${paramIndex}`);
        updateParams.push(email);
        paramIndex++;
      }

      if (password) {
        const bcrypt = require('bcryptjs');
        const hashedPassword = await bcrypt.hash(password, 12);
        updateFields.push(`password_hash = $${paramIndex}`);
        updateParams.push(hashedPassword);
        paramIndex++;
      }

      if (name) {
        updateFields.push(`name = $${paramIndex}`);
        updateParams.push(name);
        paramIndex++;
      }

      if (role) {
        updateFields.push(`role = $${paramIndex}`);
        updateParams.push(role);
        paramIndex++;
      }

      if (clientId !== undefined) {
        updateFields.push(`client_id = $${paramIndex}`);
        updateParams.push(clientId);
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
