/**
 * Logger Helper - Smart Signage v2.1
 * Helper para facilitar uso do logger em serviços
 * 
 * Estratégia:
 * - Arquivos locais: logs operacionais (erro, debug, execução)
 * - Banco de dados: eventos importantes (via EventLogService)
 */

import { getLogger } from '../config/logger';

/**
 * Campos sensíveis que devem ser removidos dos logs
 */
const SENSITIVE_FIELDS = [
  'password',
  'token',
  'apiKey',
  'api_key',
  'secret',
  'secretKey',
  'secret_key',
  'authorization',
  'auth',
  'accessToken',
  'access_token',
  'refreshToken',
  'refresh_token',
  'privateKey',
  'private_key',
  'sessionId',
  'session_id',
  'cookie',
  'cookies'
];

/**
 * Sanitiza objeto removendo campos sensíveis antes de logar
 */
export function sanitizeForLogging<T>(data: T): T | string | number | boolean | null | undefined {
  if (data == null || typeof data !== 'object') {
    return data;
  }

  if (Array.isArray(data)) {
    return (data as unknown[]).map(item => sanitizeForLogging(item)) as unknown as T;
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    const lowerKey = key.toLowerCase();
    if (SENSITIVE_FIELDS.some(field => lowerKey.includes(field))) {
      sanitized[key] = '[REDACTED]';
    } else if (value != null && typeof value === 'object') {
      sanitized[key] = sanitizeForLogging(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized as unknown as T;
}

// Cache do logger para evitar múltiplas inicializações
let loggerCache: Awaited<ReturnType<typeof getLogger>> | null = null;

/**
 * Obtém instância do logger (com cache)
 */
async function getCachedLogger() {
  if (!loggerCache) {
    loggerCache = await getLogger();
  }
  return loggerCache;
}

/**
 * Log de informação (arquivo local)
 */
export async function logInfo(message: string, meta?: unknown): Promise<void> {
  try {
    const logger = await getCachedLogger();
    logger.info(message, meta);
} catch (error: unknown) {
    // Fallback para console se logger não estiver disponível
    console.log(`[INFO] ${message}`, meta || '');
  }
}

/**
 * Log de erro (arquivo local)
 */
export async function logError(message: string, error?: unknown, meta?: unknown): Promise<void> {
  try {
    const logger = await getCachedLogger();
    const errObj = error as Error | undefined;
    const metaObj = (typeof meta === 'object' && meta !== null ? meta : {}) as Record<string, unknown>;
    logger.error(message, { error: errObj?.message || error, stack: errObj?.stack, ...metaObj });
  } catch (err: unknown) {
    // Fallback para console se logger não estiver disponível
    console.error(`[ERROR] ${message}`, error, meta || '');
  }
}

/**
 * Log de aviso (arquivo local)
 */
export async function logWarn(message: string, meta?: unknown): Promise<void> {
  try {
    const logger = await getCachedLogger();
    logger.warn(message, meta);
} catch (error: unknown) {
    // Fallback para console se logger não estiver disponível
    console.warn(`[WARN] ${message}`, meta || '');
  }
}

/**
 * Log de debug (arquivo local)
 */
export async function logDebug(message: string, meta?: unknown): Promise<void> {
  try {
    const logger = await getCachedLogger();
    logger.debug(message, meta);
} catch (error: unknown) {
    // Fallback para console se logger não estiver disponível (apenas em dev)
    if (process.env.NODE_ENV === 'development') {
      console.debug(`[DEBUG] ${message}`, meta || '');
    }
  }
}

/**
 * Log de debug síncrono (para casos onde não pode ser async)
 */
export function logDebugSync(message: string, meta?: unknown): void {
  if (process.env.NODE_ENV === 'development') {
    console.debug(`[DEBUG] ${message}`, meta || '');
  }
  // Tentar logar em background (não esperar)
  getCachedLogger().then(logger => {
    logger.debug(message, meta);
  }).catch(() => {
    // Ignorar erros em background
  });
}

/**
 * Log síncrono (para casos onde não pode ser async)
 * Usa console como fallback e tenta logger em background
 */
export function logInfoSync(message: string, meta?: unknown): void {
  console.log(`[INFO] ${message}`, meta || '');
  // Tentar logar em background (não esperar)
  getCachedLogger().then(logger => {
    logger.info(message, meta);
  }).catch(() => {
    // Ignorar erros em background
  });
}

export function logErrorSync(message: string, error?: unknown, meta?: unknown): void {
  console.error(`[ERROR] ${message}`, error, meta || '');
  // Tentar logar em background (não esperar)
  getCachedLogger().then(logger => {
    const errObj = error as Error | undefined;
    const metaObj = (typeof meta === 'object' && meta !== null ? meta : {}) as Record<string, unknown>;
    logger.error(message, { error: errObj?.message || error, stack: errObj?.stack, ...metaObj });
  }).catch(() => {
    // Ignorar erros em background
  });
}

export function logWarnSync(message: string, meta?: unknown): void {
  console.warn(`[WARN] ${message}`, meta || '');
  // Tentar logar em background (não esperar)
  getCachedLogger().then(logger => {
    logger.warn(message, meta);
  }).catch(() => {
    // Ignorar erros em background
  });
}

