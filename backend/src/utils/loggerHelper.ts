/**
 * Logger Helper - Smart Signage v2.1
 * Helper para facilitar uso do logger em serviços
 * 
 * Estratégia:
 * - Arquivos locais: logs operacionais (erro, debug, execução)
 * - Banco de dados: eventos importantes (via EventLogService)
 */

import { getLogger } from '../config/logger';

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
export async function logInfo(message: string, meta?: any): Promise<void> {
  try {
    const logger = await getCachedLogger();
    logger.info(message, meta);
  } catch (error) {
    // Fallback para console se logger não estiver disponível
    console.log(`[INFO] ${message}`, meta || '');
  }
}

/**
 * Log de erro (arquivo local)
 */
export async function logError(message: string, error?: any, meta?: any): Promise<void> {
  try {
    const logger = await getCachedLogger();
    logger.error(message, { error: error?.message || error, stack: error?.stack, ...meta });
  } catch (err) {
    // Fallback para console se logger não estiver disponível
    console.error(`[ERROR] ${message}`, error, meta || '');
  }
}

/**
 * Log de aviso (arquivo local)
 */
export async function logWarn(message: string, meta?: any): Promise<void> {
  try {
    const logger = await getCachedLogger();
    logger.warn(message, meta);
  } catch (error) {
    // Fallback para console se logger não estiver disponível
    console.warn(`[WARN] ${message}`, meta || '');
  }
}

/**
 * Log de debug (arquivo local)
 */
export async function logDebug(message: string, meta?: any): Promise<void> {
  try {
    const logger = await getCachedLogger();
    logger.debug(message, meta);
  } catch (error) {
    // Fallback para console se logger não estiver disponível (apenas em dev)
    if (process.env.NODE_ENV === 'development') {
      console.debug(`[DEBUG] ${message}`, meta || '');
    }
  }
}

/**
 * Log de debug síncrono (para casos onde não pode ser async)
 */
export function logDebugSync(message: string, meta?: any): void {
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
export function logInfoSync(message: string, meta?: any): void {
  console.log(`[INFO] ${message}`, meta || '');
  // Tentar logar em background (não esperar)
  getCachedLogger().then(logger => {
    logger.info(message, meta);
  }).catch(() => {
    // Ignorar erros em background
  });
}

export function logErrorSync(message: string, error?: any, meta?: any): void {
  console.error(`[ERROR] ${message}`, error, meta || '');
  // Tentar logar em background (não esperar)
  getCachedLogger().then(logger => {
    logger.error(message, { error: error?.message || error, stack: error?.stack, ...meta });
  }).catch(() => {
    // Ignorar erros em background
  });
}

export function logWarnSync(message: string, meta?: any): void {
  console.warn(`[WARN] ${message}`, meta || '');
  // Tentar logar em background (não esperar)
  getCachedLogger().then(logger => {
    logger.warn(message, meta);
  }).catch(() => {
    // Ignorar erros em background
  });
}

