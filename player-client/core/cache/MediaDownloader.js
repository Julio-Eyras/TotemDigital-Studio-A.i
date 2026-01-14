/**
 * Media Downloader - Core
 * Sistema de download e cache de mídias baseado em DispatchPlan
 * 
 * Este módulo implementa:
 * - Download assíncrono de mídias do DispatchPlan
 * - Cache local com validação de checksums
 * - Política de limpeza LRU
 * - Modo offline com fallback
 */

class MediaDownloader {
  constructor(options = {}) {
    this.config = {
      // Caminho base do cache
      cacheDir: options.cacheDir || './cache',
      
      // Tamanho máximo do cache (padrão: 32GB para totem)
      maxCacheSize: options.maxCacheSize || 32 * 1024 * 1024 * 1024,
      
      // Limite de uso do disco antes de limpar (80%)
      cacheThreshold: options.cacheThreshold || 0.8,
      
      // Downloads simultâneos
      maxConcurrentDownloads: options.maxConcurrentDownloads || 2,
      
      // Timeout de download (ms)
      downloadTimeout: options.downloadTimeout || 300000, // 5 minutos
      
      // Retry de downloads falhos
      maxRetries: options.maxRetries || 3,
      retryDelay: options.retryDelay || 5000, // 5 segundos
      
      // Manter histórico de N planos anteriores
      keepHistoryPlans: options.keepHistoryPlans || 3,
      
      ...options
    };

    this.apiClient = options.apiClient || null;
    this.fileSystem = options.fileSystem || null;
    this.storage = options.storage || null; // Para metadados (localStorage/IndexedDB)
    
    this.downloadQueue = [];
    this.activeDownloads = new Map();
    this.downloadStats = {
      total: 0,
      success: 0,
      failed: 0,
      skipped: 0
    };
    
    // Cache de metadados em memória
    this.mediaMetadata = new Map();
    
    // Último DispatchPlan recebido
    this.lastDispatchPlan = null;
  }

  /**
   * Processa DispatchPlan e baixa mídias necessárias
   * @param {Object} dispatchPlan - Objeto DispatchPlan do backend
   * @returns {Promise<Object>} Estatísticas do download
   */
  async processDispatchPlan(dispatchPlan) {
    if (!dispatchPlan || !dispatchPlan.mediaItems || dispatchPlan.mediaItems.length === 0) {
      console.warn('[MediaDownloader] DispatchPlan vazio ou sem mídias');
      return { success: true, downloaded: 0, skipped: 0, failed: 0 };
    }

    console.log(`[MediaDownloader] Processando DispatchPlan com ${dispatchPlan.mediaItems.length} mídias`);

    // Salvar último plano para modo offline
    await this.saveLastDispatchPlan(dispatchPlan);

    // Identificar mídias necessárias
    const mediaItems = dispatchPlan.mediaItems;
    const downloadTasks = [];

    for (const item of mediaItems) {
      const task = this.prepareDownloadTask(item);
      if (task) {
        downloadTasks.push(task);
      }
    }

    // Verificar espaço disponível antes de iniciar downloads
    await this.ensureCacheSpace(downloadTasks);

    // Executar downloads
    const results = await this.executeDownloads(downloadTasks);

    // Atualizar estatísticas
    this.downloadStats.total += results.total;
    this.downloadStats.success += results.success;
    this.downloadStats.failed += results.failed;
    this.downloadStats.skipped += results.skipped;

    console.log(`[MediaDownloader] Download concluído: ${results.success} sucesso, ${results.failed} falhas, ${results.skipped} puladas`);

    return results;
  }

  /**
   * Prepara tarefa de download para uma mídia
   * @param {Object} mediaItem - Item de mídia do DispatchPlan
   * @returns {Object|null} Tarefa de download ou null se já está em cache
   */
  async prepareDownloadTask(mediaItem) {
    const { mediaId, url, metadata } = mediaItem;

    if (!mediaId || !url) {
      console.warn('[MediaDownloader] Item de mídia inválido:', mediaItem);
      return null;
    }

    // Verificar se já está em cache e válido
    const cached = await this.getCachedMedia(mediaId);
    if (cached && cached.valid) {
      // Verificar checksum se disponível
      if (metadata && metadata.checksum) {
        const isValid = await this.validateChecksum(cached.localPath, metadata.checksum);
        if (isValid) {
          console.log(`[MediaDownloader] Mídia ${mediaId} já está em cache e válida`);
          return { mediaId, url, metadata, action: 'skip', reason: 'cached' };
        } else {
          console.warn(`[MediaDownloader] Mídia ${mediaId} corrompida, removendo e baixando novamente`);
          await this.removeCachedMedia(mediaId);
        }
      } else {
        // Sem checksum, assumir válido
        return { mediaId, url, metadata, action: 'skip', reason: 'cached' };
      }
    }

    return {
      mediaId,
      url,
      metadata: metadata || {},
      action: 'download',
      retries: 0
    };
  }

  /**
   * Executa downloads em lote com limite de concorrência
   * @param {Array} tasks - Array de tarefas de download
   * @returns {Promise<Object>} Estatísticas dos downloads
   */
  async executeDownloads(tasks) {
    const stats = { total: tasks.length, success: 0, failed: 0, skipped: 0 };
    const downloadPromises = [];

    for (const task of tasks) {
      if (task.action === 'skip') {
        stats.skipped++;
        continue;
      }

      // Adicionar à fila de download
      const promise = this.downloadMedia(task)
        .then(() => {
          stats.success++;
        })
        .catch((error) => {
          console.error(`[MediaDownloader] Falha ao baixar mídia ${task.mediaId}:`, error);
          stats.failed++;
        });

      downloadPromises.push(promise);

      // Limitar downloads simultâneos
      if (downloadPromises.length >= this.config.maxConcurrentDownloads) {
        await Promise.race(downloadPromises);
        downloadPromises.splice(0, downloadPromises.findIndex(p => p === Promise.race(downloadPromises)));
      }
    }

    // Aguardar downloads restantes
    await Promise.all(downloadPromises);

    return stats;
  }

  /**
   * Baixa uma mídia específica
   * @param {Object} task - Tarefa de download
   * @returns {Promise<string>} Caminho local do arquivo baixado
   */
  async downloadMedia(task) {
    const { mediaId, url, metadata } = task;

    // Verificar se já está sendo baixado
    if (this.activeDownloads.has(mediaId)) {
      return this.activeDownloads.get(mediaId);
    }

    const downloadPromise = this._downloadMediaInternal(task);
    this.activeDownloads.set(mediaId, downloadPromise);

    try {
      const localPath = await downloadPromise;
      return localPath;
    } finally {
      this.activeDownloads.delete(mediaId);
    }
  }

  /**
   * Implementação interna do download
   * @private
   */
  async _downloadMediaInternal(task) {
    const { mediaId, url, metadata } = task;
    let retries = task.retries || 0;

    while (retries <= this.config.maxRetries) {
      try {
        console.log(`[MediaDownloader] Baixando mídia ${mediaId}... (tentativa ${retries + 1}/${this.config.maxRetries + 1})`);

        // Determinar URL de download
        const downloadUrl = this.getDownloadUrl(mediaId, url);

        // Baixar arquivo
        const response = await this.fetchWithTimeout(downloadUrl, {
          method: 'GET',
          headers: this.getDownloadHeaders(),
          signal: AbortSignal.timeout(this.config.downloadTimeout)
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        // Obter dados do arquivo
        const blob = await response.blob();
        const arrayBuffer = await blob.arrayBuffer();

        // Validar tamanho se disponível
        if (metadata.size && arrayBuffer.byteLength !== metadata.size) {
          throw new Error(`Tamanho incorreto: esperado ${metadata.size}, recebido ${arrayBuffer.byteLength}`);
        }

        // Calcular checksum
        const checksum = await this.calculateChecksum(arrayBuffer);

        // Validar checksum se disponível
        if (metadata.checksum && checksum !== metadata.checksum) {
          throw new Error(`Checksum inválido: esperado ${metadata.checksum}, calculado ${checksum}`);
        }

        // Salvar arquivo
        const localPath = await this.saveMediaFile(mediaId, arrayBuffer, metadata);

        // Salvar metadados
        await this.saveMediaMetadata(mediaId, {
          mediaId,
          url,
          localPath,
          checksum,
          size: arrayBuffer.byteLength,
          mimeType: metadata.mimeType || blob.type,
          downloadedAt: new Date().toISOString(),
          lastAccessed: new Date().toISOString(),
          valid: true
        });

        console.log(`[MediaDownloader] Mídia ${mediaId} baixada com sucesso: ${localPath}`);
        return localPath;

      } catch (error) {
        retries++;
        
        if (retries > this.config.maxRetries) {
          console.error(`[MediaDownloader] Falha ao baixar mídia ${mediaId} após ${this.config.maxRetries + 1} tentativas:`, error);
          throw error;
        }

        console.warn(`[MediaDownloader] Tentativa ${retries} falhou, aguardando ${this.config.retryDelay}ms antes de tentar novamente...`);
        await this.sleep(this.config.retryDelay);
      }
    }
  }

  /**
   * Obtém URL de download da mídia
   */
  getDownloadUrl(mediaId, url) {
    // Se URL é absoluta, usar diretamente
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }

    // Se API client está disponível, usar endpoint de download
    if (this.apiClient) {
      return `${this.apiClient.baseURL}/api/media/${mediaId}/download`;
    }

    // Fallback: construir URL relativa
    return url.startsWith('/') ? url : `/${url}`;
  }

  /**
   * Obtém headers para download
   */
  getDownloadHeaders() {
    const headers = {};

    // Adicionar token de autenticação se disponível
    if (this.apiClient && this.apiClient.token) {
      headers['Authorization'] = `Bearer ${this.apiClient.token}`;
    }

    // Adicionar token HMAC do totem se disponível
    if (this.apiClient && this.apiClient.totemUIN && this.apiClient.totemSecret) {
      // Gerar token HMAC (implementação simplificada)
      const timestamp = Date.now();
      // Nota: Implementação completa de HMAC deve ser feita conforme APIClient
      headers['X-Totem-UIN'] = this.apiClient.totemUIN;
    }

    return headers;
  }

  /**
   * Fetch com timeout
   */
  async fetchWithTimeout(url, options = {}) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), options.signal?.timeout || this.config.downloadTimeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error('Timeout ao baixar mídia');
      }
      throw error;
    }
  }

  /**
   * Salva arquivo de mídia no sistema de arquivos
   */
  async saveMediaFile(mediaId, arrayBuffer, metadata) {
    if (!this.fileSystem) {
      throw new Error('FileSystem não disponível');
    }

    // Determinar extensão do arquivo
    const extension = this.getFileExtension(metadata.mimeType || 'application/octet-stream');
    const fileName = `${mediaId}_${metadata.checksum || Date.now()}.${extension}`;
    const localPath = `${this.config.cacheDir}/media/${fileName}`;

    // Criar diretório se não existir
    await this.fileSystem.ensureDir(`${this.config.cacheDir}/media`);

    // Salvar arquivo
    await this.fileSystem.writeFile(localPath, Buffer.from(arrayBuffer));

    return localPath;
  }

  /**
   * Obtém extensão de arquivo do MIME type
   */
  getFileExtension(mimeType) {
    const extensions = {
      'video/mp4': 'mp4',
      'video/webm': 'webm',
      'video/quicktime': 'mov',
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/png': 'png',
      'image/gif': 'gif',
      'image/webp': 'webp',
      'audio/mpeg': 'mp3',
      'audio/mp3': 'mp3',
      'audio/ogg': 'ogg',
      'audio/wav': 'wav'
    };
    return extensions[mimeType] || 'bin';
  }

  /**
   * Calcula checksum SHA-256 de um buffer
   */
  async calculateChecksum(buffer) {
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      // Browser/Web Crypto API
      const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } else if (typeof require !== 'undefined') {
      // Node.js
      const crypto = require('crypto');
      return crypto.createHash('sha256').update(Buffer.from(buffer)).digest('hex');
    } else {
      // Fallback simples (não seguro, apenas para desenvolvimento)
      return btoa(String.fromCharCode(...new Uint8Array(buffer))).substring(0, 64);
    }
  }

  /**
   * Valida checksum de um arquivo
   */
  async validateChecksum(localPath, expectedChecksum) {
    try {
      if (!this.fileSystem) {
        return false;
      }

      const fileData = await this.fileSystem.readFile(localPath);
      const buffer = fileData instanceof Buffer ? fileData : Buffer.from(fileData);
      const calculatedChecksum = await this.calculateChecksum(buffer);
      
      return calculatedChecksum === expectedChecksum;
    } catch (error) {
      console.error(`[MediaDownloader] Erro ao validar checksum de ${localPath}:`, error);
      return false;
    }
  }

  /**
   * Obtém mídia do cache
   */
  async getCachedMedia(mediaId) {
    // Verificar metadados em memória
    if (this.mediaMetadata.has(mediaId)) {
      const metadata = this.mediaMetadata.get(mediaId);
      
      // Verificar se arquivo ainda existe
      if (this.fileSystem && await this.fileSystem.exists(metadata.localPath)) {
        return metadata;
      } else {
        // Arquivo não existe mais, remover metadados
        this.mediaMetadata.delete(mediaId);
      }
    }

    // Verificar storage persistente
    if (this.storage) {
      const stored = await this.storage.get(`media:${mediaId}`);
      if (stored) {
        // Verificar se arquivo ainda existe
        if (this.fileSystem && await this.fileSystem.exists(stored.localPath)) {
          this.mediaMetadata.set(mediaId, stored);
          return stored;
        }
      }
    }

    return null;
  }

  /**
   * Salva metadados de mídia
   */
  async saveMediaMetadata(mediaId, metadata) {
    this.mediaMetadata.set(mediaId, metadata);

    if (this.storage) {
      await this.storage.set(`media:${mediaId}`, metadata);
    }
  }

  /**
   * Remove mídia do cache
   */
  async removeCachedMedia(mediaId) {
    const cached = await this.getCachedMedia(mediaId);
    
    if (cached && cached.localPath && this.fileSystem) {
      try {
        await this.fileSystem.delete(cached.localPath);
      } catch (error) {
        console.warn(`[MediaDownloader] Erro ao remover arquivo ${cached.localPath}:`, error);
      }
    }

    this.mediaMetadata.delete(mediaId);
    
    if (this.storage) {
      await this.storage.delete(`media:${mediaId}`);
    }
  }

  /**
   * Garante espaço suficiente no cache
   */
  async ensureCacheSpace(downloadTasks) {
    const totalSize = downloadTasks.reduce((sum, task) => {
      return sum + (task.metadata?.size || 0);
    }, 0);

    const currentSize = await this.getCacheSize();
    const availableSpace = this.config.maxCacheSize - currentSize;

    if (totalSize > availableSpace) {
      const neededSpace = totalSize - availableSpace;
      console.log(`[MediaDownloader] Espaço insuficiente. Liberando ${neededSpace} bytes...`);
      await this.cleanupCache(neededSpace);
    }
  }

  /**
   * Obtém tamanho atual do cache
   */
  async getCacheSize() {
    if (!this.fileSystem) {
      return 0;
    }

    let totalSize = 0;
    const mediaDir = `${this.config.cacheDir}/media`;

    if (await this.fileSystem.exists(mediaDir)) {
      const files = await this.fileSystem.listFiles(mediaDir);
      for (const file of files) {
        const stats = await this.fileSystem.stat(file);
        totalSize += stats.size || 0;
      }
    }

    return totalSize;
  }

  /**
   * Limpa cache usando política LRU
   */
  async cleanupCache(minBytesToFree) {
    if (!this.fileSystem) {
      return;
    }

    // Coletar todas as mídias com metadados de acesso
    const mediaFiles = [];
    
    for (const [mediaId, metadata] of this.mediaMetadata.entries()) {
      if (metadata.localPath && await this.fileSystem.exists(metadata.localPath)) {
        const stats = await this.fileSystem.stat(metadata.localPath);
        mediaFiles.push({
          mediaId,
          localPath: metadata.localPath,
          size: stats.size || 0,
          lastAccessed: new Date(metadata.lastAccessed || metadata.downloadedAt || 0)
        });
      }
    }

    // Ordenar por último acesso (LRU)
    mediaFiles.sort((a, b) => a.lastAccessed - b.lastAccessed);

    // Remover arquivos até liberar espaço suficiente
    let freedSpace = 0;
    for (const file of mediaFiles) {
      // Não remover mídias do plano atual
      if (this.isMediaInCurrentPlan(file.mediaId)) {
        continue;
      }

      await this.removeCachedMedia(file.mediaId);
      freedSpace += file.size;

      if (freedSpace >= minBytesToFree) {
        break;
      }
    }

    console.log(`[MediaDownloader] Limpeza concluída: ${freedSpace} bytes liberados`);
  }

  /**
   * Verifica se mídia está no plano atual
   */
  isMediaInCurrentPlan(mediaId) {
    if (!this.lastDispatchPlan || !this.lastDispatchPlan.mediaItems) {
      return false;
    }

    return this.lastDispatchPlan.mediaItems.some(item => item.mediaId === mediaId);
  }

  /**
   * Salva último DispatchPlan para modo offline
   */
  async saveLastDispatchPlan(dispatchPlan) {
    this.lastDispatchPlan = dispatchPlan;

    if (this.storage) {
      await this.storage.set('lastDispatchPlan', {
        plan: dispatchPlan,
        savedAt: new Date().toISOString()
      });
    }
  }

  /**
   * Carrega último DispatchPlan salvo (modo offline)
   */
  async loadLastDispatchPlan() {
    if (this.lastDispatchPlan) {
      return this.lastDispatchPlan;
    }

    if (this.storage) {
      const stored = await this.storage.get('lastDispatchPlan');
      if (stored && stored.plan) {
        this.lastDispatchPlan = stored.plan;
        return stored.plan;
      }
    }

    return null;
  }

  /**
   * Obtém estatísticas do downloader
   */
  getStats() {
    return {
      ...this.downloadStats,
      activeDownloads: this.activeDownloads.size,
      queueLength: this.downloadQueue.length,
      cacheSize: this.mediaMetadata.size
    };
  }

  /**
   * Sleep helper
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Exportar para diferentes ambientes
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MediaDownloader;
} else {
  window.MediaDownloader = MediaDownloader;
}
