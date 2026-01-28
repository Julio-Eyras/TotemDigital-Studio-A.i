/**
 * Smart Signage Player - Browser (player-web)
 * Player HTML5 com cache local completo usando IndexedDB.
 * Integrado à estrutura Dispatcher-Totem e envio de informações transacionais.
 * Similar ao comportamento das plataformas WebOS, Tizen e Android.
 */

class SmartSignagePlayer {
    constructor(config = {}) {
        this.config = {
            apiBaseURL: config.apiBaseURL || (typeof window !== 'undefined' && window.API_BASE_URL) || 'http://localhost:3000',
            totemUIN: config.totemUIN || (typeof window !== 'undefined' && window.TOTEM_UIN) || '',
            totemSecret: config.totemSecret || (typeof window !== 'undefined' && window.TOTEM_SECRET) || '',
            deviceId: config.deviceId || this.generateDeviceId(),
            platform: 'browser-cache',
            appVersion: '2.1.0',
            heartbeatInterval: config.heartbeatInterval || 30000,
            dispatchSyncInterval: config.dispatchSyncInterval || 900000,
            maxCacheSize: config.maxCacheSize || 500 * 1024 * 1024 // 500MB padrão
        };

        this.deviceToken = null;
        this.currentDispatchPlan = null;
        this.currentPlaylistId = null;
        this.currentCampaignId = null;
        this.currentIndex = 0;
        this.isPlaying = false;
        this.currentMediaItem = null;
        this.pendingCommands = [];
        this.lastDispatchUpdate = null;

        this.apiClient = null;
        this.mediaPlayer = null;
        this.mediaCacheManager = null;
        this.playlistChangeDetector = null;
    }

    generateDeviceId() {
        let deviceId = null;
        try {
            deviceId = localStorage.getItem('smartsignage_device_id');
        } catch (e) {}
        if (!deviceId) {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            ctx.textBaseline = 'top';
            ctx.font = '14px "Arial"';
            ctx.textBaseline = 'alphabetic';
            ctx.fillText('SmartSignage', 2, 2);
            const fp = [
                navigator.userAgent,
                navigator.language,
                screen.width + 'x' + screen.height,
                new Date().getTimezoneOffset(),
                canvas.toDataURL()
            ].join('|');
            let hash = 0;
            for (let i = 0; i < fp.length; i++) {
                const c = fp.charCodeAt(i);
                hash = ((hash << 5) - hash) + c;
                hash = hash & hash;
            }
            deviceId = 'browser-cache-' + Math.abs(hash).toString(16);
            try {
                localStorage.setItem('smartsignage_device_id', deviceId);
            } catch (e) {}
        }
        return deviceId;
    }

    async init() {
        try {
            console.log('[Player] Inicializando Smart Signage Player (Cache Completo)...');
            console.log('[Player] Device ID:', this.config.deviceId);

            await this.initAPIClient();
            await this.initCache();
            await this.getDeviceToken();
            await this.initMediaPlayer();
            
            // Tentar carregar último plano do cache (modo offline)
            const lastPlan = this.mediaCacheManager.loadLastDispatchPlan();
            if (lastPlan) {
                console.log('[Player] Último plano encontrado no cache, usando temporariamente...');
                this.currentDispatchPlan = lastPlan;
                this.currentPlaylistId = lastPlan.playlistId;
                this.currentCampaignId = (lastPlan.metadata && lastPlan.metadata.campaignId) || null;
                this.playlistChangeDetector.setLastPlan(lastPlan);
            }
            
            await this.loadDispatchPlan();
            this.startServices();

            console.log('[Player] Player inicializado com sucesso.');
            this.onInitialized();
        } catch (error) {
            console.error('[Player] Erro na inicialização:', error);
            this.onError(error);
            throw error;
        }
    }

    async initAPIClient() {
        const APIClient = (typeof window !== 'undefined' && window.APIClient);
        if (!APIClient) {
            try {
                await import('/player/js/api/client.js');
            } catch (e) {
                throw new Error('APIClient não disponível. Carregue js/api/client.js antes do app.js.');
            }
        }
        this.apiClient = new window.APIClient(
            this.config.apiBaseURL,
            this.config.totemUIN,
            this.config.totemSecret
        );
        this.apiClient.deviceId = this.config.deviceId;
    }

    async initCache() {
        const MediaCacheManager = (typeof window !== 'undefined' && window.MediaCacheManager);
        const PlaylistChangeDetector = (typeof window !== 'undefined' && window.PlaylistChangeDetector);
        
        if (!MediaCacheManager || !PlaylistChangeDetector) {
            try {
                await import('/player/js/cache/MediaCacheManager.js');
                await import('/player/js/cache/PlaylistChangeDetector.js');
            } catch (e) {
                throw new Error('MediaCacheManager ou PlaylistChangeDetector não disponíveis.');
            }
        }
        
        this.mediaCacheManager = new window.MediaCacheManager({
            maxCacheSize: this.config.maxCacheSize
        });
        await this.mediaCacheManager.init();
        
        this.playlistChangeDetector = new window.PlaylistChangeDetector();
        
        console.log('[Player] Cache inicializado.');
    }

    async getDeviceToken() {
        const response = await this.apiClient.getDeviceToken(
            this.config.totemUIN,
            this.config.deviceId,
            this.config.platform,
            this.config.appVersion
        );
        if (response && response.token) {
            this.deviceToken = response.token;
            this.apiClient.token = this.deviceToken;
            console.log('[Player] Device token obtido.');
            return;
        }
        throw new Error('Falha ao obter device token');
    }

    async initMediaPlayer() {
        const container = document.getElementById('player-container') || document.body;
        this.mediaPlayer = new MediaPlayerHTML5({ container });

        this.mediaPlayer.on('ended', (data) => {
            this._onMediaEnded(data);
        });
        this.mediaPlayer.on('error', (err) => {
            this._onMediaError(err);
        });
        console.log('[Player] Media player inicializado.');
    }

    async loadDispatchPlan(skipInitialPlaylistEnd) {
        if (!this.apiClient.token) {
            throw new Error('Token não disponível para dispatch');
        }

        const timestamp = new Date().toISOString();
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

        let response;
        try {
            response = await this.apiClient.getDispatchPlan(
                this.config.totemUIN,
                this.apiClient.token,
                this.config.deviceId,
                timestamp,
                timezone
            );
        } catch (error) {
            console.warn('[Player] Erro ao obter DispatchPlan, usando cache offline:', error);
            // Se falhar, tentar usar último plano do cache
            const lastPlan = this.mediaCacheManager.loadLastDispatchPlan();
            if (lastPlan) {
                console.log('[Player] Usando plano do cache (modo offline)');
                this.currentDispatchPlan = lastPlan;
                this.currentPlaylistId = lastPlan.playlistId;
                this.currentCampaignId = (lastPlan.metadata && lastPlan.metadata.campaignId) || null;
                this.playlistChangeDetector.setLastPlan(lastPlan);
                return;
            }
            throw error;
        }

        if (!response || !response.success) {
            throw new Error(response?.error || 'Falha ao obter DispatchPlan');
        }

        const plan = response.plan;
        if (!plan || !plan.mediaItems || !plan.mediaItems.length) {
            console.warn('[Player] DispatchPlan sem itens.');
            this.onPlaybackEnded();
            return;
        }

        // Detectar mudança de playlist
        const hasChanged = this.playlistChangeDetector.hasPlanChanged(
            this.currentDispatchPlan,
            plan
        );

        if (!skipInitialPlaylistEnd && this.currentDispatchPlan && hasChanged) {
            await this._sendEvent({
                eventType: 'playlist_end',
                playlistId: this.currentPlaylistId,
                campaignId: this.currentCampaignId,
                metadata: { reason: 'sync_reload' }
            }).catch(() => {});
        }

        // Se houve mudança, processar cache
        if (hasChanged) {
            console.log('[Player] Mudança de playlist detectada, processando cache...');
            try {
                await this.mediaCacheManager.processDispatchPlan(plan, this.apiClient);
            } catch (error) {
                console.error('[Player] Erro ao processar cache:', error);
                // Continuar mesmo se o cache falhar
            }
        }

        this.currentDispatchPlan = plan;
        this.currentPlaylistId = plan.playlistId;
        this.currentCampaignId = (plan.metadata && plan.metadata.campaignId) || null;
        this.currentIndex = 0;
        this.lastDispatchUpdate = Date.now();
        this.playlistChangeDetector.setLastPlan(plan);

        console.log('[Player] DispatchPlan carregado:', plan.playlistName, '(' + plan.mediaItems.length + ' itens)');
        this.onDispatchPlanLoaded(plan);

        if (hasChanged || !skipInitialPlaylistEnd) {
            await this._sendEvent({
                eventType: 'playlist_start',
                playlistId: this.currentPlaylistId,
                campaignId: this.currentCampaignId,
                metadata: { playlistName: plan.playlistName, source: plan.source }
            });
        }
    }

    async playNext() {
        if (!this.currentDispatchPlan || !this.currentDispatchPlan.mediaItems.length) {
            this.onPlaybackEnded();
            return;
        }

        const now = Date.now();
        const validityStart = this.currentDispatchPlan.validityStart
            ? new Date(this.currentDispatchPlan.validityStart).getTime() : null;
        const validityEnd = this.currentDispatchPlan.validityEnd
            ? new Date(this.currentDispatchPlan.validityEnd).getTime() : null;

        if (validityStart != null && now < validityStart) {
            setTimeout(() => this.playNext(), 1000);
            return;
        }

        if (validityEnd != null && now > validityEnd) {
            await this._sendEvent({
                eventType: 'playlist_end',
                playlistId: this.currentPlaylistId,
                campaignId: this.currentCampaignId,
                metadata: { reason: 'validity_expired' }
            }).catch(() => {});
            await this.loadDispatchPlan(true);
            await this.playNext();
            return;
        }

        const mediaItem = this.currentDispatchPlan.mediaItems[this.currentIndex];
        this.currentIndex = (this.currentIndex + 1) % this.currentDispatchPlan.mediaItems.length;

        this.currentMediaItem = mediaItem;
        this.isPlaying = true;
        this.onPlaying(mediaItem);

        const mt = (mediaItem.mediaType || 'video').toLowerCase();

        if (mt === 'video') {
            await this._sendEvent({
                eventType: 'video_playback_start',
                mediaId: mediaItem.mediaId,
                playlistId: this.currentPlaylistId,
                campaignId: this.currentCampaignId,
                metadata: { order: mediaItem.order }
            });
        } else if (mt === 'image') {
            await this._sendEvent({
                eventType: 'image_display',
                mediaId: mediaItem.mediaId,
                playlistId: this.currentPlaylistId,
                campaignId: this.currentCampaignId,
                metadata: { order: mediaItem.order, displayTime: new Date().toISOString() }
            });
        } else {
            await this._sendEvent({
                eventType: 'playlist_item_play',
                mediaId: mediaItem.mediaId,
                playlistId: this.currentPlaylistId,
                campaignId: this.currentCampaignId,
                metadata: { mediaType: mt, order: mediaItem.order }
            });
        }

        try {
            // Tentar usar cache primeiro
            const cachedBlobURL = await this.mediaCacheManager.getCachedMediaBlobURL(mediaItem.mediaId);
            
            if (cachedBlobURL) {
                console.log(`[Player] Reproduzindo mídia ${mediaItem.mediaId} do cache`);
                await this.mediaPlayer.play(mediaItem, cachedBlobURL);
            } else {
                // Fallback: streaming direto (enquanto baixa em background)
                console.log(`[Player] Mídia ${mediaItem.mediaId} não está em cache, usando streaming`);
                await this.mediaPlayer.play(mediaItem, mediaItem.url);
                
                // Baixar em background para próximo uso (não bloqueia)
                this.mediaCacheManager.downloadMedia(mediaItem, this.apiClient).catch(err => {
                    console.warn(`[Player] Erro ao baixar mídia em background:`, err);
                });
            }
        } catch (err) {
            console.error('[Player] Erro ao reproduzir:', err);
            await this._sendEvent({
                eventType: 'video_playback_error',
                mediaId: mediaItem.mediaId,
                playlistId: this.currentPlaylistId,
                campaignId: this.currentCampaignId,
                metadata: { error: String(err && err.message) }
            });
            this.onPlaybackError(err);
            setTimeout(() => this.playNext(), 2000);
        }
    }

    _onMediaEnded(data) {
        const item = this.currentMediaItem;
        const mt = item && (item.mediaType || 'video').toLowerCase();
        const duration = (data && data.duration != null) ? data.duration : (item && item.duration);

        if (mt === 'video' && item) {
            this._sendEvent({
                eventType: 'video_playback_end',
                mediaId: item.mediaId,
                playlistId: this.currentPlaylistId,
                campaignId: this.currentCampaignId,
                duration: duration != null ? Math.round(duration) : 0,
                completed: true,
                metadata: {}
            }).catch(() => {});
        }

        this.playNext();
    }

    _onMediaError(err) {
        const item = this.currentMediaItem;
        if (item) {
            this._sendEvent({
                eventType: 'video_playback_error',
                mediaId: item.mediaId,
                playlistId: this.currentPlaylistId,
                campaignId: this.currentCampaignId,
                metadata: { error: String(err && err.message) }
            }).catch(() => {});
        }
        this.onPlaybackError(err);
        this.playNext();
    }

    async _sendEvent(payload) {
        if (!this.apiClient || !this.config.totemUIN) return;
        try {
            await this.apiClient.sendEvent({
                ...payload,
                uin: this.config.totemUIN,
                token: this.apiClient.token
            });
        } catch (e) {
            console.warn('[Player] Erro ao enviar evento:', e);
        }
    }

    startServices() {
        setInterval(() => {
            this.sendHeartbeat().catch((e) => console.warn('[Player] Heartbeat:', e));
        }, this.config.heartbeatInterval);

        setInterval(() => {
            // Verificar se precisa atualizar baseado em intervalo
            const needsUpdate = this.playlistChangeDetector.needsUpdateByInterval(
                this.currentDispatchPlan,
                this.lastDispatchUpdate,
                this.config.dispatchSyncInterval
            );
            
            if (needsUpdate) {
                this.loadDispatchPlan().catch((e) => console.warn('[Player] Sync dispatch:', e));
            }
        }, this.config.dispatchSyncInterval);

        console.log('[Player] Serviços (heartbeat, sync) iniciados.');
    }

    async sendHeartbeat() {
        const metrics = {
            isOnline: typeof navigator !== 'undefined' && navigator.onLine,
            currentMediaId: this.currentMediaItem ? this.currentMediaItem.mediaId : null,
            platform: this.config.platform,
            appVersion: this.config.appVersion,
            userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
            cacheSize: await this.mediaCacheManager.getCacheSize()
        };

        const res = await this.apiClient.sendHeartbeat({
            status: 'online',
            version: this.config.appVersion,
            platform: this.config.platform,
            deviceId: this.config.deviceId,
            metrics,
            executedCommands: []
        });

        if (res && Array.isArray(res.pendingCommands) && res.pendingCommands.length) {
            this.pendingCommands = res.pendingCommands;
        }
    }

    stop() {
        this._sendEvent({
            eventType: 'playlist_end',
            playlistId: this.currentPlaylistId,
            campaignId: this.currentCampaignId,
            metadata: { reason: 'stopped' }
        }).catch(() => {});

        this.isPlaying = false;
        if (this.mediaPlayer) this.mediaPlayer.stop(true);
        this.onStopped();
    }

    pause() {
        if (this.mediaPlayer) this.mediaPlayer.pause();
        this.onPaused();
    }

    resume() {
        if (this.mediaPlayer) this.mediaPlayer.resume();
        this.onResumed();
    }

    onInitialized() {}
    onDispatchPlanLoaded(/* plan */) {}
    onPlaying(/* mediaItem */) {}
    onPlaybackError(/* err */) {}
    onPlaybackEnded() {}
    onStopped() {}
    onPaused() {}
    onResumed() {}
    onError(/* err */) {}
}

class MediaPlayerHTML5 {
    constructor(options = {}) {
        this.container = options.container || document.body;
        this.currentElement = null;
        this.listeners = {};
        this._startedAt = null;
        this._currentBlobURL = null; // Para limpar Blob URLs
    }

    on(event, callback) {
        if (!this.listeners[event]) this.listeners[event] = [];
        this.listeners[event].push(callback);
    }

    emit(event, data) {
        const list = this.listeners[event];
        if (list) list.forEach((fn) => fn(data));
    }

    async play(mediaItem, url) {
        return new Promise((resolve, reject) => {
            this._stopSilent();
            this._startedAt = Date.now();
            const mt = (mediaItem.mediaType || 'video').toLowerCase();
            const duration = mediaItem.duration;

            // Limpar Blob URL anterior se existir
            if (this._currentBlobURL && this._currentBlobURL.startsWith('blob:')) {
                URL.revokeObjectURL(this._currentBlobURL);
            }
            this._currentBlobURL = url;

            const finish = (err, d) => {
                const secs = d != null ? d : (Date.now() - this._startedAt) / 1000;
                this.emit('ended', { duration: secs });
                this._stopSilent();
                if (err) reject(err);
                else resolve({ duration: secs });
            };

            switch (mt) {
                case 'video':
                    this._playVideo(url, duration, finish);
                    break;
                case 'image':
                    this._playImage(url, duration || 10, finish);
                    break;
                case 'html':
                case 'web':
                    this._playHTML(url, duration || 30, finish);
                    break;
                default:
                    reject(new Error('Tipo de mídia não suportado: ' + mt));
            }
        });
    }

    _playVideo(url, durationSec, finish) {
        const v = document.createElement('video');
        v.src = url;
        v.autoplay = true;
        v.controls = false;
        v.style.width = v.style.height = '100%';
        v.style.objectFit = 'contain';

        v.onended = () => {
            const secs = durationSec != null ? durationSec : (Date.now() - this._startedAt) / 1000;
            finish(null, secs);
        };
        v.onerror = (e) => finish(e || new Error('Video error'));

        this.container.appendChild(v);
        this.currentElement = v;

        if (durationSec) {
            setTimeout(() => {
                if (this.currentElement === v) finish(null, durationSec);
            }, durationSec * 1000);
        }
    }

    _playImage(url, durationSec, finish) {
        const img = document.createElement('img');
        img.src = url;
        img.style.width = img.style.height = '100%';
        img.style.objectFit = 'contain';
        img.onerror = (e) => finish(e || new Error('Image error'));

        this.container.appendChild(img);
        this.currentElement = img;

        setTimeout(() => {
            if (this.currentElement === img) finish(null, durationSec);
        }, durationSec * 1000);
    }

    _playHTML(url, durationSec, finish) {
        const iframe = document.createElement('iframe');
        iframe.src = url;
        iframe.style.width = iframe.style.height = '100%';
        iframe.style.border = 'none';
        iframe.onerror = () => finish(new Error('Iframe error'));

        this.container.appendChild(iframe);
        this.currentElement = iframe;

        setTimeout(() => {
            if (this.currentElement === iframe) finish(null, durationSec);
        }, durationSec * 1000);
    }

    _stopSilent() {
        if (!this.currentElement) return;
        if (this.currentElement.tagName === 'VIDEO') {
            this.currentElement.pause();
            this.currentElement.src = '';
        }
        this.currentElement.remove();
        this.currentElement = null;
        
        // Limpar Blob URL
        if (this._currentBlobURL && this._currentBlobURL.startsWith('blob:')) {
            URL.revokeObjectURL(this._currentBlobURL);
            this._currentBlobURL = null;
        }
    }

    stop(skipEmit) {
        if (!skipEmit) {
            const dur = this._startedAt != null ? (Date.now() - this._startedAt) / 1000 : 0;
            this.emit('ended', { duration: dur });
        }
        this._stopSilent();
    }

    pause() {
        if (this.currentElement && this.currentElement.tagName === 'VIDEO') {
            this.currentElement.pause();
        }
    }

    resume() {
        if (this.currentElement && this.currentElement.tagName === 'VIDEO') {
            this.currentElement.play();
        }
    }
}

if (typeof window !== 'undefined') {
    window.SmartSignagePlayer = SmartSignagePlayer;
    window.MediaPlayerHTML5 = MediaPlayerHTML5;
}
