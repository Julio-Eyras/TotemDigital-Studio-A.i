/**
 * Smart Signage Player - Linux/Windows
 * Aplicativo principal para totens desktop
 * 
 * Suporta DispatchPlan nativo, cache local e servidor HTTP local
 */

const http = require('http');
const https = require('https');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const { EventEmitter } = require('events');

// Importar componentes (em produção, seria via módulos)
// Por enquanto, vamos incluir os arquivos diretamente
const MDNSAnnouncer = require('./mdns/MDNSAnnouncer');

class SmartSignagePlayer extends EventEmitter {
    constructor(config = {}) {
        super();
        
        this.config = {
            apiBaseURL: config.apiBaseURL || process.env.API_BASE_URL || 'http://localhost:3000',
            totemUIN: config.totemUIN || process.env.TOTEM_UIN || '',
            totemSecret: config.totemSecret || process.env.TOTEM_SECRET || '',
            deviceId: config.deviceId || this.generateDeviceId(),
            platform: process.platform === 'win32' ? 'windows' : 'linux',
            appVersion: '2.1.0',
            heartbeatInterval: config.heartbeatInterval || 30000,
            dispatchSyncInterval: config.dispatchSyncInterval || 900000, // 15 minutos
            cacheEnabled: config.cacheEnabled !== false,
            cacheMaxSize: config.cacheMaxSize || 32 * 1024 * 1024 * 1024, // 32GB
            httpServerPort: config.httpServerPort || 8080,
            autoDiscovery: config.autoDiscovery !== false
        };
        
        this.deviceToken = null;
        this.currentDispatchPlan = null;
        this.currentIndex = 0;
        this.isPlaying = false;
        this.currentMediaItem = null;
        
        // Componentes
        this.apiClient = null;
        this.cacheManager = null;
        this.httpServer = null;
        this.totemConnectionManager = null;
        this.mediaPlayer = null;
        this.mdnsAnnouncer = null;
    }

    /**
     * Gera deviceId único para Linux/Windows
     */
    generateDeviceId() {
        const os = require('os');
        const crypto = require('crypto');
        
        // Combinar informações do sistema
        const systemInfo = [
            os.hostname(),
            os.platform(),
            os.arch(),
            os.totalmem().toString()
        ].join('-');
        
        // Gerar hash
        const hash = crypto.createHash('sha256').update(systemInfo).digest('hex');
        return `${this.config.platform}-${hash.substring(0, 16)}`;
    }

    /**
     * Inicializa o player
     */
    async init() {
        try {
            console.log('[Player] Inicializando Smart Signage Player...');
            console.log(`[Player] Platform: ${this.config.platform}`);
            console.log(`[Player] Device ID: ${this.config.deviceId}`);
            
            // 1. Inicializar TotemConnectionManager (descoberta totem local vs servidor central)
            await this.initTotemConnectionManager();
            
            // 2. Inicializar API Client
            await this.initAPIClient();
            
            // 3. Token + heartbeat inicial (contrato: GET /token → POST /heartbeat antes do dispatch)
            await this.bootstrapDispatcherSession();
            
            // 4. Inicializar cache local
            if (this.config.cacheEnabled) {
                await this.initCacheManager();
            }
            
            // 5. Inicializar servidor HTTP local (totem)
            if (this.config.platform === 'linux' || this.config.platform === 'windows') {
                await this.initHttpServer();
            }
            
            // 5.5. Registrar totem via mDNS (descoberta automática)
            if (this.config.platform === 'linux' || this.config.platform === 'windows') {
                await this.initMDNS();
            }
            
            // 6. Inicializar media player
            await this.initMediaPlayer();
            
            // 7. Carregar DispatchPlan inicial (GET /api/player/dispatch)
            await this.loadDispatchPlan();
            
            // 8. Iniciar serviços
            this.startServices();
            
            console.log('[Player] Player inicializado com sucesso!');
            this.emit('initialized');
            
        } catch (error) {
            console.error('[Player] Erro na inicialização:', error);
            this.emit('error', error);
            throw error;
        }
    }

    /**
     * Inicializa TotemConnectionManager
     */
    async initTotemConnectionManager() {
        // Para Linux/Windows, geralmente são totens, não TVs
        // Mas podem se conectar a outros totens se necessário
        const TotemConnectionManager = require('./totem/TotemConnectionManager');
        this.totemConnectionManager = new TotemConnectionManager({
            totemIP: this.config.totemIP || null,
            totemPort: this.config.totemPort || 8080,
            totemUIN: this.config.totemUIN,
            apiBaseURL: this.config.apiBaseURL,
            autoDiscovery: this.config.autoDiscovery,
            discoveryTimeout: 5000
        });
        
        const strategy = await this.totemConnectionManager.determineConnectionStrategy();
        if (strategy.useLocalTotem) {
            console.log('[Player] Totem local encontrado:', strategy.totemInfo);
            this.config.apiBaseURL = this.totemConnectionManager.getBaseURL();
        } else {
            console.log('[Player] Usando servidor central');
        }
    }

    /**
     * Inicializa API Client
     */
    async initAPIClient() {
        const APIClient = require('./api/client');
        this.apiClient = new APIClient(
            this.config.apiBaseURL,
            this.config.totemUIN,
            this.config.totemSecret
        );
    }

    /**
     * Obtém apenas token (GET /api/player/token). Para arranque completo use bootstrapDispatcherSession().
     */
    async getDeviceToken() {
        try {
            const response = await this.apiClient.getDeviceToken(
                this.config.totemUIN,
                this.config.deviceId,
                this.config.platform,
                this.config.appVersion
            );
            
            if (response && response.token) {
                this.deviceToken = response.token;
                this.apiClient.token = this.deviceToken;
                console.log('[Player] Device token obtido com sucesso');
                return true;
            }
            
            throw new Error('Falha ao obter device token');
        } catch (error) {
            console.error('[Player] Erro ao obter device token:', error);
            throw error;
        }
    }

    /**
     * Token + primeiro heartbeat antes do dispatch (ver api/client.dispatcherStartupSequence).
     */
    async bootstrapDispatcherSession() {
        console.log('[Player] Ciclo de vida: (1) /api/player/token → (2) /api/player/heartbeat');
        await this.apiClient.dispatcherStartupSequence({
            uin: this.config.totemUIN,
            deviceId: this.config.deviceId,
            platform: this.config.platform,
            appVersion: this.config.appVersion
        });
        if (this.apiClient.token) {
            this.deviceToken = this.apiClient.token;
        }
        console.log('[Player] Sessão Dispatcher pronta');
    }

    /**
     * Inicializa cache manager
     */
    async initCacheManager() {
        const MediaCacheManager = require('./cache/MediaCacheManager');
        this.cacheManager = new MediaCacheManager({
            maxCacheSize: this.config.cacheMaxSize,
            cacheDir: path.join(__dirname, '../cache/media')
        });
        
        await this.cacheManager.init();
        console.log('[Player] Cache manager inicializado');
    }

    /**
     * Inicializa servidor HTTP local
     */
    async initHttpServer() {
        const LocalHttpServer = require('./local-http-server');
        this.httpServer = new LocalHttpServer({
            port: this.config.httpServerPort,
            cacheDir: path.join(__dirname, '../cache/media')
        });
        
        this.httpServer.start();
        console.log(`[Player] Servidor HTTP local iniciado na porta ${this.config.httpServerPort}`);
        console.log(`[Player] URL base: ${this.httpServer.getBaseUrl()}`);
    }

    /**
     * Inicializa mDNS (Avahi) para descoberta automática
     */
    async initMDNS() {
        try {
            if (!this.config.totemUIN) {
                console.warn('[Player] TOTEM_UIN não configurado, pulando registro mDNS');
                return;
            }

            this.mdnsAnnouncer = new MDNSAnnouncer({
                totemUIN: this.config.totemUIN,
                port: this.config.httpServerPort,
                version: this.config.appVersion
            });

            const success = await this.mdnsAnnouncer.createServiceFile();
            if (success) {
                console.log('[Player] Totem registrado via mDNS para descoberta automática');
                console.log(`[Player] Smart TVs podem descobrir via: Publisher-${os.hostname()}.local`);
            } else {
                console.warn('[Player] Falha ao registrar mDNS (totem ainda funcionará normalmente)');
            }
        } catch (error) {
            console.warn('[Player] Erro ao inicializar mDNS:', error.message);
            console.warn('[Player] Totem ainda funcionará, mas não será descoberto via mDNS');
        }
    }

    /**
     * Inicializa media player
     */
    async initMediaPlayer() {
        const MediaPlayer = require('./media/MediaPlayer');
        this.mediaPlayer = new MediaPlayer({
            platform: this.config.platform
        });
        
        this.mediaPlayer.on('ended', () => {
            this.playNext();
        });
        
        this.mediaPlayer.on('error', (error) => {
            console.error('[Player] Erro no media player:', error);
            this.emit('playback-error', error);
            this.playNext(); // Tentar próximo
        });
        
        console.log('[Player] Media player inicializado');
    }

    /**
     * Carrega DispatchPlan do dispatcher
     */
    async loadDispatchPlan() {
        try {
            const token = this.apiClient.token || this.deviceToken;
            if (!token) {
                throw new Error('Device token não disponível');
            }
            
            const timestamp = new Date().toISOString();
            const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
            
            const response = await this.apiClient.getDispatchPlan(
                this.config.totemUIN,
                token,
                this.config.deviceId,
                timestamp,
                timezone
            );
            
            if (response && response.success && response.plan) {
                this.currentDispatchPlan = response.plan;
                this.currentIndex = 0;
                
                // Processar cache em background
                if (this.cacheManager) {
                    this.cacheManager.processDispatchPlan(response.plan, this.apiClient)
                        .then(stats => {
                            console.log(`[Player] Cache processado: ${stats.success} sucesso, ${stats.failed} falhas, ${stats.skipped} puladas`);
                        })
                        .catch(error => {
                            console.error('[Player] Erro ao processar cache:', error);
                        });
                }
                
                console.log(`[Player] DispatchPlan carregado: ${response.plan.playlistName} (${response.plan.mediaItems.length} itens)`);
                this.emit('dispatchplan-loaded', response.plan);
                
                return true;
            }
            
            throw new Error(response?.error || 'Falha ao obter DispatchPlan');
        } catch (error) {
            console.error('[Player] Erro ao carregar DispatchPlan:', error);
            
            // Tentar modo offline
            if (this.cacheManager) {
                const lastPlan = this.cacheManager.loadLastDispatchPlan();
                if (lastPlan) {
                    console.log('[Player] Usando último DispatchPlan em cache (modo offline)');
                    this.currentDispatchPlan = lastPlan;
                    this.currentIndex = 0;
                    this.emit('dispatchplan-loaded', lastPlan);
                    return true;
                }
            }
            
            throw error;
        }
    }

    /**
     * Reproduz próximo item do DispatchPlan
     */
    async playNext() {
        if (!this.currentDispatchPlan || !this.currentDispatchPlan.mediaItems || this.currentDispatchPlan.mediaItems.length === 0) {
            console.warn('[Player] Nenhum DispatchPlan disponível');
            this.emit('playback-ended');
            return;
        }
        
        // Validar validade temporal
        const now = Date.now();
        const validityStart = this.currentDispatchPlan.validityStart ? new Date(this.currentDispatchPlan.validityStart).getTime() : null;
        const validityEnd = this.currentDispatchPlan.validityEnd ? new Date(this.currentDispatchPlan.validityEnd).getTime() : null;
        
        if (validityStart && now < validityStart) {
            console.log('[Player] DispatchPlan ainda não válido, aguardando...');
            setTimeout(() => this.playNext(), 1000);
            return;
        }
        
        if (validityEnd && now > validityEnd) {
            console.log('[Player] DispatchPlan expirado, recarregando...');
            await this.loadDispatchPlan();
            return;
        }
        
        // Obter próximo item
        const mediaItem = this.currentDispatchPlan.mediaItems[this.currentIndex];
        this.currentIndex = (this.currentIndex + 1) % this.currentDispatchPlan.mediaItems.length;
        
        // Tentar usar caminho local primeiro
        let url = mediaItem.url;
        if (this.cacheManager) {
            const localPath = await this.cacheManager.getLocalPath(mediaItem.mediaId);
            if (localPath) {
                url = `file://${localPath}`;
                console.log(`[Player] Usando mídia do cache local: ${localPath}`);
            } else if (this.totemConnectionManager && this.totemConnectionManager.isUsingLocalTotem()) {
                // Tentar usar totem local HTTP
                const totemInfo = this.totemConnectionManager.getTotemInfo();
                const checksum = mediaItem.metadata?.checksum || 'unknown';
                const extension = this.getFileExtension(mediaItem.metadata?.mimeType || 'application/octet-stream');
                url = `http://${totemInfo.ip}:${totemInfo.port}/media/${mediaItem.mediaId}_${checksum}.${extension}`;
                console.log(`[Player] Usando mídia do totem local: ${url}`);
            }
        }
        
        // Reproduzir
        try {
            this.currentMediaItem = mediaItem;
            this.isPlaying = true;
            this.emit('playing', mediaItem);
            
            await this.mediaPlayer.play(mediaItem, url);
        } catch (error) {
            console.error('[Player] Erro ao reproduzir mídia:', error);
            this.emit('playback-error', error);
            // Tentar próximo após delay
            setTimeout(() => this.playNext(), 2000);
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

    /**
     * Inicia serviços (heartbeat, sincronização)
     */
    startServices() {
        // Heartbeat periódico
        setInterval(async () => {
            try {
                await this.sendHeartbeat();
            } catch (error) {
                console.error('[Player] Erro no heartbeat:', error);
            }
        }, this.config.heartbeatInterval);
        
        // Sincronização periódica do DispatchPlan
        setInterval(async () => {
            try {
                await this.loadDispatchPlan();
            } catch (error) {
                console.error('[Player] Erro na sincronização:', error);
            }
        }, this.config.dispatchSyncInterval);
        
        console.log('[Player] Serviços iniciados');
    }

    /**
     * Envia heartbeat
     */
    async sendHeartbeat() {
        try {
            const metrics = {
                isOnline: true,
                cacheSize: this.cacheManager ? await this.cacheManager.getCacheSize() : 0,
                currentMediaId: this.currentMediaItem?.mediaId || null,
                platform: this.config.platform,
                appVersion: this.config.appVersion
            };
            
            await this.apiClient.sendHeartbeat({
                status: 'online',
                version: this.config.appVersion,
                platform: this.config.platform,
                deviceId: this.config.deviceId,
                metrics: metrics
            });
            if (this.apiClient.token) {
                this.deviceToken = this.apiClient.token;
            }
        } catch (error) {
            console.error('[Player] Erro ao enviar heartbeat:', error);
            throw error;
        }
    }

    /**
     * Para reprodução
     */
    stop() {
        this.isPlaying = false;
        this.mediaPlayer?.stop();
        this.emit('stopped');
    }

    /**
     * Pausa reprodução
     */
    pause() {
        this.mediaPlayer?.pause();
        this.emit('paused');
    }

    /**
     * Resume reprodução
     */
    resume() {
        this.mediaPlayer?.resume();
        this.emit('resumed');
    }

    /**
     * Limpa recursos
     */
    async cleanup() {
        this.stop();
        this.httpServer?.stop();
        this.mediaPlayer?.release();
        
        // Remover registro mDNS
        if (this.mdnsAnnouncer) {
            await this.mdnsAnnouncer.removeServiceFile();
        }
        
        console.log('[Player] Recursos liberados');
    }
}

// Se executado diretamente
if (require.main === module) {
    const player = new SmartSignagePlayer({
        apiBaseURL: process.env.API_BASE_URL || 'http://localhost:3000',
        totemUIN: process.env.TOTEM_UIN || '',
        totemSecret: process.env.TOTEM_SECRET || '',
        cacheEnabled: true,
        httpServerPort: parseInt(process.env.HTTP_PORT || '8080')
    });
    
    player.on('initialized', () => {
        console.log('[Player] Player inicializado, iniciando reprodução...');
        player.playNext();
    });
    
    player.on('error', (error) => {
        console.error('[Player] Erro fatal:', error);
        process.exit(1);
    });
    
    player.init().catch(error => {
        console.error('[Player] Erro na inicialização:', error);
        process.exit(1);
    });
    
    // Parar graciosamente
    process.on('SIGTERM', async () => {
        console.log('[Player] Recebido SIGTERM, parando...');
        await player.cleanup();
        process.exit(0);
    });
    
    process.on('SIGINT', async () => {
        console.log('[Player] Recebido SIGINT, parando...');
        await player.cleanup();
        process.exit(0);
    });
}

module.exports = SmartSignagePlayer;
