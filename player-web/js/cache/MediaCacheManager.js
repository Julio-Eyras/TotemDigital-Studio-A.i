/**
 * MediaCacheManager - Browser (IndexedDB)
 * Gerencia cache local de mídias do DispatchPlan usando IndexedDB
 * Similar ao WebOS/Tizen/Android, mas adaptado para browser
 */

class MediaCacheManager {
    constructor(options = {}) {
        this.maxCacheSize = options.maxCacheSize || 500 * 1024 * 1024; // 500MB padrão
        this.dbName = options.dbName || 'smartsignage_cache';
        this.dbVersion = 1;
        this.metadataKey = 'smartsignage_cache_metadata';
        this.dispatchPlanKey = 'smartsignage_last_dispatch_plan';
        
        this.db = null;
        this.metadata = null;
        
        this.init();
    }

    /**
     * Inicializa IndexedDB
     */
    async init() {
        try {
            if (!('indexedDB' in window)) {
                console.warn('[MediaCacheManager] IndexedDB não disponível, usando localStorage apenas');
                await this.loadMetadata();
                return;
            }

            return new Promise((resolve, reject) => {
                const request = indexedDB.open(this.dbName, this.dbVersion);

                request.onerror = () => {
                    console.error('[MediaCacheManager] Erro ao abrir IndexedDB:', request.error);
                    reject(request.error);
                };

                request.onsuccess = () => {
                    this.db = request.result;
                    console.log('[MediaCacheManager] IndexedDB inicializado');
                    this.loadMetadata().then(resolve).catch(reject);
                };

                request.onupgradeneeded = (event) => {
                    const db = event.target.result;
                    
                    // Object store para Blobs de mídias
                    if (!db.objectStoreNames.contains('media')) {
                        const mediaStore = db.createObjectStore('media', { keyPath: 'mediaId' });
                        mediaStore.createIndex('checksum', 'checksum', { unique: false });
                        mediaStore.createIndex('lastAccessed', 'lastAccessed', { unique: false });
                    }
                };
            });
        } catch (error) {
            console.error('[MediaCacheManager] Erro na inicialização', error);
            await this.loadMetadata(); // Fallback para localStorage
        }
    }

    /**
     * Processa DispatchPlan e baixa mídias necessárias
     */
    async processDispatchPlan(dispatchPlan, apiClient) {
        const stats = { success: 0, failed: 0, skipped: 0 };
        
        try {
            // Salvar último DispatchPlan para modo offline
            await this.saveLastDispatchPlan(dispatchPlan);
            
            // Verificar espaço disponível
            await this.ensureCacheSpace(dispatchPlan.mediaItems);
            
            // Processar cada mídia
            for (const mediaItem of dispatchPlan.mediaItems) {
                try {
                    const cached = await this.getCachedMedia(mediaItem.mediaId);
                    
                    if (cached && cached.valid) {
                        // Verificar checksum se disponível
                        if (mediaItem.metadata?.checksum) {
                            const isValid = await this.validateChecksum(cached.blob, mediaItem.metadata.checksum);
                            if (!isValid) {
                                console.warn(`[MediaCacheManager] Mídia ${mediaItem.mediaId} corrompida, removendo e baixando novamente`);
                                await this.removeCachedMedia(mediaItem.mediaId);
                                await this.downloadMedia(mediaItem, apiClient, stats);
                            } else {
                                stats.skipped++;
                            }
                        } else {
                            stats.skipped++;
                        }
                    } else {
                        // Download necessário
                        await this.downloadMedia(mediaItem, apiClient, stats);
                    }
                } catch (error) {
                    console.error(`[MediaCacheManager] Erro ao processar mídia ${mediaItem.mediaId}`, error);
                    stats.failed++;
                }
            }
            
            console.log(`[MediaCacheManager] Processamento concluído: ${stats.success} sucesso, ${stats.failed} falhas, ${stats.skipped} puladas`);
            
        } catch (error) {
            console.error('[MediaCacheManager] Erro ao processar DispatchPlan', error);
        }
        
        return stats;
    }

    /**
     * Baixa uma mídia específica
     */
    async downloadMedia(mediaItem, apiClient, stats) {
        try {
            console.log(`[MediaCacheManager] Baixando mídia ${mediaItem.mediaId}...`);
            
            // Baixar arquivo via API ou URL direta
            let blob;
            if (apiClient && apiClient.downloadMedia) {
                const response = await apiClient.downloadMedia(mediaItem.mediaId);
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                blob = await response.blob();
            } else {
                // Fallback: baixar diretamente da URL
                const response = await fetch(mediaItem.url);
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                blob = await response.blob();
            }
            
            // Converter Blob para ArrayBuffer para calcular checksum
            const arrayBuffer = await blob.arrayBuffer();
            const data = new Uint8Array(arrayBuffer);
            
            // Validar tamanho se disponível
            if (mediaItem.metadata?.size && data.length !== mediaItem.metadata.size) {
                throw new Error(`Tamanho incorreto: esperado ${mediaItem.metadata.size}, recebido ${data.length}`);
            }
            
            // Calcular checksum
            const checksum = await this.calculateChecksum(data);
            
            // Validar checksum se disponível
            if (mediaItem.metadata?.checksum && checksum !== mediaItem.metadata.checksum) {
                throw new Error(`Checksum inválido: esperado ${mediaItem.metadata.checksum}, calculado ${checksum}`);
            }
            
            // Salvar no IndexedDB
            await this.saveMediaBlob(mediaItem.mediaId, blob, {
                mediaId: mediaItem.mediaId,
                url: mediaItem.url,
                checksum: checksum,
                size: data.length,
                mimeType: mediaItem.metadata?.mimeType || blob.type || 'application/octet-stream',
                downloadedAt: Date.now(),
                lastAccessed: Date.now(),
                valid: true
            });
            
            stats.success++;
            console.log(`[MediaCacheManager] Mídia ${mediaItem.mediaId} baixada com sucesso`);
            
        } catch (error) {
            console.error(`[MediaCacheManager] Erro ao baixar mídia ${mediaItem.mediaId}`, error);
            stats.failed++;
            throw error;
        }
    }

    /**
     * Obtém mídia do cache
     */
    async getCachedMedia(mediaId) {
        try {
            // Tentar obter do IndexedDB primeiro
            if (this.db) {
                const transaction = this.db.transaction(['media'], 'readonly');
                const store = transaction.objectStore('media');
                const request = store.get(mediaId);
                
                const result = await new Promise((resolve, reject) => {
                    request.onsuccess = () => resolve(request.result);
                    request.onerror = () => reject(request.error);
                });
                
                if (result && result.valid) {
                    // Atualizar último acesso
                    result.lastAccessed = Date.now();
                    await this.updateMediaAccess(mediaId, result.lastAccessed);
                    return result;
                }
            }
            
            // Fallback: verificar metadados no localStorage
            const metadata = await this.loadMediaMetadata(mediaId);
            if (metadata && metadata.valid) {
                // Tentar obter Blob do IndexedDB usando metadata
                if (this.db) {
                    const transaction = this.db.transaction(['media'], 'readonly');
                    const store = transaction.objectStore('media');
                    const request = store.get(mediaId);
                    
                    const result = await new Promise((resolve, reject) => {
                        request.onsuccess = () => resolve(request.result);
                        request.onerror = () => reject(request.error);
                    });
                    
                    if (result) {
                        result.lastAccessed = Date.now();
                        await this.updateMediaAccess(mediaId, result.lastAccessed);
                        return result;
                    }
                }
            }
            
            return null;
        } catch (error) {
            console.error('[MediaCacheManager] Erro ao obter mídia do cache', error);
            return null;
        }
    }

    /**
     * Obtém Blob URL de uma mídia em cache
     */
    async getCachedMediaBlobURL(mediaId) {
        const cached = await this.getCachedMedia(mediaId);
        if (cached && cached.blob) {
            return URL.createObjectURL(cached.blob);
        }
        return null;
    }

    /**
     * Remove mídia do cache
     */
    async removeCachedMedia(mediaId) {
        try {
            // Remover do IndexedDB
            if (this.db) {
                const transaction = this.db.transaction(['media'], 'readwrite');
                const store = transaction.objectStore('media');
                await new Promise((resolve, reject) => {
                    const request = store.delete(mediaId);
                    request.onsuccess = () => resolve();
                    request.onerror = () => reject(request.error);
                });
            }
            
            // Remover metadados
            await this.removeMediaMetadata(mediaId);
        } catch (error) {
            console.error('[MediaCacheManager] Erro ao remover mídia do cache', error);
        }
    }

    /**
     * Garante espaço suficiente no cache
     */
    async ensureCacheSpace(mediaItems) {
        const totalSize = mediaItems.reduce((sum, item) => sum + (item.metadata?.size || 0), 0);
        const currentSize = await this.getCacheSize();
        const availableSpace = this.maxCacheSize - currentSize;
        
        if (totalSize > availableSpace) {
            const neededSpace = totalSize - availableSpace;
            console.log(`[MediaCacheManager] Espaço insuficiente. Liberando ${neededSpace} bytes...`);
            await this.cleanupCache(neededSpace, mediaItems.map(item => item.mediaId));
        }
    }

    /**
     * Obtém tamanho atual do cache
     */
    async getCacheSize() {
        try {
            if (this.db) {
                const transaction = this.db.transaction(['media'], 'readonly');
                const store = transaction.objectStore('media');
                const request = store.getAll();
                
                const allMedia = await new Promise((resolve, reject) => {
                    request.onsuccess = () => resolve(request.result);
                    request.onerror = () => reject(request.error);
                });
                
                return allMedia.reduce((sum, media) => sum + (media.size || 0), 0);
            }
            
            // Fallback: usar metadados
            const allMetadata = await this.loadAllMediaMetadata();
            return Object.values(allMetadata).reduce((sum, meta) => sum + (meta.size || 0), 0);
        } catch (error) {
            console.error('[MediaCacheManager] Erro ao obter tamanho do cache', error);
            return 0;
        }
    }

    /**
     * Limpa cache usando política LRU
     */
    async cleanupCache(minBytesToFree, currentMediaIds) {
        const currentMediaIdsSet = new Set(currentMediaIds);
        
        try {
            if (this.db) {
                const transaction = this.db.transaction(['media'], 'readonly');
                const store = transaction.objectStore('media');
                const request = store.index('lastAccessed').openCursor(null, 'next');
                
                const unusedMedia = [];
                
                await new Promise((resolve, reject) => {
                    request.onsuccess = (event) => {
                        const cursor = event.target.result;
                        if (cursor) {
                            const media = cursor.value;
                            if (!currentMediaIdsSet.has(media.mediaId)) {
                                unusedMedia.push(media);
                            }
                            cursor.continue();
                        } else {
                            resolve();
                        }
                    };
                    request.onerror = () => reject(request.error);
                });
                
                // Ordenar por último acesso (LRU)
                unusedMedia.sort((a, b) => a.lastAccessed - b.lastAccessed);
                
                let freedSpace = 0;
                const deleteTransaction = this.db.transaction(['media'], 'readwrite');
                const deleteStore = deleteTransaction.objectStore('media');
                
                for (const media of unusedMedia) {
                    if (freedSpace >= minBytesToFree) break;
                    
                    await new Promise((resolve, reject) => {
                        const deleteRequest = deleteStore.delete(media.mediaId);
                        deleteRequest.onsuccess = () => {
                            freedSpace += media.size || 0;
                            resolve();
                        };
                        deleteRequest.onerror = () => reject(deleteRequest.error);
                    });
                    
                    await this.removeMediaMetadata(media.mediaId);
                }
                
                console.log(`[MediaCacheManager] Limpeza concluída: ${freedSpace} bytes liberados`);
                return freedSpace;
            }
            
            // Fallback: usar metadados
            const allMetadata = await this.loadAllMediaMetadata();
            const unusedMedia = Object.values(allMetadata)
                .filter(meta => !currentMediaIdsSet.has(meta.mediaId))
                .sort((a, b) => a.lastAccessed - b.lastAccessed);
            
            let freedSpace = 0;
            for (const metadata of unusedMedia) {
                if (freedSpace >= minBytesToFree) break;
                
                await this.removeCachedMedia(metadata.mediaId);
                freedSpace += metadata.size || 0;
            }
            
            console.log(`[MediaCacheManager] Limpeza concluída: ${freedSpace} bytes liberados`);
            return freedSpace;
        } catch (error) {
            console.error('[MediaCacheManager] Erro na limpeza do cache', error);
            return 0;
        }
    }

    /**
     * Salva último DispatchPlan para modo offline
     */
    async saveLastDispatchPlan(dispatchPlan) {
        try {
            localStorage.setItem(this.dispatchPlanKey, JSON.stringify(dispatchPlan));
        } catch (error) {
            console.error('[MediaCacheManager] Erro ao salvar DispatchPlan', error);
        }
    }

    /**
     * Carrega último DispatchPlan salvo (modo offline)
     */
    loadLastDispatchPlan() {
        try {
            const json = localStorage.getItem(this.dispatchPlanKey);
            return json ? JSON.parse(json) : null;
        } catch (error) {
            console.error('[MediaCacheManager] Erro ao carregar DispatchPlan', error);
            return null;
        }
    }

    /**
     * Salva Blob de mídia no IndexedDB
     */
    async saveMediaBlob(mediaId, blob, metadata) {
        if (!this.db) {
            throw new Error('IndexedDB não disponível');
        }
        
        const transaction = this.db.transaction(['media'], 'readwrite');
        const store = transaction.objectStore('media');
        
        const mediaData = {
            mediaId: mediaId,
            blob: blob,
            checksum: metadata.checksum,
            size: metadata.size,
            mimeType: metadata.mimeType,
            downloadedAt: metadata.downloadedAt,
            lastAccessed: metadata.lastAccessed,
            valid: metadata.valid,
            url: metadata.url
        };
        
        await new Promise((resolve, reject) => {
            const request = store.put(mediaData);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
        
        // Salvar metadados também no localStorage (backup)
        await this.saveMediaMetadata(mediaId, metadata);
    }

    /**
     * Atualiza último acesso de uma mídia
     */
    async updateMediaAccess(mediaId, lastAccessed) {
        if (this.db) {
            const transaction = this.db.transaction(['media'], 'readwrite');
            const store = transaction.objectStore('media');
            const request = store.get(mediaId);
            
            await new Promise((resolve, reject) => {
                request.onsuccess = () => {
                    const media = request.result;
                    if (media) {
                        media.lastAccessed = lastAccessed;
                        const updateRequest = store.put(media);
                        updateRequest.onsuccess = () => resolve();
                        updateRequest.onerror = () => reject(updateRequest.error);
                    } else {
                        resolve();
                    }
                };
                request.onerror = () => reject(request.error);
            });
        }
        
        // Atualizar metadados também
        const metadata = await this.loadMediaMetadata(mediaId);
        if (metadata) {
            metadata.lastAccessed = lastAccessed;
            await this.saveMediaMetadata(mediaId, metadata);
        }
    }

    /**
     * Salva metadados de mídia
     */
    async saveMediaMetadata(mediaId, metadata) {
        try {
            const allMetadata = await this.loadAllMediaMetadata();
            allMetadata[mediaId] = metadata;
            localStorage.setItem(this.metadataKey, JSON.stringify(allMetadata));
        } catch (error) {
            console.error('[MediaCacheManager] Erro ao salvar metadados', error);
        }
    }

    /**
     * Carrega metadados de uma mídia
     */
    async loadMediaMetadata(mediaId) {
        const allMetadata = await this.loadAllMediaMetadata();
        return allMetadata[mediaId] || null;
    }

    /**
     * Carrega todos os metadados
     */
    async loadAllMediaMetadata() {
        try {
            const json = localStorage.getItem(this.metadataKey);
            return json ? JSON.parse(json) : {};
        } catch (error) {
            console.error('[MediaCacheManager] Erro ao carregar metadados', error);
            return {};
        }
    }

    /**
     * Remove metadados de uma mídia
     */
    async removeMediaMetadata(mediaId) {
        try {
            const allMetadata = await this.loadAllMediaMetadata();
            delete allMetadata[mediaId];
            localStorage.setItem(this.metadataKey, JSON.stringify(allMetadata));
        } catch (error) {
            console.error('[MediaCacheManager] Erro ao remover metadados', error);
        }
    }

    /**
     * Carrega metadados do localStorage
     */
    async loadMetadata() {
        this.metadata = await this.loadAllMediaMetadata();
    }

    /**
     * Calcula checksum SHA-256
     */
    async calculateChecksum(data) {
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    /**
     * Valida checksum de um Blob
     */
    async validateChecksum(blob, expectedChecksum) {
        try {
            const arrayBuffer = await blob.arrayBuffer();
            const data = new Uint8Array(arrayBuffer);
            const calculatedChecksum = await this.calculateChecksum(data);
            return calculatedChecksum === expectedChecksum;
        } catch (error) {
            console.error('[MediaCacheManager] Erro ao validar checksum', error);
            return false;
        }
    }
}

// Exportar para uso global
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MediaCacheManager;
} else {
    window.MediaCacheManager = MediaCacheManager;
}
