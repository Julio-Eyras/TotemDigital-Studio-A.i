/**
 * Two Factor Authentication API - Smart Signage v2.1
 * API client para autenticação de dois fatores
 */

import api from './index';

export interface TwoFactorSetup {
  secret: string;
  qrCodeUrl: string;
  backupCodes: string[];
}

export interface TwoFactorStatus {
  enabled: boolean;
  lastUsedAt?: string;
  backupCodesRemaining: number;
  recentAttempts: number;
}

export const twoFactorApi = {
  /**
   * Inicia setup de 2FA (gera QR code)
   */
  setup: async (): Promise<TwoFactorSetup> => {
    const response = await api.post('/auth/2fa/setup');
    return response.data.data;
  },

  /**
   * Habilita 2FA após verificação do código
   */
  enable: async (code: string): Promise<{ success: boolean; message: string }> => {
    const response = await api.post('/auth/2fa/enable', { code });
    return response.data;
  },

  /**
   * Desabilita 2FA
   */
  disable: async (): Promise<{ success: boolean; message: string }> => {
    const response = await api.post('/auth/2fa/disable');
    return response.data;
  },

  /**
   * Obtém status e estatísticas de 2FA
   */
  getStatus: async (): Promise<TwoFactorStatus> => {
    const response = await api.get('/auth/2fa/status');
    return response.data.data;
  },

  /**
   * Regenera códigos de backup
   */
  regenerateBackupCodes: async (): Promise<{ backupCodes: string[] }> => {
    const response = await api.post('/auth/2fa/regenerate-backup-codes');
    return response.data.data;
  },

  /**
   * Verifica código 2FA após login inicial
   */
  verify: async (userId: number, code: string): Promise<{
    token: string;
    refreshToken: string;
    user: any;
  }> => {
    const response = await api.post('/auth/2fa/verify', { userId, code });
    return response.data;
  },
};

