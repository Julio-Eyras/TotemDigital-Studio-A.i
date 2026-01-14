/**
 * MediaCacheManager - webOS
 * Gerencia cache local de mídias do DispatchPlan usando FileSystem API
 */

class MediaCacheManager {
    constructor(options = {}) {
        this.maxCacheSize = options.maxCacheSize || 500 * 1024 * 1024; // 500MB padrão
        this.cacheDir = options.cacheDir || '/media/internal/smartsignage/cache';
        this.metadataKey = 'smartsignage_cache_metadata';
        this.dispatchPlanKey = 'smartsignage_last_dispatch_plan';
        
        this.fileSystem = null;
        this.metadata = null;
        
        this.init();
    }

    /**
     * Inicializa FileSystem API
     */
    async init() {
        try {
            if (typeof webOS !== 'undefined' && webOS.service && webOS.service.request) {
                // webOS FileSystem API disponível
                this.fileSystem = webOS.service;
                await this.loadMetadata();
            } else {
                console.warn('[MediaCacheManager] webOS FileSystem API não disponível, usando localStorage apenas');
            }
        } catch (error) {
            console.error('[MediaCacheManager] Erro na inicialização', error);
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
                            const isValid = await this.validateChecksum(cached.localPath, mediaItem.metadata.checksum);
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
            
            // Baixar arquivo via API
            const response = await apiClient.downloadMedia(mediaItem.mediaId);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const blob = await response.blob();
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
            
            // Salvar arquivo
            const extension = this.getFileExtension(mediaItem.metadata?.mimeType || 'application/octet-stream');
            const fileName = `${mediaItem.mediaId}_${checksum}.${extension}`;
            const localPath = `${this.cacheDir}/${fileName}`;
            
            await this.saveFile(localPath, data);
            
            // Salvar metadados
            await this.saveMediaMetadata(mediaItem.mediaId, {
                mediaId: mediaItem.mediaId,
                url: mediaItem.url,
                localPath: localPath,
                checksum: checksum,
                size: data.length,
                mimeType: mediaItem.metadata?.mimeType || 'application/octet-stream',
                downloadedAt: Date.now(),
                lastAccessed: Date.now(),
                valid: true
            });
            
            stats.success++;
            console.log(`[MediaCacheManager] Mídia ${mediaItem.mediaId} baixada com sucesso: ${localPath}`);
            
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
            const metadata = await this.loadMediaMetadata(mediaId);
            if (metadata && metadata.valid) {
                // Verificar se arquivo ainda existe
                const exists = await this.fileExists(metadata.localPath);
                if (exists) {
                    // Atualizar último acesso
                    metadata.lastAccessed = Date.now();
                    await this.saveMediaMetadata(mediaId, metadata);
                    return metadata;
                }
            }
            return null;
        } catch (error) {
            console.error('[MediaCacheManager] Erro ao obter mídia do cache', error);
            return null;
        }
    }

    /**
     * Obtém caminho local de uma mídia
     */
    async getLocalPath(mediaId) {
        const cached = await this.getCachedMedia(mediaId);
        return cached?.localPath || null;
    }

    /**
     * Remove mídia do cache
     */
    async removeCachedMedia(mediaId) {
        try {
            const metadata = await this.loadMediaMetadata(mediaId);
            if (metadata && metadata.localPath) {
                await this.deleteFile(metadata.localPath);
            }
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
        const allMetadata = await this.loadAllMediaMetadata();
        
        // Filtrar mídias não usadas e ordenar por último acesso (LRU)
        const unusedMedia = Object.values(allMetadata)
            .filter(meta => !currentMediaIdsSet.has(meta.mediaId))
            .sort((a, b) => a.lastAccessed - b.lastAccessed);
        
        let freedSpace = 0;
        for (const metadata of unusedMedia) {
            if (freedSpace >= minBytesToFree) break;
            
            await this.removeCachedMedia(metadata.mediaId);
            freedSpace += metadata.size;
        }
        
        console.log(`[MediaCacheManager] Limpeza concluída: ${freedSpace} bytes liberados`);
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
     * Salva arquivo usando FileSystem API
     */
    async saveFile(path, data) {
        if (!this.fileSystem) {
            throw new Error('FileSystem API não disponível');
        }
        
        // webOS FileSystem API
        return new Promise((resolve, reject) => {
            this.fileSystem.request('luna://com.webos.service.file', {
                method: 'write',
                params: {
                    path: path,
                    data: Array.from(data).map(b => String.fromCharCode(b)).join(''),
                    mode: 'w'
                },
                onSuccess: (response) => {
                    resolve(response);
                },
                onFailure: (error) => {
                    reject(error);
                }
            });
        });
    }

    /**
     * Verifica se arquivo existe
     */
    async fileExists(path) {
        if (!this.fileSystem) {
            return false;
        }
        
        return new Promise((resolve) => {
            this.fileSystem.request('luna://com.webos.service.file', {
                method: 'exists',
                params: { path: path },
                onSuccess: (response) => {
                    resolve(response.exists === true);
                },
                onFailure: () => {
                    resolve(false);
                }
            });
        });
    }

    /**
     * Deleta arquivo
     */
    async deleteFile(path) {
        if (!this.fileSystem) {
            return;
        }
        
        return new Promise((resolve, reject) => {
            this.fileSystem.request('luna://com.webos.service.file', {
                method: 'remove',
                params: { path: path },
                onSuccess: resolve,
                onFailure: reject
            });
        });
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
     * Valida checksum de um arquivo
     */
    async validateChecksum(filePath, expectedChecksum) {
        try {
            // Ler arquivo e calcular checksum
            const fileData = await this.readFile(filePath);
            const calculatedChecksum = await this.calculateChecksum(fileData);
            return calculatedChecksum === expectedChecksum;
        } catch (error) {
            console.error('[MediaCacheManager] Erro ao validar checksum', error);
            return false;
        }
    }

    /**
     * Lê arquivo
     */
    async readFile(path) {
        if (!this.fileSystem) {
            throw new Error('FileSystem API não disponível');
        }
        
        return new Promise((resolve, reject) => {
            this.fileSystem.request('luna://com.webos.service.file', {
                method: 'read',
                params: { path: path },
                onSuccess: (response) => {
                    const data = new Uint8Array(response.data.split('').map(c => c.charCodeAt(0)));
                    resolve(data);
                },
                onFailure: reject
            });
        });
    }

    /**
     * Obtém extensão de arquivo do MIME type
     */
    getFileExtension(mimeType) {
        const mimeMap = {
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
        return mimeMap[mimeType] || 'bin';
    }
}

// Exportar para uso global
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MediaCacheManager;
} else {
    window.MediaCacheManager = MediaCacheManager;
}
