/**
 * Smart Signage Player - webOS
 * Aplicativo principal
 */

// Importar componentes core (em produção, seria via bundle)
// Por enquanto, vamos incluir os arquivos diretamente no HTML

// Configuração
const CONFIG = {
  API_BASE_URL: 'http://localhost:3000', // Será configurado via appinfo.json
  TOTEM_UIN: '', // Será obtido via configuração
  TOTEM_SECRET: '', // Será obtido via configuração
  HEARTBEAT_INTERVAL: 30000, // 30 segundos
  PLAYLIST_UPDATE_INTERVAL: 300000, // 5 minutos
  CACHE_ENABLED: true,
  CACHE_MAX_SIZE: 50 * 1024 * 1024, // 50MB
};

// Inicialização
let apiClient;
let playlistManager;
let heartbeatService;
let mediaPlayer;
let logger;
let scheduler;
let cache;
let errorHandler;

// SmartDisplayFX
let fxClient;
let fxEngine;
let playerBridge;

/**
 * Inicializa aplicativo
 */
async function init() {
  try {
    // Carregar configuração
    await loadConfig();

    // Inicializar cache
    if (CONFIG.CACHE_ENABLED) {
      cache = new Cache();
      cache.setMaxSize(CONFIG.CACHE_MAX_SIZE);
    }

    // Inicializar API client
    apiClient = new APIClient(
      CONFIG.API_BASE_URL,
      CONFIG.TOTEM_UIN,
      CONFIG.TOTEM_SECRET
    );

    // Inicializar logger (depois do API client)
    logger = new Logger(apiClient, CONFIG.logLevel || 'info');

    // Inicializar error handler
    errorHandler = new ErrorHandler(logger, apiClient);

    // Autenticar totem
    const authenticated = await apiClient.authenticateTotem();
    if (!authenticated) {
      logger.error('Failed to authenticate totem');
      showError('Falha na autenticação. Verifique a configuração.');
      return;
    }

    logger.info('Totem authenticated successfully');

    // Inicializar scheduler
    scheduler = new Scheduler();

    // Inicializar playlist manager
    playlistManager = new PlaylistManager(apiClient, cache);

    // Inicializar heartbeat
    heartbeatService = new HeartbeatService(apiClient, CONFIG.HEARTBEAT_INTERVAL);
    heartbeatService.start();

    // Inicializar media player
    mediaPlayer = new MediaPlayer(document.getElementById('player-container'));
    mediaPlayer.onEnd(() => {
      playNext();
    });

    // Inicializar SmartDisplayFX
    await initSmartDisplayFX();

    // Configurar APIs webOS específicas
    await setupWebOSAPIs();

    // Carregar e iniciar playlist
    await loadAndStartPlaylist();

    // Configurar atualização periódica de playlist
    setInterval(async () => {
      if (playlistManager.needsUpdate(CONFIG.PLAYLIST_UPDATE_INTERVAL)) {
        await loadAndStartPlaylist();
      }
    }, CONFIG.PLAYLIST_UPDATE_INTERVAL);

    // Atualizar scheduler periodicamente (verificar agendamentos)
    setInterval(() => {
      // Se playlist mudou por agendamento, recarregar
      const currentItem = playlistManager.getCurrentItem();
      if (currentItem && !scheduler.shouldDisplay(currentItem)) {
        logger.info('Current item no longer scheduled, loading next');
        playNext();
      }
    }, 60000); // Verificar a cada minuto

    logger.info('Application initialized successfully');
    updateStatus('Aplicativo inicializado');
  } catch (error) {
    if (errorHandler) {
      errorHandler.handle(error, { phase: 'initialization' });
    } else if (logger) {
      logger.error('Failed to initialize application', error);
    }
    showError('Erro ao inicializar aplicativo');
  }
}

/**
 * Carrega configuração
 */
async function loadConfig() {
  try {
    // Tentar carregar de arquivo de configuração
    const response = await fetch('config/config.json');
    if (response.ok) {
      const config = await response.json();
      Object.assign(CONFIG, config);
    }
  } catch (error) {
    console.warn('Failed to load config file, using defaults');
  }

  // Obter configuração do appinfo.json ou variáveis de ambiente
  if (typeof webOS !== 'undefined' && webOS.service) {
    try {
      // webOS específico
      const webOSConfig = await webOS.service.request('luna://com.smartsignage.config', {
        method: 'get',
      });
      
      if (webOSConfig) {
        CONFIG.API_BASE_URL = webOSConfig.apiBaseURL || CONFIG.API_BASE_URL;
        CONFIG.TOTEM_UIN = webOSConfig.totemUIN || CONFIG.TOTEM_UIN;
        CONFIG.TOTEM_SECRET = webOSConfig.totemSecret || CONFIG.TOTEM_SECRET;
      }
    } catch (error) {
      console.warn('webOS config service not available');
    }
  }

  // Aplicar timezone se configurado
  if (CONFIG.timezone && scheduler) {
    scheduler.setTimezone(CONFIG.timezone);
  }
}

/**
 * Carrega e inicia playlist
 */
async function loadAndStartPlaylist() {
  try {
    updateStatus('Carregando playlist...');
    await playlistManager.loadPlaylist();
    
    // Filtrar itens por agendamento
    if (playlistManager.currentPlaylist && scheduler) {
      const filteredItems = scheduler.filterScheduledItems(
        playlistManager.currentPlaylist.items
      );
      playlistManager.currentPlaylist.items = filteredItems;
      
      if (filteredItems.length === 0) {
        logger.warn('No scheduled items in playlist');
        updateStatus('Nenhum conteúdo agendado no momento');
        setTimeout(loadAndStartPlaylist, CONFIG.PLAYLIST_UPDATE_INTERVAL);
        return;
      }
    }

    updateStatus('Playlist carregada');
    playNext();
  } catch (error) {
    if (errorHandler) {
      errorHandler.handle(error, { phase: 'load_playlist' });
    } else if (logger) {
      logger.error('Failed to load playlist', error);
    }
    updateStatus('Erro ao carregar playlist');
    // Tentar novamente após delay
    setTimeout(loadAndStartPlaylist, 10000);
  }
}

/**
 * Reproduz próximo item
 */
async function playNext() {
  const item = playlistManager.getNextItem();
  if (!item) {
    logger.warn('No items in playlist');
    updateStatus('Nenhum item na playlist');
    // Tentar recarregar playlist
    setTimeout(loadAndStartPlaylist, 5000);
    return;
  }

  // Verificar se item deve ser exibido (agendamento)
  if (scheduler && !scheduler.shouldDisplay(item)) {
    logger.debug('Item skipped due to schedule', { itemId: item.id });
    playNext(); // Pular para próximo
    return;
  }

  try {
    updateStatus(`Reproduzindo: ${item.name || `Item ${item.id}`}`);
    await mediaPlayer.play(item);
  } catch (error) {
    if (errorHandler) {
      errorHandler.handle(error, { phase: 'play_media', itemId: item.id });
    } else if (logger) {
      logger.error('Failed to play media', error, { itemId: item.id });
    }
    updateStatus('Erro ao reproduzir mídia');
    // Tentar próximo item após delay
    setTimeout(playNext, 2000);
  }
}

/**
 * Inicializa SmartDisplayFX
 */
async function initSmartDisplayFX() {
  try {
    // Verificar se módulos SmartDisplayFX estão disponíveis
    if (!window.SmartDisplayFX) {
      logger?.warn('SmartDisplayFX modules not loaded');
      return;
    }

    // Obter siteId e totemId da configuração
    const siteId = CONFIG.siteId || 'site-01';
    const totemId = CONFIG.TOTEM_UIN || `totem-${Date.now()}`;

    // Carregar configuração do site do backend
    let clientOptions = {};
    try {
      const { loadAndCreateClientOptions } = window.SmartDisplayFX;
      if (typeof loadAndCreateClientOptions === 'function') {
        clientOptions = await loadAndCreateClientOptions(
          CONFIG.API_BASE_URL,
          siteId,
          () => apiClient?.token || null
        );
        logger?.info('Site configuration loaded', { siteId, brokerUrl: clientOptions.mqttUrl });
      } else {
        // Fallback: usar configuração local se função não disponível
        logger?.warn('loadAndCreateClientOptions not available, using local config');
        clientOptions = {
          transportType: 'auto',
          mqttUrl: CONFIG.mqttUrl || 'ws://localhost:9001',
          mqttPrefix: CONFIG.mqttPrefix || 'smartdisplay',
          mqttOptions: {
            username: CONFIG.mqttUsername,
            password: CONFIG.mqttPassword,
          },
        };
      }
    } catch (error) {
      logger?.warn('Failed to load site config, using defaults', error);
      // Usar configuração padrão
      clientOptions = {
        transportType: 'auto',
        mqttUrl: CONFIG.mqttUrl || 'ws://localhost:9001',
        mqttPrefix: CONFIG.mqttPrefix || 'smartdisplay',
        mqttOptions: {
          username: CONFIG.mqttUsername,
          password: CONFIG.mqttPassword,
        },
      };
    }

    // Inicializar PlayerBridge
    const { WebPlayerBridge, FxEngine, SmartDisplayFlowClient } = window.SmartDisplayFX;
    
    if (!WebPlayerBridge || !FxEngine || !SmartDisplayFlowClient) {
      logger?.warn('SmartDisplayFX modules incomplete');
      return;
    }

    const videoElement = document.querySelector('video') || mediaPlayer?.element;
    if (videoElement) {
      playerBridge = new WebPlayerBridge({
        videoElement: videoElement,
        onContentChange: (newId, oldId) => {
          logger?.debug('Content changed', { newId, oldId });
        },
        onPlaybackStateChange: (newState, oldState) => {
          logger?.debug('Playback state changed', { newState, oldState });
        },
      });
      playerBridge.connect();
    }

    // Inicializar FxEngine
    const fxCanvas = document.getElementById('fx-canvas');
    if (fxCanvas) {
      fxEngine = new FxEngine({
        canvas: fxCanvas,
        playerBridge: playerBridge,
        onLog: (msg, extra) => {
          logger?.debug(`SmartDisplayFX: ${msg}`, extra);
        },
        onEffectComplete: async (metrics) => {
          // Enviar telemetria com FPS real quando efeito completar
          if (fxClient && metrics) {
            try {
              await fxClient.sendTelemetry({
                effectId: metrics.effectId,
                actualStartTs: new Date(metrics.startTime).toISOString(),
                endedAt: new Date(metrics.endTime).toISOString(),
                durationMs: metrics.durationMs,
                avgFps: metrics.avgFps,
                status: 'success',
                metadata: {
                  frameCount: metrics.frameCount,
                },
              });
            } catch (e) {
              logger?.warn('Erro ao enviar telemetria de conclusão', e);
            }
          }
        },
      });
    }

    // Inicializar SmartDisplayFlowClient
    fxClient = new SmartDisplayFlowClient({
      siteId: siteId,
      totemId: totemId,
      backendBaseUrl: CONFIG.API_BASE_URL,
      getAuthToken: () => {
        // Obter token de autenticação (se disponível)
        return apiClient?.token || null;
      },
      ...clientOptions,
      onLog: (msg, extra) => {
        logger?.debug(`SmartDisplayFlowClient: ${msg}`, extra);
      },
    });

    // Handler para efeitos
    fxClient.onEffect(async (payload, context) => {
      logger?.info('Effect received', { payload, context });

      const { isOrigin, isTarget } = context;
      const effectStartTime = Date.now();

      if (fxEngine) {
        // Delegar payload completo para o FxEngine,
        // que já entende effect_id, from/to, duration_ms e params
        fxEngine.playEffect(payload, {
          isOrigin,
          isTarget,
          currentTotemId: totemId
        });
        
        // Enviar telemetria inicial (quando efeito começa)
        // A telemetria final (com FPS) será enviada pelo callback onEffectComplete
        try {
          await fxClient.sendTelemetry({
            effectId: payload.effect_id,
            eventId: payload.event_id || `evt_${Date.now()}`,
            contentId: payload.content_id || null,
            plannedStartTs: payload.start_ts,
            actualStartTs: new Date(effectStartTime).toISOString(),
            status: 'started',
            metadata: {
              fromTotem: payload.from?.totem,
              toTotem: payload.to?.totem,
              edge: isTarget ? payload.to?.edge : payload.from?.edge,
              isOrigin,
              isTarget,
            },
          });
        } catch (e) {
          logger?.warn('Erro ao enviar telemetria inicial', e);
        }
      }

      // Se houver content_id e for o totem destino, exibir conteúdo
      if (isTarget && payload.content_id) {
        logger?.info('Content to display', { contentId: payload.content_id });
        // TODO: Implementar lógica para exibir conteúdo
      }
    });

    // Handler para timeline
    fxClient.onTimeline((timeline) => {
      logger?.info('Timeline received', { timeline });
      
      // Processar eventos da timeline
      if (timeline.events && Array.isArray(timeline.events)) {
        timeline.events.forEach((event) => {
          if (event.msg_type === 'effect_transfer') {
            // Agendar efeito da timeline
            const delay = new Date(event.start_ts).getTime() - Date.now();
            if (delay > 0) {
              setTimeout(() => {
                fxClient.onEffect(event, { isOrigin: false, isTarget: true });
              }, delay);
            } else {
              // Executar imediatamente se já passou
              fxClient.onEffect(event, { isOrigin: false, isTarget: true });
            }
          }
        });
      }
    });

    // Handler para sincronização de tempo
    fxClient.onSyncTime((syncPayload) => {
      logger?.info('Sync time received', { syncPayload });
      
      // Calcular offset de tempo se necessário
      if (syncPayload.server_time && syncPayload.totem_time) {
        const serverTime = new Date(syncPayload.server_time).getTime();
        const totemTime = new Date(syncPayload.totem_time).getTime();
        const offset = serverTime - totemTime;
        
        // Armazenar offset para correção de timing em efeitos futuros
        if (fxEngine) {
          fxEngine.timeOffset = offset;
        }
        
        logger?.debug('Time offset calculated', { offset });
      }
    });

    // Conectar
    fxClient.connect(siteId, totemId);
    logger?.info('SmartDisplayFX initialized', { siteId, totemId, transport: clientOptions.transportType });
  } catch (error) {
    logger?.warn('Failed to initialize SmartDisplayFX', error);
    // Não bloquear inicialização do player se SmartDisplayFX falhar
  }
}

/**
 * Configura APIs webOS específicas
 */
async function setupWebOSAPIs() {
  if (typeof webOS === 'undefined') {
    logger.warn('webOS APIs not available');
    return;
  }

  try {
    // Configurar controle de brilho (se disponível)
    if (webOS.service && webOS.service.request) {
      // Obter configuração de brilho do backend
      const config = await apiClient.getConfig();
      if (config.brightness !== undefined) {
        await setBrightness(config.brightness);
      }
    }

    // Configurar modo de tela (se disponível)
    if (webOS.service && webOS.service.request) {
      // Manter tela ligada
      await webOS.service.request('luna://com.webos.service.tvpower', {
        method: 'keepAlive',
        params: { timeout: 0 }
      });
    }

    logger.info('webOS APIs configured');
  } catch (error) {
    logger.warn('Failed to configure webOS APIs', error);
  }
}

/**
 * Define brilho da tela
 */
async function setBrightness(level) {
  if (typeof webOS === 'undefined' || !webOS.service) {
    return;
  }

  try {
    await webOS.service.request('luna://com.webos.service.tvpower', {
      method: 'setBacklight',
      params: { backlight: Math.max(0, Math.min(100, level)) }
    });
  } catch (error) {
    logger.warn('Failed to set brightness', error);
  }
}

/**
 * Mostra erro
 */
function showError(message) {
  const statusBar = document.getElementById('status-bar');
  const statusText = document.getElementById('status-text');
  
  statusBar.classList.remove('hidden');
  statusText.textContent = message;
  statusBar.style.backgroundColor = '#ff0000';
  
  // Esconder após 5 segundos
  setTimeout(() => {
    statusBar.classList.add('hidden');
  }, 5000);
}

/**
 * Atualiza status
 */
function updateStatus(message) {
  const statusBar = document.getElementById('status-bar');
  const statusText = document.getElementById('status-text');
  
  statusBar.classList.remove('hidden');
  statusText.textContent = message;
  statusBar.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
  
  // Esconder após 3 segundos (se não for erro)
  setTimeout(() => {
    if (statusBar.style.backgroundColor !== '#ff0000') {
      statusBar.classList.add('hidden');
    }
  }, 3000);
}

// Inicializar quando DOM estiver pronto
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// Tratamento de erros globais
window.addEventListener('error', (event) => {
  if (errorHandler) {
    errorHandler.handle(event.error, { type: 'global_error' });
  } else if (logger) {
    logger.error('Global error', event.error);
  }
});

window.addEventListener('unhandledrejection', (event) => {
  if (errorHandler) {
    errorHandler.handle(event.reason, { type: 'unhandled_promise_rejection' });
  } else if (logger) {
    logger.error('Unhandled promise rejection', event.reason);
  }
});

