/**
 * Two Factor Authentication Service - Smart Signage v2.1
 * Serviço para gerenciar autenticação de dois fatores (TOTP)
 */

import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import crypto from 'crypto';
import { getDatabase } from '../config/database';
import { logInfo, logError, logWarn, logDebug } from '../utils/loggerHelper';
import { config } from '../config/env';
import { normalizeError } from '../utils/errors';

export interface TwoFactorSetup {
  secret: string;
  qrCodeUrl: string;
  backupCodes: string[];
}

export interface TwoFactorVerification {
  success: boolean;
  error?: string;
}

export class TwoFactorService {
  private get db() {
    return getDatabase();
  }

  // Chave de criptografia para secrets (deve estar em variável de ambiente)
  private getEncryptionKey(): string {
    return config.jwt.twoFactorEncryptionKey;
  }

  /**
   * Criptografa secret usando AES-256
   */
  private encryptSecret(secret: string): string {
    const algorithm = 'aes-256-cbc';
    const key = crypto.scryptSync(this.getEncryptionKey(), 'salt', 32);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    
    let encrypted = cipher.update(secret, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    // Retornar IV + encrypted (IV é necessário para descriptografar)
    return iv.toString('hex') + ':' + encrypted;
  }

  /**
   * Descriptografa secret
   */
  private decryptSecret(encryptedSecret: string): string {
    const algorithm = 'aes-256-cbc';
    const key = crypto.scryptSync(this.getEncryptionKey(), 'salt', 32);
    const [ivHex, encrypted] = encryptedSecret.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    
    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  /**
   * Gera hash SHA-256 de backup code
   */
  private hashBackupCode(code: string): string {
    return crypto.createHash('sha256').update(code).digest('hex');
  }

  /**
   * Gera setup inicial de 2FA para usuário
   */
  async setupTwoFactor(userId: number, userEmail: string): Promise<TwoFactorSetup> {
    try {
      await logInfo('Iniciando setup de 2FA', { userId });

      // Gerar secret TOTP
      const secret = speakeasy.generateSecret({
        name: `Smart Signage (${userEmail})`,
        issuer: 'Smart Signage Pro',
        length: 32,
      });

      // Gerar QR Code
      const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url || '');

      // Gerar backup codes (10 códigos de 8 dígitos)
      const backupCodes: string[] = [];
      const hashedBackupCodes: string[] = [];
      
      for (let i = 0; i < 10; i++) {
        const code = crypto.randomBytes(4).toString('hex').substring(0, 8).toUpperCase();
        backupCodes.push(code);
        hashedBackupCodes.push(this.hashBackupCode(code));
      }

      // Criptografar secret
      const encryptedSecret = this.encryptSecret(secret.base32 || '');

      // Salvar no banco (ainda não habilitado)
      await this.db.executeRaw(`
        INSERT INTO user_two_factor (user_id, secret, enabled, backup_codes)
        VALUES ($1, $2, false, $3)
        ON CONFLICT (user_id) 
        DO UPDATE SET 
          secret = EXCLUDED.secret,
          backup_codes = EXCLUDED.backup_codes,
          updated_at = CURRENT_TIMESTAMP
      `, [userId, encryptedSecret, hashedBackupCodes]);

      await logInfo('Setup de 2FA criado com sucesso', { userId });

      return {
        secret: secret.base32 || '',
        qrCodeUrl,
        backupCodes,
      };} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('Erro ao criar setup de 2FA', e.error, { userId });
      throw e.error;
    }
  }

  /**
   * Verifica código TOTP ou backup code
   */
  async verifyTwoFactor(userId: number, code: string, ipAddress?: string, userAgent?: string): Promise<TwoFactorVerification> {
    try {
      await logDebug('Verificando código 2FA', { userId, codeLength: code.length });

      // Buscar configuração 2FA do usuário
      const twoFactorConfig = await this.db.findFirst(`
        SELECT secret, enabled, backup_codes
        FROM user_two_factor
        WHERE user_id = $1 AND enabled = true
      `, [userId]);

      if (!twoFactorConfig) {
        await logWarn('2FA não configurado ou desabilitado', { userId });
        return { success: false, error: '2FA não está habilitado para este usuário' };
      }

      // Descriptografar secret
      const decryptedSecret = this.decryptSecret(twoFactorConfig.secret);

      // Verificar se é código TOTP (6 dígitos)
      if (code.length === 6 && /^\d+$/.test(code)) {
        const verified = speakeasy.totp.verify({
          secret: decryptedSecret,
          encoding: 'base32',
          token: code,
          window: 2, // Aceitar códigos com 2 períodos de tolerância (60 segundos)
        });

        if (verified) {
          // Atualizar last_used_at
          await this.db.executeRaw(`
            UPDATE user_two_factor
            SET last_used_at = CURRENT_TIMESTAMP
            WHERE user_id = $1
          `, [userId]);

          // Registrar tentativa bem-sucedida
          await this.recordAttempt(userId, code, true, ipAddress, userAgent);

          await logInfo('Código TOTP verificado com sucesso', { userId });
          return { success: true };
        }
      }

      // Verificar se é backup code (8 caracteres alfanuméricos)
      if (code.length === 8 && /^[A-Z0-9]+$/.test(code)) {
        const hashedCode = this.hashBackupCode(code);
        const backupCodes = twoFactorConfig.backup_codes || [];

        if (backupCodes.includes(hashedCode)) {
          // Remover backup code usado
          const updatedBackupCodes = backupCodes.filter((bc: string) => bc !== hashedCode);
          
          await this.db.executeRaw(`
            UPDATE user_two_factor
            SET backup_codes = $1, last_used_at = CURRENT_TIMESTAMP
            WHERE user_id = $2
          `, [updatedBackupCodes, userId]);

          // Registrar tentativa bem-sucedida
          await this.recordAttempt(userId, code, true, ipAddress, userAgent);

          await logInfo('Backup code verificado com sucesso', { userId });
          return { success: true };
        }
      }

      // Registrar tentativa falhada
      await this.recordAttempt(userId, code, false, ipAddress, userAgent);

      await logWarn('Código 2FA inválido', { userId });
      return {
        success: false, error: 'Código inválido' };} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('Erro ao verificar código 2FA', e.error, { userId });
      return { success: false, error: 'Erro ao verificar código' };
    }
  }

  /**
   * Habilita 2FA após verificação inicial
   */
  async enableTwoFactor(userId: number, verificationCode: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Verificar código antes de habilitar
      const verification = await this.verifyTwoFactor(userId, verificationCode);
      
      if (!verification.success) {
        return { success: false, error: verification.error || 'Código de verificação inválido' };
      }

      // Habilitar 2FA
      await this.db.executeRaw(`
        UPDATE user_two_factor
        SET enabled = true, updated_at = CURRENT_TIMESTAMP
        WHERE user_id = $1
      `, [userId]);

      await logInfo('2FA habilitado com sucesso', { userId });
      return {
        success: true };} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('Erro ao habilitar 2FA', e.error, { userId });
      return { success: false, error: 'Erro ao habilitar 2FA' };
    }
  }

  /**
   * Desabilita 2FA
   */
  async disableTwoFactor(userId: number): Promise<{ success: boolean; error?: string }> {
    try {
      await this.db.executeRaw(`
        UPDATE user_two_factor
        SET enabled = false, updated_at = CURRENT_TIMESTAMP
        WHERE user_id = $1
      `, [userId]);

      await logInfo('2FA desabilitado', { userId });
      return {
        success: true };} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('Erro ao desabilitar 2FA', e.error, { userId });
      return { success: false, error: 'Erro ao desabilitar 2FA' };
    }
  }

  /**
   * Verifica se usuário tem 2FA habilitado
   */
  async isTwoFactorEnabled(userId: number): Promise<boolean> {
    try {
      const result = await this.db.findFirst(`
        SELECT enabled
        FROM user_two_factor
        WHERE user_id = $1
      `, [userId]);

      return result?.enabled === true;} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('Erro ao verificar status 2FA', e.error, { userId });
      return false;
    }
  }

  /**
   * Gera novos backup codes
   */
  async regenerateBackupCodes(userId: number): Promise<string[]> {
    try {
      const backupCodes: string[] = [];
      const hashedBackupCodes: string[] = [];
      
      for (let i = 0; i < 10; i++) {
        const code = crypto.randomBytes(4).toString('hex').substring(0, 8).toUpperCase();
        backupCodes.push(code);
        hashedBackupCodes.push(this.hashBackupCode(code));
      }

      await this.db.executeRaw(`
        UPDATE user_two_factor
        SET backup_codes = $1, updated_at = CURRENT_TIMESTAMP
        WHERE user_id = $2
      `, [hashedBackupCodes, userId]);

      await logInfo('Backup codes regenerados', { userId });
      return backupCodes;} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('Erro ao regenerar backup codes', e.error, { userId });
      throw e.error;
    }
  }

  /**
   * Registra tentativa de verificação (para auditoria)
   */
  private async recordAttempt(
    userId: number,
    code: string,
    success: boolean,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    try {
      await this.db.executeRaw(`
        INSERT INTO two_factor_attempts (user_id, code, ip_address, user_agent, success)
        VALUES ($1, $2, $3, $4, $5)
      `, [userId, code.substring(0, 8), ipAddress, userAgent, success]);

      // Limpar tentativas antigas (manter apenas últimos 30 dias)
      await this.db.executeRaw(`
        DELETE FROM two_factor_attempts
        WHERE created_at < NOW() - INTERVAL '30 days'
      `);} catch (error: unknown) {
      const e = normalizeError(error);
      // Não falhar se não conseguir registrar tentativa
      await logWarn('Erro ao registrar tentativa 2FA', { userId, error: e.message });
    }
  }

  /**
   * Obtém estatísticas de 2FA para usuário
   */
  async getTwoFactorStats(userId: number): Promise<{
    enabled: boolean;
    lastUsedAt?: string;
    backupCodesRemaining: number;
    recentAttempts: number;
  }> {
    try {
      const config = await this.db.findFirst(`
        SELECT enabled, last_used_at, backup_codes
        FROM user_two_factor
        WHERE user_id = $1
      `, [userId]);

      if (!config) {
        return {
          enabled: false,
          backupCodesRemaining: 0,
          recentAttempts: 0,
        };
      }

      // Contar tentativas recentes (últimas 24 horas)
      const recentAttempts = await this.db.findFirst(`
        SELECT COUNT(*) as count
        FROM two_factor_attempts
        WHERE user_id = $1 AND created_at > NOW() - INTERVAL '24 hours'
      `, [userId]);

      return {
        enabled: config.enabled === true,
        lastUsedAt: config.last_used_at ? new Date(config.last_used_at).toISOString() : undefined,
        backupCodesRemaining: (config.backup_codes || []).length,
        recentAttempts: parseInt(recentAttempts?.count || '0', 10),
      };} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('Erro ao obter estatísticas 2FA', e.error, { userId });
      throw e.error;
    }
  }
}

// Singleton instance
let twoFactorServiceInstance: TwoFactorService | null = null;

export function getTwoFactorService(): TwoFactorService {
  if (!twoFactorServiceInstance) {
    twoFactorServiceInstance = new TwoFactorService();
  }
  return twoFactorServiceInstance;
}

