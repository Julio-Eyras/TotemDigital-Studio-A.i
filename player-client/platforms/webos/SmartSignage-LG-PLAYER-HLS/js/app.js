/**
 * SmartSignage LG Player HLS - Aplicação Principal
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
    this.apiUrl = null;
    
    this.initialized = false;
  }

  /**
   * Inicializa a aplicação
   */
  async init() {
    try {
      console.log('[App] Inicializando SmartSignage LG Player HLS...');

      // 1. Carregar configuração
      await this.loadConfig();

      // 2. Verificar/Registrar UIN
      await this.ensureUIN();

      // 3. Obter token de autenticação
      await this.getToken();

      // 4. Validar totem no backend
      const validation = await this.validateTotem();
      
      // 5. Inicializar componentes
      await this.initializeComponents(validation);

      // 6. Iniciar serviços
      this.startServices();

      // 7. Reproduzir stream inicial
      await this.startPlayback(validation);

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
   * Obtém token de autenticação
   */
  async getToken() {
    try {
      const response = await fetch(`${this.apiUrl}/player/token?uin=${this.uin}`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const result = await response.json();
      this.token = result.token;
      console.log('[App] Token obtido');
      
      return this.token;
    } catch (error) {
      console.warn('[App] Erro ao obter token:', error);
      return null;
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
      this.config.heartbeat_interval
    );
    this.heartbeatService.setToken(this.token);
    this.heartbeatService.setCallbacks(
      () => this.player.getStatus(),
      () => this.player.getCurrentStream()
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
   * Inicializa modo fallback (sem conexão com backend)
   */
  async initializeFallbackMode() {
    console.log('[App] Inicializando modo fallback...');
    
    this.player = new HLSPlayer('player');
    
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

