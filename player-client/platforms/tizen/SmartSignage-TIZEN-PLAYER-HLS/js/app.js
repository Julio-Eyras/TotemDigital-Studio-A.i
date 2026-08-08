/**
 * SmartSignage Tizen Player HLS - Aplicação Principal
 * Integra todos os componentes e gerencia ciclo de vida
 */

class SmartSignageApp {
  constructor() {
    this.deviceInfo = new DeviceInfoService();
    this.player = null;
    this.commandFetcher = null;
    this.heartbeatService = null;
    this.fallbackManager = null;
    
    this.config = null;
    this.uin = null;
    this.token = null;
    this.deviceToken = null; // Token de dispositivo do dispatcher
    this.deviceId = null; // ID do dispositivo Tizen
    this.apiUrl = null;
    this.currentDispatchPlan = null; // Último DispatchPlan recebido
    this.useDispatcher = true; // Usar novo dispatcher por padrão
    this.totemConnectionManager = null; // Gerenciador de conexão com totem
    this.mediaCacheManager = null; // Gerenciador de cache local
    this.storageHelper = null; // Storage propagandas, externo por defeito (design 3.3)
    
    this.initialized = false;
  }

  /**
   * Inicializa a aplicação
   */
  async init() {
    try {
      console.log('[App] Inicializando SmartSignage Tizen Player HLS...');

      // 1. Carregar configuração
      await this.loadConfig();

      // 2. Verificar/Registrar UIN
      await this.ensureUIN();

      // 3. Obter deviceId do Tizen
      await this.getDeviceId();

      // 4. Inicializar TotemConnectionManager (descoberta totem local vs servidor central)
      this.totemConnectionManager = new TotemConnectionManager({
        totemIP: this.config.totem_ip || null,
        totemPort: this.config.totem_port || 8080,
        totemUIN: this.uin,
        apiBaseURL: this.apiUrl,
        autoDiscovery: this.config.auto_discovery !== false,
        discoveryTimeout: 5000
      });

      // Determinar estratégia de conexão (totem local ou servidor central)
      const connectionStrategy = await this.totemConnectionManager.determineConnectionStrategy();
      
      if (connectionStrategy.useLocalTotem) {
        console.log('[App] Totem local encontrado, usando como dispatcher e cache', connectionStrategy.totemInfo);
        // Atualizar configuração para usar totem local
        this.apiUrl = this.totemConnectionManager.getBaseURL();
        this.uin = this.totemConnectionManager.getTotemUIN();
      } else {
        console.log('[App] Totem local não encontrado, usando servidor central');
      }

      // Storage: path propagandas, externo por defeito (design 3.3)
      if (typeof StorageHelper !== 'undefined') {
        this.storageHelper = new StorageHelper({
          useExternalFirst: this.config.use_external_first !== undefined ? this.config.use_external_first : true
        });
        await this.storageHelper.ensurePropagandasDirs();
      }

      // Inicializar MediaCacheManager para cache em .../propagandas/
      if (typeof MediaCacheManager !== 'undefined') {
        this.mediaCacheManager = new MediaCacheManager({
          maxCacheSize: 500 * 1024 * 1024, // 500MB
          cacheDir: 'smartsignage/cache',
          storageHelper: this.storageHelper
        });
        await this.mediaCacheManager.init();
      }

      // 4. Obter token de dispositivo (novo fluxo dispatcher)
      if (this.useDispatcher) {
        await this.getDeviceToken();
      }

      // 5. Obter token de autenticação (legado - fallback)
      if (!this.deviceToken) {
        await this.getToken();
      }

      // 7. Tentar obter DispatchPlan (novo fluxo)
      let validation = null;
      if (this.useDispatcher && this.deviceToken) {
        try {
          await this.applyPlayerConfigFromApi();
          const dispatchPlan = await this.getDispatchPlan();
          
          // Processar cache local de mídias em background (se disponível)
          if (this.mediaCacheManager) {
            this.mediaCacheManager.processDispatchPlan(dispatchPlan, {
              baseURL: this.apiUrl,
              token: this.deviceToken,
              totemUIN: this.uin
            })
              .then(stats => {
                console.log(`[App] Cache processado: ${stats.success} sucesso, ${stats.failed} falhas, ${stats.skipped} puladas`);
              })
              .catch(error => {
                console.warn('[App] Erro ao processar cache', error);
              });
          }
          
          // Usar DispatchPlan nativamente - extrair stream URL diretamente
          const streamUrl = await this.extractStreamUrlFromDispatchPlan(dispatchPlan, true);
          if (streamUrl) {
            validation = {
              playlist: {
                stream_url: streamUrl
              }
            };
          }
        } catch (error) {
          console.warn('[App] Falha ao obter DispatchPlan, tentando modo offline...', error);
          
          // Tentar modo offline (último DispatchPlan em cache)
          if (this.mediaCacheManager) {
            const lastPlan = this.mediaCacheManager.loadLastDispatchPlan();
            if (lastPlan) {
              console.log('[App] Usando último DispatchPlan em cache (modo offline)');
              const streamUrl = await this.extractStreamUrlFromDispatchPlan(lastPlan, true);
              if (streamUrl) {
                validation = {
                  playlist: {
                    stream_url: streamUrl
                  }
                };
              }
            }
          }
          
          if (!validation) {
            this.useDispatcher = false;
          }
        }
      }

      // 7. Validar totem no backend (legado - fallback)
      if (!validation) {
        validation = await this.validateTotem();
      }
      
      // 8. Inicializar componentes
      await this.initializeComponents(validation);

      // 9. Iniciar serviços
      this.startServices();

      // 10. Reproduzir stream inicial
      await this.startPlayback(validation);

      // 11. Configurar sincronização periódica do DispatchPlan
      if (this.useDispatcher) {
        this.startDispatchPlanSync();
      }

      this.initialized = true;
      console.log('[App] Aplicação inicializada com sucesso!');

    } catch (error) {
      console.error('[App] Erro na inicialização:', error);
      // Tentar modo fallback mesmo sem conexão
      await this.initializeFallbackMode();
    }
  }

  /**
   * Carrega configuração
   */
  async loadConfig() {
    // Tentar carregar do localStorage primeiro
    const savedConfig = this.deviceInfo.loadConfig();
    
    if (savedConfig) {
      this.config = savedConfig;
      console.log('[App] Configuração carregada do cache');
    } else {
      // Configuração padrão (pode vir de config.json no futuro)
      this.config = {
        api_base_url: window.API_BASE_URL || 'http://192.168.1.100:3000/api',
        heartbeat_interval: 30000,
        command_poll_interval: 15000,
        watchdog_interval: 20000,
        auto_reload_timeout: 300000,
        fallback_urls: [
          '/media/usb/fallback.mp4',
          '/media/internal/fallback.mp4'
        ]
      };
      console.log('[App] Usando configuração padrão');
    }

    this.apiUrl = this.config.api_base_url;
  }

  /**
   * Garante que UIN existe (coleta ou usa salvo)
   */
  async ensureUIN() {
    this.uin = this.deviceInfo.getUIN();

    if (!this.uin) {
      console.log('[App] UIN não encontrado, coletando hardware e registrando...');
      try {
        const result = await this.deviceInfo.registerWithBackend(this.apiUrl);
        this.uin = result.uin;
        console.log('[App] UIN registrado:', this.uin);
      } catch (error) {
        console.error('[App] Erro ao registrar UIN:', error);
        // Gerar UIN temporário baseado em hardware mesmo sem backend
        const hardwareInfo = await this.deviceInfo.collectHardwareInfo();
        this.uin = this.deviceInfo.generateUIN(hardwareInfo);
        console.log('[App] Usando UIN temporário:', this.uin);
      }
    } else {
      console.log('[App] UIN encontrado:', this.uin);
    }
  }

  /**
   * Obtém deviceId do Tizen
   */
  async getDeviceId() {
    try {
      if (typeof tizen !== 'undefined' && tizen.systeminfo) {
        // Tentar obter ID único do Tizen
        const deviceId = tizen.systeminfo.getCapability('http://tizen.org/system/tizenid');
        if (deviceId) {
          this.deviceId = `TIZEN-${deviceId}`.trim().toUpperCase();
          return this.deviceId;
        }
      }
      
      // Fallback: gerar ID baseado em hardware
      const hardwareInfo = await this.deviceInfo.collectHardwareInfo();
      this.deviceId = `TIZEN-${hardwareInfo.serial || Date.now()}`.trim().toUpperCase();
      return this.deviceId;
    } catch (error) {
      console.warn('[App] Erro ao obter deviceId:', error);
      this.deviceId = `TIZEN-${Date.now()}`;
      return this.deviceId;
    }
  }

  /**
   * Obtém token de dispositivo (novo fluxo dispatcher)
   */
  async getDeviceToken() {
    if (!this.deviceId) {
      await this.getDeviceId();
    }

    try {
      const params = new URLSearchParams({
        uin: this.uin,
        deviceId: this.deviceId || '',
        platform: 'tizen',
        appVersion: '2.1.0'
      });

      const response = await fetch(`${this.apiUrl}/player/token?${params}`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const result = await response.json();
      this.deviceToken = result.token;
      console.log('[App] Device token obtido');
      
      return this.deviceToken;
    } catch (error) {
      console.warn('[App] Erro ao obter device token:', error);
      this.useDispatcher = false;
      return null;
    }
  }

  /**
   * Obtém token de autenticação (legado - fallback)
   */
  async getToken() {
    try {
      const response = await fetch(`${this.apiUrl}/player/token?uin=${this.uin}`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const result = await response.json();
      this.token = result.token;
      console.log('[App] Token obtido (legacy)');
      
      return this.token;
    } catch (error) {
      console.warn('[App] Erro ao obter token:', error);
      return null;
    }
  }

  /**
   * Aplica config do player vinda da API (storage externo/interno).
   */
  async applyPlayerConfigFromApi() {
    try {
      const response = await fetch(`${this.apiUrl}/api/player/config`);
      if (!response.ok) return;
      const config = await response.json();
      if (config && typeof config.storageUseExternalFirst === 'boolean' && this.storageHelper) {
        this.storageHelper.useExternalFirst = config.storageUseExternalFirst;
        console.log('[App] Config aplicada: storageUseExternalFirst=' + config.storageUseExternalFirst);
      }
    } catch (e) {
      console.warn('[App] Erro ao obter config do player (usando defaults)', e);
    }
  }

  /**
   * Obtém DispatchPlan do dispatcher
   */
  async getDispatchPlan() {
    if (!this.deviceToken || !this.uin) {
      throw new Error('Device token ou UIN não disponível');
    }

    try {
      const timestamp = new Date().toISOString();
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      
      const params = new URLSearchParams({
        uin: this.uin,
        token: this.deviceToken,
        deviceId: this.deviceId || '',
        timestamp: timestamp,
        timezone: timezone
      });

      const response = await fetch(`${this.apiUrl}/player/dispatch?${params}`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const result = await response.json();
      
      if (result.success && result.plan) {
        this.currentDispatchPlan = result.plan;
        console.log('[App] DispatchPlan obtido:', result.plan);
        return result.plan;
      }

      throw new Error(result.error || 'Não foi possível obter DispatchPlan');
    } catch (error) {
      console.warn('[App] Erro ao obter DispatchPlan:', error);
      this.useDispatcher = false;
      throw error;
    }
  }

  /**
   * Valida totem no backend
   */
  async validateTotem() {
    try {
      const url = `${this.apiUrl}/player/validate?uin=${this.uin}`;
      const params = new URLSearchParams({ uin: this.uin });
      if (this.token) {
        params.append('token', this.token);
      }

      const response = await fetch(`${url}&${params}`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const result = await response.json();
      console.log('[App] Totem validado');
      
      return result;
    } catch (error) {
      console.warn('[App] Erro ao validar totem:', error);
      return null;
    }
  }

  /**
   * Inicializa componentes principais
   */
  async initializeComponents(validation) {
    // 1. Player HLS
    this.player = new HLSPlayer('player');
    
    // Configurar callback de erro para fallback
    this.player.onError = (error) => {
      if (this.fallbackManager) {
        this.fallbackManager.handleError();
      }
    };

    // 2. Fallback Manager
    const fallbackUrls = this.config.fallback_urls || [];
    const primaryStream = validation?.playlist?.stream_url || this.config.stream_url;
    
    this.fallbackManager = new FallbackManager(primaryStream, fallbackUrls);
    this.fallbackManager.setPlayer(this.player);

    // 3. Command Fetcher
    this.commandFetcher = new CommandFetcher(
      this.apiUrl,
      this.uin,
      this.config.command_poll_interval
    );
    this.commandFetcher.setToken(this.token);
    this.commandFetcher.onCommand = (command) => this.processCommand(command);

    // 4. Heartbeat Service
    this.heartbeatService = new HeartbeatService(
      this.apiUrl,
      this.uin,
      this.config.heartbeat_interval,
      this.deviceId || null
    );
    // Usar deviceToken se disponível, senão token legado
    this.heartbeatService.setToken(this.deviceToken || this.token);
    
    // Atualizar callbacks para incluir informações do dispositivo
    const originalStatusCallback = () => this.player.getStatus();
    const originalStreamCallback = () => this.player.getCurrentStream();
    
    this.heartbeatService.setCallbacks(
      () => {
        const status = originalStatusCallback();
        return {
          ...status,
          deviceId: this.deviceId,
          platform: 'tizen',
          appVersion: '2.1.0',
          isOnline: navigator.onLine
        };
      },
      originalStreamCallback
    );
  }

  /**
   * Inicia serviços (polling, heartbeat, watchdog)
   */
  startServices() {
    // Watchdog do player
    this.player.startWatchdog(this.config.watchdog_interval);

    // Command Fetcher
    this.commandFetcher.start();

    // Heartbeat Service
    this.heartbeatService.start();

    // Auto-reload como última camada de segurança
    this.startAutoReload();
  }

  /**
   * Inicia reprodução do stream inicial
   */
  async startPlayback(validation) {
    const streamUrl = validation?.playlist?.stream_url || 
                     validation?.stream_url || 
                     this.config.stream_url;

    if (streamUrl) {
      console.log('[App] Iniciando reprodução:', streamUrl);
      try {
        await this.player.play(streamUrl);
      } catch (error) {
        console.error('[App] Erro ao iniciar reprodução:', error);
        // Fallback será ativado automaticamente via onError
      }
    } else {
      console.warn('[App] Nenhum stream URL disponível');
    }
  }

  /**
   * Processa comandos recebidos do backend
   */
  async processCommand(command) {
    console.log('[App] Processando comando:', command.action);

    switch (command.action) {
      case 'PLAY':
        if (command.stream) {
          await this.player.play(command.stream);
        }
        break;

      case 'STOP':
        this.player.stop();
        break;

      case 'PAUSE':
        this.player.pause();
        break;

      case 'RESUME':
        this.player.resume();
        break;

      case 'RESTART':
        console.log('[App] Reiniciando aplicação...');
        location.reload();
        break;

      case 'SET_VOLUME':
        if (command.volume !== undefined) {
          this.player.setVolume(command.volume);
        }
        break;

      default:
        console.warn('[App] Comando desconhecido:', command.action);
    }
  }

  /**
   * Inicia auto-reload como última camada de segurança
   */
  startAutoReload() {
    const timeout = this.config.auto_reload_timeout || 300000; // 5 minutos

    setInterval(() => {
      if (this.player && this.player.lastActivity) {
        const lastActivity = this.player.lastActivity;
        const timeSinceActivity = Date.now() - lastActivity;

        if (timeSinceActivity > timeout) {
          console.warn('[App] Sem atividade há muito tempo, reiniciando...');
          location.reload();
        }
      }
    }, 60000); // Verificar a cada minuto
  }

  /**
   * Extrai stream URL do DispatchPlan (formato nativo)
   * Se useLocalPaths=true, tenta usar caminhos locais do cache ou totem local
   * 
   * Agora trabalha diretamente com DispatchPlanMediaItem, sem conversão
   */
  async extractStreamUrlFromDispatchPlan(dispatchPlan, useLocalPaths = false) {
    // Se DispatchPlan tem stream_url direto, usar
    if (dispatchPlan.streamUrl) {
      return dispatchPlan.streamUrl;
    }

    // Se tem mediaItems, usar primeiro vídeo como stream
    if (dispatchPlan.mediaItems && dispatchPlan.mediaItems.length > 0) {
      const videoItem = dispatchPlan.mediaItems.find(item => 
        item.mediaType === 'video' || item.url.endsWith('.mp4') || item.url.endsWith('.m3u8')
      );
      
      if (videoItem) {
        let streamUrl = videoItem.url;
        
        // Tentar usar caminho local do cache (se disponível)
        if (useLocalPaths && this.mediaCacheManager) {
          const localPath = await this.mediaCacheManager.getLocalPath(videoItem.mediaId);
          if (localPath) {
            streamUrl = `file://${localPath}`;
            console.log(`[App] Usando mídia do cache local: ${localPath}`);
          } else if (this.totemConnectionManager && this.totemConnectionManager.isUsingLocalTotem()) {
            // Tentar usar totem local HTTP
            const totemInfo = this.totemConnectionManager.getTotemInfo();
            const checksum = videoItem.metadata?.checksum || 'unknown';
            const extension = this.getFileExtension(videoItem.metadata?.mimeType || 'video/mp4');
            streamUrl = `http://${totemInfo.ip}:${totemInfo.port}/media/${videoItem.mediaId}_${checksum}.${extension}`;
            console.log(`[App] Usando mídia do totem local: ${streamUrl}`);
          }
        }
        
        return streamUrl;
      }
    }

    // Fallback: retornar null para usar validação legada
    return null;
  }
  
  /**
   * DEPRECATED: Converte DispatchPlan para formato de validação (compatibilidade)
   * 
   * @deprecated Use extractStreamUrlFromDispatchPlan() e trabalhe diretamente com DispatchPlan
   * TODO: Remover quando todos os componentes usarem DispatchPlan nativamente
   */
  async convertDispatchPlanToValidation(dispatchPlan, useLocalPaths = false) {
    console.warn('[DEPRECATED] convertDispatchPlanToValidation() - Use extractStreamUrlFromDispatchPlan()');
    
    const streamUrl = await this.extractStreamUrlFromDispatchPlan(dispatchPlan, useLocalPaths);
    if (streamUrl) {
      return {
        playlist: {
          stream_url: streamUrl
        }
      };
    }
    return null;
  }
  
  /**
   * Obtém extensão de arquivo do MIME type
   */
  getFileExtension(mimeType) {
    const mimeMap = {
      'video/mp4': 'mp4',
      'video/webm': 'webm',
      'video/quicktime': 'mov',
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/gif': 'gif',
      'image/webp': 'webp',
      'audio/mpeg': 'mp3',
      'audio/ogg': 'ogg',
      'audio/wav': 'wav'
    };
    return mimeMap[mimeType] || 'bin';
  }

  /**
   * Inicia sincronização periódica do DispatchPlan
   */
  startDispatchPlanSync() {
    const syncInterval = this.config.dispatch_sync_interval || 900000; // 15 minutos

    setInterval(async () => {
      if (!this.useDispatcher || !this.deviceToken) {
        return;
      }

      try {
        const dispatchPlan = await this.getDispatchPlan();
        const validation = this.convertDispatchPlanToValidation(dispatchPlan);
        
        if (validation && validation.playlist && validation.playlist.stream_url) {
          const currentStream = this.player?.getCurrentStream();
          const newStream = validation.playlist.stream_url;
          
          // Se stream mudou, atualizar reprodução
          if (currentStream !== newStream) {
            console.log('[App] Stream atualizado via DispatchPlan:', newStream);
            await this.player.play(newStream);
          }
        }
      } catch (error) {
        console.warn('[App] Erro na sincronização do DispatchPlan:', error);
        // Não desabilitar dispatcher por erro temporário
      }
    }, syncInterval);
  }

  /**
   * Inicializa modo fallback (sem conexão com backend)
   */
  async initializeFallbackMode() {
    console.log('[App] Inicializando modo fallback...');
    
    this.player = new HLSPlayer('player');
    
    // Tentar usar último DispatchPlan em cache (se disponível)
    let dispatchPlan = this.currentDispatchPlan;
    if (!dispatchPlan && this.mediaCacheManager) {
      dispatchPlan = this.mediaCacheManager.loadLastDispatchPlan();
    }
    
    if (dispatchPlan) {
      const streamUrl = await this.extractStreamUrlFromDispatchPlan(dispatchPlan, true);
      if (streamUrl) {
        validation = {
          playlist: {
            stream_url: streamUrl
          }
        };
      }
      if (validation && validation.playlist && validation.playlist.stream_url) {
        try {
          await this.player.play(validation.playlist.stream_url);
          console.log('[App] Usando DispatchPlan em cache (modo offline)');
          return;
        } catch (error) {
          console.warn('[App] Falha ao usar DispatchPlan em cache:', error);
        }
      }
    }
    
    // Tentar reproduzir fallback local
    const fallbackUrls = this.config.fallback_urls || ['/media/usb/fallback.mp4'];
    for (const url of fallbackUrls) {
      try {
        await this.player.play(url);
        console.log('[App] Fallback ativado:', url);
        return;
      } catch (error) {
        console.warn('[App] Fallback falhou:', url);
      }
    }

    console.error('[App] Nenhum fallback disponível');
  }
}

// Inicializar aplicação quando DOM estiver pronto
document.addEventListener('DOMContentLoaded', async () => {
  console.log('[App] DOM carregado, iniciando aplicação...');
  
  const app = new SmartSignageApp();
  window.smartsignageApp = app; // Expor globalmente para debug
  await app.init();
});

