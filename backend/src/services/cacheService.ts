/**
 * CacheService - Serviço de Cache com Redis
 * 
 * Gerencia cache de queries frequentes, analytics e dados computados
 */

import { getRedisClient } from '../config/redis';
import { logError, logDebug } from '../utils/loggerHelper';
import { normalizeError } from '../utils/errors';

export interface CacheOptions {
  ttl?: number; // Time to live em segundos
  prefix?: string; // Prefixo para chave
  serialize?: boolean; // Serializar objetos complexos
}

export class CacheService {
  private get redis() {
    try {
      return getRedisClient();
    } catch {
      return null;
    }
  }

  /**
   * Obtém valor do cache
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      if (!this.redis) {
        return null;
      }

      const value = await this.redis.get(key);
      if (!value) {
        return null;
      }

      try {
        return JSON.parse(value) as T;
      } catch {
        return value as T;
 
}} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('CacheService.get error', e.error, { key });
      return null;
    }
  }

  /**
   * Define valor no cache
   */
  async set(key: string, value: unknown, ttl?: number): Promise<boolean> {
    try {
      if (!this.redis) {
        return false;
      }

      const serialized = typeof value === 'string' ? value : JSON.stringify(value);
      
      if (ttl) {
        await this.redis.setex(key, ttl, serialized);
      } else {
        await this.redis.set(key, serialized);
      }

      return true;} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('CacheService.set error', e.error, { key });
      return false;
    }
  }

  /**
   * Remove valor do cache
   */
  async delete(key: string): Promise<boolean> {
    try {
      if (!this.redis) {
        return false;
      }

      await this.redis.del(key);
      return true;} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('CacheService.delete error', e.error, { key });
      return false;
    }
  }

  /**
   * Remove múltiplas chaves por padrão
   */
  async deletePattern(pattern: string): Promise<number> {
    try {
      if (!this.redis) {
        return 0;
      }

      const keys = await this.redis.keys(pattern);
      if (keys.length === 0) {
        return 0;
      }

      await this.redis.del(...keys);
      return keys.length;} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('CacheService.deletePattern error', e.error, { pattern });
      return 0;
    }
  }

  /**
   * Obtém ou calcula valor (cache-aside pattern)
   */
  async getOrSet<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    try {
      // Tentar obter do cache
      const cached = await this.get<T>(key);
      if (cached !== null) {
        await logDebug('Cache hit', { key });
        return cached;
      }

      // Cache miss - buscar e armazenar
      await logDebug('Cache miss', { key });
      const value = await fetcher();
      await this.set(key, value, ttl);
      return value;} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('CacheService.getOrSet error', e.error, { key });
      // Em caso de erro no cache, retornar valor direto
      return await fetcher();
    }
  }

  /**
   * Invalida cache relacionado a uma entidade
   */
  async invalidateEntity(entityType: string, entityId?: string | number): Promise<void> {
    try {
      const patterns = [
        `analytics:*`,
        `fx_analytics:*`,
        `${entityType}:*`,
      ];

      if (entityId) {
        patterns.push(`${entityType}:${entityId}:*`);
      }

      for (const pattern of patterns) {
        await this.deletePattern(pattern);
 
}} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('CacheService.invalidateEntity error', e.error, { entityType, entityId });
    }
  }

  /**
   * Gera chave de cache padronizada
   */
  generateKey(prefix: string, ...parts: (string | number | undefined)[]): string {
    const filtered = parts.filter(p => p !== undefined && p !== null);
    return `${prefix}:${filtered.join(':')}`;
  }

  /**
   * Verifica se Redis está disponível
   */
  isAvailable(): boolean {
    return this.redis !== null;
  }
}

let cacheServiceInstance: CacheService | null = null;

export function getCacheService(): CacheService {
  if (!cacheServiceInstance) {
    cacheServiceInstance = new CacheService();
  }
  return cacheServiceInstance;
}
