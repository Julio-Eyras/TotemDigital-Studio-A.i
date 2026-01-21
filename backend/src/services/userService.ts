import { getDatabase } from '../config/database';
import { logError } from '../utils/loggerHelper';
import { Role } from '../types/roles';

export interface User {
  user_id: number;
  username: string;
  email?: string;
  name: string;
  role: 'admin' | 'user' | 'client' | 'subscriber' | 'publisher';
  publisher_id?: number;
  subscriber_id?: number;
  user_type?: 'system_user' | 'subscriber_user' | 'publisher_user';
  is_tenant_user?: boolean; // NOVO: True se for admin/operador do sistema
  is_active: boolean;
  last_login?: string;
  created_at: string;
  updated_at?: string;
  publisher_name?: string; // Nome do publisher (do JOIN)
}

export interface UserFlags {
  flag_smart_0: boolean;
  flag_smart_1: boolean;
  flag_smart_2: boolean;
  flag_smart_3: boolean;
  flag_smart_4: boolean;
  flag_smart_5: boolean;
  flag_smart_6: boolean;
  flag_smart_7: boolean;
  flag_smart_8: boolean;
  flag_smart_9: boolean;
}

export interface CreateUserRequest {
  username: string;
  email?: string;
  password: string;
  name: string;
  role: 'owner_system' | 'admin_sql' | 'admin' | 'operador_tecnico' | 'operador_faturamento' | 'operador_comercial' | 'gerente_marketing' | 'editoracao' | 'visualizador' | 'user' | 'publisher_user' | 'subscriber_user';
  publisherId?: number;
  subscriberId?: number;
  userType?: 'system_user' | 'subscriber_user' | 'publisher_user';
  isTenantUser?: boolean;
  flags?: Partial<UserFlags>;
}

export interface UpdateUserRequest {
  username?: string;
  email?: string;
  password?: string;
  name?: string;
  role?: 'owner_system' | 'admin_sql' | 'admin' | 'operador_tecnico' | 'operador_faturamento' | 'operador_comercial' | 'gerente_marketing' | 'editoracao' | 'visualizador' | 'user' | 'publisher_user' | 'subscriber_user';
  publisherId?: number;
  subscriberId?: number;
  userType?: 'system_user' | 'subscriber_user' | 'publisher_user';
  isTenantUser?: boolean;
  isActive?: boolean;
  flags?: Partial<UserFlags>;
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
        WHERE ur.user_id = $1
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
        WHERE user_id = $1 AND role_id = $2
      `, [userId, roleId]);

      if (existing) {
        return; // Já existe, não precisa fazer nada
      }

      await this.db.executeRaw(`
        INSERT INTO user_roles (user_id, role_id, granted_by)
        VALUES ($1, $2, $3)
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
        WHERE user_id = $1 AND role_id = $2
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
        WHERE user_id = $1
      `, [userId]);

      // Adicionar novas roles
      if (roleIds.length > 0) {
        // Construir placeholders PostgreSQL dinamicamente
        let paramIndex = 1;
        const values = roleIds.map(() => {
          const placeholder = `($${paramIndex++}, $${paramIndex++}, $${paramIndex++})`;
          return placeholder;
        }).join(', ');
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
    publisherId?: number;
    subscriberId?: number;
    userType?: 'system_user' | 'subscriber_user' | 'publisher_user';
    isTenantUser?: boolean;
  }): Promise<UserListResponse> {
    try {
      const { page = 1, limit = 10, search, role, publisherId, subscriberId, userType, isTenantUser } = params;
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

      // Filtrar por subscriber_id (vínculo direto)
      if (subscriberId !== undefined) {
        whereClause += ' AND u.subscriber_id = $' + (queryParams.length + 1);
        queryParams.push(subscriberId);
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
          -- u.client_id removido - não existe mais no schema v2
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
          -- u.client_id removido - não existe mais no schema v2
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
      const { username, email, password, name, role, publisherId, subscriberId, userType, isTenantUser, flags } = data;

      // Verificar se username já existe
      const existingUser = await this.db.findFirst(`
        SELECT id FROM users WHERE username = $1
      `, [username]);

      if (existingUser) {
        throw new Error('Nome de usuário já existe');
      }

      // Mapeamento de roles para recursos
      const ROLE_RESOURCE_MAPPING: Record<string, 'publisher' | 'subscriber' | 'system'> = {
        'owner_system': 'system',
        'admin_sql': 'system',
        'admin': 'system',
        'operador_tecnico': 'system',
        'operador_faturamento': 'system',
        'operador_comercial': 'system',
        'gerente_marketing': 'system',
        'editoracao': 'system',
        'visualizador': 'system',
        'user': 'system',
        'publisher_user': 'publisher',
        'subscriber_user': 'subscriber',
      };

      // Determinar publisher_id, subscriber_id e user_type (NÃO existe "both")
      let finalPublisherId: number | null = null;
      let finalSubscriberId: number | null = null;
      let finalUserType: string = 'system_user';
      let finalIsTenantUser: boolean = false;

      // Se isTenantUser = true, publisher_id e subscriber_id devem ser NULL
      if (isTenantUser === true) {
        finalIsTenantUser = true;
        finalPublisherId = null;
        finalSubscriberId = null;
        finalUserType = 'system_user';
      } else {
        const resourceType = ROLE_RESOURCE_MAPPING[role] || 'system';
        
        // Validar mapeamento de role para recurso
        if (resourceType === 'publisher') {
          if (!publisherId) {
            throw new Error(`Role '${role}' requer publisher_id`);
          }
          finalPublisherId = publisherId;
          finalSubscriberId = null;
          finalUserType = userType || 'publisher_user';
          if (finalUserType !== 'publisher_user') {
            throw new Error(`userType inválido para role '${role}': use 'publisher_user'`);
          }
        } else if (resourceType === 'subscriber') {
          if (!subscriberId) {
            throw new Error(`Role '${role}' requer subscriber_id`);
          }
          finalPublisherId = null;
          finalSubscriberId = subscriberId;
          finalUserType = userType || 'subscriber_user';
          if (finalUserType !== 'subscriber_user') {
            throw new Error(`userType inválido para role '${role}': use 'subscriber_user'`);
          }
        } else {
          // system roles
          finalPublisherId = null;
          finalSubscriberId = null;
          finalUserType = userType || 'system_user';
          if (finalUserType !== 'system_user') {
            throw new Error(`userType inválido para role '${role}': use 'system_user'`);
          }
        }
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

      // Validar subscriber existe se fornecido
      if (finalSubscriberId) {
        const subscriber = await this.db.findFirst(`
          SELECT subscriber_id FROM subscribers 
          WHERE subscriber_id = $1 AND is_active = true
        `, [finalSubscriberId]);

        if (!subscriber) {
          throw new Error('Subscriber não encontrado ou inativo');
        }
      }

      // Hash da senha
      const bcrypt = require('bcryptjs');
      const hashedPassword = await bcrypt.hash(password, 12);

      // Criar usuário
      const result = await this.db.executeRaw(`
        INSERT INTO users (
          username, email, password_hash, name, role, 
          publisher_id, subscriber_id, user_type, is_tenant_user,
          is_active, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING id as user_id
      `, [username, email, hashedPassword, name, role, finalPublisherId, finalSubscriberId, finalUserType, finalIsTenantUser]);

      if (!result.rows || result.rows.length === 0) {
        throw new Error('Erro ao criar usuário');
      }

      const userId = result.rows[0].user_id;

      // Criar flags do usuário se fornecidas
      if (flags && Object.keys(flags).length > 0) {
        await this.updateUserFlags(userId, flags, userId);
      }

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
      const { username, email, password, name, role, publisherId, subscriberId, userType, isTenantUser, isActive, flags } = data;

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

      // Atualizar subscriber_id
      if (subscriberId !== undefined) {
        // Validar subscriber existe
        if (subscriberId !== null) {
          const subscriber = await this.db.findFirst(`
            SELECT subscriber_id FROM subscribers 
            WHERE subscriber_id = $1 AND is_active = true
          `, [subscriberId]);

          if (!subscriber) {
            throw new Error('Subscriber não encontrado ou inativo');
          }
        }
        updateFields.push(`subscriber_id = $${paramIndex++}`);
        updateParams.push(subscriberId);
      }

      if (userType) {
        updateFields.push(`user_type = $${paramIndex++}`);
        updateParams.push(userType);
      }

      if (isTenantUser !== undefined) {
        updateFields.push(`is_tenant_user = $${paramIndex++}`);
        updateParams.push(isTenantUser);

        // Se isTenantUser = true, publisher_id/subscriber_id devem ser NULL e user_type deve ser system_user
        if (isTenantUser === true) {
          updateFields.push(`publisher_id = NULL`);
          updateFields.push(`subscriber_id = NULL`);
          updateFields.push(`user_type = 'system_user'`);
        }
      }

      // (Regra do domínio) Não existe user "both".
      // Se não for tenant, precisa ter exatamente um vínculo (publisher OU subscriber) e user_type coerente.
      // Para evitar estados inválidos, normalizamos sempre que for possível a partir do role/userType/publisherId/subscriberId.
      const nextIsTenant = isTenantUser !== undefined ? isTenantUser : (existingUser as any).is_tenant_user;
      const nextRole = role || (existingUser as any).role;
      const nextPublisherId = publisherId !== undefined ? publisherId : (existingUser as any).publisher_id ?? null;
      const nextSubscriberId = subscriberId !== undefined ? subscriberId : (existingUser as any).subscriber_id ?? null;
      const nextUserType = userType || (existingUser as any).user_type || null;

      if (nextIsTenant === false) {
        // Proibir vínculo duplo
        if (nextPublisherId && nextSubscriberId) {
          throw new Error('Usuário não pode ter publisher_id e subscriber_id ao mesmo tempo');
        }

        // Se role indica publisher/subscriber, exigir o vínculo correspondente
        if (nextRole === 'publisher_user') {
          if (!nextPublisherId) throw new Error(`Role 'publisher_user' requer publisher_id`);
          if (nextUserType && nextUserType !== 'publisher_user') throw new Error(`userType inválido para role 'publisher_user'`);
          updateFields.push(`subscriber_id = NULL`);
          updateFields.push(`user_type = 'publisher_user'`);
        }
        if (nextRole === 'subscriber_user') {
          if (!nextSubscriberId) throw new Error(`Role 'subscriber_user' requer subscriber_id`);
          if (nextUserType && nextUserType !== 'subscriber_user') throw new Error(`userType inválido para role 'subscriber_user'`);
          updateFields.push(`publisher_id = NULL`);
          updateFields.push(`user_type = 'subscriber_user'`);
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

      // Atualizar flags se fornecidas
      if (flags && Object.keys(flags).length > 0) {
        await this.updateUserFlags(id, flags, id);
      }

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

  /**
   * Obter flags de um usuário
   */
  async getUserFlags(userId: number): Promise<UserFlags> {
    try {
      // Buscar flags do usuário (user_flags) ou usar flags padrão da role
      const userFlags = await this.db.findFirst(`
        SELECT 
          COALESCE(uf.flag_smart_0, rfd.flag_smart_0, false) as flag_smart_0,
          COALESCE(uf.flag_smart_1, rfd.flag_smart_1, false) as flag_smart_1,
          COALESCE(uf.flag_smart_2, rfd.flag_smart_2, false) as flag_smart_2,
          COALESCE(uf.flag_smart_3, rfd.flag_smart_3, false) as flag_smart_3,
          COALESCE(uf.flag_smart_4, rfd.flag_smart_4, false) as flag_smart_4,
          COALESCE(uf.flag_smart_5, rfd.flag_smart_5, false) as flag_smart_5,
          COALESCE(uf.flag_smart_6, rfd.flag_smart_6, false) as flag_smart_6,
          COALESCE(uf.flag_smart_7, rfd.flag_smart_7, false) as flag_smart_7,
          COALESCE(uf.flag_smart_8, rfd.flag_smart_8, false) as flag_smart_8,
          COALESCE(uf.flag_smart_9, rfd.flag_smart_9, false) as flag_smart_9
        FROM users u
        LEFT JOIN user_flags uf ON u.id = uf.user_id
        LEFT JOIN roles r ON u.role = r.name
        LEFT JOIN role_flags_default rfd ON r.role_id = rfd.role_id
        WHERE u.id = $1
      `, [userId]);

      if (!userFlags) {
        // Retornar flags padrão (todas false) se usuário não encontrado
        return {
          flag_smart_0: false,
          flag_smart_1: false,
          flag_smart_2: false,
          flag_smart_3: false,
          flag_smart_4: false,
          flag_smart_5: false,
          flag_smart_6: false,
          flag_smart_7: false,
          flag_smart_8: false,
          flag_smart_9: false,
        };
      }

      return userFlags as UserFlags;
    } catch (error: any) {
      await logError('Erro ao buscar flags do usuário', error, { userId });
      throw error;
    }
  }

  /**
   * Atualizar flags de um usuário
   */
  async updateUserFlags(userId: number, flags: Partial<UserFlags>, updatedBy: number): Promise<void> {
    try {
      // Verificar se usuário existe
      const user = await this.getUserById(userId);
      if (!user) {
        throw new Error('Usuário não encontrado');
      }

      // Verificar se já existe registro de flags para o usuário
      const existingFlags = await this.db.findFirst(`
        SELECT user_id FROM user_flags WHERE user_id = $1
      `, [userId]);

      if (existingFlags) {
        // Atualizar flags existentes
        const updateFields: string[] = [];
        const updateParams: any[] = [];
        let paramIndex = 1;

        for (const flagName of ['flag_smart_0', 'flag_smart_1', 'flag_smart_2', 'flag_smart_3', 'flag_smart_4', 
                                'flag_smart_5', 'flag_smart_6', 'flag_smart_7', 'flag_smart_8', 'flag_smart_9'] as const) {
          if (flags[flagName] !== undefined) {
            updateFields.push(`${flagName} = $${paramIndex++}`);
            updateParams.push(flags[flagName]);
          }
        }

        if (updateFields.length > 0) {
          updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
          updateFields.push(`updated_by = $${paramIndex++}`);
          updateParams.push(updatedBy);
          updateParams.push(userId);

          await this.db.executeRaw(`
            UPDATE user_flags 
            SET ${updateFields.join(', ')}
            WHERE user_id = $${paramIndex}
          `, updateParams);
        }
      } else {
        // Criar novo registro de flags
        await this.db.executeRaw(`
          INSERT INTO user_flags (
            user_id, flag_smart_0, flag_smart_1, flag_smart_2, flag_smart_3, flag_smart_4,
            flag_smart_5, flag_smart_6, flag_smart_7, flag_smart_8, flag_smart_9,
            updated_by, created_at, updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `, [
          userId,
          flags.flag_smart_0 ?? false,
          flags.flag_smart_1 ?? false,
          flags.flag_smart_2 ?? false,
          flags.flag_smart_3 ?? false,
          flags.flag_smart_4 ?? false,
          flags.flag_smart_5 ?? false,
          flags.flag_smart_6 ?? false,
          flags.flag_smart_7 ?? false,
          flags.flag_smart_8 ?? false,
          flags.flag_smart_9 ?? false,
          updatedBy,
        ]);
      }
    } catch (error: any) {
      await logError('Erro ao atualizar flags do usuário', error, { userId, flags });
      throw error;
    }
  }

  /**
   * Ativar/desativar flag específica de um usuário
   */
  async setUserFlag(userId: number, flagName: keyof UserFlags, value: boolean, updatedBy: number): Promise<void> {
    try {
      await this.updateUserFlags(userId, { [flagName]: value }, updatedBy);
    } catch (error: any) {
      await logError('Erro ao definir flag do usuário', error, { userId, flagName, value });
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
