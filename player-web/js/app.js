/**
 * Smart Signage Player - Browser (player-web)
 * Player HTML5 para streaming direto (sem cache local)
 * 
 * Suporta DispatchPlan nativo e streaming de mídias
 */

class SmartSignagePlayer {
    constructor(config = {}) {
        this.config = {
            apiBaseURL: config.apiBaseURL || window.API_BASE_URL || 'http://localhost:3000',
            totemUIN: config.totemUIN || window.TOTEM_UIN || '',
            totemSecret: config.totemSecret || window.TOTEM_SECRET || '',
            deviceId: config.deviceId || this.generateDeviceId(),
            platform: 'browser',
            appVersion: '2.1.0',
            heartbeatInterval: config.heartbeatInterval || 30000,
            dispatchSyncInterval: config.dispatchSyncInterval || 900000 // 15 minutos
        };
        
        this.deviceToken = null;
        this.currentDispatchPlan = null;
        this.currentIndex = 0;
        this.isPlaying = false;
        this.currentMediaItem = null;
        
        // Componentes
        this.apiClient = null;
        this.mediaPlayer = null;
    }

    /**
     * Gera deviceId único para browser
     */
    generateDeviceId() {
        // Tentar usar localStorage para persistir deviceId
        let deviceId = localStorage.getItem('smartsignage_device_id');
        
        if (!deviceId) {
            // Gerar novo deviceId baseado em características do navegador
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            ctx.textBaseline = 'top';
            ctx.font = '14px "Arial"';
            ctx.textBaseline = 'alphabetic';
            ctx.fillText('SmartSignage', 2, 2);
            
            const fingerprint = [
                navigator.userAgent,
                navigator.language,
                screen.width + 'x' + screen.height,
                new Date().getTimezoneOffset(),
                canvas.toDataURL()
            ].join('|');
            
            // Hash simples
            let hash = 0;
            for (let i = 0; i < fingerprint.length; i++) {
                const char = fingerprint.charCodeAt(i);
                hash = ((hash << 5) - hash) + char;
                hash = hash & hash; // Convert to 32bit integer
            }
            
            deviceId = `browser-${Math.abs(hash).toString(16)}`;
            localStorage.setItem('smartsignage_device_id', deviceId);
        }
        
        return deviceId;
    }

    /**
     * Inicializa o player
     */
    async init() {
        try {
            console.log('[Player] Inicializando Smart Signage Player (Browser)...');
            console.log(`[Player] Device ID: ${this.config.deviceId}`);
            
            // 1. Inicializar API Client
            await this.initAPIClient();
            
            // 2. Obter token de dispositivo
            await this.getDeviceToken();
            
            // 3. Inicializar media player HTML5
            await this.initMediaPlayer();
            
            // 4. Carregar DispatchPlan inicial
            await this.loadDispatchPlan();
            
            // 5. Iniciar serviços
            this.startServices();
            
            console.log('[Player] Player inicializado com sucesso!');
            this.onInitialized();
            
        } catch (error) {
            console.error('[Player] Erro na inicialização:', error);
            this.onError(error);
            throw error;
        }
    }

    /**
     * Inicializa API Client
     */
    async initAPIClient() {
        const APIClient = window.APIClient || await import('./api/client.js');
        this.apiClient = new APIClient(
            this.config.apiBaseURL,
            this.config.totemUIN,
            this.config.totemSecret
        );
    }

    /**
     * Obtém token de dispositivo
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
     * Inicializa media player HTML5
     */
    async initMediaPlayer() {
        this.mediaPlayer = new MediaPlayerHTML5({
            container: document.getElementById('player-container') || document.body
        });
        
        this.mediaPlayer.on('ended', () => {
            this.playNext();
        });
        
        this.mediaPlayer.on('error', (error) => {
            console.error('[Player] Erro no media player:', error);
            this.onPlaybackError(error);
            this.playNext(); // Tentar próximo
        });
        
        console.log('[Player] Media player inicializado');
    }

    /**
     * Carrega DispatchPlan do dispatcher
     */
    async loadDispatchPlan() {
        try {
            if (!this.deviceToken) {
                throw new Error('Device token não disponível');
            }
            
            const timestamp = new Date().toISOString();
            const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
            
            const response = await this.apiClient.getDispatchPlan(
                this.config.totemUIN,
                this.deviceToken,
                this.config.deviceId,
                timestamp,
                timezone
            );
            
            if (response && response.success && response.plan) {
                this.currentDispatchPlan = response.plan;
                this.currentIndex = 0;
                
                console.log(`[Player] DispatchPlan carregado: ${response.plan.playlistName} (${response.plan.mediaItems.length} itens)`);
                this.onDispatchPlanLoaded(response.plan);
                
                return true;
            }
            
            throw new Error(response?.error || 'Falha ao obter DispatchPlan');
        } catch (error) {
            console.error('[Player] Erro ao carregar DispatchPlan:', error);
            throw error;
        }
    }

    /**
     * Reproduz próximo item do DispatchPlan
     */
    async playNext() {
        if (!this.currentDispatchPlan || !this.currentDispatchPlan.mediaItems || this.currentDispatchPlan.mediaItems.length === 0) {
            console.warn('[Player] Nenhum DispatchPlan disponível');
            this.onPlaybackEnded();
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
        
        // Usar URL diretamente (streaming, sem cache)
        const url = mediaItem.url;
        
        // Reproduzir
        try {
            this.currentMediaItem = mediaItem;
            this.isPlaying = true;
            this.onPlaying(mediaItem);
            
            await this.mediaPlayer.play(mediaItem, url);
        } catch (error) {
            console.error('[Player] Erro ao reproduzir mídia:', error);
            this.onPlaybackError(error);
            // Tentar próximo após delay
            setTimeout(() => this.playNext(), 2000);
        }
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
                isOnline: navigator.onLine,
                currentMediaId: this.currentMediaItem?.mediaId || null,
                platform: this.config.platform,
                appVersion: this.config.appVersion,
                userAgent: navigator.userAgent
            };
            
            await this.apiClient.sendHeartbeat({
                status: 'online',
                version: this.config.appVersion,
                platform: this.config.platform,
                deviceId: this.config.deviceId,
                metrics: metrics
            });
        } catch (error) {
            console.error('[Player] Erro ao enviar heartbeat:', error);
        }
    }

    /**
     * Para reprodução
     */
    stop() {
        this.isPlaying = false;
        this.mediaPlayer?.stop();
        this.onStopped();
    }

    /**
     * Pausa reprodução
     */
    pause() {
        this.mediaPlayer?.pause();
        this.onPaused();
    }

    /**
     * Resume reprodução
     */
    resume() {
        this.mediaPlayer?.resume();
        this.onResumed();
    }

    // Event handlers (podem ser sobrescritos)
    onInitialized() {
        console.log('[Player] Inicializado');
    }

    onDispatchPlanLoaded(dispatchPlan) {
        console.log('[Player] DispatchPlan carregado:', dispatchPlan);
    }

    onPlaying(mediaItem) {
        console.log('[Player] Reproduzindo:', mediaItem);
    }

    onPlaybackError(error) {
        console.error('[Player] Erro na reprodução:', error);
    }

    onPlaybackEnded() {
        console.log('[Player] Reprodução finalizada');
    }

    onStopped() {
        console.log('[Player] Parado');
    }

    onPaused() {
        console.log('[Player] Pausado');
    }

    onResumed() {
        console.log('[Player] Retomado');
    }

    onError(error) {
        console.error('[Player] Erro:', error);
    }
}

// Classe MediaPlayerHTML5
class MediaPlayerHTML5 {
    constructor(options = {}) {
        this.container = options.container || document.body;
        this.currentElement = null;
        this.listeners = {};
    }

    /**
     * Reproduz item de mídia do DispatchPlan
     */
    async play(mediaItem, url) {
        return new Promise((resolve, reject) => {
            // Limpar elemento anterior
            this.stop();
            
            switch (mediaItem.mediaType.toLowerCase()) {
                case 'video':
                    this.playVideo(url, mediaItem.duration, resolve, reject);
                    break;
                case 'image':
                    this.playImage(url, mediaItem.duration || 10, resolve, reject);
                    break;
                case 'html':
                case 'web':
                    this.playHTML(url, mediaItem.duration || 30, resolve, reject);
                    break;
                default:
                    reject(new Error(`Tipo de mídia não suportado: ${mediaItem.mediaType}`));
            }
        });
    }

    /**
     * Reproduz vídeo
     */
    playVideo(url, durationSeconds, resolve, reject) {
        const video = document.createElement('video');
        video.src = url;
        video.autoplay = true;
        video.controls = false;
        video.style.width = '100%';
        video.style.height = '100%';
        video.style.objectFit = 'contain';
        
        video.onended = () => {
            this.stop();
            resolve();
        };
        
        video.onerror = (error) => {
            reject(error);
        };
        
        this.container.appendChild(video);
        this.currentElement = video;
        
        // Se duração especificada, agendar término
        if (durationSeconds) {
            setTimeout(() => {
                this.stop();
                resolve();
            }, durationSeconds * 1000);
        }
    }

    /**
     * Exibe imagem
     */
    playImage(url, durationSeconds, resolve, reject) {
        const img = document.createElement('img');
        img.src = url;
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = 'contain';
        
        img.onerror = (error) => {
            reject(error);
        };
        
        this.container.appendChild(img);
        this.currentElement = img;
        
        // Aguardar duração especificada
        setTimeout(() => {
            this.stop();
            resolve();
        }, durationSeconds * 1000);
    }

    /**
     * Exibe HTML/Web
     */
    playHTML(url, durationSeconds, resolve, reject) {
        const iframe = document.createElement('iframe');
        iframe.src = url;
        iframe.style.width = '100%';
        iframe.style.height = '100%';
        iframe.style.border = 'none';
        
        iframe.onerror = (error) => {
            reject(error);
        };
        
        this.container.appendChild(iframe);
        this.currentElement = iframe;
        
        // Aguardar duração especificada
        setTimeout(() => {
            this.stop();
            resolve();
        }, durationSeconds * 1000);
    }

    /**
     * Para reprodução
     */
    stop() {
        if (this.currentElement) {
            if (this.currentElement.tagName === 'VIDEO') {
                this.currentElement.pause();
                this.currentElement.src = '';
            }
            this.currentElement.remove();
            this.currentElement = null;
        }
        this.emit('ended');
    }

    /**
     * Pausa reprodução
     */
    pause() {
        if (this.currentElement && this.currentElement.tagName === 'VIDEO') {
            this.currentElement.pause();
        }
    }

    /**
     * Resume reprodução
     */
    resume() {
        if (this.currentElement && this.currentElement.tagName === 'VIDEO') {
            this.currentElement.play();
        }
    }

    /**
     * Event emitter simples
     */
    on(event, callback) {
        if (!this.listeners[event]) {
            this.listeners[event] = [];
        }
        this.listeners[event].push(callback);
    }

    emit(event, data) {
        if (this.listeners[event]) {
            this.listeners[event].forEach(callback => callback(data));
        }
    }
}

// Exportar para uso global
window.SmartSignagePlayer = SmartSignagePlayer;
window.MediaPlayerHTML5 = MediaPlayerHTML5;
