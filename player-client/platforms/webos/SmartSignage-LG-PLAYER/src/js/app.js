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
  DEVICE_ID: '', // Será obtido do webOS
  PLATFORM: 'webos',
  APP_VERSION: '2.1.0',
  HEARTBEAT_INTERVAL: 30000, // 30 segundos
  PLAYLIST_UPDATE_INTERVAL: 900000, // 15 minutos (sincronização DispatchPlan)
  CACHE_ENABLED: true,
  CACHE_MAX_SIZE: 50 * 1024 * 1024, // 50MB (cache leve para webOS)
  USE_DISPATCHER: true, // Usar novo dispatcher por padrão
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
let deviceToken = null; // Token de dispositivo do dispatcher
let currentDispatchPlan = null; // Último DispatchPlan recebido
let totemConnectionManager = null; // Gerenciador de conexão com totem
let mediaCacheManager = null; // Gerenciador de cache local
let storageHelper = null; // Storage propagandas, externo por defeito (design 3.3)

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

    // Inicializar TotemConnectionManager (descoberta totem local vs servidor central)
    totemConnectionManager = new TotemConnectionManager({
      totemIP: CONFIG.TOTEM_IP || null,
      totemPort: CONFIG.TOTEM_PORT || 8080,
      totemUIN: CONFIG.TOTEM_UIN,
      apiBaseURL: CONFIG.API_BASE_URL,
      autoDiscovery: CONFIG.AUTO_DISCOVERY !== false,
      discoveryTimeout: 5000
    });

    // Determinar estratégia de conexão (totem local ou servidor central)
    const connectionStrategy = await totemConnectionManager.determineConnectionStrategy();
    
    if (connectionStrategy.useLocalTotem) {
      logger?.info('Totem local encontrado, usando como dispatcher e cache', connectionStrategy.totemInfo);
      // Atualizar configuração para usar totem local
      CONFIG.API_BASE_URL = totemConnectionManager.getBaseURL();
      CONFIG.TOTEM_UIN = totemConnectionManager.getTotemUIN();
    } else {
      logger?.info('Totem local não encontrado, usando servidor central');
    }

    // Storage: path propagandas, externo por defeito (design 3.3)
    if (typeof StorageHelper !== 'undefined') {
      storageHelper = new StorageHelper({
        useExternalFirst: CONFIG.useExternalFirst !== undefined ? CONFIG.useExternalFirst : true
      });
      await storageHelper.ensurePropagandasDirs();
    }

    // Inicializar cache
    if (CONFIG.CACHE_ENABLED) {
      cache = new Cache();
      cache.setMaxSize(CONFIG.CACHE_MAX_SIZE);
      
      // Inicializar MediaCacheManager para cache local em .../propagandas/
      if (typeof MediaCacheManager !== 'undefined') {
        mediaCacheManager = new MediaCacheManager({
          maxCacheSize: CONFIG.CACHE_MAX_SIZE,
          cacheDir: '/media/internal/smartsignage/cache',
          storageHelper: storageHelper
        });
        await mediaCacheManager.init();
      }
    }

    // Inicializar API client (com URL atualizada pelo TotemConnectionManager)
    apiClient = new APIClient(
      CONFIG.API_BASE_URL,
      CONFIG.TOTEM_UIN,
      CONFIG.TOTEM_SECRET
    );

    // Inicializar logger (depois do API client)
    logger = new Logger(apiClient, CONFIG.logLevel || 'info');

    // Inicializar error handler
    errorHandler = new ErrorHandler(logger, apiClient);

    // Obter deviceId do webOS
    if (typeof webOS !== 'undefined' && webOS.deviceInfo) {
      try {
        const deviceInfo = webOS.deviceInfo();
        CONFIG.DEVICE_ID = String(deviceInfo.deviceId || `webos-${Date.now()}`).trim().toUpperCase();
        logger.info('Device ID obtained', { deviceId: CONFIG.DEVICE_ID });
      } catch (error) {
        logger.warn('Failed to get device ID, using fallback', error);
        CONFIG.DEVICE_ID = `WEBOS-${Date.now()}`;
      }
    } else {
      CONFIG.DEVICE_ID = `WEBOS-${Date.now()}`;
    }

    apiClient.deviceId = CONFIG.DEVICE_ID;

    // Obter token de dispositivo + heartbeat inicial (novo fluxo)
    if (CONFIG.USE_DISPATCHER) {
      try {
        if (typeof apiClient.dispatcherStartupSequence === 'function') {
          await apiClient.dispatcherStartupSequence({
            uin: CONFIG.TOTEM_UIN,
            deviceId: CONFIG.DEVICE_ID,
            platform: CONFIG.PLATFORM,
            appVersion: CONFIG.APP_VERSION,
          });
          deviceToken = apiClient.token;
          logger.info('Dispatcher: token + heartbeat inicial (webos)');
        } else {
          const tokenResponse = await apiClient.getDeviceToken(
            CONFIG.TOTEM_UIN,
            CONFIG.DEVICE_ID,
            CONFIG.PLATFORM,
            CONFIG.APP_VERSION
          );

          if (tokenResponse && tokenResponse.token) {
            deviceToken = tokenResponse.token;
            apiClient.token = deviceToken;
            logger.info('Device token obtained successfully');
          } else {
            logger.warn('Failed to get device token, falling back to legacy auth');
            CONFIG.USE_DISPATCHER = false;
          }
        }
      } catch (error) {
        logger.warn('Failed to get device token, falling back to legacy auth', error);
        CONFIG.USE_DISPATCHER = false;
      }
    }

    // Autenticar totem (legado - fallback)
    if (!CONFIG.USE_DISPATCHER) {
      const authenticated = await apiClient.authenticateTotem();
      if (!authenticated) {
        logger.error('Failed to authenticate totem');
        showError('Falha na autenticação. Verifique a configuração.');
        return;
      }
      logger.info('Totem authenticated successfully (legacy)');
    }

    // Inicializar scheduler
    scheduler = new Scheduler();

    // Inicializar playlist manager
    playlistManager = new PlaylistManager(apiClient, cache);

    // Heartbeat: deviceId/platform/version vão em apiClient + métricas (sendHeartbeat do core não recebe argumentos)
    heartbeatService = new HeartbeatService(apiClient, CONFIG.HEARTBEAT_INTERVAL);
    const baseGetSystemMetrics = heartbeatService.getSystemMetrics.bind(heartbeatService);
    heartbeatService.getSystemMetrics = function webosHeartbeatMetrics() {
      const base = baseGetSystemMetrics();
      return {
        ...base,
        deviceId: CONFIG.DEVICE_ID,
        platform: CONFIG.PLATFORM,
        appVersion: CONFIG.APP_VERSION,
        isOnline: navigator.onLine,
        cacheSize: cache ? cache.getSize() : 0,
      };
    };
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
 * Aplica config do player vinda da API (storage externo/interno) — paridade com Android/Linux.
 */
async function applyPlayerConfigFromApi() {
  try {
    if (!apiClient || !apiClient.getConfig) return;
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
 * Carrega e inicia playlist
 */
async function loadAndStartPlaylist() {
  try {
    updateStatus('Carregando conteúdo...');

    await applyPlayerConfigFromApi();
    
    // Tentar usar DispatchPlan primeiro (novo fluxo - NATIVO, sem conversão)
    if (CONFIG.USE_DISPATCHER && deviceToken) {
      try {
        const dispatchPlan = await loadFromDispatchPlan();
        if (dispatchPlan && dispatchPlan.mediaItems && dispatchPlan.mediaItems.length > 0) {
          // Armazenar DispatchPlan nativamente (sem conversão)
          currentDispatchPlan = dispatchPlan;
          currentDispatchPlanIndex = 0; // Resetar índice
          
          // Processar cache local de mídias em background (se disponível)
          if (mediaCacheManager) {
            mediaCacheManager.processDispatchPlan(dispatchPlan, apiClient)
              .then(stats => {
                logger?.info(`Cache processado: ${stats.success} sucesso, ${stats.failed} falhas, ${stats.skipped} puladas`);
              })
              .catch(error => {
                logger?.warn('Erro ao processar cache', error);
              });
          }
          
          updateStatus('Conteúdo carregado');
          playNext();
          return;
        }
      } catch (error) {
        logger.warn('Failed to load from DispatchPlan, falling back to legacy', error);
        
        // Tentar modo offline (último DispatchPlan em cache)
        if (mediaCacheManager) {
          const lastPlan = mediaCacheManager.loadLastDispatchPlan();
          if (lastPlan && lastPlan.mediaItems && lastPlan.mediaItems.length > 0) {
            logger?.info('Usando último DispatchPlan em cache (modo offline)');
            currentDispatchPlan = lastPlan;
            currentDispatchPlanIndex = 0; // Resetar índice
            updateStatus('Conteúdo carregado (modo offline)');
            playNext();
            return;
          }
        }
        
        CONFIG.USE_DISPATCHER = false;
      }
    }
    
    // Fallback: usar playlist legada
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
 * Carrega DispatchPlan do dispatcher
 */
async function loadFromDispatchPlan() {
  if (!apiClient || !deviceToken || !CONFIG.TOTEM_UIN) {
    throw new Error('Missing required configuration for DispatchPlan');
  }

  const timestamp = new Date().toISOString();
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const dispatchPlan = await apiClient.getDispatchPlan(
    CONFIG.TOTEM_UIN,
    deviceToken,
    CONFIG.DEVICE_ID,
    timestamp,
    timezone
  );

  return dispatchPlan;
}

/**
 * DEPRECATED: Converte DispatchPlan para formato de PlaylistResponse
 * 
 * @deprecated Use currentDispatchPlan diretamente. Esta função é mantida apenas para compatibilidade.
 * TODO: Remover quando todos os componentes usarem DispatchPlan nativamente
 */
async function convertDispatchPlanToPlaylist(dispatchPlan, useLocalPaths = false) {
  console.warn('[DEPRECATED] convertDispatchPlanToPlaylist() - Use currentDispatchPlan diretamente');
  
  const items = await Promise.all(dispatchPlan.mediaItems.map(async (item, index) => {
    let url = item.url;
    
    // Tentar usar caminho local do cache (propagandas)
    if (useLocalPaths && mediaCacheManager) {
      const ext = item.metadata?.mimeType ? getFileExtension(item.metadata.mimeType) : null;
      const localPath = await mediaCacheManager.getLocalPath(item.mediaId, ext);
      if (localPath) {
        url = `file://${localPath}`;
        logger?.debug(`Usando mídia do cache local: ${localPath}`);
      } else if (totemConnectionManager && totemConnectionManager.isUsingLocalTotem()) {
        // Tentar usar totem local HTTP
        const totemInfo = totemConnectionManager.getTotemInfo();
        const checksum = item.metadata?.checksum || 'unknown';
        const extension = getFileExtension(item.metadata?.mimeType || 'application/octet-stream');
        url = `http://${totemInfo.ip}:${totemInfo.port}/media/${item.mediaId}_${checksum}.${extension}`;
        logger?.debug(`Usando mídia do totem local: ${url}`);
      }
    }
    
    return {
      id: item.mediaId || index + 1,
      type: item.mediaType || 'image', // 'video', 'image', 'html'
      url: url,
      duration: item.duration || 10, // segundos
      name: item.metadata?.name || `Item ${index + 1}`,
      schedule: null // Agendamento já foi aplicado pelo dispatcher
    };
  }));

  return {
    id: dispatchPlan.playlistId || 0,
    name: dispatchPlan.playlistName || 'DispatchPlan Playlist',
    items: items
  };
}

/**
 * Obtém extensão de arquivo do MIME type
 */
function getFileExtension(mimeType) {
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

// Índice atual para DispatchPlan
let currentDispatchPlanIndex = 0;

/**
 * Reproduz próximo item (agora usa DispatchPlanMediaItem diretamente)
 */
async function playNext() {
  // Prioridade 1: Usar DispatchPlan nativo
  let mediaItem = null;
  if (currentDispatchPlan && currentDispatchPlan.mediaItems && currentDispatchPlan.mediaItems.length > 0) {
    if (currentDispatchPlanIndex < currentDispatchPlan.mediaItems.length) {
      mediaItem = currentDispatchPlan.mediaItems[currentDispatchPlanIndex];
      currentDispatchPlanIndex = (currentDispatchPlanIndex + 1) % currentDispatchPlan.mediaItems.length;
    } else {
      // Resetar índice se necessário
      currentDispatchPlanIndex = 0;
      mediaItem = currentDispatchPlan.mediaItems[currentDispatchPlanIndex];
      currentDispatchPlanIndex = 1;
    }
  }
  
  // Fallback: Formato antigo (compatibilidade)
  if (!mediaItem) {
    const item = playlistManager.getNextItem();
    if (!item) {
      logger.warn('No items in playlist');
      updateStatus('Nenhum item na playlist');
      // Tentar recarregar playlist
      setTimeout(loadAndStartPlaylist, 5000);
      return;
    }
    
    // Converter PlaylistItem para DispatchPlanMediaItem (temporário)
    mediaItem = {
      mediaId: item.id,
      order: playlistManager.currentIndex || 0,
      duration: item.duration ? Math.floor(item.duration / 1000) : 10,
      url: item.url,
      mediaType: item.type,
      metadata: { name: item.name || '' }
    };
  }

  // Validar validade temporal do DispatchPlan (se disponível)
  if (currentDispatchPlan) {
    const now = Date.now();
    const validityStart = currentDispatchPlan.validityStart ? new Date(currentDispatchPlan.validityStart).getTime() : null;
    const validityEnd = currentDispatchPlan.validityEnd ? new Date(currentDispatchPlan.validityEnd).getTime() : null;
    
    if (validityStart && now < validityStart) {
      logger.debug('DispatchPlan ainda não válido, aguardando...');
      setTimeout(playNext, 1000);
      return;
    }
    
    if (validityEnd && now > validityEnd) {
      logger.info('DispatchPlan expirado, recarregando...');
      loadAndStartPlaylist();
      return;
    }
  }

  // Verificar se item deve ser exibido (agendamento - DispatchPlan já aplicou regras, mas podemos validar localmente)
  // Nota: DispatchPlan já considera agendamento, mas podemos ter validação adicional se necessário

  try {
    updateStatus(`Reproduzindo: ${mediaItem.metadata?.name || `Item ${mediaItem.mediaId}`}`);
    
    // Tentar usar caminho local primeiro (propagandas, resolução externo → interno)
    let url = mediaItem.url;
    if (mediaCacheManager) {
      const ext = mediaItem.metadata?.mimeType ? getFileExtension(mediaItem.metadata.mimeType) : null;
      const localPath = await mediaCacheManager.getLocalPath(mediaItem.mediaId, ext);
      if (localPath) {
        url = `file://${localPath}`;
        logger?.debug(`Usando mídia do cache local: ${localPath}`);
      } else if (totemConnectionManager && totemConnectionManager.isUsingLocalTotem()) {
        // Tentar usar totem local HTTP
        const totemInfo = totemConnectionManager.getTotemInfo();
        const checksum = mediaItem.metadata?.checksum || 'unknown';
        const extension = getFileExtension(mediaItem.metadata?.mimeType || 'application/octet-stream');
        url = `http://${totemInfo.ip}:${totemInfo.port}/media/${mediaItem.mediaId}_${checksum}.${extension}`;
        logger?.debug(`Usando mídia do totem local: ${url}`);
      }
    }
    
    // Reproduzir usando DispatchPlanMediaItem diretamente
    await playMediaItem(mediaItem, url);
  } catch (error) {
    if (errorHandler) {
      errorHandler.handle(error, { phase: 'play_media', itemId: mediaItem.mediaId });
    } else if (logger) {
      logger.error('Failed to play media', error, { itemId: mediaItem.mediaId });
    }
    updateStatus('Erro ao reproduzir mídia');
    // Tentar próximo item após delay
    setTimeout(playNext, 2000);
  }
}

/**
 * Reproduz item de mídia do DispatchPlan (formato nativo)
 */
async function playMediaItem(mediaItem, url) {
  switch(mediaItem.mediaType.toLowerCase()) {
    case 'video':
      await mediaPlayer.playVideo(url, mediaItem.duration);
      break;
    case 'image':
      await mediaPlayer.playImage(url, mediaItem.duration || 10);
      break;
    case 'html':
    case 'web':
      await mediaPlayer.playHTML(url, mediaItem.duration || 30);
      break;
    default:
      logger.warn(`Tipo de mídia não suportado: ${mediaItem.mediaType}`);
      playNext();
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

