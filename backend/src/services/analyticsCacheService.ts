/**
 * Analytics Cache Service - Smart Signage Pro v3.1
 * Serviço de cache para queries de analytics frequentes usando Redis
 */

import { getRedisClient } from '../config/redis';
import { logInfo, logError, logDebug } from '../utils/loggerHelper';

export interface CacheOptions {
  ttl?: number; // Time to live em segundos
  key: string;
  tags?: string[]; // Tags para invalidação em grupo
}

export class AnalyticsCacheService {
  private get redis() {
    return getRedisClient();
  }
  private defaultTTL = 300; // 5 minutos padrão

  /**
   * Obtém valor do cache
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      if (!this.redis) {
        return null;
      }
      const cached = await this.redis.get(key);
      if (cached) {
        await logDebug('Cache hit', { key });
        return JSON.parse(cached) as T;
      }
      await logDebug('Cache miss', { key });
      return null;
    } catch (error: any) {
      await logError('Erro ao buscar do cache', error, { key });
      return null;
    }
  }

  /**
   * Armazena valor no cache
   */
  async set<T>(key: string, value: T, ttl: number = this.defaultTTL): Promise<void> {
    try {
      if (!this.redis) {
        return;
      }
      const serialized = JSON.stringify(value);
      await this.redis.setex(key, ttl, serialized);
      await logDebug('Valor armazenado no cache', { key, ttl });
    } catch (error: any) {
      await logError('Erro ao armazenar no cache', error, { key });
    }
  }

  /**
   * Remove valor do cache
   */
  async delete(key: string): Promise<void> {
    try {
      if (!this.redis) {
        return;
      }
      await this.redis.del(key);
      await logDebug('Valor removido do cache', { key });
    } catch (error: any) {
      await logError('Erro ao remover do cache', error, { key });
    }
  }

  /**
   * Remove múltiplas chaves do cache (por padrão)
   */
  async deletePattern(pattern: string): Promise<void> {
    try {
      if (!this.redis) {
        return;
      }
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
        await logDebug('Chaves removidas do cache', { pattern, count: keys.length });
      }
    } catch (error: any) {
      await logError('Erro ao remover padrão do cache', error, { pattern });
    }
  }

  /**
   * Gera chave de cache para analytics overview
   */
  getOverviewKey(clientId?: number, startDate?: string, endDate?: string): string {
    const parts = ['analytics', 'overview'];
    if (clientId) parts.push(`client:${clientId}`);
    if (startDate) parts.push(`start:${startDate}`);
    if (endDate) parts.push(`end:${endDate}`);
    return parts.join(':');
  }

  /**
   * Gera chave de cache para estatísticas de totens
   */
  getTotemsStatsKey(clientId?: number, status?: string): string {
    const parts = ['analytics', 'totems'];
    if (clientId) parts.push(`client:${clientId}`);
    if (status) parts.push(`status:${status}`);
    return parts.join(':');
  }

  /**
   * Gera chave de cache para estatísticas de mídia
   */
  getMediaStatsKey(clientId?: number, type?: string): string {
    const parts = ['analytics', 'media'];
    if (clientId) parts.push(`client:${clientId}`);
    if (type) parts.push(`type:${type}`);
    return parts.join(':');
  }

  /**
   * Gera chave de cache para estatísticas de campanhas
   */
  getCampaignsStatsKey(clientId?: number, status?: string): string {
    const parts = ['analytics', 'campaigns'];
    if (clientId) parts.push(`client:${clientId}`);
    if (status) parts.push(`status:${status}`);
    return parts.join(':');
  }

  /**
   * Invalida cache relacionado a um cliente
   */
  async invalidateClientCache(clientId: number): Promise<void> {
    await this.deletePattern(`analytics:*:client:${clientId}*`);
    await logInfo('Cache do cliente invalidado', { clientId });
  }

  /**
   * Invalida cache relacionado a totens
   */
  async invalidateTotemsCache(clientId?: number): Promise<void> {
    if (clientId) {
      await this.deletePattern(`analytics:totems:client:${clientId}*`);
    } else {
      await this.deletePattern('analytics:totems:*');
    }
    await logInfo('Cache de totens invalidado', { clientId });
  }

  /**
   * Invalida cache relacionado a mídia
   */
  async invalidateMediaCache(clientId?: number): Promise<void> {
    if (clientId) {
      await this.deletePattern(`analytics:media:client:${clientId}*`);
    } else {
      await this.deletePattern('analytics:media:*');
    }
    await logInfo('Cache de mídia invalidado', { clientId });
  }

  /**
   * Invalida cache relacionado a campanhas
   */
  async invalidateCampaignsCache(clientId?: number): Promise<void> {
    if (clientId) {
      await this.deletePattern(`analytics:campaigns:client:${clientId}*`);
    } else {
      await this.deletePattern('analytics:campaigns:*');
    }
    await logInfo('Cache de campanhas invalidado', { clientId });
  }

  /**
   * Obtém ou calcula valor (cache-aside pattern)
   */
  async getOrSet<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttl: number = this.defaultTTL
  ): Promise<T> {
    try {
      // Tentar obter do cache
      const cached = await this.get<T>(key);
      if (cached !== null) {
        return cached;
      }

      // Cache miss - buscar e armazenar
      const value = await fetcher();
      await this.set(key, value, ttl);
      return value;
    } catch (error: any) {
      await logError('Erro no getOrSet', error, { key });
      // Em caso de erro no cache, retornar valor direto
      return await fetcher();
    }
  }

  /**
   * Obtém estatísticas do cache
   */
  async getCacheStats(): Promise<{
    hitRate: number;
    totalKeys: number;
    memoryUsage: string;
  }> {
    try {
      if (!this.redis) {
        return {
          hitRate: 0,
          totalKeys: 0,
          memoryUsage: 'Redis desabilitado'
        };
      }
      await this.redis.info('stats');
      await this.redis.info('keyspace');
      
      // Parsear informações (simplificado)
      const stats = {
        hitRate: 0,
        totalKeys: 0,
        memoryUsage: 'N/A'
      };

      // Contar chaves
      const allKeys = await this.redis.keys('analytics:*');
      stats.totalKeys = allKeys.length;

      return stats;
    } catch (error: any) {
      await logError('Erro ao obter estatísticas do cache', error, {});
      return {
        hitRate: 0,
        totalKeys: 0,
        memoryUsage: 'N/A'
      };
    }
  }
}

// Singleton
let analyticsCacheServiceInstance: AnalyticsCacheService | null = null;

export function getAnalyticsCacheService(): AnalyticsCacheService {
  if (!analyticsCacheServiceInstance) {
    analyticsCacheServiceInstance = new AnalyticsCacheService();
  }
  return analyticsCacheServiceInstance;
}

