/**
 * System Service - Smart Signage v2.1
 * Serviço de informações do sistema (PostgreSQL-only)
 */

import { getDatabase } from '../config/database';
import * as os from 'os';
import { logError, logInfo } from '../utils/loggerHelper';
import { config } from '../config/env';
import { APP_VERSION, APP_NAME, APP_DESCRIPTION } from '../config/version';

export interface SystemHealth {
  status: 'healthy' | 'unhealthy' | 'degraded';
  database: {
    status: 'connected' | 'disconnected' | 'error';
    driver: string;
    responseTime?: number;
  };
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  disk: {
    used: number;
    total: number;
    percentage: number;
  };
  uptime: number;
  timestamp: string;
}

export interface SystemInfo {
  name: string;
  version: string;
  description: string;
  environment: string;
  database: {
    driver: string;
    version?: string;
  };
  features: string[];
  endpoints: { [key: string]: string };
  ai: {
    provider: string;
    enabled: boolean;
    status?: string;
  };
  system: {
    platform: string;
    arch: string;
    nodeVersion: string;
    uptime: number;
  };
}

export interface PlayerConfig {
  serverUrl: string;
  heartbeatInterval: number;
  mediaPath: string;
  defaultPlaylist?: number;
  autoStart: boolean;
  fullscreen: boolean;
  portrait: boolean;
  abandonPin: string;
}

export class SystemService {
  private get db() {
    return getDatabase();
  }

  /**
   * Inicializa o serviço
   */
  async initialize(): Promise<void> {
    try {
      await logInfo('SystemService inicializado', {});
    } catch (error: any) {
      await logError('Erro ao inicializar SystemService', error, {});
      throw error;
    }
  }

  /**
   * Verifica saúde do sistema
   */
  async getSystemHealth(): Promise<SystemHealth> {
    try {
      const startTime = Date.now();
      
      // Testar conexão com banco
      let dbStatus: 'connected' | 'disconnected' | 'error' = 'disconnected';
      let dbResponseTime: number | undefined;
      
      try {
        await this.db.findFirst('SELECT 1 as test');
        dbStatus = 'connected';
        dbResponseTime = Date.now() - startTime;
      } catch (error) {
        dbStatus = 'error';
      }

      // Informações de memória
      const totalMem = os.totalmem();
      const freeMem = os.freemem();
      const usedMem = totalMem - freeMem;
      const memPercentage = (usedMem / totalMem) * 100;

      // Informações de disco
      const diskInfo = this.getDiskUsage();
      
      // Status geral
      let status: 'healthy' | 'unhealthy' | 'degraded' = 'healthy';
      
      if (dbStatus !== 'connected') {
        status = 'unhealthy';
      } else if (memPercentage > 90 || diskInfo.percentage > 90) {
        status = 'degraded';
      }

      return {
        status,
        database: {
          status: dbStatus,
          driver: 'postgresql',
          responseTime: dbResponseTime
        },
        memory: {
          used: usedMem,
          total: totalMem,
          percentage: Math.round(memPercentage * 100) / 100
        },
        disk: diskInfo,
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
      };

    } catch (error: any) {
      await logError('Erro ao verificar saúde do sistema', error, {});
      throw error;
    }
  }

  /**
   * Obtém informações do sistema
   */
  async getSystemInfo(): Promise<SystemInfo> {
    try {
      const features = [
        'Gestão de clientes e usuários',
        'Gestão de totems e campanhas',
        'Upload e gestão de mídia',
        'Playlists inteligentes com IA',
        'Analytics e relatórios',
        'Faturamento e cobrança',
        'QR Codes dinâmicos',
        'Integração com IA (Ollama/OpenAI/Anthropic)',
        'PostgreSQL (apenas)',
        'Instalação Docker e single-server'
      ];

      const endpoints = {
        auth: '/api/auth',
        users: '/api/users',
        clients: '/api/clients',
        totems: '/api/totems',
        media: '/api/media',
        playlists: '/api/playlists',
        campaigns: '/api/campaigns',
        qrcodes: '/api/qrcodes',
        analytics: '/api/analytics',
        billing: '/api/billing',
        ai: '/api/ai',
        smartPlaylist: '/api/smart-playlist',
        settings: '/api/settings',
        reports: '/api/reports'
      };

      return {
        name: APP_NAME,
        version: APP_VERSION,
        description: APP_DESCRIPTION,
        environment: process.env.NODE_ENV || 'development',
        database: {
          driver: 'postgresql',
          version: await this.getDatabaseVersion()
        },
        features,
        endpoints,
        ai: {
          provider: process.env.AI_PROVIDER || 'ollama',
          enabled: process.env.AI_ENABLED !== 'false',
          status: await this.getAIStatus()
        },
        system: {
          platform: os.platform(),
          arch: os.arch(),
          nodeVersion: process.version,
          uptime: process.uptime()
        }
      };

    } catch (error: any) {
      await logError('Erro ao obter informações do sistema', error, {});
      throw error;
    }
  }

  /**
   * Obtém configuração do player
   */
  async getPlayerConfig(): Promise<PlayerConfig> {
    try {
      const serverUrl = config.player.serverUrl || `http://${config.server.host}:${config.server.port}`;
      return {
        serverUrl,
        heartbeatInterval: config.player.heartbeatInterval,
        mediaPath: '/assets/uploads',
        defaultPlaylist: undefined,
        autoStart: config.player.autoStart,
        fullscreen: config.player.fullscreen,
        portrait: config.player.portrait,
        abandonPin: config.security.playerAbandonPin
      };

    } catch (error: any) {
      await logError('Erro ao obter configuração do player', error, {});
      throw error;
    }
  }

  /**
   * Obtém uso de disco
   */
  private getDiskUsage(): { used: number; total: number; percentage: number } {
    try {
      // Implementação simplificada - em um sistema real, você usaria uma biblioteca como 'diskusage'
      return {
        used: 0,
        total: 0,
        percentage: 0
      };
    } catch (error) {
      return {
        used: 0,
        total: 0,
        percentage: 0
      };
    }
  }

  /**
   * Obtém versão do banco de dados
   */
  private async getDatabaseVersion(): Promise<string | undefined> {
    try {
      // Apenas PostgreSQL suportado na v2.1
      const result = await this.db.findFirst('SELECT version() as version');
      return result?.version;
    } catch (error) {
      return undefined;
    }
  }

  /**
   * Obtém status da IA
   */
  private async getAIStatus(): Promise<string> {
    try {
      const provider = process.env.AI_PROVIDER || 'ollama';
      const enabled = process.env.AI_ENABLED !== 'false';
      
      if (!enabled) {
        return 'disabled';
      }

      // Testar conexão com IA
      switch (provider) {
        case 'ollama':
          try {
            const axios = require('axios');
            await axios.get(`${process.env.OLLAMA_BASE_URL || 'http://localhost:11434'}/api/tags`);
            return 'online';
          } catch {
            return 'offline';
          }
        
        case 'openai':
          return process.env.OPENAI_API_KEY ? 'configured' : 'not_configured';
        
        case 'anthropic':
          return process.env.ANTHROPIC_API_KEY ? 'configured' : 'not_configured';
        
        default:
          return 'unknown';
      }
    } catch (error) {
      return 'error';
    }
  }
}

