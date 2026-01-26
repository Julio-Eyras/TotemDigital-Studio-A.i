/**
 * Dispatcher Debug Service
 * Serviço para debug online do dispatcher, Redis, queries SQL e mensagens
 */

import { getRedisClient, testRedisConnection } from '../config/redis';
import { redisConfig } from '../config/env';
import { getCacheService } from './cacheService';

export interface RedisStatus {
  enabled: boolean;
  connected: boolean;
  error?: string;
  config: {
    host: string;
    port: number;
    db: number;
    url?: string;
  };
  cacheServiceAvailable: boolean;
  lastCheck: Date;
}

export interface QueryLog {
  id: string;
  timestamp: Date;
  query: string;
  params?: any[];
  duration?: number;
  rowCount?: number;
  error?: string;
  source?: string; // 'dispatcher', 'totem', etc.
}

export interface DispatcherMessage {
  id: string;
  timestamp: Date;
  direction: 'incoming' | 'outgoing';
  totemId?: number;
  uin?: string;
  endpoint?: string;
  method?: string;
  request?: any;
  response?: any;
  duration?: number;
  fromCache?: boolean;
  error?: string;
  ipAddress?: string;
  userAgent?: string;
  statusCode?: number;
}

export interface DebugLog {
  id: string;
  timestamp: Date;
  type: 'redis' | 'query' | 'message' | 'cache';
  data: any;
}

class DispatcherDebugService {
  private queryLogs: QueryLog[] = [];
  private messageLogs: DispatcherMessage[] = [];
  private debugLogs: DebugLog[] = [];
  private maxLogs = 1000; // Limite de logs em memória

  /**
   * Obter status do Redis
   */
  async getRedisStatus(): Promise<RedisStatus> {
    const cacheService = getCacheService();
    let connected = false;
    let error: string | undefined;

    try {
      if (redisConfig.enabled) {
        connected = await testRedisConnection();
        if (!connected) {
          const client = getRedisClient();
          if (client) {
            try {
              await client.ping();
              connected = true;
            } catch (e: any) {
              error = e.message || 'Erro ao conectar ao Redis';
            }
          } else {
            error = 'Cliente Redis não inicializado';
          }
        }
      }
    } catch (e: any) {
      error = e.message || 'Erro ao verificar Redis';
      connected = false;
    }

    return {
      enabled: redisConfig.enabled,
      connected,
      error,
      config: {
        host: redisConfig.host,
        port: redisConfig.port,
        db: redisConfig.db,
        url: redisConfig.url,
      },
      cacheServiceAvailable: cacheService.isAvailable(),
      lastCheck: new Date(),
    };
  }

  /**
   * Registrar query SQL
   */
  logQuery(query: string, params?: any[], duration?: number, rowCount?: number, error?: string, source?: string): void {
    const log: QueryLog = {
      id: `query-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      timestamp: new Date(),
      query,
      params,
      duration,
      rowCount,
      error,
      source,
    };

    this.queryLogs.unshift(log);
    if (this.queryLogs.length > this.maxLogs) {
      this.queryLogs = this.queryLogs.slice(0, this.maxLogs);
    }

    // Também adicionar ao debugLogs
    this.addDebugLog('query', log);
  }

  /**
   * Registrar mensagem do dispatcher
   */
  logMessage(
    direction: 'incoming' | 'outgoing',
    data: {
      totemId?: number;
      uin?: string;
      endpoint?: string;
      method?: string;
      request?: any;
      response?: any;
      duration?: number;
      fromCache?: boolean;
      error?: string;
      ipAddress?: string;
      userAgent?: string;
      statusCode?: number;
    }
  ): void {
    const message: DispatcherMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      timestamp: new Date(),
      direction,
      ...data,
    };

    this.messageLogs.unshift(message);
    if (this.messageLogs.length > this.maxLogs) {
      this.messageLogs = this.messageLogs.slice(0, this.maxLogs);
    }

    // Também adicionar ao debugLogs
    this.addDebugLog('message', message);

    // Broadcast via WebSocket para monitoramento em tempo real
    this.broadcastMessage(message);
  }

  /**
   * Broadcast mensagem via WebSocket para clientes conectados
   */
  private broadcastMessage(message: DispatcherMessage): void {
    try {
      const { getWebSocketService } = require('./websocketService');
      const wsService = getWebSocketService();
      if (wsService && typeof wsService.broadcast === 'function') {
        wsService.broadcast({
          type: 'dispatcher-message',
          data: message
        });
      }
    } catch (error) {
      // Falha silenciosa - WebSocket pode não estar disponível
    }
  }

  /**
   * Adicionar log de debug genérico
   */
  addDebugLog(type: 'redis' | 'query' | 'message' | 'cache', data: any): void {
    const log: DebugLog = {
      id: `debug-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      timestamp: new Date(),
      type,
      data,
    };

    this.debugLogs.unshift(log);
    if (this.debugLogs.length > this.maxLogs) {
      this.debugLogs = this.debugLogs.slice(0, this.maxLogs);
    }
  }

  /**
   * Obter logs de queries
   */
  getQueryLogs(limit: number = 100, since?: Date): QueryLog[] {
    let logs = this.queryLogs;
    if (since) {
      logs = logs.filter(log => log.timestamp >= since);
    }
    return logs.slice(0, limit);
  }

  /**
   * Obter logs de mensagens
   */
  getMessageLogs(limit: number = 100, since?: Date, totemId?: number, uin?: string): DispatcherMessage[] {
    let logs = this.messageLogs;
    if (since) {
      logs = logs.filter(log => log.timestamp >= since);
    }
    if (totemId) {
      logs = logs.filter(log => log.totemId === totemId);
    }
    if (uin) {
      logs = logs.filter(log => log.uin === uin);
    }
    return logs.slice(0, limit);
  }

  /**
   * Obter todos os logs de debug
   */
  getDebugLogs(limit: number = 200, since?: Date, type?: 'redis' | 'query' | 'message' | 'cache'): DebugLog[] {
    let logs = this.debugLogs;
    if (since) {
      logs = logs.filter(log => log.timestamp >= since);
    }
    if (type) {
      logs = logs.filter(log => log.type === type);
    }
    return logs.slice(0, limit);
  }

  /**
   * Limpar logs antigos
   */
  clearLogs(olderThan?: Date): void {
    if (olderThan) {
      this.queryLogs = this.queryLogs.filter(log => log.timestamp >= olderThan);
      this.messageLogs = this.messageLogs.filter(log => log.timestamp >= olderThan);
      this.debugLogs = this.debugLogs.filter(log => log.timestamp >= olderThan);
    } else {
      this.queryLogs = [];
      this.messageLogs = [];
      this.debugLogs = [];
    }
  }

  /**
   * Obter estatísticas
   */
  getStats(): {
    totalQueries: number;
    totalMessages: number;
    totalDebugLogs: number;
    queriesWithError: number;
    messagesWithError: number;
    avgQueryDuration: number;
    avgMessageDuration: number;
  } {
    const queriesWithError = this.queryLogs.filter(q => q.error).length;
    const messagesWithError = this.messageLogs.filter(m => m.error).length;
    
    const queriesWithDuration = this.queryLogs.filter(q => q.duration !== undefined);
    const avgQueryDuration = queriesWithDuration.length > 0
      ? queriesWithDuration.reduce((sum, q) => sum + (q.duration || 0), 0) / queriesWithDuration.length
      : 0;

    const messagesWithDuration = this.messageLogs.filter(m => m.duration !== undefined);
    const avgMessageDuration = messagesWithDuration.length > 0
      ? messagesWithDuration.reduce((sum, m) => sum + (m.duration || 0), 0) / messagesWithDuration.length
      : 0;

    return {
      totalQueries: this.queryLogs.length,
      totalMessages: this.messageLogs.length,
      totalDebugLogs: this.debugLogs.length,
      queriesWithError,
      messagesWithError,
      avgQueryDuration: Math.round(avgQueryDuration),
      avgMessageDuration: Math.round(avgMessageDuration),
    };
  }
}

export const dispatcherDebugService = new DispatcherDebugService();
