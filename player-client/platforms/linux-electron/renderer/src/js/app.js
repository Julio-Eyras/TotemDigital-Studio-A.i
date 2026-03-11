/**
 * Smart Signage Player - Linux Electron
 * Aplicativo principal
 */

const { ipcRenderer } = require('electron');

// Configuração
let CONFIG = {
  API_BASE_URL: 'http://localhost:3000',
  TOTEM_UIN: '',
  TOTEM_SECRET: '',
  HEARTBEAT_INTERVAL: 30000,
  PLAYLIST_UPDATE_INTERVAL: 300000,
  CACHE_ENABLED: true,
  CACHE_MAX_SIZE: 50 * 1024 * 1024,
  storagePath: null,
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
let storageHelper;
let mediaCacheManager;
let deviceToken = null;
let currentDispatchPlan = null;
let currentDispatchIndex = 0;
let deviceId = '';

// SmartDisplayFX
let fxClient;
let fxEngine;
let playerBridge;

/**
 * Inicializa aplicativo
 */
async function init() {
  try {
    // Carregar configuração do main process
    const mainConfig = await ipcRenderer.invoke('get-config');
    Object.assign(CONFIG, mainConfig);

    // Carregar configuração de arquivo se disponível
    try {
      const response = await fetch('config/config.json');
      if (response.ok) {
        const fileConfig = await response.json();
        Object.assign(CONFIG, fileConfig);
      }
    } catch (error) {
      console.warn('Failed to load config file, using defaults');
    }

    // Storage: path fixo /propagandas, interno + USB (Linux)
    if (typeof StorageHelper === 'undefined' || typeof MediaCacheManager === 'undefined') {
      throw new Error('StorageHelper/MediaCacheManager não carregados. Inclua os scripts no index.html.');
    }
    storageHelper = new StorageHelper({
      pathBase: CONFIG.storagePath || null,
      useExternalFirst: CONFIG.useExternalFirst !== undefined ? CONFIG.useExternalFirst : true
    });
    await storageHelper.ensurePropagandasDirs();
    mediaCacheManager = new MediaCacheManager(storageHelper);

    // Inicializar cache (legado)
    if (CONFIG.CACHE_ENABLED) {
      cache = new Cache();
      cache.setMaxSize(CONFIG.CACHE_MAX_SIZE);
    }

    // Inicializar API client
    apiClient = new APIClient(
      CONFIG.API_BASE_URL || CONFIG.apiBaseURL,
      CONFIG.TOTEM_UIN || CONFIG.totemUIN,
      CONFIG.TOTEM_SECRET || CONFIG.totemSecret
    );

    // Inicializar logger
    logger = new Logger(apiClient, CONFIG.logLevel || 'info');

    // Inicializar error handler
    errorHandler = new ErrorHandler(logger, apiClient);

    // DeviceId para Linux
    const os = require('os');
    deviceId = CONFIG.deviceId || `linux-${os.hostname()}-${require('crypto').randomBytes(4).toString('hex')}`;

    // Token: tentar getDeviceToken (fluxo DispatchPlan)
    if (CONFIG.TOTEM_UIN || CONFIG.totemUIN) {
      try {
        const tokenRes = await apiClient.getDeviceToken(
          CONFIG.TOTEM_UIN || CONFIG.totemUIN,
          deviceId,
          'linux',
          '2.1.0'
        );
        if (tokenRes && tokenRes.token) {
          deviceToken = tokenRes.token;
          apiClient.token = deviceToken;
          logger.info('Device token obtido (DispatchPlan)');
        }
      } catch (e) {
        logger.warn('getDeviceToken falhou, tentando auth legado', e);
      }
    }

    // Autenticar totem (legado, se ainda não tem token)
    if (!apiClient.token) {
      const authenticated = await apiClient.authenticateTotem();
      if (!authenticated) {
        logger.error('Failed to authenticate totem');
        showError('Falha na autenticação. Verifique a configuração.');
        return;
      }
      logger.info('Totem authenticated successfully');
    }

    // Inicializar scheduler
    scheduler = new Scheduler();

    // Inicializar playlist manager (legado)
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

    // Debug: botão e painel storage
    setupDebugPanel();

    // Carregar e iniciar: preferir DispatchPlan (propagandas), fallback playlist legada
    await loadAndStartPlaylist();

    // Configurar atualização periódica (DispatchPlan ou playlist legada)
    setInterval(async () => {
      await loadAndStartPlaylist();
    }, CONFIG.PLAYLIST_UPDATE_INTERVAL);

    // Atualizar scheduler periodicamente
    setInterval(() => {
      const currentItem = playlistManager.getCurrentItem();
      if (currentItem && !scheduler.shouldDisplay(currentItem)) {
        logger.info('Current item no longer scheduled, loading next');
        playNext();
      }
    }, 60000);

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
 * Inicializa SmartDisplayFX
 */
async function initSmartDisplayFX() {
  try {
    // Verificar se módulos foram carregados
    if (!window.SmartDisplayFX || !window.SmartDisplayFX.WebPlayerBridge) {
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

    const { WebPlayerBridge, FxEngine, SmartDisplayFlowClient } = window.SmartDisplayFX;
    
    // Inicializar PlayerBridge
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
      const effectStartTime = Date.now();

      if (fxEngine) {
        fxEngine.playEffect(payload, {
          isOrigin: context.isOrigin,
          isTarget: context.isTarget,
          currentTotemId: totemId,
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
              edge: context.isTarget ? payload.to?.edge : payload.from?.edge,
              isOrigin: context.isOrigin,
              isTarget: context.isTarget,
            },
          });
        } catch (e) {
          logger?.warn('Erro ao enviar telemetria inicial', e);
        }
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
 * Carrega DispatchPlan e processa cache em propagandas (interno + USB)
 */
async function loadFromDispatchPlan() {
  if (!deviceToken && !apiClient.token) return false;
  const uin = CONFIG.TOTEM_UIN || CONFIG.totemUIN;
  if (!uin) return false;
  try {
    const plan = await apiClient.getDispatchPlan(
      uin,
      deviceToken || apiClient.token,
      deviceId,
      null,
      Intl.DateTimeFormat().resolvedOptions().timeZone
    );
    if (!plan || !plan.mediaItems || !plan.mediaItems.length) {
      return false;
    }
    currentDispatchPlan = plan;
    currentDispatchIndex = 0;
    const stats = await mediaCacheManager.processDispatchPlan(plan, apiClient);
    logger.info('DispatchPlan carregado: ' + plan.mediaItems.length + ' itens, cache: ' + stats.success + ' ok, ' + stats.skipped + ' skip, ' + stats.failed + ' fail');
    return true;
  } catch (e) {
    logger.warn('loadFromDispatchPlan falhou', e);
    return false;
  }
}

/**
 * Aplica config do player vinda da API (ex.: storage externo/interno) — paridade com Android.
 */
async function applyPlayerConfigFromApi() {
  try {
    const config = await apiClient.getConfig();
    if (config && typeof config.storageUseExternalFirst === 'boolean' && storageHelper) {
      storageHelper.useExternalFirst = config.storageUseExternalFirst;
      logger?.info('Config aplicada: storageUseExternalFirst=' + config.storageUseExternalFirst);
    }
  } catch (e) {
    logger?.warn('Erro ao obter config do player (usando defaults)', e);
  }
}

/**
 * Carrega e inicia playlist (DispatchPlan primeiro, depois legada)
 */
async function loadAndStartPlaylist() {
  try {
    updateStatus('Carregando playlist...');

    await applyPlayerConfigFromApi();

    let useDispatch = false;
    if (deviceToken || apiClient.token) {
      useDispatch = await loadFromDispatchPlan();
      if (!useDispatch && mediaCacheManager) {
        const lastPlan = await mediaCacheManager.loadLastDispatchPlan();
        if (lastPlan && lastPlan.mediaItems && lastPlan.mediaItems.length) {
          currentDispatchPlan = lastPlan;
          currentDispatchIndex = 0;
          useDispatch = true;
          logger.info('Usando último DispatchPlan em cache (offline)');
        }
      }
    }

    if (useDispatch) {
      updateStatus('Playlist carregada (DispatchPlan)');
      playNext();
      return;
    }

    await playlistManager.loadPlaylist();
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
    currentDispatchPlan = null;
    updateStatus('Playlist carregada');
    playNext();
  } catch (error) {
    if (errorHandler) {
      errorHandler.handle(error, { phase: 'load_playlist' });
    } else if (logger) {
      logger.error('Failed to load playlist', error);
    }
    updateStatus('Erro ao carregar playlist');
    setTimeout(loadAndStartPlaylist, 10000);
  }
}

/**
 * Reproduz próximo item (DispatchPlan com path local ou playlist legada)
 */
async function playNext() {
  if (currentDispatchPlan && currentDispatchPlan.mediaItems && currentDispatchPlan.mediaItems.length) {
    const idx = currentDispatchIndex % currentDispatchPlan.mediaItems.length;
    currentDispatchIndex = (currentDispatchIndex + 1) % currentDispatchPlan.mediaItems.length;
    const mediaItem = currentDispatchPlan.mediaItems[idx];
    const localPath = mediaCacheManager ? await mediaCacheManager.getLocalPath(mediaItem.mediaId) : null;
    const item = {
      id: mediaItem.mediaId,
      type: (mediaItem.mediaType || 'video').toLowerCase(),
      url: localPath ? 'file://' + localPath : mediaItem.url,
      localPath: localPath || null,
      duration: (mediaItem.duration || 10) * 1000,
      name: 'Item ' + mediaItem.mediaId
    };
    try {
      updateStatus('Reproduzindo: ' + item.name);
      await mediaPlayer.play(item);
    } catch (error) {
      if (errorHandler) errorHandler.handle(error, { phase: 'play_media', itemId: item.id });
      else if (logger) logger.error('Failed to play media', error);
      setTimeout(playNext, 2000);
    }
    return;
  }

  const item = playlistManager.getNextItem();
  if (!item) {
    logger.warn('No items in playlist');
    updateStatus('Nenhum item na playlist');
    setTimeout(loadAndStartPlaylist, 5000);
    return;
  }

  if (scheduler && !scheduler.shouldDisplay(item)) {
    playNext();
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
    setTimeout(playNext, 2000);
  }
}

/**
 * Painel Debug: storage (interno + USB), ordem, ficheiros em propagandas
 */
function setupDebugPanel() {
  const btn = document.getElementById('btn-debug');
  const panel = document.getElementById('debug-panel');
  const text = document.getElementById('debug-storage-text');
  const btnRefresh = document.getElementById('btn-debug-refresh-storage');
  if (!btn || !panel) return;

  btn.addEventListener('click', () => {
    panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
    if (panel.style.display === 'block') refreshDebugStorageInfo();
  });

  if (btnRefresh) {
    btnRefresh.addEventListener('click', () => refreshDebugStorageInfo());
  }
}

async function refreshDebugStorageInfo() {
  const text = document.getElementById('debug-storage-text');
  if (!text || !storageHelper) return;
  try {
    const info = await storageHelper.getDebugStorageInfo();
    let s = 'Ordem de resolução: ' + info.resolutionOrder + '\n\n';
    for (const e of info.entries) {
      s += e.label + '\n  Path: ' + e.path + '\n  Ficheiros em propagandas: ' + e.fileCount + '\n';
      if (e.fileNames && e.fileNames.length) s += '  Ficheiros: ' + e.fileNames.slice(0, 15).join(', ') + (e.fileNames.length > 15 ? '...' : '') + '\n';
      s += '\n';
    }
    text.textContent = s;
  } catch (e) {
    text.textContent = 'Erro ao obter info: ' + (e && e.message);
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
  }
});

window.addEventListener('unhandledrejection', (event) => {
  if (errorHandler) {
    errorHandler.handle(event.reason, { type: 'unhandled_promise_rejection' });
  }
});

