/**
 * Media Config - Smart Signage v2.1
 * Configurações de mídia lidas dinamicamente do banco de dados
 */

import { SettingsService } from '../services/settingsService';

let settingsServiceInstance: SettingsService | null = null;

function getSettingsService(): SettingsService {
  if (!settingsServiceInstance) {
    settingsServiceInstance = new SettingsService();
  }
  return settingsServiceInstance;
}

/**
 * Cache de configurações (atualizado quando necessário)
 */
let configCache: {
  maxSize: number;
  nginxMaxSize: string;
  expressLimit: string;
  proxyTimeout: number;
  allowedTypes: string[];
  storagePath: string;
  quotaPerClient: number;
  autoCleanup: boolean;
  cleanupDays: number;
  lastUpdated: number;
} | null = null;

const CACHE_TTL = 60000; // 1 minuto

/**
 * Converte tamanho de string (ex: "500MB") para bytes
 */
function parseSize(sizeStr: string): number {
  const match = sizeStr.match(/^(\d+(?:\.\d+)?)\s*(B|KB|MB|GB|TB)$/i);
  if (!match) {
    return 500 * 1024 * 1024; // Default 500MB
  }

  const value = parseFloat(match[1]);
  const unit = match[2].toUpperCase();

  const multipliers: { [key: string]: number } = {
    'B': 1,
    'KB': 1024,
    'MB': 1024 * 1024,
    'GB': 1024 * 1024 * 1024,
    'TB': 1024 * 1024 * 1024 * 1024
  };

  return Math.floor(value * (multipliers[unit] || 1024 * 1024));
}

/**
 * Converte tamanho para formato Nginx (ex: "500M")
 */
function convertToNginxFormat(sizeStr: string): string {
  const match = sizeStr.match(/^(\d+(?:\.\d+)?)\s*(B|KB|MB|GB|TB)$/i);
  if (!match) {
    return '500M'; // Default
  }

  const value = parseFloat(match[1]);
  const unit = match[2].toUpperCase();

  const nginxUnits: { [key: string]: string } = {
    'B': 'B',
    'KB': 'K',
    'MB': 'M',
    'GB': 'G',
    'TB': 'T'
  };

  return `${Math.floor(value)}${nginxUnits[unit] || 'M'}`;
}

/**
 * Converte tamanho para formato Express (ex: "500mb")
 */
function convertToExpressFormat(sizeStr: string): string {
  const match = sizeStr.match(/^(\d+(?:\.\d+)?)\s*(B|KB|MB|GB|TB)$/i);
  if (!match) {
    return '500mb'; // Default
  }

  const value = parseFloat(match[1]);
  const unit = match[2].toUpperCase();

  const expressUnits: { [key: string]: string } = {
    'B': 'b',
    'KB': 'kb',
    'MB': 'mb',
    'GB': 'gb',
    'TB': 'tb'
  };

  return `${Math.floor(value)}${expressUnits[unit] || 'mb'}`;
}

/**
 * Carrega configurações de mídia do banco de dados
 */
export async function loadMediaConfig(): Promise<void> {
  try {
    const settingsService = getSettingsService();
    
    const [
      maxSizeSetting,
      nginxMaxSizeSetting,
      expressLimitSetting,
      proxyTimeoutSetting,
      allowedTypesSetting,
      storagePathSetting,
      quotaPerClientSetting,
      autoCleanupSetting,
      cleanupDaysSetting
    ] = await Promise.all([
      settingsService.getSetting('media.upload.max_size'),
      settingsService.getSetting('media.upload.nginx_max_size'),
      settingsService.getSetting('media.upload.express_limit'),
      settingsService.getSetting('media.upload.proxy_timeout'),
      settingsService.getSetting('media.upload.allowed_types'),
      settingsService.getSetting('media.storage.path'),
      settingsService.getSetting('media.storage.quota_per_client'),
      settingsService.getSetting('media.storage.auto_cleanup'),
      settingsService.getSetting('media.storage.cleanup_days')
    ]);

    const maxSize = maxSizeSetting ? parseSize(String(maxSizeSetting.value)) : 500 * 1024 * 1024;
    const nginxMaxSize = nginxMaxSizeSetting ? String(nginxMaxSizeSetting.value) : '500M';
    const expressLimit = expressLimitSetting ? String(expressLimitSetting.value) : '500mb';
    const proxyTimeout = proxyTimeoutSetting ? parseInt(String(proxyTimeoutSetting.value)) : 300;
    const allowedTypes = allowedTypesSetting 
      ? String(allowedTypesSetting.value).split(',').map(t => t.trim())
      : ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/webm', 'video/ogg', 'audio/mp3', 'audio/wav', 'audio/ogg'];
    const storagePath = storagePathSetting ? String(storagePathSetting.value) : '/opt/smart-signage/public/assets/uploads';
    const quotaPerClient = quotaPerClientSetting ? parseSize(String(quotaPerClientSetting.value)) : 5 * 1024 * 1024 * 1024;
    const autoCleanup = autoCleanupSetting ? String(autoCleanupSetting.value) === 'true' : false;
    const cleanupDays = cleanupDaysSetting ? parseInt(String(cleanupDaysSetting.value)) : 90;

    configCache = {
      maxSize,
      nginxMaxSize: convertToNginxFormat(nginxMaxSize),
      expressLimit: convertToExpressFormat(expressLimit),
      proxyTimeout,
      allowedTypes,
      storagePath,
      quotaPerClient,
      autoCleanup,
      cleanupDays,
      lastUpdated: Date.now()
    };

    console.log('✅ Configurações de mídia carregadas do banco de dados');
  } catch (error: any) {
    console.error('❌ Erro ao carregar configurações de mídia:', error.message);
    // Usar valores padrão em caso de erro
    configCache = {
      maxSize: 500 * 1024 * 1024,
      nginxMaxSize: '500M',
      expressLimit: '500mb',
      proxyTimeout: 300,
      allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/webm', 'video/ogg', 'audio/mp3', 'audio/wav', 'audio/ogg'],
      storagePath: '/opt/smart-signage/public/assets/uploads',
      quotaPerClient: 5 * 1024 * 1024 * 1024,
      autoCleanup: false,
      cleanupDays: 90,
      lastUpdated: Date.now()
    };
  }
}

/**
 * Obtém configurações de mídia (com cache)
 */
export function getMediaConfig() {
  // Se cache expirou ou não existe, recarregar
  if (!configCache || (Date.now() - configCache.lastUpdated) > CACHE_TTL) {
    // Carregar de forma assíncrona (não bloquear)
    loadMediaConfig().catch(err => {
      console.error('❌ Erro ao recarregar configurações de mídia:', err);
    });
  }

  // Retornar cache atual ou valores padrão
  return configCache || {
    maxSize: 500 * 1024 * 1024,
    nginxMaxSize: '500M',
    expressLimit: '500mb',
    proxyTimeout: 300,
    allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/webm', 'video/ogg', 'audio/mp3', 'audio/wav', 'audio/ogg'],
    storagePath: '/opt/smart-signage/public/assets/uploads',
    quotaPerClient: 5 * 1024 * 1024 * 1024,
    autoCleanup: false,
    cleanupDays: 90,
    lastUpdated: Date.now()
  };
}

/**
 * Força recarregamento das configurações (chamado após atualização)
 */
export async function reloadMediaConfig(): Promise<void> {
  await loadMediaConfig();
}

/**
 * Obtém limite de tamanho de arquivo em bytes
 */
export function getMaxFileSize(): number {
  return getMediaConfig().maxSize;
}

/**
 * Obtém limite do Express em formato string
 */
export function getExpressLimit(): string {
  return getMediaConfig().expressLimit;
}

/**
 * Obtém tipos MIME permitidos
 */
export function getAllowedMimeTypes(): string[] {
  return getMediaConfig().allowedTypes;
}

/**
 * Obtém caminho de armazenamento
 */
export function getStoragePath(): string {
  return getMediaConfig().storagePath;
}

