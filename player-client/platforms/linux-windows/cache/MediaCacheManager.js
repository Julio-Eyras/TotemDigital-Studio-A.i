/**
 * MediaCacheManager - Linux/Windows
 * Gerencia cache local de mídias do DispatchPlan usando FileSystem nativo
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

class MediaCacheManager {
    constructor(options = {}) {
        this.maxCacheSize = options.maxCacheSize || 32 * 1024 * 1024 * 1024; // 32GB padrão
        this.cacheDir = options.cacheDir || path.join(__dirname, '../../cache/media');
        this.metadataFile = path.join(path.dirname(this.cacheDir), 'metadata.json');
        this.dispatchPlanFile = path.join(path.dirname(this.cacheDir), 'dispatch_plan.json');
        
        this.metadata = null;
        
        this.init();
    }

    /**
     * Inicializa cache manager
     */
    async init() {
        try {
            // Criar diretório de cache se não existir
            await fs.mkdir(this.cacheDir, { recursive: true });
            
            // Carregar metadados
            await this.loadMetadata();
            
            console.log('[MediaCacheManager] Inicializado');
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
            
            // Ler dados
            const chunks = [];
            response.on('data', chunk => chunks.push(chunk));
            await new Promise((resolve, reject) => {
                response.on('end', resolve);
                response.on('error', reject);
            });
            
            const data = Buffer.concat(chunks);
            
            // Validar tamanho se disponível
            if (mediaItem.metadata?.size && data.length !== mediaItem.metadata.size) {
                throw new Error(`Tamanho incorreto: esperado ${mediaItem.metadata.size}, recebido ${data.length}`);
            }
            
            // Calcular checksum
            const checksum = this.calculateChecksum(data);
            
            // Validar checksum se disponível
            if (mediaItem.metadata?.checksum && checksum !== mediaItem.metadata.checksum) {
                throw new Error(`Checksum inválido: esperado ${mediaItem.metadata.checksum}, calculado ${checksum}`);
            }
            
            // Salvar arquivo
            const extension = this.getFileExtension(mediaItem.metadata?.mimeType || 'application/octet-stream');
            const fileName = `${mediaItem.mediaId}_${checksum}.${extension}`;
            const localPath = path.join(this.cacheDir, fileName);
            
            await fs.writeFile(localPath, data);
            
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
                try {
                    await fs.access(metadata.localPath);
                    // Atualizar último acesso
                    metadata.lastAccessed = Date.now();
                    await this.saveMediaMetadata(mediaId, metadata);
                    return metadata;
                } catch (e) {
                    return null;
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
                try {
                    await fs.unlink(metadata.localPath);
                } catch (e) {
                    // Arquivo já não existe
                }
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
            await fs.writeFile(this.dispatchPlanFile, JSON.stringify(dispatchPlan, null, 2));
        } catch (error) {
            console.error('[MediaCacheManager] Erro ao salvar DispatchPlan', error);
        }
    }

    /**
     * Carrega último DispatchPlan salvo (modo offline)
     */
    async loadLastDispatchPlan() {
        try {
            const data = await fs.readFile(this.dispatchPlanFile, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            return null;
        }
    }

    /**
     * Salva metadados de mídia
     */
    async saveMediaMetadata(mediaId, metadata) {
        try {
            const allMetadata = await this.loadAllMediaMetadata();
            allMetadata[mediaId] = metadata;
            await fs.writeFile(this.metadataFile, JSON.stringify(allMetadata, null, 2));
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
            const data = await fs.readFile(this.metadataFile, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            return {};
        }
    }

    /**
     * Carrega metadados do arquivo
     */
    async loadMetadata() {
        this.metadata = await this.loadAllMediaMetadata();
    }

    /**
     * Remove metadados de uma mídia
     */
    async removeMediaMetadata(mediaId) {
        try {
            const allMetadata = await this.loadAllMediaMetadata();
            delete allMetadata[mediaId];
            await fs.writeFile(this.metadataFile, JSON.stringify(allMetadata, null, 2));
        } catch (error) {
            console.error('[MediaCacheManager] Erro ao remover metadados', error);
        }
    }

    /**
     * Calcula checksum SHA-256
     */
    calculateChecksum(data) {
        return crypto.createHash('sha256').update(data).digest('hex');
    }

    /**
     * Valida checksum de um arquivo
     */
    async validateChecksum(filePath, expectedChecksum) {
        try {
            const data = await fs.readFile(filePath);
            const calculatedChecksum = this.calculateChecksum(data);
            return calculatedChecksum === expectedChecksum;
        } catch (error) {
            console.error('[MediaCacheManager] Erro ao validar checksum', error);
            return false;
        }
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
            'image/png': 'png',
            'image/gif': 'gif',
            'image/webp': 'webp',
            'audio/mpeg': 'mp3',
            'audio/ogg': 'ogg',
            'audio/wav': 'wav'
        };
        return mimeMap[mimeType] || 'bin';
    }
}

module.exports = MediaCacheManager;
