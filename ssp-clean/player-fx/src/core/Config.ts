/**
 * Config - SmartDisplayFX Player Configuration
 * Gerencia configuração do player
 */

export interface PlayerConfig {
  // Identificação
  totemId: string;
  siteId: string;
  
  // MQTT/Broker
  brokerUrl: string;
  brokerType: 'mqtt' | 'websocket' | 'hybrid';
  brokerConfig?: {
    username?: string;
    password?: string;
    clientId?: string;
    keepalive?: number;
  };
  
  // API Backend
  apiBaseUrl: string;
  
  // Sincronização
  syncIntervalMs: number;
  timeSyncEnabled: boolean;
  syncToleranceMs: number;
  
  // Efeitos
  defaultEffectDuration: number;
  maxConcurrentEffects: number;
  
  // Cache
  cacheEnabled: boolean;
  cacheMaxSize: number;
  
  // Debug
  debug: boolean;
  logLevel: 'error' | 'warn' | 'info' | 'debug';
}

export function getInstance(): Config {
  if (!Config.instance) {
    Config.instance = new Config();
  }
  return Config.instance;
}

export class Config {
  private static instance: Config;
  private config: PlayerConfig;

  private constructor() {
    // Configuração padrão
    this.config = {
      totemId: '',
      siteId: '',
      brokerUrl: 'ws://localhost:9001',
      brokerType: 'mqtt',
      apiBaseUrl: 'http://localhost:3000',
      syncIntervalMs: 2000,
      timeSyncEnabled: true,
      syncToleranceMs: 100,
      defaultEffectDuration: 1600,
      maxConcurrentEffects: 3,
      cacheEnabled: true,
      cacheMaxSize: 100 * 1024 * 1024, // 100MB
      debug: false,
      logLevel: 'info',
    };
  }

  static getInstance(): Config {
    if (!Config.instance) {
      Config.instance = new Config();
    }
    return Config.instance;
  }

  /**
   * Carrega configuração do backend ou localStorage
   */
  async load(): Promise<void> {
    try {
      // Tentar carregar do localStorage primeiro
      const savedConfig = localStorage.getItem('smartdisplayfx_config');
      if (savedConfig) {
        const parsed = JSON.parse(savedConfig);
        this.config = { ...this.config, ...parsed };
      }

      // Buscar configuração do site do backend
      if (this.config.siteId) {
        const response = await fetch(`${this.config.apiBaseUrl}/api/smartdisplayfx/sites/${this.config.siteId}`);
        if (response.ok) {
          const site = await response.json();
          if (site.data) {
            this.config.brokerUrl = site.data.broker_url || this.config.brokerUrl;
            this.config.brokerType = site.data.broker_type || this.config.brokerType;
            this.config.syncIntervalMs = site.data.sync_interval_ms || this.config.syncIntervalMs;
            this.config.timeSyncEnabled = site.data.time_sync_enabled ?? this.config.timeSyncEnabled;
            
            if (site.data.broker_config) {
              this.config.brokerConfig = {
                username: site.data.broker_config.username,
                password: site.data.broker_config.password,
                clientId: `smartdisplayfx_${this.config.totemId}_${Date.now()}`,
                keepalive: 60,
              };
            }
          }
        }
      }
    } catch (error) {
      console.error('Erro ao carregar configuração:', error);
    }
  }

  /**
   * Salva configuração no localStorage
   */
  save(): void {
    try {
      localStorage.setItem('smartdisplayfx_config', JSON.stringify(this.config));
    } catch (error) {
      console.error('Erro ao salvar configuração:', error);
    }
  }

  /**
   * Atualiza configuração
   */
  update(updates: Partial<PlayerConfig>): void {
    this.config = { ...this.config, ...updates };
    this.save();
  }

  /**
   * Obtém configuração completa
   */
  get(): PlayerConfig {
    return { ...this.config };
  }

  /**
   * Obtém valor específico
   */
  getValue<K extends keyof PlayerConfig>(key: K): PlayerConfig[K] {
    return this.config[key];
  }
}

