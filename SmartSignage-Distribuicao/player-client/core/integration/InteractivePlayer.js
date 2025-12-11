/**
 * Interactive Player - Smart Signage Pro v2.1
 * Integração completa de todos os serviços interativos
 */

class InteractivePlayer {
  constructor(config = {}) {
    this.config = {
      totemId: config.totemId || null,
      apiClient: config.apiClient || null,
      mediaPlayer: config.mediaPlayer || null,
      ...config
    };

    // Serviços
    this.localPlaylistManager = null;
    this.interruptionManager = null;
    this.facialRecognition = null;
    this.tagReader = null;
    this.visualNetwork = null;

    // Estado
    this.initialized = false;
    this.currentPlaylist = null;
    this.currentItem = null;
  }

  /**
   * Inicializa todos os serviços
   */
  async initialize() {
    if (this.initialized) {
      console.warn('[InteractivePlayer] Já inicializado');
      return;
    }

    try {
      console.log('[InteractivePlayer] Inicializando serviços...');

      // 1. Inicializar Local Playlist Manager
      this.localPlaylistManager = new LocalPlaylistManager({
        syncInterval: 300,
        cacheExpiration: 3600,
        offlineMode: true
      });
      window.localPlaylistManager = this.localPlaylistManager;

      // 2. Inicializar Interruption Manager
      this.interruptionManager = new InterruptionManager();
      window.interruptionManager = this.interruptionManager;

      // 3. Inicializar Facial Recognition (opcional)
      if (this.config.enableFacialRecognition !== false) {
        try {
          this.facialRecognition = new FacialRecognitionService({
            enabled: true,
            camera: 'front',
            defaultContentId: this.config.defaultInteractiveContentId
          });
          await this.facialRecognition.initialize();
          window.facialRecognition = this.facialRecognition;
          console.log('[InteractivePlayer] Reconhecimento facial inicializado');
        } catch (error) {
          console.warn('[InteractivePlayer] Reconhecimento facial não disponível:', error);
        }
      }

      // 4. Inicializar Tag Reader (opcional)
      if (this.config.enableTagReader !== false) {
        try {
          this.tagReader = new TagReaderService({
            enabled: true,
            types: ['nfc', 'qr_code'],
            defaultContentId: this.config.defaultInteractiveContentId
          });
          await this.tagReader.initialize();
          window.tagReader = this.tagReader;
          console.log('[InteractivePlayer] Leitor de tags inicializado');
        } catch (error) {
          console.warn('[InteractivePlayer] Leitor de tags não disponível:', error);
        }
      }

      // 5. Inicializar Visual Network (opcional)
      if (this.config.enableVisualNetwork !== false) {
        try {
          this.visualNetwork = new VisualNetworkService({
            enabled: true,
            totemId: this.config.totemId,
            signalingServer: this.config.signalingServer || 'ws://localhost:8080'
          });
          await this.visualNetwork.connectToNetwork();
          window.visualNetwork = this.visualNetwork;
          console.log('[InteractivePlayer] Rede visual inicializada');
        } catch (error) {
          console.warn('[InteractivePlayer] Rede visual não disponível:', error);
        }
      }

      // 6. Configurar callbacks
      this.setupCallbacks();

      this.initialized = true;
      console.log('[InteractivePlayer] Todos os serviços inicializados com sucesso');
    } catch (error) {
      console.error('[InteractivePlayer] Erro ao inicializar:', error);
      throw error;
    }
  }

  /**
   * Configura callbacks entre serviços
   */
  setupCallbacks() {
    // Facial Recognition → Interruption Manager
    if (this.facialRecognition) {
      this.facialRecognition.onFaceDetected(async (signal) => {
        await this.interruptionManager.handleInterrupt(signal);
        
        // Broadcast para rede
        if (this.visualNetwork) {
          await this.visualNetwork.broadcastInteraction({
            type: 'facial_recognition',
            metadata: signal.metadata
          });
        }
      });
    }

    // Tag Reader → Interruption Manager
    if (this.tagReader) {
      this.tagReader.onTagDetected(async (signal) => {
        await this.interruptionManager.handleInterrupt(signal);
        
        // Broadcast para rede
        if (this.visualNetwork) {
          await this.visualNetwork.broadcastInteraction({
            type: 'tag_id',
            metadata: signal.metadata
          });
        }
      });
    }

    // Visual Network → Interruption Manager
    if (this.visualNetwork) {
      this.visualNetwork.onInteractionReceived(async (interaction) => {
        // Processar interação de outro totem
        if (interaction.type === 'facial_recognition' || interaction.type === 'tag_id') {
          await this.interruptionManager.handleInterrupt({
            type: 'network_interaction',
            priority: 2, // CRITICAL
            contentId: null, // Será buscado pelo processInteraction
            metadata: interaction
          });
        }
      });
    }

    // Interruption Manager callbacks
    this.interruptionManager.onInterrupt((content) => {
      console.log('[InteractivePlayer] Conteúdo interrompido:', content);
    });

    this.interruptionManager.onResume((content) => {
      console.log('[InteractivePlayer] Conteúdo retomado:', content);
    });
  }

  /**
   * Carrega e inicia reprodução de playlist
   */
  async loadPlaylist(playlistId) {
    try {
      console.log('[InteractivePlayer] Carregando playlist:', playlistId);

      // 1. Sincronizar playlist
      const playlist = await this.localPlaylistManager.syncPlaylist(playlistId);
      
      if (!playlist) {
        throw new Error('Playlist não encontrada');
      }

      this.currentPlaylist = playlist;

      // 2. Iniciar sincronização automática
      this.localPlaylistManager.startAutoSync(playlistId);

      // 3. Iniciar reprodução
      await this.startPlayback();

      console.log('[InteractivePlayer] Playlist carregada e reprodução iniciada');
    } catch (error) {
      console.error('[InteractivePlayer] Erro ao carregar playlist:', error);
      throw error;
    }
  }

  /**
   * Inicia reprodução da playlist
   */
  async startPlayback() {
    if (!this.currentPlaylist || !this.currentPlaylist.items) {
      throw new Error('Playlist não carregada');
    }

    const items = this.currentPlaylist.items;
    let index = 0;

    const playNext = async () => {
      if (index >= items.length) {
        index = 0; // Loop
      }

      const item = items[index];
      this.currentItem = item;

      // Verificar se item pode ser interrompido
      const priority = this.getItemPriority(item);
      const interruptible = item.interruptible !== false;

      // Definir como conteúdo atual no Interruption Manager
      this.interruptionManager.setCurrentContent({
        ...item,
        priority: priority,
        interruptible: interruptible,
        player: this.config.mediaPlayer
      });

      // Carregar mídia do cache ou servidor
      const media = await this.loadMedia(item.media);

      // Reproduzir
      if (this.config.mediaPlayer) {
        await this.config.mediaPlayer.play(media, {
          duration: item.duration,
          onEnd: () => {
            index++;
            playNext();
          }
        });
      } else {
        // Fallback: aguardar duração e passar para próximo
        setTimeout(() => {
          index++;
          playNext();
        }, (item.duration || 10) * 1000);
      }
    };

    // Iniciar reprodução
    playNext();
  }

  /**
   * Carrega mídia (cache ou servidor)
   */
  async loadMedia(media) {
    // Tentar do cache primeiro
    const cached = await this.localPlaylistManager.getCachedMedia(media.id);
    if (cached) {
      return {
        ...media,
        blob: cached,
        url: URL.createObjectURL(cached)
      };
    }

    // Se não estiver em cache, buscar do servidor
    if (this.config.apiClient) {
      const response = await this.config.apiClient.get(`/api/media/${media.id}/download`);
      const blob = await response.blob();
      
      // Cachear
      await this.localPlaylistManager.cacheMedia(media.id, blob);
      
      return {
        ...media,
        blob: blob,
        url: URL.createObjectURL(blob)
      };
    }

    // Fallback: usar path direto
    return {
      ...media,
      url: media.path
    };
  }

  /**
   * Obtém prioridade do item
   */
  getItemPriority(item) {
    if (item.priority) {
      const priorityMap = {
        'normal': 0,
        'high': 1,
        'critical': 2,
        'interactive': 3
      };
      return priorityMap[item.priority] || 0;
    }
    return 0; // NORMAL por padrão
  }

  /**
   * Para todos os serviços
   */
  stop() {
    console.log('[InteractivePlayer] Parando serviços...');

    if (this.localPlaylistManager) {
      this.localPlaylistManager.stopAutoSync();
    }

    if (this.facialRecognition) {
      this.facialRecognition.stop();
    }

    if (this.tagReader) {
      this.tagReader.stop();
    }

    if (this.visualNetwork) {
      this.visualNetwork.disconnect();
    }

    this.initialized = false;
    console.log('[InteractivePlayer] Serviços parados');
  }

  /**
   * Obtém status de todos os serviços
   */
  getStatus() {
    return {
      initialized: this.initialized,
      currentPlaylist: this.currentPlaylist ? {
        id: this.currentPlaylist.playlistId,
        version: this.currentPlaylist.version,
        itemsCount: this.currentPlaylist.items?.length || 0
      } : null,
      currentItem: this.currentItem ? {
        id: this.currentItem.id,
        priority: this.getItemPriority(this.currentItem)
      } : null,
      services: {
        localPlaylistManager: this.localPlaylistManager ? this.localPlaylistManager.getCacheStatus() : null,
        interruptionManager: this.interruptionManager ? this.interruptionManager.getStatus() : null,
        facialRecognition: this.facialRecognition ? this.facialRecognition.getStatus?.() : null,
        tagReader: this.tagReader ? this.tagReader.getStatus() : null,
        visualNetwork: this.visualNetwork ? this.visualNetwork.getStatus() : null
      }
    };
  }
}

// Exportar
if (typeof window !== 'undefined') {
  window.InteractivePlayer = InteractivePlayer;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = InteractivePlayer;
}

