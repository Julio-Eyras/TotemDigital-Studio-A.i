/**
 * Auth Service - Smart Signage v2.0
 * Serviço de autenticação unificado
 */

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { getDatabase } from '../config/database';
import { AuditService } from './auditService';
import { logInfo, logError, logWarn, logDebug } from '../utils/loggerHelper';
import { config } from '../config/env';
import { getAuditServiceInstance } from '../utils/globalInstances';

export interface LoginRequest {
  username: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  password: string;
  email?: string;
  role?: string;
  subscriberId?: number; // clientId deprecated, usar subscriberId
}

export interface AuthResponse {
  success: boolean;
  token?: string;
  refreshToken?: string;
  user?: {
    id: number;
    username: string;
    email: string;
    role: string;
    subscriberId?: number;
    publisherId?: number;
    subscriberName?: string;
    user_type?: 'system_user' | 'subscriber_user' | 'publisher_user' | 'publisher_subscriber';
    isTenantUser?: boolean;
    flags?: {
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
    };
  };
  error?: string;
  requiresTwoFactor?: boolean; // Indica se 2FA é necessário
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export class AuthService {
  private get db() {
    return getDatabase();
  }
  
  // Lazy initialization - só criar quando necessário
  private getAuditService(): AuditService {
    return getAuditServiceInstance();
  }

  /**
   * Autentica usuário
   */
  async login(credentials: LoginRequest): Promise<AuthResponse> {
    try {
      const { username, password } = credentials;
      
      await logDebug(`[AUTH] Tentativa de login`, { username, passwordLength: password ? password.length : 0 });

      // Buscar usuário
      await logDebug(`[AUTH] Buscando usuário no banco de dados`, { username });
      
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
        } catch (error: unknown) {
          // Se falhar mesmo com a tabela existindo, tentar sem JOIN
          const errorMessage = error instanceof Error ? error.message : String(error);
          await logWarn(`[AUTH] Erro no JOIN com clients - buscando sem JOIN`, { error: errorMessage });
          user = await this.db.findFirst(`
            SELECT u.*
            FROM users u 
            WHERE u.username = ? AND u.is_active = true
          `, [username]);
        }
      } else {
        // Buscar sem JOIN se a tabela não existir
        await logWarn(`[AUTH] Tabela clients não existe - buscando usuário sem JOIN`, { username });
        user = await this.db.findFirst(`
          SELECT u.*
          FROM users u 
          WHERE u.username = ? AND u.is_active = true
        `, [username]);
      }

      await logDebug(`[AUTH] Resultado da busca`, { username, found: !!user, userId: user?.id });

      if (!user) {
        await logWarn(`[AUTH] Usuário não encontrado ou inativo`, { username });
        await this.getAuditService().log('auth', 'login_failed', undefined, { username, reason: 'user_not_found' }).catch(e => logError('[AUTH] Erro ao registrar log', e));
        return { success: false, error: 'Credenciais inválidas' };
      }

      await logDebug(`[AUTH] Usuário encontrado`, { username: user.username, role: user.role, email: user.email || 'N/A' });

      // Verificar senha
      await logDebug(`[AUTH] Verificando senha`, { username });
      const isValidPassword = await bcrypt.compare(password, user.password_hash);
      await logDebug(`[AUTH] Validação de senha`, { username, isValid: isValidPassword });

      if (!isValidPassword) {
        await logWarn(`[AUTH] Senha inválida`, { username });
        await this.getAuditService().log('auth', 'login_failed', user.id, { username, reason: 'invalid_password' }).catch(e => logError('[AUTH] Erro ao registrar log', e));
        return { success: false, error: 'Credenciais inválidas' };
      }

      // Atualizar último login
      await logDebug(`[AUTH] Atualizando último login`, { userId: user.id });
      await this.db.executeRaw(`
        UPDATE users 
        SET last_login = CURRENT_TIMESTAMP 
        WHERE id = ?
      `, [user.id]).catch(e => logError('[AUTH] Erro ao atualizar last_login', e));

      // Verificar se 2FA está habilitado
      const { getTwoFactorService } = await import('./twoFactorService');
      const twoFactorService = getTwoFactorService();
      const requiresTwoFactor = await twoFactorService.isTwoFactorEnabled(user.id);

      if (requiresTwoFactor) {
        await logInfo(`[AUTH] 2FA requerido para usuário`, { username, userId: user.id });
        
        // Não gerar tokens ainda - aguardar verificação 2FA
        return {
          success: true,
          requiresTwoFactor: true,
          user: {
            id: user.id,
            username: user.username,
            email: user.email || '',
            role: user.role,
            // clientId removido - usar subscriberId
            user_type: user.user_type, // NOVO: Incluir user_type
            publisherId: user.publisher_id,
            subscriberId: user.subscriber_id
          }
        };
      }

      // Buscar flags efetivas do usuário
      let effectiveFlags: any = null;
      try {
        const { getUserEffectiveFlags } = await import('../utils/flagChecker');
        effectiveFlags = await getUserEffectiveFlags({
          id: user.id,
          role: user.role,
          user_type: user.user_type,
          publisher_id: user.publisher_id
        });
      } catch (error) {
        await logWarn(`[AUTH] Erro ao buscar flags do usuário`, { userId: user.id, error });
        // Continuar sem flags se houver erro
      }

      // Gerar tokens (2FA não habilitado)
      await logDebug(`[AUTH] Gerando tokens JWT`, { userId: user.id });
      const token = this.generateToken(user);
      const refreshToken = this.generateRefreshToken(user);
      await logDebug(`[AUTH] Tokens gerados com sucesso`, { userId: user.id });

      // Log de sucesso
      await this.getAuditService().log('auth', 'login_success', user.id, { username }).catch(e => logError('[AUTH] Erro ao registrar log de sucesso', e));

      await logInfo(`[AUTH] Login bem-sucedido`, { username, userId: user.id });

      return {
        success: true,
        token,
        refreshToken,
        user: {
          id: user.id,
          username: user.username,
          email: user.email || '',
          role: user.role,
          // clientId removido - usar subscriberId
          user_type: user.user_type, // NOVO: Incluir user_type para detecção automática
          publisherId: user.publisher_id, // NOVO: Incluir publisherId se existir
          subscriberId: user.subscriber_id, // NOVO: Incluir subscriberId se existir (derivado)
          flags: effectiveFlags
        }
      };

    } catch (error: any) {
      await logError('[AUTH] Erro no login', error, { username: credentials.username });
      
      // Verificar se é erro de banco de dados
      if (error.message && error.message.includes('relation') && error.message.includes('does not exist')) {
        await logError('[AUTH] ERRO CRÍTICO: Tabela users não existe no banco de dados', error);
        return { success: false, error: 'Erro interno: Tabela de usuários não encontrada. Verifique a instalação do banco de dados.' };
      }
      
      if (error.message && error.message.includes('column') && error.message.includes('does not exist')) {
        await logError(`[AUTH] ERRO CRÍTICO: Coluna não existe na tabela users`, error);
        return { success: false, error: 'Erro interno: Estrutura do banco de dados incorreta. Execute o smartchannel-db.sql para criar as tabelas.' };
      }
      
      return { success: false, error: `Erro interno do servidor: ${error.message}` };
    }
  }

  /**
   * Registra novo usuário
   */
  async register(data: RegisterRequest): Promise<AuthResponse> {
    try {
      const { username, password, role = 'client' } = data;

      // Verificar se usuário já existe
      const existingUser = await this.db.findFirst(`
        SELECT id FROM users WHERE username = ?
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
        VALUES (?, ?, ?, ?, true)
        RETURNING id
      `, [username, passwordHash, role, null]); // clientId removido

      const insertedUser = result?.rows?.[0];
      if (!insertedUser?.id) {
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
            WHERE u.id = ?
          `, [insertedUser.id]);
        } catch {
          newUser = await this.db.findFirst(`
            SELECT u.*
            FROM users u 
            WHERE u.id = ?
          `, [insertedUser.id]);
        }
      } else {
        newUser = await this.db.findFirst(`
          SELECT u.*
          FROM users u 
          WHERE u.id = ?
        `, [insertedUser.id]);
      }

      // Gerar tokens
      const token = this.generateToken(newUser);
      const refreshToken = this.generateRefreshToken(newUser);

      // Log de registro
      await this.getAuditService().log('auth', 'user_registered', newUser.id, { username, role });

      return {
        success: true,
        token,
        refreshToken,
        user: {
          id: newUser.id,
          username: newUser.username,
          email: newUser.email || '',
          role: newUser.role,
          // clientId removido - usar subscriberId
        }
      };

    } catch (error: any) {
      await logError('Erro no registro', error);
      return { success: false, error: 'Erro interno do servidor' };
    }
  }

  /**
   * Atualiza token de acesso
   */
  async refreshToken(refreshToken: string): Promise<AuthResponse> {
    try {
      const decoded = jwt.verify(refreshToken, config.jwt.secret) as any;
      
      // Buscar usuário (com ou sem JOIN dependendo da existência da tabela)
      const clientsTableExists = await this.db.tableExists('clients');
      let user;
      if (clientsTableExists) {
        try {
          user = await this.db.findFirst(`
            SELECT u.*, c.name as client_name 
            FROM users u 
            LEFT JOIN clients c ON u.client_id = c.client_id 
            WHERE u.id = ? AND u.is_active = true
          `, [decoded.userId]);
        } catch {
          user = await this.db.findFirst(`
            SELECT u.*
            FROM users u 
            WHERE u.id = ? AND u.is_active = true
          `, [decoded.userId]);
        }
      } else {
        user = await this.db.findFirst(`
          SELECT u.*
          FROM users u 
          WHERE u.id = ? AND u.is_active = true
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
          id: user.id,
          username: user.username,
          email: user.email || '',
          role: user.role,
          // clientId removido - usar subscriberId
        }
      };

    } catch (error: any) {
      await logError('Erro no refresh token', error);
      return { success: false, error: 'Token inválido' };
    }
  }

  /**
   * Login específico para subscribers
   * Permite login usando email do subscriber e senha de um usuário associado
   */
  async subscriberLogin(credentials: { email: string; password: string }): Promise<AuthResponse> {
    try {
      const { email, password } = credentials;
      
      await logDebug(`[AUTH] Tentativa de login subscriber`, { email, passwordLength: password ? password.length : 0 });

      // 1. Buscar subscriber pelo email
      const subscriber = await this.db.findFirst(`
        SELECT subscriber_id, name, email, is_active
        FROM subscribers
        WHERE email = $1 AND is_active = true
      `, [email]);

      if (!subscriber) {
        await logWarn(`[AUTH] Subscriber não encontrado ou inativo`, { email });
        await this.getAuditService().log('auth', 'subscriber_login_failed', undefined, { email, reason: 'subscriber_not_found' }).catch(e => logError('[AUTH] Erro ao registrar log', e));
        return { success: false, error: 'Subscriber não encontrado ou inativo' };
      }

      await logDebug(`[AUTH] Subscriber encontrado`, { subscriberId: subscriber.subscriber_id, email });

      // 2. Buscar publisher relacionado ao subscriber
      // Estratégia: buscar publisher que tem o mesmo email OU que tem is_subscriber = true
      // e verificar se há relação direta (futuro: tabela subscriber_publishers)
      const publisher = await this.db.findFirst(`
        SELECT publisher_id, name, email, is_subscriber, active
        FROM publishers
        WHERE (email = $1 OR is_subscriber = true)
        AND COALESCE(active, true) = true
        ORDER BY CASE WHEN email = $1 THEN 1 ELSE 2 END
        LIMIT 1
      `, [email]);

      if (!publisher) {
        await logWarn(`[AUTH] Publisher não encontrado para subscriber`, { subscriberId: subscriber.subscriber_id, email });
        await this.getAuditService().log('auth', 'subscriber_login_failed', undefined, { email, reason: 'publisher_not_found' }).catch(e => logError('[AUTH] Erro ao registrar log', e));
        return { success: false, error: 'Nenhum publisher associado encontrado para este subscriber' };
      }

      await logDebug(`[AUTH] Publisher encontrado`, { publisherId: publisher.publisher_id, email });

      // 3. Buscar usuários do publisher
      const users = await this.db.findMany(`
        SELECT id, username, email, password_hash, role, publisher_id, user_type, is_active
        FROM users
        WHERE publisher_id = $1 AND is_active = true
        ORDER BY created_at ASC
      `, [publisher.publisher_id]);

      if (!users || users.length === 0) {
        await logWarn(`[AUTH] Nenhum usuário encontrado para publisher`, { publisherId: publisher.publisher_id });
        await this.getAuditService().log('auth', 'subscriber_login_failed', undefined, { email, reason: 'no_users_found' }).catch(e => logError('[AUTH] Erro ao registrar log', e));
        return { success: false, error: 'Nenhum usuário encontrado para este subscriber. Contate o administrador.' };
      }

      await logDebug(`[AUTH] Usuários encontrados`, { count: users.length, publisherId: publisher.publisher_id });

      // 4. Tentar validar senha com cada usuário até encontrar um válido
      let authenticatedUser: any = null;
      for (const user of users) {
        const isValidPassword = await bcrypt.compare(password, user.password_hash);
        if (isValidPassword) {
          authenticatedUser = user;
          break;
        }
      }

      if (!authenticatedUser) {
        await logWarn(`[AUTH] Senha inválida para subscriber`, { email, subscriberId: subscriber.subscriber_id });
        await this.getAuditService().log('auth', 'subscriber_login_failed', undefined, { email, reason: 'invalid_password' }).catch(e => logError('[AUTH] Erro ao registrar log', e));
        return { success: false, error: 'Credenciais inválidas' };
      }

      await logDebug(`[AUTH] Usuário autenticado`, { userId: authenticatedUser.id, username: authenticatedUser.username });

      // 5. Atualizar último login
      await this.db.executeRaw(`
        UPDATE users 
        SET last_login = CURRENT_TIMESTAMP 
        WHERE id = $1
      `, [authenticatedUser.id]).catch(e => logError('[AUTH] Erro ao atualizar last_login', e));

      // 6. Verificar se 2FA está habilitado
      const { getTwoFactorService } = await import('./twoFactorService');
      const twoFactorService = getTwoFactorService();
      const requiresTwoFactor = await twoFactorService.isTwoFactorEnabled(authenticatedUser.id);

      if (requiresTwoFactor) {
        await logInfo(`[AUTH] 2FA requerido para subscriber`, { email, userId: authenticatedUser.id });
        
        return {
          success: true,
          requiresTwoFactor: true,
          user: {
            id: authenticatedUser.id,
            username: authenticatedUser.username,
            email: authenticatedUser.email || '',
            role: authenticatedUser.role,
            subscriberId: subscriber.subscriber_id,
            publisherId: publisher.publisher_id
          }
        };
      }

      // 7. Gerar tokens
      await logDebug(`[AUTH] Gerando tokens JWT para subscriber`, { userId: authenticatedUser.id });
      
      // Criar objeto user com subscriberId para o token
      const userForToken = {
        ...authenticatedUser,
        subscriber_id: subscriber.subscriber_id,
        client_id: subscriber.subscriber_id // Compatibilidade
      };
      
      const token = this.generateToken(userForToken);
      const refreshToken = this.generateRefreshToken(userForToken);
      
      await logDebug(`[AUTH] Tokens gerados com sucesso para subscriber`, { userId: authenticatedUser.id });

      // 8. Log de sucesso
      await this.getAuditService().log('auth', 'subscriber_login_success', authenticatedUser.id, { 
        email, 
        subscriberId: subscriber.subscriber_id,
        publisherId: publisher.publisher_id
      }).catch(e => logError('[AUTH] Erro ao registrar log de sucesso', e));

      await logInfo(`[AUTH] Login subscriber bem-sucedido`, { email, userId: authenticatedUser.id, subscriberId: subscriber.subscriber_id });

      return {
        success: true,
        token,
        refreshToken,
        user: {
          id: authenticatedUser.id,
          username: authenticatedUser.username,
          email: authenticatedUser.email || '',
          role: authenticatedUser.role,
          subscriberId: subscriber.subscriber_id,
          publisherId: publisher.publisher_id,
          subscriberName: subscriber.name,
          // clientId removido - usar subscriberId
        }
      };

    } catch (error: any) {
      await logError('[AUTH] Erro no login subscriber', error, { email: credentials.email });
      
      if (error.message && error.message.includes('relation') && error.message.includes('does not exist')) {
        await logError('[AUTH] ERRO CRÍTICO: Tabela não existe no banco de dados', error);
        return { success: false, error: 'Erro interno: Estrutura do banco de dados não encontrada.' };
      }
      
      return { success: false, error: `Erro interno do servidor: ${error.message}` };
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
        SELECT password_hash FROM users WHERE id = ? AND is_active = true
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
        WHERE id = ?
      `, [newPasswordHash, userId]);

      // Log de alteração
      await this.getAuditService().log('auth', 'password_changed', userId, {});

      return { success: true };

    } catch (error: any) {
      await logError('Erro ao alterar senha', error);
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
              u.id as user_id,
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
            WHERE u.id = ? AND u.is_active = true
          `, [userId]);
        } catch {
          user = await this.db.findFirst(`
            SELECT 
              u.id as user_id,
              u.username,
              u.role,
              u.is_active,
              u.last_login,
              u.created_at,
              u.updated_at
            FROM users u 
            WHERE u.id = ? AND u.is_active = true
          `, [userId]);
        }
      } else {
        user = await this.db.findFirst(`
          SELECT 
            u.id as user_id,
            u.username,
            u.role,
            u.is_active,
            u.last_login,
            u.created_at,
            u.updated_at
          FROM users u 
          WHERE u.id = ? AND u.is_active = true
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
      await logError('Erro ao buscar dados do usuário', error);
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
      await logError('Erro no logout', error);
      return { success: false, error: 'Erro interno do servidor' };
    }
  }

  /**
   * Gera token JWT
   */
  private generateToken(user: any): string {
    const payload: any = {
      userId: user.id,
      username: user.username,
      role: user.role,
      // clientId deprecated - usar subscriberId
    };

    // Adicionar subscriberId se disponível
    if (user.subscriber_id) {
      payload.subscriberId = user.subscriber_id;
    }

    return jwt.sign(payload, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn
    } as jwt.SignOptions);
  }

  /**
   * Gera refresh token
   */
  private generateRefreshToken(user: any): string {
    const payload = {
      userId: user.id,
      type: 'refresh'
    };

    return jwt.sign(payload, config.jwt.secret, {
      expiresIn: config.jwt.refreshExpiresIn
    } as jwt.SignOptions);
  }

  /**
   * Verifica se PIN de abandono está correto
   */
  async verifyAbandonPin(pin: string): Promise<boolean> {
    const correctPin = config.security.playerAbandonPin;
    return pin === correctPin;
  }

  /**
   * Solicita recuperação de senha (forgot password)
   */
  async forgotPassword(email: string): Promise<{ success: boolean; message: string; token?: string }> {
    try {
      // Buscar usuário por email
      const user = await this.db.findFirst(`
        SELECT id, username, email, is_active
        FROM users
        WHERE email = ? AND is_active = true
      `, [email]);

      // Por segurança, sempre retornar sucesso mesmo se email não existir
      // Isso previne enumeração de emails
      if (!user) {
        await logWarn(`[PASSWORD_RESET] Tentativa de recuperação para email não cadastrado`, { email });
        return {
          success: true,
          message: 'Se o email estiver cadastrado, você receberá um link de recuperação.'
        };
      }

      // Invalidar tokens anteriores do usuário
      await this.db.executeRaw(`
        UPDATE password_reset_tokens
        SET used = true
        WHERE user_id = ? AND used = false
      `, [user.id]);

      // Gerar token seguro
      const token = this.generatePasswordResetToken();
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 1); // Token expira em 1 hora

      // Salvar token no banco
      await this.db.executeRaw(`
        INSERT INTO password_reset_tokens (user_id, token, expires_at)
        VALUES (?, ?, ?)
      `, [user.id, token, expiresAt]);

      // Log de auditoria
      await this.getAuditService().log('auth', 'password_reset_requested', user.id, {
        email: email,
        username: user.username
      });

      // Enviar email de recuperação de senha
      try {
        const { emailService } = await import('./emailService');
        const emailResult = await emailService.sendPasswordResetEmail(
          user.email || email,
          token,
          user.username
        );

        if (!emailResult.success && process.env.NODE_ENV === 'development') {
          await logInfo(`[PASSWORD RESET] Token gerado`, { email, expiresAt: expiresAt.toISOString() });
          await logDebug(`[PASSWORD RESET] Token details`, { token, link: `${process.env.FRONTEND_URL || 'http://localhost:3001'}/reset-password?token=${token}` });
        }
      } catch (emailError: any) {
        await logError('Erro ao enviar email de recuperação de senha', emailError, { email });
        // Em desenvolvimento, mostrar token no log
        if (process.env.NODE_ENV === 'development') {
          await logInfo(`[PASSWORD RESET] Token gerado (modo desenvolvimento)`, { email, expiresAt: expiresAt.toISOString() });
          await logDebug(`[PASSWORD RESET] Token details`, { token, link: `${process.env.FRONTEND_URL || 'http://localhost:3001'}/reset-password?token=${token}` });
        }
      }

      return {
        success: true,
        message: 'Se o email estiver cadastrado, você receberá um link de recuperação.',
        token: process.env.NODE_ENV === 'development' ? token : undefined // Apenas em dev
      };

    } catch (error: any) {
      await logError('Erro ao solicitar recuperação de senha', error);
      return {
        success: false,
        message: 'Erro ao processar solicitação de recuperação de senha'
      };
    }
  }

  /**
   * Redefine senha usando token (reset password)
   */
  async resetPassword(token: string, newPassword: string): Promise<{ success: boolean; message: string }> {
    try {
      // Buscar token válido
      const resetToken = await this.db.findFirst(`
        SELECT prt.*, u.id as user_id, u.username, u.email
        FROM password_reset_tokens prt
        INNER JOIN users u ON prt.user_id = u.id
        WHERE prt.token = ? 
          AND prt.used = false 
          AND prt.expires_at > CURRENT_TIMESTAMP
          AND u.is_active = true
      `, [token]);

      if (!resetToken) {
        return {
          success: false,
          message: 'Token inválido ou expirado. Solicite uma nova recuperação de senha.'
        };
      }

      // Validar nova senha
      if (!newPassword || newPassword.length < 6) {
        return {
          success: false,
          message: 'A nova senha deve ter pelo menos 6 caracteres'
        };
      }

      // Hash da nova senha
      const saltRounds = 12;
      const passwordHash = await bcrypt.hash(newPassword, saltRounds);

      // Atualizar senha do usuário
      await this.db.executeRaw(`
        UPDATE users
        SET password_hash = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [passwordHash, resetToken.user_id]);

      // Marcar token como usado
      await this.db.executeRaw(`
        UPDATE password_reset_tokens
        SET used = true
        WHERE id = ?
      `, [resetToken.id]);

      // Log de auditoria
      await this.getAuditService().log('auth', 'password_reset_completed', resetToken.user_id, {
        username: resetToken.username,
        email: resetToken.email
      });

      return {
        success: true,
        message: 'Senha redefinida com sucesso. Você já pode fazer login com a nova senha.'
      };

    } catch (error: any) {
      await logError('Erro ao redefinir senha', error);
      return {
        success: false,
        message: 'Erro ao processar redefinição de senha'
      };
    }
  }

  /**
   * Gera token seguro para recuperação de senha
   */
  private generatePasswordResetToken(): string {
    // Gerar token aleatório de 32 bytes (256 bits) em hexadecimal
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Limpa tokens expirados (manutenção)
   */
  async cleanupExpiredTokens(): Promise<number> {
    try {
      const result = await this.db.executeRaw(`
        DELETE FROM password_reset_tokens
        WHERE expires_at < CURRENT_TIMESTAMP OR used = true
      `);

      return (result as any).rowCount || 0;
    } catch (error: any) {
      await logError('Erro ao limpar tokens expirados', error);
      return 0;
    }
  }

  /**
   * Cria usuário admin padrão se não existir
   */
  async createDefaultAdmin(): Promise<void> {
    try {
      const adminExists = await this.db.findFirst(`
        SELECT id FROM users WHERE username = 'admin'
      `);

      if (adminExists) {
        await logInfo('Usuário admin já existe');
        return;
      }

      const saltRounds = 12;
      const passwordHash = await bcrypt.hash('admin', saltRounds);

      await this.db.executeRaw(`
        INSERT INTO users (username, password_hash, role, is_active)
        VALUES ('admin', ?, 'admin', 1)
      `, [passwordHash]);

      await logInfo('Usuário admin padrão criado (admin/admin)');

    } catch (error: any) {
      await logError('Erro ao criar admin padrão', error);
    }
  }
}

