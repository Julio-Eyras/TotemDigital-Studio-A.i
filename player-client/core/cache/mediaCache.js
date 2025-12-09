/**
 * Media Cache - Core
 * Sistema de cache local para mídias do player
 */

class MediaCache {
  constructor(storage, fileSystem, options = {}) {
    this.storage = storage; // IndexedDB, localStorage, ou FileSystem
    this.fileSystem = fileSystem; // FileSystem API ou similar
    this.maxCacheSize = options.maxCacheSize || 5 * 1024 * 1024 * 1024; // 5GB padrão
    this.maxConcurrentDownloads = options.maxConcurrentDownloads || 2;
    this.downloadQueue = [];
    this.activeDownloads = new Map();
  }

  /**
   * Baixa mídia do servidor e armazena localmente
   */
  async downloadMedia(mediaItem, apiClient) {
    const { media_id, file_path, size_bytes, mime_type, version, checksum } = mediaItem;

    // Verificar se já existe e está atualizada
    const existing = await this.getMediaMetadata(media_id);
    if (existing && existing.version === version && existing.checksum === checksum) {
      // Verificar se arquivo ainda existe
      const exists = await this.fileSystem.exists(existing.localPath);
      if (exists) {
        return existing.localPath;
      }
    }

    // Adicionar à fila de download
    return new Promise((resolve, reject) => {
      this.downloadQueue.push({
        mediaItem,
        apiClient,
        resolve,
        reject
      });

      this.processDownloadQueue();
    });
  }

  /**
   * Processa fila de downloads
   */
  async processDownloadQueue() {
    // Limitar downloads simultâneos
    while (this.activeDownloads.size < this.maxConcurrentDownloads && this.downloadQueue.length > 0) {
      const task = this.downloadQueue.shift();
      this.downloadMediaTask(task);
    }
  }

  /**
   * Executa download de uma mídia
   */
  async downloadMediaTask({ mediaItem, apiClient, resolve, reject }) {
    const { media_id, file_path, size_bytes, mime_type, version, checksum } = mediaItem;
    const downloadId = `download_${media_id}_${Date.now()}`;

    try {
      this.activeDownloads.set(media_id, { id: downloadId, progress: 0 });

      // Verificar espaço disponível
      const availableSpace = await this.getAvailableSpace();
      if (availableSpace < size_bytes) {
        // Tentar liberar espaço
        await this.cleanupUnusedMedia([]);
        const newAvailableSpace = await this.getAvailableSpace();
        if (newAvailableSpace < size_bytes) {
          throw new Error('Espaço insuficiente para download');
        }
      }

      // Baixar arquivo
      const localPath = `media/${media_id}.${this.getFileExtension(mime_type)}`;
      const response = await apiClient.downloadMedia(media_id);

      // Salvar arquivo
      await this.fileSystem.save(localPath, response, {
        onProgress: (progress) => {
          const active = this.activeDownloads.get(media_id);
          if (active) {
            active.progress = progress;
          }
        }
      });

      // Verificar integridade (se checksum disponível)
      if (checksum) {
        const fileChecksum = await this.calculateChecksum(localPath);
        if (fileChecksum !== checksum) {
          // Arquivo corrompido, remover e tentar novamente
          await this.fileSystem.delete(localPath);
          throw new Error('Checksum verification failed');
        }
      }

      // Salvar metadados
      await this.saveMediaMetadata({
        id: media_id,
        name: mediaItem.name || `Media ${media_id}`,
        type: mediaItem.media_type,
        mime_type,
        size_bytes,
        duration_seconds: mediaItem.duration_seconds,
        version,
        checksum,
        url: file_path,
        localPath,
        downloaded: true,
        downloadedAt: new Date().toISOString(),
        lastVerified: new Date().toISOString(),
        integrityCheck: true
      });

      // Atualizar índice
      await this.updateIndex(media_id, { localPath, size_bytes });

      this.activeDownloads.delete(media_id);
      resolve(localPath);

      // Processar próximo da fila
      this.processDownloadQueue();

    } catch (error) {
      this.activeDownloads.delete(media_id);
      reject(error);
      this.processDownloadQueue();
    }
  }

  /**
   * Obtém metadados de uma mídia
   */
  async getMediaMetadata(mediaId) {
    return await this.storage.get(`media:${mediaId}`);
  }

  /**
   * Salva metadados de uma mídia
   */
  async saveMediaMetadata(metadata) {
    await this.storage.set(`media:${metadata.id}`, metadata);
  }

  /**
   * Obtém caminho local de uma mídia
   */
  async getLocalPath(mediaId) {
    const metadata = await this.getMediaMetadata(mediaId);
    if (metadata && metadata.downloaded) {
      const exists = await this.fileSystem.exists(metadata.localPath);
      if (exists) {
        return metadata.localPath;
      }
    }
    return null;
  }

  /**
   * Remove mídias não usadas
   */
  async cleanupUnusedMedia(currentPlaylistItems) {
    const allMedia = await this.storage.getAll('media:');
    const usedIds = new Set(
      currentPlaylistItems
        .map(item => item.media_id || item.media?.media_id)
        .filter(id => id)
    );

    let freedSpace = 0;

    for (const media of allMedia) {
      if (!usedIds.has(media.id)) {
        // Remover arquivo
        try {
          await this.fileSystem.delete(media.localPath);
          freedSpace += media.size_bytes || 0;
        } catch (error) {
          console.warn(`Failed to delete media file: ${media.localPath}`, error);
        }

        // Remover metadados
        await this.storage.delete(`media:${media.id}`);
      }
    }

    return freedSpace;
  }

  /**
   * Obtém tamanho total do cache
   */
  async getCacheSize() {
    const allMedia = await this.storage.getAll('media:');
    return allMedia.reduce((sum, media) => sum + (media.size_bytes || 0), 0);
  }

  /**
   * Obtém espaço disponível
   */
  async getAvailableSpace() {
    const cacheSize = await this.getCacheSize();
    return this.maxCacheSize - cacheSize;
  }

  /**
   * Atualiza índice de mídias
   */
  async updateIndex(mediaId, data) {
    const index = await this.storage.get('media:index') || {};
    index[mediaId] = {
      ...index[mediaId],
      ...data,
      lastUpdated: new Date().toISOString()
    };
    await this.storage.set('media:index', index);
  }

  /**
   * Calcula checksum de um arquivo
   */
  async calculateChecksum(filePath) {
    // Implementação específica por plataforma
    // Pode usar crypto.subtle.digest ou biblioteca de hash
    const fileData = await this.fileSystem.read(filePath);
    const hashBuffer = await crypto.subtle.digest('SHA-256', fileData);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Obtém extensão de arquivo do MIME type
   */
  getFileExtension(mimeType) {
    const extensions = {
      'video/mp4': 'mp4',
      'video/webm': 'webm',
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/gif': 'gif',
      'audio/mpeg': 'mp3',
      'audio/ogg': 'ogg',
    };
    return extensions[mimeType] || 'bin';
  }

  /**
   * Obtém progresso de download
   */
  getDownloadProgress(mediaId) {
    const active = this.activeDownloads.get(mediaId);
    return active ? active.progress : null;
  }

  /**
   * Verifica se mídia está sendo baixada
   */
  isDownloading(mediaId) {
    return this.activeDownloads.has(mediaId);
  }
}

// Exportar para diferentes ambientes
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MediaCache;
} else {
  window.MediaCache = MediaCache;
}

