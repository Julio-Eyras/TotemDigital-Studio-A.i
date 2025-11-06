/**
 * Redis Configuration - Smart Signage v2.1
 * Configuração do Redis para Bull Queue
 */

import Redis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

// Configuração do Redis
const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || undefined,
  db: parseInt(process.env.REDIS_DB || '0'),
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
  if (!redisClient) {
    redisClient = new Redis(redisConfig);
    
    redisClient.on('connect', () => {
      console.log('✅ Redis conectado com sucesso');
    });
    
    redisClient.on('error', (err) => {
      console.error('❌ Erro no Redis:', err.message);
    });
    
    redisClient.on('close', () => {
      console.log('⚠️ Conexão Redis fechada');
    });
    
    redisClient.on('reconnecting', () => {
      console.log('🔄 Reconectando ao Redis...');
    });
  }
  
  return redisClient;
}

/**
 * Obtém cliente Redis
 */
export function getRedisClient(): Redis {
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
    console.log('✅ Redis desconectado');
  }
}

/**
 * Testa conexão com Redis
 */
export async function testRedisConnection(): Promise<boolean> {
  try {
    const client = getRedisClient();
    const result = await client.ping();
    return result === 'PONG';
  } catch (error) {
    console.error('❌ Erro ao testar conexão Redis:', error);
    return false;
  }
}

// Exportar configuração
export const redisConnection = redisConfig;

