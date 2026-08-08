/**
 * Exemplo de Integração com Dispatcher e Cache Local
 * 
 * Este exemplo demonstra como integrar:
 * - APIClient com novos endpoints (/api/player/token, /api/player/dispatch)
 * - MediaDownloader para download e cache de mídias
 * - LocalHttpServer para servir mídias às TVs associadas
 * - Modo offline com fallback
 */

// Exemplo de uso (Node.js/Electron)

class DispatcherIntegration {
  constructor(config) {
    this.config = {
      baseURL: config.baseURL || 'http://localhost:3000',
      uin: config.uin,
      totemSecret: config.totemSecret,
      deviceId: String(config.deviceId || this.generateDeviceId()).trim().toUpperCase(),
      platform: config.platform || 'linux',
      appVersion: config.appVersion || '2.1.0',
      cacheDir: config.cacheDir || './cache',
      ...config
    };

    // Inicializar componentes
    this.apiClient = null;
    this.mediaDownloader = null;
    this.localServer = null;
    this.currentDispatchPlan = null;
    
    // Estado
    this.token = null;
    this.isOnline = true;
    this.syncInterval = null;
  }

  /**
   * Inicializa todos os componentes
   */
  async initialize() {
    console.log('[DispatcherIntegration] Inicializando...');

    // 1. Inicializar API Client
    const APIClient = require('../api/client');
    this.apiClient = new APIClient(
      this.config.baseURL,
      this.config.uin,
      this.config.totemSecret
    );

    // 2. Obter token de dispositivo
    await this.obtainDeviceToken();

    // 3. Inicializar Media Downloader
    await this.initializeMediaDownloader();

    // 4. Inicializar servidor HTTP local (apenas para totens)
    if (this.shouldStartLocalServer()) {
      await this.initializeLocalServer();
    }

    // 5. Heartbeat inicial (contrato: token → heartbeat → dispatch nas syncs seguintes)
    await this.initialHeartbeat();

    console.log('[DispatcherIntegration] Inicialização concluída');
  }

  /**
   * Primeiro POST /api/player/heartbeat após /token — regista online e atualiza token na resposta.
   */
  async initialHeartbeat() {
    console.log('[DispatcherIntegration] Ciclo de vida: heartbeat inicial...');
    await this.sendHeartbeat({ phase: 'startup' });
    console.log('[DispatcherIntegration] Ciclo de vida: heartbeat inicial OK');
  }

  /**
   * Obtém token de dispositivo
   */
  async obtainDeviceToken() {
    try {
      console.log('[DispatcherIntegration] Obtendo token de dispositivo...');
      
      const response = await this.apiClient.getDeviceToken(
        this.config.uin,
        this.config.deviceId,
        this.config.platform,
        this.config.appVersion
      );

      if (response.token) {
        this.token = response.token;
        this.apiClient.token = response.token;
        console.log('[DispatcherIntegration] Token obtido com sucesso');
        return true;
      }

      throw new Error('Token não retornado na resposta');
    } catch (error) {
      console.error('[DispatcherIntegration] Erro ao obter token:', error);
      this.isOnline = false;
      throw error;
    }
  }

  /**
   * Inicializa Media Downloader
   */
  async initializeMediaDownloader() {
    const MediaDownloader = require('../cache/MediaDownloader');
    const FileSystem = this.createFileSystemAdapter();
    const Storage = this.createStorageAdapter();

    this.mediaDownloader = new MediaDownloader({
      cacheDir: this.config.cacheDir,
      maxCacheSize: 32 * 1024 * 1024 * 1024, // 32GB
      apiClient: this.apiClient,
      fileSystem: FileSystem,
      storage: Storage
    });

    console.log('[DispatcherIntegration] Media Downloader inicializado');
  }

  /**
   * Inicializa servidor HTTP local
   */
  async initializeLocalServer() {
    const LocalHttpServer = require('../server/LocalHttpServer');

    this.localServer = new LocalHttpServer({
      port: 8080,
      cacheDir: this.config.cacheDir,
      mediaDownloader: this.mediaDownloader,
      apiClient: this.apiClient
    });

    await this.localServer.start();
    console.log(`[DispatcherIntegration] Servidor HTTP local iniciado em ${this.localServer.getBaseUrl()}`);
  }

  /**
   * Verifica se deve iniciar servidor local (apenas para totens)
   */
  shouldStartLocalServer() {
    // Totens devem iniciar servidor, TVs não
    // Você pode adicionar lógica aqui para determinar isso
    return this.config.platform !== 'webos' && this.config.platform !== 'tizen';
  }

  /**
   * Obtém DispatchPlan e processa mídias
   */
  async syncDispatchPlan() {
    try {
      console.log('[DispatcherIntegration] Sincronizando DispatchPlan...');

      // Tentar obter novo plano do dispatcher
      const dispatchPlan = await this.apiClient.getDispatchPlan(
        this.config.uin,
        this.token,
        this.config.deviceId,
        new Date().toISOString(),
        Intl.DateTimeFormat().resolvedOptions().timeZone
      );

      // Verificar se plano mudou
      if (this.hasPlanChanged(dispatchPlan)) {
        console.log('[DispatcherIntegration] Novo DispatchPlan recebido');

        // Processar download de mídias
        const downloadStats = await this.mediaDownloader.processDispatchPlan(dispatchPlan);
        console.log('[DispatcherIntegration] Download concluído:', downloadStats);

        // Atualizar plano atual
        this.currentDispatchPlan = dispatchPlan;
        this.isOnline = true;

        return dispatchPlan;
      } else {
        console.log('[DispatcherIntegration] DispatchPlan não mudou');
        return this.currentDispatchPlan;
      }

    } catch (error) {
      console.error('[DispatcherIntegration] Erro ao sincronizar:', error);
      this.isOnline = false;

      // Tentar usar último plano em cache (modo offline)
      return await this.fallbackToOfflineMode();
    }
  }

  /**
   * Verifica se plano mudou
   */
  hasPlanChanged(newPlan) {
    if (!this.currentDispatchPlan) {
      return true;
    }

    // Comparar IDs de playlist e timestamps
    const oldPlaylistId = this.currentDispatchPlan.playlistId;
    const newPlaylistId = newPlan.playlistId;

    if (oldPlaylistId !== newPlaylistId) {
      return true;
    }

    // Comparar número de mídias
    const oldMediaCount = this.currentDispatchPlan.mediaItems?.length || 0;
    const newMediaCount = newPlan.mediaItems?.length || 0;

    if (oldMediaCount !== newMediaCount) {
      return true;
    }

    // Comparar IDs de mídias
    const oldMediaIds = (this.currentDispatchPlan.mediaItems || [])
      .map(item => item.mediaId)
      .sort()
      .join(',');
    const newMediaIds = (newPlan.mediaItems || [])
      .map(item => item.mediaId)
      .sort()
      .join(',');

    return oldMediaIds !== newMediaIds;
  }

  /**
   * Modo offline: usa último plano em cache
   */
  async fallbackToOfflineMode() {
    console.log('[DispatcherIntegration] Entrando em modo offline...');

    const lastPlan = await this.mediaDownloader.loadLastDispatchPlan();
    
    if (lastPlan) {
      console.log('[DispatcherIntegration] Usando último DispatchPlan em cache');
      this.currentDispatchPlan = lastPlan;
      return lastPlan;
    }

    console.warn('[DispatcherIntegration] Nenhum plano em cache disponível');
    return null;
  }

  /**
   * Inicia sincronização periódica
   */
  startAutoSync(intervalMs = 900000) { // 15 minutos padrão
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    // Sincronizar imediatamente
    this.syncDispatchPlan().catch(err => {
      console.error('[DispatcherIntegration] Erro na sincronização inicial:', err);
    });

    // Sincronizar periodicamente
    this.syncInterval = setInterval(() => {
      this.syncDispatchPlan().catch(err => {
        console.error('[DispatcherIntegration] Erro na sincronização periódica:', err);
      });
    }, intervalMs);

    console.log(`[DispatcherIntegration] Sincronização automática iniciada (intervalo: ${intervalMs}ms)`);
  }

  /**
   * Para sincronização periódica
   */
  stopAutoSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
      console.log('[DispatcherIntegration] Sincronização automática parada');
    }
  }

  /**
   * Obtém caminho local de uma mídia
   */
  async getMediaLocalPath(mediaId) {
    const cached = await this.mediaDownloader.getCachedMedia(mediaId);
    return cached ? cached.localPath : null;
  }

  /**
   * Obtém URL local de uma mídia (para TVs acessarem via HTTP)
   */
  getMediaLocalUrl(mediaId) {
    if (this.localServer && this.localServer.isServerRunning()) {
      // Obter nome do arquivo do cache
      // Assumir formato: {mediaId}_{checksum}.{ext}
      // Em produção, você deve buscar isso do MediaDownloader
      return `${this.localServer.getBaseUrl()}/media/${mediaId}`;
    }
    return null;
  }

  /**
   * Envia heartbeat
   */
  async sendHeartbeat(metrics = {}) {
    try {
      const response = await this.apiClient.sendHeartbeat({
        status: 'online',
        version: this.config.appVersion,
        platform: this.config.platform,
        deviceId: this.config.deviceId,
        metrics: {
          ...metrics,
          cacheSize: await this.mediaDownloader.getCacheSize(),
          isOnline: this.isOnline
        }
      });

      // Atualizar token se necessário
      if (response.token) {
        this.token = response.token;
        this.apiClient.token = response.token;
      }

      return response;
    } catch (error) {
      console.error('[DispatcherIntegration] Erro ao enviar heartbeat:', error);
      this.isOnline = false;
      throw error;
    }
  }

  /**
   * Cria adaptador de FileSystem usando factory
   */
  createFileSystemAdapter() {
    const { createFileSystemAdapter } = require('../adapters/FileSystemAdapter');
    return createFileSystemAdapter(this.config.platform, {
      baseDir: this.config.cacheDir
    });
  }

  /**
   * Cria adaptador de Storage usando factory
   */
  createStorageAdapter() {
    const { createStorageAdapter } = require('../adapters/StorageAdapter');
    return createStorageAdapter(this.config.platform, {
      storageFile: require('path').join(this.config.cacheDir, 'metadata.json'),
      androidBridge: this.config.androidBridge // Se disponível
    });
  }

  /**
   * Gera Device ID único
   */
  generateDeviceId() {
    // Em produção, usar ID real do dispositivo
    // Exemplo: Android ID, webOS deviceId, serial number, etc.
    return `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Limpa recursos
   */
  async cleanup() {
    this.stopAutoSync();

    if (this.localServer) {
      await this.localServer.stop();
    }

    console.log('[DispatcherIntegration] Recursos limpos');
  }
}

// Exemplo de uso:
/*
async function main() {
  const integration = new DispatcherIntegration({
    baseURL: 'http://localhost:3000',
    uin: 'TOTEM-001',
    totemSecret: 'secret-key',
    deviceId: 'DEVICE-123',
    platform: 'linux',
    appVersion: '2.1.0',
    cacheDir: './cache'
  });

  try {
    // Inicializar (token → heartbeat inicial → pronto para dispatch)
    await integration.initialize();

    // Sincronizar DispatchPlan (primeiro fetch após ciclo de vida)
    const plan = await integration.syncDispatchPlan();
    console.log('Plano recebido:', plan);

    // Iniciar sincronização automática
    integration.startAutoSync(900000); // 15 minutos

    // Enviar heartbeat periódico
    setInterval(() => {
      integration.sendHeartbeat({
        cpuUsage: 10.5,
        memoryUsage: 45.2
      }).catch(console.error);
    }, 30000); // 30 segundos

    // Obter caminho local de uma mídia
    const mediaPath = await integration.getMediaLocalPath(1);
    console.log('Mídia local:', mediaPath);

  } catch (error) {
    console.error('Erro:', error);
  }
}

// Executar se for script principal
if (require.main === module) {
  main().catch(console.error);
}
*/

// Exportar
if (typeof module !== 'undefined' && module.exports) {
  module.exports = DispatcherIntegration;
} else {
  window.DispatcherIntegration = DispatcherIntegration;
}
