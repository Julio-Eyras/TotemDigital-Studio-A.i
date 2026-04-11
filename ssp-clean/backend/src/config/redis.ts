/**
 * Redis Configuration - Smart Signage v2.1
 * Configuração do Redis para Bull Queue
 */

import Redis from 'ioredis';
import { logInfoSync, logErrorSync, logWarnSync } from '../utils/loggerHelper';
import { redisConfig as config } from './env';

// Configuração do Redis usando sistema centralizado
const redisConfig = {
  host: config.host,
  port: config.port,
  password: config.password || undefined,
  db: config.db,
  maxRetriesPerRequest: 3,
  retryStrategy: (times: number) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  reconnectOnError: (err: Error) => {
    const targetError = 'READONLY';
    if (err.message.includes(targetError)) {
      return true; // Reconectar se erro de READONLY
    }
    return false;
  },
};

// Cliente Redis para Bull
let redisClient: Redis | null = null;

/**
 * Inicializa conexão com Redis
 */
export function initializeRedis(): Redis {
  // Verificar se Redis está habilitado
  if (!config.enabled) {
    throw new Error('Redis está desabilitado (CACHE_ENABLED=false)');
  }
  
  if (!redisClient) {
    redisClient = new Redis(redisConfig);
    
    redisClient.on('connect', () => {
      logInfoSync('Redis conectado com sucesso', {
        host: redisConfig.host,
        port: redisConfig.port
      });
    });
    
    redisClient.on('error', (err) => {
      logErrorSync('Erro no Redis', err, {
        host: redisConfig.host,
        port: redisConfig.port
      });
    });
    
    redisClient.on('close', () => {
      logWarnSync('Conexão Redis fechada', {
        host: redisConfig.host,
        port: redisConfig.port
      });
    });
    
    redisClient.on('reconnecting', () => {
      logInfoSync('Reconectando ao Redis', {
        host: redisConfig.host,
        port: redisConfig.port
      });
    });
  }
  
  return redisClient;
}

/**
 * Obtém cliente Redis
 */
export function getRedisClient(): Redis | null {
  // Se Redis está desabilitado, retornar null
  if (!config.enabled) {
    return null;
  }
  
  if (!redisClient) {
    return initializeRedis();
  }
  return redisClient;
}

/**
 * Fecha conexão com Redis
 */
export async function closeRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    logInfoSync('Redis desconectado', {});
  }
}

/**
 * Testa conexão com Redis
 */
export async function testRedisConnection(): Promise<boolean> {
  // Se Redis está desabilitado, retornar false
  if (!config.enabled) {
    return false;
  }
  
  try {
    const client = getRedisClient();
    if (!client) {
      return false;
    }
    const result = await client.ping();
    return result === 'PONG';
  } catch (error) {
    logErrorSync('Erro ao testar conexão Redis', error, {
      host: redisConfig.host,
      port: redisConfig.port
    });
    return false;
  }
}

// Exportar configuração
export const redisConnection = redisConfig;

