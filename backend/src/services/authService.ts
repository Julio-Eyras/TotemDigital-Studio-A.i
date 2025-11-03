/**
 * Auth Service - Smart Signage v2.0
 * Serviço de autenticação unificado
 */

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getDatabase } from '../config/database';
import { AuditService } from './auditService';

export interface LoginRequest {
  username: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  password: string;
  email?: string;
  role?: string;
  clientId?: number;
}

export interface AuthResponse {
  success: boolean;
  token?: string;
  refreshToken?: string;
  user?: {
    id: number;
    username: string;
    role: string;
    clientId?: number;
  };
  error?: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export class AuthService {
  private db = getDatabase();
  
  // Lazy initialization - só criar quando necessário
  private getAuditService(): AuditService {
    if (!(global as any).auditServiceInstance) {
      (global as any).auditServiceInstance = new AuditService();
    }
    return (global as any).auditServiceInstance;
  }

  /**
   * Autentica usuário
   */
  async login(credentials: LoginRequest): Promise<AuthResponse> {
    try {
      const { username, password } = credentials;
      
      console.log(`[AUTH] Tentativa de login para usuário: ${username}`);
      console.log(`[AUTH] Senha fornecida (tamanho): ${password ? password.length : 0} caracteres`);

      // Buscar usuário
      console.log(`[AUTH] Buscando usuário no banco de dados...`);
      
      // Verificar se tabela clients existe antes de fazer JOIN
      const clientsTableExists = await this.db.tableExists('clients');
      let user;
      
      if (clientsTableExists) {
        // Tentar com JOIN se a tabela existir
        try {
          user = await this.db.findFirst(`
            SELECT u.*, c.name as client_name 
            FROM users u 
            LEFT JOIN clients c ON u.client_id = c.client_id 
            WHERE u.username = ? AND u.is_active = true
          `, [username]);
        } catch (error: any) {
          // Se falhar mesmo com a tabela existindo, tentar sem JOIN
          console.log(`[AUTH] ⚠️ Erro no JOIN com clients - buscando sem JOIN: ${error.message}`);
          user = await this.db.findFirst(`
            SELECT u.*
            FROM users u 
            WHERE u.username = ? AND u.is_active = true
          `, [username]);
        }
      } else {
        // Buscar sem JOIN se a tabela não existir
        console.log(`[AUTH] ⚠️ Tabela clients não existe - buscando usuário sem JOIN...`);
        user = await this.db.findFirst(`
          SELECT u.*
          FROM users u 
          WHERE u.username = ? AND u.is_active = true
        `, [username]);
      }

      console.log(`[AUTH] Resultado da busca: ${user ? `Usuário encontrado (ID: ${user.user_id})` : 'Usuário NÃO encontrado'}`);

      if (!user) {
        console.log(`[AUTH] ❌ Usuário '${username}' não encontrado ou inativo`);
        await this.getAuditService().log('auth', 'login_failed', null, { username, reason: 'user_not_found' }).catch(e => console.error('[AUTH] Erro ao registrar log:', e.message));
        return { success: false, error: 'Credenciais inválidas' };
      }

      console.log(`[AUTH] Usuário encontrado: ${user.username}, Role: ${user.role}, Email: ${user.email || 'N/A'}`);
      console.log(`[AUTH] Password hash do banco: ${user.password_hash ? `${user.password_hash.substring(0, 10)}...` : 'NÃO DEFINIDO'}`);

      // Verificar senha
      console.log(`[AUTH] Verificando senha...`);
      const isValidPassword = await bcrypt.compare(password, user.password_hash);
      console.log(`[AUTH] Senha válida: ${isValidPassword ? 'SIM' : 'NÃO'}`);

      if (!isValidPassword) {
        console.log(`[AUTH] ❌ Senha inválida para usuário '${username}'`);
        await this.getAuditService().log('auth', 'login_failed', user.user_id, { username, reason: 'invalid_password' }).catch(e => console.error('[AUTH] Erro ao registrar log:', e.message));
        return { success: false, error: 'Credenciais inválidas' };
      }

      // Atualizar último login
      console.log(`[AUTH] Atualizando último login...`);
      await this.db.executeRaw(`
        UPDATE users 
        SET last_login = CURRENT_TIMESTAMP 
        WHERE user_id = ?
      `, [user.user_id]).catch(e => console.error('[AUTH] Erro ao atualizar last_login:', e.message));

      // Gerar tokens
      console.log(`[AUTH] Gerando tokens JWT...`);
      const token = this.generateToken(user);
      const refreshToken = this.generateRefreshToken(user);
      console.log(`[AUTH] Tokens gerados com sucesso`);

      // Log de sucesso
      await this.getAuditService().log('auth', 'login_success', user.user_id, { username }).catch(e => console.error('[AUTH] Erro ao registrar log de sucesso:', e.message));

      console.log(`[AUTH] ✅ Login bem-sucedido para '${username}'`);

      return {
        success: true,
        token,
        refreshToken,
        user: {
          id: user.user_id,
          username: user.username,
          role: user.role,
          clientId: user.client_id
        }
      };

    } catch (error: any) {
      console.error('❌ [AUTH] Erro no login:', error.message);
      console.error('❌ [AUTH] Stack trace:', error.stack);
      console.error('❌ [AUTH] Erro completo:', JSON.stringify(error, null, 2));
      
      // Verificar se é erro de banco de dados
      if (error.message && error.message.includes('relation') && error.message.includes('does not exist')) {
        console.error('❌ [AUTH] ERRO CRÍTICO: Tabela users não existe no banco de dados!');
        return { success: false, error: 'Erro interno: Tabela de usuários não encontrada. Verifique a instalação do banco de dados.' };
      }
      
      if (error.message && error.message.includes('column') && error.message.includes('does not exist')) {
        console.error(`❌ [AUTH] ERRO CRÍTICO: Coluna não existe na tabela users! Erro: ${error.message}`);
        return { success: false, error: 'Erro interno: Estrutura do banco de dados incorreta. Execute: npx prisma db push' };
      }
      
      return { success: false, error: `Erro interno do servidor: ${error.message}` };
    }
  }

  /**
   * Registra novo usuário
   */
  async register(data: RegisterRequest): Promise<AuthResponse> {
    try {
      const { username, password, email, role = 'client', clientId } = data;

      // Verificar se usuário já existe
      const existingUser = await this.db.findFirst(`
        SELECT user_id FROM users WHERE username = ?
      `, [username]);

      if (existingUser) {
        return { success: false, error: 'Nome de usuário já existe' };
      }

      // Hash da senha
      const saltRounds = 12;
      const passwordHash = await bcrypt.hash(password, saltRounds);

      // Criar usuário
      const result = await this.db.executeRaw(`
        INSERT INTO users (username, password_hash, role, client_id, is_active)
        VALUES (?, ?, ?, ?, 1)
      `, [username, passwordHash, role, clientId]);

      if (!result.lastInsertRowid) {
        return { success: false, error: 'Erro ao criar usuário' };
      }

      // Buscar usuário criado (com ou sem JOIN dependendo da existência da tabela)
      const clientsTableExists = await this.db.tableExists('clients');
      let newUser;
      if (clientsTableExists) {
        try {
          newUser = await this.db.findFirst(`
            SELECT u.*, c.name as client_name 
            FROM users u 
            LEFT JOIN clients c ON u.client_id = c.client_id 
            WHERE u.user_id = ?
          `, [result.lastInsertRowid]);
        } catch {
          newUser = await this.db.findFirst(`
            SELECT u.*
            FROM users u 
            WHERE u.user_id = ?
          `, [result.lastInsertRowid]);
        }
      } else {
        newUser = await this.db.findFirst(`
          SELECT u.*
          FROM users u 
          WHERE u.user_id = ?
        `, [result.lastInsertRowid]);
      }

      // Gerar tokens
      const token = this.generateToken(newUser);
      const refreshToken = this.generateRefreshToken(newUser);

      // Log de registro
      await this.getAuditService().log('auth', 'user_registered', newUser.user_id, { username, role });

      return {
        success: true,
        token,
        refreshToken,
        user: {
          id: newUser.user_id,
          username: newUser.username,
          role: newUser.role,
          clientId: newUser.client_id
        }
      };

    } catch (error: any) {
      console.error('❌ Erro no registro:', error.message);
      return { success: false, error: 'Erro interno do servidor' };
    }
  }

  /**
   * Atualiza token de acesso
   */
  async refreshToken(refreshToken: string): Promise<AuthResponse> {
    try {
      const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET!) as any;
      
      // Buscar usuário (com ou sem JOIN dependendo da existência da tabela)
      const clientsTableExists = await this.db.tableExists('clients');
      let user;
      if (clientsTableExists) {
        try {
          user = await this.db.findFirst(`
            SELECT u.*, c.name as client_name 
            FROM users u 
            LEFT JOIN clients c ON u.client_id = c.client_id 
            WHERE u.user_id = ? AND u.is_active = true
          `, [decoded.userId]);
        } catch {
          user = await this.db.findFirst(`
            SELECT u.*
            FROM users u 
            WHERE u.user_id = ? AND u.is_active = true
          `, [decoded.userId]);
        }
      } else {
        user = await this.db.findFirst(`
          SELECT u.*
          FROM users u 
          WHERE u.user_id = ? AND u.is_active = 1
        `, [decoded.userId]);
      }

      if (!user) {
        return { success: false, error: 'Token inválido' };
      }

      // Gerar novo token
      const newToken = this.generateToken(user);

      return {
        success: true,
        token: newToken,
        user: {
          id: user.user_id,
          username: user.username,
          role: user.role,
          clientId: user.client_id
        }
      };

    } catch (error: any) {
      console.error('❌ Erro no refresh token:', error.message);
      return { success: false, error: 'Token inválido' };
    }
  }

  /**
   * Altera senha do usuário
   */
  async changePassword(userId: number, data: ChangePasswordRequest): Promise<AuthResponse> {
    try {
      const { currentPassword, newPassword } = data;

      // Buscar usuário
      const user = await this.db.findFirst(`
        SELECT password_hash FROM users WHERE user_id = ? AND is_active = true
      `, [userId]);

      if (!user) {
        return { success: false, error: 'Usuário não encontrado' };
      }

      // Verificar senha atual
      const isValidPassword = await bcrypt.compare(currentPassword, user.password_hash);
      if (!isValidPassword) {
        await this.getAuditService().log('auth', 'password_change_failed', userId, { reason: 'invalid_current_password' });
        return { success: false, error: 'Senha atual incorreta' };
      }

      // Hash da nova senha
      const saltRounds = 12;
      const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

      // Atualizar senha
      await this.db.executeRaw(`
        UPDATE users 
        SET password_hash = ?, updated_at = CURRENT_TIMESTAMP 
        WHERE user_id = ?
      `, [newPasswordHash, userId]);

      // Log de alteração
      await this.getAuditService().log('auth', 'password_changed', userId, {});

      return { success: true };

    } catch (error: any) {
      console.error('❌ Erro ao alterar senha:', error.message);
      return { success: false, error: 'Erro interno do servidor' };
    }
  }

  /**
   * Busca dados do usuário autenticado
   */
  async getMe(userId: number): Promise<any> {
    try {
      // Buscar usuário (com ou sem JOIN dependendo da existência da tabela)
      const clientsTableExists = await this.db.tableExists('clients');
      let user;
      if (clientsTableExists) {
        try {
          user = await this.db.findFirst(`
            SELECT 
              u.user_id,
              u.username,
              u.role,
              u.is_active,
              u.last_login,
              u.created_at,
              u.updated_at,
              c.name as client_name,
              c.email as client_email
            FROM users u 
            LEFT JOIN clients c ON u.client_id = c.client_id 
            WHERE u.user_id = ? AND u.is_active = true
          `, [userId]);
        } catch {
          user = await this.db.findFirst(`
            SELECT 
              u.user_id,
              u.username,
              u.role,
              u.is_active,
              u.last_login,
              u.created_at,
              u.updated_at
            FROM users u 
            WHERE u.user_id = ? AND u.is_active = true
          `, [userId]);
        }
      } else {
        user = await this.db.findFirst(`
          SELECT 
            u.user_id,
            u.username,
            u.role,
            u.is_active,
            u.last_login,
            u.created_at,
            u.updated_at
          FROM users u 
          WHERE u.user_id = ? AND u.is_active = 1
        `, [userId]);
      }

      if (!user) {
        return null;
      }

      // Buscar permissões do usuário
      const permissions = await this.db.findMany(`
        SELECT p.name, p.resource, p.action
        FROM user_roles ur
        JOIN role_permissions rp ON ur.role_id = rp.role_id
        JOIN permissions p ON rp.permission_id = p.permission_id
        WHERE ur.user_id = ?
      `, [userId]);

      return {
        ...user,
        permissions: permissions.map(p => p.name)
      };

    } catch (error: any) {
      console.error('❌ Erro ao buscar dados do usuário:', error.message);
      return null;
    }
  }

  /**
   * Logout (invalida token)
   */
  async logout(userId: number): Promise<AuthResponse> {
    try {
      // Log de logout
      await this.getAuditService().log('auth', 'logout', userId, {});

      return { success: true };

    } catch (error: any) {
      console.error('❌ Erro no logout:', error.message);
      return { success: false, error: 'Erro interno do servidor' };
    }
  }

  /**
   * Gera token JWT
   */
  private generateToken(user: any): string {
    const payload = {
      userId: user.user_id,
      username: user.username,
      role: user.role,
      clientId: user.client_id
    };

    return jwt.sign(payload, process.env.JWT_SECRET!, {
      expiresIn: process.env.JWT_EXPIRES_IN || '24h'
    } as jwt.SignOptions);
  }

  /**
   * Gera refresh token
   */
  private generateRefreshToken(user: any): string {
    const payload = {
      userId: user.user_id,
      type: 'refresh'
    };

    return jwt.sign(payload, process.env.JWT_SECRET!, {
      expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d'
    } as jwt.SignOptions);
  }

  /**
   * Verifica se PIN de abandono está correto
   */
  async verifyAbandonPin(pin: string): Promise<boolean> {
    const correctPin = process.env.PLAYER_ABANDON_PIN || '1234';
    return pin === correctPin;
  }

  /**
   * Cria usuário admin padrão se não existir
   */
  async createDefaultAdmin(): Promise<void> {
    try {
      const adminExists = await this.db.findFirst(`
        SELECT user_id FROM users WHERE username = 'admin'
      `);

      if (adminExists) {
        console.log('✅ Usuário admin já existe');
        return;
      }

      const saltRounds = 12;
      const passwordHash = await bcrypt.hash('admin', saltRounds);

      await this.db.executeRaw(`
        INSERT INTO users (username, password_hash, role, is_active)
        VALUES ('admin', ?, 'admin', 1)
      `, [passwordHash]);

      console.log('✅ Usuário admin padrão criado (admin/admin)');

    } catch (error: any) {
      console.error('❌ Erro ao criar admin padrão:', error.message);
    }
  }
}
