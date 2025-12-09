import crypto from 'crypto';
import { logErrorSync } from './loggerHelper';

// Chave secreta para encriptação (deve estar no .env em produção)
const TOTEM_SECRET_KEY = process.env.TOTEM_SECRET_KEY || 'smart-signage-totem-secret-key-2025-change-in-production';

interface PlayerConfig {
  encrypted: boolean;
  version: string;
  data: string;
  mac: string;
  created: string;
}

/**
 * Desencriptar configuração do player e validar vinculação ao hardware
 */
export function decryptPlayerConfig(encryptedConfig: PlayerConfig, currentMacAddress: string): { uin: string; mac: string; timestamp: number } | null {
  try {
    if (!encryptedConfig.encrypted || !encryptedConfig.data) {
      return null;
    }

    // TODO: Implementar desencriptação real usando OpenSSL via child_process
    // Por ora, apenas validar estrutura básica no futuro
    
    return null; // Retornar null por enquanto - será implementado com OpenSSL via child_process
  } catch (error) {
    logErrorSync('Erro ao desencriptar configuração do player', error, {
      currentMacAddress
    });
    return null;
  }
}

/**
 * Validar MAC address do hardware
 */
export function validateMacAddress(configMac: string, currentMac: string): boolean {
  if (!configMac || !currentMac) return false;
  
  // Normalizar MAC addresses (remover espaços, converter para minúsculas)
  const normalizedConfigMac = configMac.toLowerCase().replace(/[^0-9a-f:]/g, '');
  const normalizedCurrentMac = currentMac.toLowerCase().replace(/[^0-9a-f:]/g, '');
  
  return normalizedConfigMac === normalizedCurrentMac;
}

/**
 * Encriptar UIN vinculado ao hardware (para uso em scripts)
 */
export function encryptUinForHardware(uin: string, macAddress: string): string {
  const timestamp = Date.now();
  const payload = `${uin}:${macAddress}:${timestamp}`;
  
  // Usar AES-256-CBC com chave derivada
  const key = crypto.scryptSync(TOTEM_SECRET_KEY, 'salt', 32);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  
  let encrypted = cipher.update(payload, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  
  return `${iv.toString('base64')}:${encrypted}`;
}

