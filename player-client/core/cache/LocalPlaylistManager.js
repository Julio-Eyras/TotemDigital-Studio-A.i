/**
 * Local Playlist Manager - Smart Signage Pro v2.1
 * Gerenciador avançado de cache local de playlists
 */

class LocalPlaylistManager {
  constructor(config = {}) {
    this.config = {
      syncInterval: config.syncInterval || 300, // 5 minutos
      cacheExpiration: config.cacheExpiration || 3600, // 1 hora
      offlineMode: config.offlineMode !== false,
      maxCacheSize: config.maxCacheSize || 500 * 1024 * 1024, // 500MB
      ...config
    };

    this.storage = window.localStorage;
    this.currentPlaylist = null;
    this.mediaCache = new Map();
    this.syncTimer = null;
  }

  /**
   * Sincroniza playlist do servidor e armazena localmente
   */
  async syncPlaylist(playlistId) {
    try {
      console.log('[LocalPlaylistManager] Sincronizando playlist:', playlistId);

      // 1. Buscar playlist do servidor
      const serverPlaylist = await this.fetchPlaylist(playlistId);
      
      if (!serverPlaylist) {
        throw new Error('Playlist não encontrada no servidor');
      }

      // 2. Verificar se precisa atualizar
      const localVersion = this.getLocalVersion(playlistId);
      if (serverPlaylist.version && serverPlaylist.version <= localVersion) {
        console.log('[LocalPlaylistManager] Playlist já está atualizada');
        return await this.loadFromLocalStorage(playlistId);
      }

      // 3. Baixar mídias que não estão em cache
      await this.downloadMissingMedia(serverPlaylist.items);

      // 4. Salvar no Local Storage
      await this.saveToLocalStorage(playlistId, serverPlaylist);

      // 5. Atualizar cache de mídia
      await this.updateMediaCache(serverPlaylist.items);

      console.log('[LocalPlaylistManager] Playlist sincronizada com sucesso');
      return serverPlaylist;
    } catch (error) {
      console.error('[LocalPlaylistManager] Erro ao sincronizar:', error);
      
      // Tentar carregar do cache local em caso de erro
      const cached = await this.loadFromLocalStorage(playlistId);
      if (cached) {
        console.log('[LocalPlaylistManager] Usando playlist do cache local');
        return cached;
      }
      
      throw error;
    }
  }

  /**
   * Carrega playlist do Local Storage (modo offline)
   */
  async loadFromLocalStorage(playlistId) {
    const key = `playlist_${playlistId}`;
    const data = this.storage.getItem(key);
    
    if (!data) {
      return null;
    }

    try {
      const playlist = JSON.parse(data);

      // Verificar se expirou
      if (playlist.expiresAt && new Date(playlist.expiresAt) < new Date()) {
        console.log('[LocalPlaylistManager] Playlist expirada, tentando sincronizar');
        
        // Tentar sincronizar em background
        this.syncPlaylist(playlistId).catch(err => {
          console.error('[LocalPlaylistManager] Erro ao sincronizar:', err);
        });
        
        // Retornar playlist expirada mesmo assim (melhor que nada)
        return playlist;
      }

      return playlist;
    } catch (error) {
      console.error('[LocalPlaylistManager] Erro ao carregar do cache:', error);
      return null;
    }
  }

  /**
   * Busca playlist do servidor
   */
  async fetchPlaylist(playlistId) {
    const apiClient = window.apiClient;
    if (!apiClient) {
      throw new Error('API Client não disponível');
    }

    const response = await apiClient.get(`/api/player/validate`);
    
    if (response.data && response.data.playlist) {
      return this.mapServerPlaylist(response.data.playlist);
    }

    throw new Error('Playlist não encontrada na resposta do servidor');
  }

  /**
   * Mapeia playlist do servidor para formato local
   */
  mapServerPlaylist(serverPlaylist) {
    return {
      playlistId: serverPlaylist.id,
      version: serverPlaylist.version || Date.now(),
      lastSync: new Date().toISOString(),
      expiresAt: new Date(Date.now() + this.config.cacheExpiration * 1000).toISOString(),
      items: serverPlaylist.items || [],
      priorityRules: serverPlaylist.priorityRules || [],
      config: {
        autoSync: true,
        syncInterval: this.config.syncInterval,
        offlineMode: this.config.offlineMode
      }
    };
  }

  /**
   * Obtém versão local da playlist
   */
  getLocalVersion(playlistId) {
    const playlist = this.loadFromLocalStorage(playlistId);
    return playlist ? (playlist.version || 0) : 0;
  }

  /**
   * Baixa mídias que não estão em cache
   */
  async downloadMissingMedia(items) {
    if (!items || items.length === 0) return;

    console.log('[LocalPlaylistManager] Verificando mídias em cache...');

    for (const item of items) {
      if (item.media && item.media.id) {
        const cached = await this.isMediaCached(item.media.id);
        if (!cached) {
          console.log('[LocalPlaylistManager] Baixando mídia:', item.media.id);
          await this.downloadMedia(item.media);
        }
      }
    }
  }

  /**
   * Verifica se mídia está em cache
   */
  async isMediaCached(mediaId) {
    // Verificar IndexedDB ou cache de arquivos
    const cacheKey = `media_${mediaId}`;
    const cached = this.storage.getItem(cacheKey);
    
    if (cached) {
      const data = JSON.parse(cached);
      // Verificar se não expirou
      if (data.expiresAt && new Date(data.expiresAt) > new Date()) {
        return true;
      }
    }

    // Verificar se está no Map de cache
    return this.mediaCache.has(mediaId);
  }

  /**
   * Baixa mídia e armazena em cache
   */
  async downloadMedia(media) {
    try {
      const apiClient = window.apiClient;
      if (!apiClient) {
        throw new Error('API Client não disponível');
      }

      // Baixar mídia
      const response = await fetch(`${apiClient.baseURL}/api/media/${media.id}/download`, {
        headers: {
          'Authorization': `Bearer ${apiClient.getToken()}`
        }
      });

      if (!response.ok) {
        throw new Error(`Erro ao baixar mídia: ${response.statusText}`);
      }

      const blob = await response.blob();

      // Armazenar em cache
      await this.cacheMedia(media.id, blob);

      console.log('[LocalPlaylistManager] Mídia baixada e cacheada:', media.id);
    } catch (error) {
      console.error('[LocalPlaylistManager] Erro ao baixar mídia:', error);
      throw error;
    }
  }

  /**
   * Armazena mídia em cache
   */
  async cacheMedia(mediaId, blob) {
    // Opção 1: IndexedDB (para arquivos grandes)
    if ('indexedDB' in window) {
      await this.cacheInIndexedDB(mediaId, blob);
    }

    // Opção 2: Local Storage (para metadados)
    const cacheKey = `media_${mediaId}`;
    const metadata = {
      id: mediaId,
      size: blob.size,
      type: blob.type,
      cachedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + this.config.cacheExpiration * 1000).toISOString()
    };
    this.storage.setItem(cacheKey, JSON.stringify(metadata));

    // Opção 3: Map em memória (para acesso rápido)
    this.mediaCache.set(mediaId, blob);
  }

  /**
   * Cache em IndexedDB
   */
  async cacheInIndexedDB(mediaId, blob) {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('smartsignage_cache', 1);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction(['media'], 'readwrite');
        const store = transaction.objectStore('media');
        const putRequest = store.put(blob, mediaId);
        putRequest.onsuccess = () => resolve();
        putRequest.onerror = () => reject(putRequest.error);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains('media')) {
          db.createObjectStore('media');
        }
      };
    });
  }

  /**
   * Salva playlist no Local Storage
   */
  async saveToLocalStorage(playlistId, playlist) {
    const key = `playlist_${playlistId}`;
    this.storage.setItem(key, JSON.stringify(playlist));
    
    // Atualizar referência atual
    this.currentPlaylist = playlist;
  }

  /**
   * Atualiza cache de mídia
   */
  async updateMediaCache(items) {
    // Limpar cache antigo se necessário
    await this.cleanOldCache();

    // Atualizar referências
    for (const item of items) {
      if (item.media && item.media.id) {
        // Verificar se mídia está em cache
        const cached = await this.isMediaCached(item.media.id);
        if (!cached) {
          console.warn('[LocalPlaylistManager] Mídia não está em cache:', item.media.id);
        }
      }
    }
  }

  /**
   * Limpa cache antigo
   */
  async cleanOldCache() {
    const keys = Object.keys(this.storage);
    let totalSize = 0;

    for (const key of keys) {
      if (key.startsWith('media_')) {
        const data = this.storage.getItem(key);
        if (data) {
          try {
            const metadata = JSON.parse(data);
            if (metadata.expiresAt && new Date(metadata.expiresAt) < new Date()) {
              // Cache expirado, remover
              this.storage.removeItem(key);
              console.log('[LocalPlaylistManager] Removido cache expirado:', key);
            } else {
              totalSize += metadata.size || 0;
            }
          } catch (e) {
            // Ignorar erros de parse
          }
        }
      }
    }

    // Se cache exceder tamanho máximo, remover mais antigos
    if (totalSize > this.config.maxCacheSize) {
      await this.removeOldestCache();
    }
  }

  /**
   * Remove cache mais antigo
   */
  async removeOldestCache() {
    const mediaKeys = [];
    const keys = Object.keys(this.storage);

    for (const key of keys) {
      if (key.startsWith('media_')) {
        const data = this.storage.getItem(key);
        if (data) {
          try {
            const metadata = JSON.parse(data);
            mediaKeys.push({
              key,
              cachedAt: new Date(metadata.cachedAt || 0)
            });
          } catch (e) {
            // Ignorar
          }
        }
      }
    }

    // Ordenar por data (mais antigo primeiro)
    mediaKeys.sort((a, b) => a.cachedAt - b.cachedAt);

    // Remover 20% mais antigos
    const toRemove = Math.ceil(mediaKeys.length * 0.2);
    for (let i = 0; i < toRemove; i++) {
      this.storage.removeItem(mediaKeys[i].key);
      console.log('[LocalPlaylistManager] Removido cache antigo:', mediaKeys[i].key);
    }
  }

  /**
   * Inicia sincronização periódica
   */
  startAutoSync(playlistId) {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
    }

    this.syncTimer = setInterval(() => {
      this.syncPlaylist(playlistId).catch(err => {
        console.error('[LocalPlaylistManager] Erro na sincronização automática:', err);
      });
    }, this.config.syncInterval * 1000);

    console.log('[LocalPlaylistManager] Sincronização automática iniciada');
  }

  /**
   * Para sincronização periódica
   */
  stopAutoSync() {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
      console.log('[LocalPlaylistManager] Sincronização automática parada');
    }
  }

  /**
   * Obtém mídia do cache
   */
  async getCachedMedia(mediaId) {
    // Tentar do Map primeiro
    if (this.mediaCache.has(mediaId)) {
      return this.mediaCache.get(mediaId);
    }

    // Tentar do IndexedDB
    if ('indexedDB' in window) {
      try {
        const blob = await this.getFromIndexedDB(mediaId);
        if (blob) {
          this.mediaCache.set(mediaId, blob);
          return blob;
        }
      } catch (error) {
        console.error('[LocalPlaylistManager] Erro ao buscar do IndexedDB:', error);
      }
    }

    return null;
  }

  /**
   * Obtém do IndexedDB
   */
  async getFromIndexedDB(mediaId) {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('smartsignage_cache', 1);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction(['media'], 'readonly');
        const store = transaction.objectStore('media');
        const getRequest = store.get(mediaId);
        getRequest.onsuccess = () => resolve(getRequest.result);
        getRequest.onerror = () => reject(getRequest.error);
      };
    });
  }

  /**
   * Obtém status do cache
   */
  getCacheStatus() {
    const keys = Object.keys(this.storage);
    let mediaCount = 0;
    let totalSize = 0;

    for (const key of keys) {
      if (key.startsWith('media_')) {
        mediaCount++;
        const data = this.storage.getItem(key);
        if (data) {
          try {
            const metadata = JSON.parse(data);
            totalSize += metadata.size || 0;
          } catch (e) {
            // Ignorar
          }
        }
      }
    }

    return {
      mediaCount,
      totalSize,
      maxSize: this.config.maxCacheSize,
      usagePercent: (totalSize / this.config.maxCacheSize) * 100
    };
  }
}

// Exportar
if (typeof window !== 'undefined') {
  window.LocalPlaylistManager = LocalPlaylistManager;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = LocalPlaylistManager;
}

