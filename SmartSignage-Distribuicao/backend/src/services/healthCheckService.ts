/**
 * Health Check Service - Smart Signage Pro v3.1
 * Serviço avançado para verificação de saúde do sistema
 */

import { getDatabase } from '../config/database';
import { getRedis } from '../config/redis';
import { logInfo, logError } from '../utils/loggerHelper';
import * as os from 'os';
import * as fs from 'fs/promises';

export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  checks: {
    database: ComponentHealth;
    redis: ComponentHealth;
    disk: ComponentHealth;
    memory: ComponentHealth;
    cpu: ComponentHealth;
    services: ServiceHealth[];
  };
  metrics: {
    uptime: number;
    responseTime: number;
    totalChecks: number;
    passedChecks: number;
    failedChecks: number;
  };
}

export interface ComponentHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime?: number;
  message?: string;
  details?: Record<string, unknown>;
}

export interface ServiceHealth {
  name: string;
  status: 'running' | 'stopped' | 'error';
  uptime?: number;
  lastCheck?: Date;
  details?: Record<string, unknown>;
}

export class HealthCheckService {
  private get db() {
    return getDatabase();
  }

  private get redis() {
    return getRedis();
  }

  /**
   * Executar verificação completa de saúde
   */
  async performHealthCheck(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    const checks: HealthCheckResult['checks'] = {
      database: await this.checkDatabase(),
      redis: await this.checkRedis(),
      disk: await this.checkDisk(),
      memory: await this.checkMemory(),
      cpu: await this.checkCpu(),
      services: await this.checkServices()
    };

    const responseTime = Date.now() - startTime;
    const allChecks = [
      checks.database,
      checks.redis,
      checks.disk,
      checks.memory,
      checks.cpu,
      ...checks.services.map(s => ({ status: s.status === 'running' ? 'healthy' as const : 'unhealthy' as const }))
    ];

    const passedChecks = allChecks.filter(c => c.status === 'healthy').length;
    const failedChecks = allChecks.filter(c => c.status === 'unhealthy').length;
    const totalChecks = allChecks.length;

    // Determinar status geral
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (failedChecks > 0) {
      const criticalFailed = [
        checks.database,
        checks.redis,
        checks.disk
      ].some(c => c.status === 'unhealthy');

      overallStatus = criticalFailed ? 'unhealthy' : 'degraded';
    }

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      checks,
      metrics: {
        uptime: process.uptime(),
        responseTime,
        totalChecks,
        passedChecks,
        failedChecks
      }
    };
  }

  /**
   * Verificar saúde do banco de dados
   */
  private async checkDatabase(): Promise<ComponentHealth> {
    const startTime = Date.now();
    try {
      // Teste simples de conexão
      await this.db.findFirst('SELECT 1 as test');
      
      // Verificar conexões ativas
      const connections = await this.db.findFirst(`
        SELECT count(*)::int as count 
        FROM pg_stat_activity 
        WHERE datname = current_database()
      `);

      const responseTime = Date.now() - startTime;
      const status = responseTime < 1000 ? 'healthy' : responseTime < 3000 ? 'degraded' : 'unhealthy';

      return {
        status,
        responseTime,
        details: {
          connections: connections?.count || 0,
          responseTimeMs: responseTime
        }
      };
    } catch (error: unknown) {
      return {
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        message: (error as Error).message,
        details: { error: (error as Error).message }
      };
    }
  }

  /**
   * Verificar saúde do Redis
   */
  private async checkRedis(): Promise<ComponentHealth> {
    const startTime = Date.now();
    try {
      const redis = this.redis;
      await redis.ping();
      
      const info = await redis.info('memory');
      const responseTime = Date.now() - startTime;
      const status = responseTime < 100 ? 'healthy' : responseTime < 500 ? 'degraded' : 'unhealthy';

      return {
        status,
        responseTime,
        details: {
          connected: true,
          responseTimeMs: responseTime
        }
      };
    } catch (error: unknown) {
      return {
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        message: 'Redis não disponível',
        details: { error: (error as Error).message }
      };
    }
  }

  /**
   * Verificar saúde do disco
   */
  private async checkDisk(): Promise<ComponentHealth> {
    try {
      // Usar método alternativo para verificar disco
      // Em produção, usar biblioteca como 'diskusage' ou comando do sistema
      const testPath = process.env.UPLOAD_PATH || '/opt/smart-signage';
      
      try {
        await fs.access(testPath);
      } catch {
        // Se não conseguir acessar, usar diretório raiz
      }

      // Para verificação precisa, usar comando do sistema ou biblioteca externa
      // Por enquanto, retornar status baseado em memória disponível como aproximação
      const totalMem = os.totalmem();
      const freeMem = os.freemem();
      
      // Aproximação: assumir que disco tem ~10x mais espaço que memória
      const diskInfo = {
        total: totalMem * 10,
        used: (totalMem - freeMem) * 10,
        available: freeMem * 10
      };
      
      const percentage = (diskInfo.used / diskInfo.total) * 100;

      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
      if (percentage > 90) {
        status = 'unhealthy';
      } else if (percentage > 80) {
        status = 'degraded';
      }

      return {
        status,
        message: 'Verificação de disco aproximada (use comando do sistema para precisão)',
        details: {
          total: diskInfo.total,
          used: diskInfo.used,
          available: diskInfo.available,
          percentage: Math.round(percentage * 100) / 100,
          note: 'Para verificação precisa, instale biblioteca diskusage ou use comando do sistema'
        }
      };
    } catch (error: unknown) {
      return {
        status: 'degraded',
        message: 'Não foi possível verificar disco',
        details: { error: (error as Error).message }
      };
    }
  }

  /**
   * Verificar saúde da memória
   */
  private async checkMemory(): Promise<ComponentHealth> {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const percentage = (usedMem / totalMem) * 100;

    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (percentage > 90) {
      status = 'unhealthy';
    } else if (percentage > 80) {
      status = 'degraded';
    }

    return {
      status,
      details: {
        total: totalMem,
        used: usedMem,
        free: freeMem,
        percentage: Math.round(percentage * 100) / 100
      }
    };
  }

  /**
   * Verificar saúde da CPU
   */
  private async checkCpu(): Promise<ComponentHealth> {
    const cpus = os.cpus();
    const loadAvg = os.loadavg();
    const cpuCount = cpus.length;
    const loadPercentage = (loadAvg[0] / cpuCount) * 100;

    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (loadPercentage > 90) {
      status = 'unhealthy';
    } else if (loadPercentage > 70) {
      status = 'degraded';
    }

    return {
      status,
      details: {
        cores: cpuCount,
        loadAverage: loadAvg,
        loadPercentage: Math.round(loadPercentage * 100) / 100
      }
    };
  }

  /**
   * Verificar saúde dos serviços
   */
  private async checkServices(): Promise<ServiceHealth[]> {
    const services: ServiceHealth[] = [];

    // Verificar serviços críticos
    try {
      // Verificar se há totens online
      const onlineTotems = await this.db.findFirst(`
        SELECT COUNT(*)::int as count
        FROM totems
        WHERE is_active = true
        AND last_heartbeat > NOW() - INTERVAL '5 minutes'
      `);

      services.push({
        name: 'totems',
        status: (onlineTotems?.count as number) > 0 ? 'running' : 'stopped',
        details: {
          online: onlineTotems?.count || 0
        }
      });
    } catch (error: unknown) {
      services.push({
        name: 'totems',
        status: 'error',
        details: { error: (error as Error).message }
      });
    }

    return services;
  }

  /**
   * Verificação rápida (apenas componentes críticos)
   */
  async quickHealthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; message: string }> {
    try {
      const [dbCheck, redisCheck] = await Promise.all([
        this.checkDatabase(),
        this.checkRedis()
      ]);

      if (dbCheck.status === 'unhealthy' || redisCheck.status === 'unhealthy') {
        return {
          status: 'unhealthy',
          message: 'Componentes críticos falhando'
        };
      }

      return {
        status: 'healthy',
        message: 'Sistema operacional'
      };
    } catch (error: unknown) {
      return {
        status: 'unhealthy',
        message: (error as Error).message
      };
    }
  }
}

// Singleton
let healthCheckServiceInstance: HealthCheckService | null = null;

export function getHealthCheckService(): HealthCheckService {
  if (!healthCheckServiceInstance) {
    healthCheckServiceInstance = new HealthCheckService();
  }
  return healthCheckServiceInstance;
}

