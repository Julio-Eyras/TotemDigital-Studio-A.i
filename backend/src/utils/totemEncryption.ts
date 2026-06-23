import crypto from 'crypto';
import { logErrorSync } from './loggerHelper';
import { getTotemSecretKey } from '../config/totemSecurity';

interface PlayerConfig {
  encrypted: boolean;
  version: string;
  data: string;
  mac: string;
  created: string;
}

/**
 * Desencripta payload no formato OpenSSL:
 * `openssl enc -aes-256-cbc -base64 -salt -pbkdf2 -iter 10000 -k <password>`
 */
export function decryptOpenSslSaltedBase64(encryptedBase64: string, password: string): string {
  const data = Buffer.from(encryptedBase64.trim(), 'base64');
  if (data.length < 17 || data.subarray(0, 8).toString('utf8') !== 'Salted__') {
    throw new Error('Formato de configuração encriptada inválido');
  }
  const salt = data.subarray(8, 16);
  const ciphertext = data.subarray(16);
  const derived = crypto.pbkdf2Sync(password, salt, 10000, 48, 'sha256');
  const key = derived.subarray(0, 32);
  const iv = derived.subarray(32, 48);
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString('utf8');
}

/**
 * Desencriptar configuração do player e validar vinculação ao hardware
 */
export function decryptPlayerConfig(
  encryptedConfig: PlayerConfig,
  currentMacAddress: string
): { uin: string; mac: string; timestamp: number } | null {
  try {
    if (!encryptedConfig.encrypted || !encryptedConfig.data) {
      return null;
    }
    const decrypted = decryptOpenSslSaltedBase64(encryptedConfig.data, getTotemSecretKey());
    const [uin, mac, timestampRaw] = decrypted.split(':');
    if (!uin || uin.length < 3) {
      return null;
    }
    if (mac && currentMacAddress && !validateMacAddress(mac, currentMacAddress)) {
      return null;
    }
    const timestamp = Number(timestampRaw);
    return {
      uin,
      mac: mac || '',
      timestamp: Number.isFinite(timestamp) ? timestamp : 0,
    };
  } catch (error) {
    logErrorSync('Erro ao desencriptar configuração do player', error, {
      currentMacAddress,
    });
    return null;
  }
}

/**
 * Validar MAC address do hardware
 */
export function validateMacAddress(configMac: string, currentMac: string): boolean {
  if (!configMac || !currentMac) return false;

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

  const key = crypto.scryptSync(getTotemSecretKey(), 'salt', 32);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);

  let encrypted = cipher.update(payload, 'utf8', 'base64');
  encrypted += cipher.final('base64');

  return `${iv.toString('base64')}:${encrypted}`;
}
