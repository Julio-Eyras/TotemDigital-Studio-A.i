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
            maxCacheSize: config.maxCacheSize || 500 * 1024 * 1024, // 500MB padrão
            fallbackImageDuration: 20,
            fallbackPropagandasPerVinheta: 5,
            playbackStartTimeoutMs: config.playbackStartTimeoutMs || 45000,
            playbackWatchdogMinMs: config.playbackWatchdogMinMs || 30000,
            playbackWatchdogGraceMs: config.playbackWatchdogGraceMs || 15000,
            playbackWatchdogDefaultMs: config.playbackWatchdogDefaultMs || 15 * 60 * 1000
        };

        /** IDs de mídia que falharam (404) na playlist atual - para entrar em fallback só quando TODOS falharem */
        this.failedMediaIds = new Set();

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

    /** Resolve URL de mídia: se for path relativo (/api/...), converte para URL absoluta com apiBaseURL */
    _resolveMediaURL(url) {
        if (!url || typeof url !== 'string') return url || '';
        const trimmed = url.trim();
        if (/^(https?:|\/\/|blob:)/i.test(trimmed)) return trimmed;
        const base = (this.config.apiBaseURL || '').replace(/\/$/, '');
        if (!base) return trimmed;
        return base + (trimmed.startsWith('/') ? '' : '/') + trimmed;
    }

    /** Carrega player-config.json (fallbackImageDuration, fallbackPropagandasPerVinheta) */
    async loadPlayerConfig() {
        try {
            const base = (this.config.apiBaseURL || '').replace(/\/$/, '');
            const res = await fetch(base + '/api/player-static/player-config.json');
            if (res.ok) {
                const cfg = await res.json();
                if (cfg.fallbackImageDuration != null) this.config.fallbackImageDuration = cfg.fallbackImageDuration;
                if (cfg.fallbackPropagandasPerVinheta != null) this.config.fallbackPropagandasPerVinheta = cfg.fallbackPropagandasPerVinheta;
            }
        } catch (e) {
            console.warn('[Player] Não foi possível carregar player-config.json, usando padrões:', e);
        }
    }

    /** Busca manifest de fallback (propagandas + vinhetas) do backend */
    async fetchFallbackManifest() {
        const base = (this.config.apiBaseURL || '').replace(/\/$/, '');
        const res = await fetch(base + '/api/player/fallback-manifest');
        if (!res.ok) throw new Error('Fallback manifest não disponível');
        return await res.json();
    }

    /** Cria plano de fallback intercalando propagandas e vinhetas (a cada N propagandas, 1 vinheta) */
    buildFallbackPlan(propagandas, vinhetas) {
        const base = (this.config.apiBaseURL || '').replace(/\/$/, '');
        const imgExt = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
        const imgDur = this.config.fallbackImageDuration || 20;
        const n = Math.max(1, this.config.fallbackPropagandasPerVinheta || 5);

        const toItem = (file, folder, idx, isImage) => ({
            mediaId: 'fb-' + folder + '-' + idx,
            order: idx,
            duration: isImage ? imgDur : undefined,
            url: base + '/api/player-static/' + folder + '/' + encodeURIComponent(file),
            mediaType: isImage ? 'image' : 'video',
            metadata: { source: 'fallback' }
        });

        const mediaItems = [];
        let pi = 0, vi = 0, order = 0;
        while (pi < propagandas.length || vi < vinhetas.length) {
            for (let k = 0; k < n && pi < propagandas.length; k++) {
                const f = propagandas[pi++];
                const ext = f.slice(f.lastIndexOf('.')).toLowerCase();
                mediaItems.push(toItem(f, 'propagandas', order++, imgExt.includes(ext)));
            }
            if (vi < vinhetas.length) {
                const f = vinhetas[vi++];
                const ext = f.slice(f.lastIndexOf('.')).toLowerCase();
                mediaItems.push(toItem(f, 'vinhetas', order++, imgExt.includes(ext)));
            }
        }
        if (mediaItems.length === 0) {
            // Fallback mínimo: vinheta antiga se não houver arquivos
            mediaItems.push({
                mediaId: 'fb-default',
                order: 0,
                duration: 30,
                url: base + '/api/player-static/vinhetas/Smartsignage-interface-111.mp4',
                mediaType: 'video',
                metadata: { source: 'fallback' }
            });
        }
        return {
            totemId: 0,
            timestamp: new Date(),
            playlistId: 0,
            playlistName: 'Fallback (Propagandas + Vinhetas)',
            mediaItems,
            totalDuration: mediaItems.reduce((s, m) => s + (m.duration || 30), 0),
            priority: 0,
            source: 'fallback',
            sourceId: 0,
            validityStart: new Date(),
            validityEnd: new Date(Date.now() + 24 * 60 * 60 * 1000),
            metadata: {}
        };
    }

    /** Entra em modo fallback: carrega manifest, monta plano intercalado. O chamador deve chamar playNext(). */
    async startFallbackMode() {
        try {
            const { propagandas = [], vinhetas = [] } = await this.fetchFallbackManifest();
            const plan = this.buildFallbackPlan(propagandas, vinhetas);
            this.currentDispatchPlan = plan;
            this.currentPlaylistId = 0;
            this.currentCampaignId = null;
            this.currentIndex = 0;
            this.failedMediaIds.clear();
            this.playlistChangeDetector.setLastPlan(plan);
            console.log('[Player] Modo fallback: propagandas + vinhetas (' + plan.mediaItems.length + ' itens).');
        } catch (e) {
            console.warn('[Player] Fallback manifest falhou, usando vinheta padrão:', e);
            const plan = this.buildFallbackPlan([], []);
            this.currentDispatchPlan = plan;
            this.currentPlaylistId = 0;
            this.currentCampaignId = null;
            this.currentIndex = 0;
            this.failedMediaIds.clear();
            this.playlistChangeDetector.setLastPlan(plan);
        }
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

            await this.loadPlayerConfig();
            await this.initAPIClient();
            await this.initCache();
            // Contrato Dispatcher: token + heartbeat inicial antes do primeiro dispatch
            await this.bootstrapDispatcherSession();
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
                await import('/api/player-static/js/api/client.js');
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
                await import('/api/player-static/js/cache/MediaCacheManager.js');
                await import('/api/player-static/js/cache/PlaylistChangeDetector.js');
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

    /**
     * (1) /api/player/token → (2) /api/player/heartbeat com métricas de cache (cache já inicializado).
     */
    async bootstrapDispatcherSession() {
        console.log('[Player] Ciclo de vida: (1) token → (2) heartbeat inicial');
        await this.getDeviceToken();
        const metrics = {
            phase: 'startup',
            isOnline: typeof navigator !== 'undefined' && navigator.onLine,
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
        if (this.apiClient.token) {
            this.deviceToken = this.apiClient.token;
        }
        if (res && Array.isArray(res.pendingCommands) && res.pendingCommands.length) {
            this.pendingCommands = res.pendingCommands;
        }
        console.log('[Player] Sessão Dispatcher pronta');
    }

    async initMediaPlayer() {
        const container = document.getElementById('player-container') || document.body;
        this.mediaPlayer = new MediaPlayerHTML5({
            container,
            playbackStartTimeoutMs: this.config.playbackStartTimeoutMs,
            playbackWatchdogMinMs: this.config.playbackWatchdogMinMs,
            playbackWatchdogGraceMs: this.config.playbackWatchdogGraceMs,
            playbackWatchdogDefaultMs: this.config.playbackWatchdogDefaultMs
        });

        this.mediaPlayer.on('ended', (data) => {
            this._onMediaEnded(data);
        });
        this.mediaPlayer.on('error', (err) => {
            this._onMediaError(err);
        });
        console.log('[Player] Media player inicializado.');
    }

    async loadDispatchPlan(skipInitialPlaylistEnd) {
        if (!this.apiClient.token && !this.deviceToken) {
            throw new Error('Token não disponível para dispatch');
        }

        const timestamp = new Date().toISOString();
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

        const token = this.apiClient.token || this.deviceToken;
        let response;
        try {
            response = await this.apiClient.getDispatchPlan(
                this.config.totemUIN,
                token,
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
            // Sem cache: exibir modo fallback (propagandas + vinhetas)
            console.warn('[Player] Sem plano nem cache. Entrando em modo fallback.');
            await this.startFallbackMode();
            return;
        }

        if (!response || !response.success) {
            console.warn('[Player] API retornou sem plano:', response?.error || 'Falha ao obter DispatchPlan. Entrando em modo fallback.');
            await this.startFallbackMode();
            return;
        }

        const plan = response.plan;
        if (!plan || !plan.mediaItems || !plan.mediaItems.length) {
            console.warn('[Player] DispatchPlan sem itens. Entrando em modo fallback.');
            await this.startFallbackMode();
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
        this.failedMediaIds.clear();
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
            await this.startFallbackMode();
            this.playNext();
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
                // Garantir URL absoluta (backend pode enviar path relativo /api/player-static/...)
                const mediaUrl = this._resolveMediaURL(mediaItem.url);
                if (!mediaUrl) {
                    throw new Error('URL de mídia vazia: ' + (mediaItem.url || mediaItem.mediaId));
                }
                console.log(`[Player] Mídia ${mediaItem.mediaId} não está em cache, usando streaming`);
                await this.mediaPlayer.play(mediaItem, mediaUrl);
                
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
            }).catch(() => {});
            this.onPlaybackError(err);
            this._onItemPlayFailed(mediaItem);
        }
    }

    /** Quando um item falha (404): pula ou entra em fallback se TODOS falharem */
    _onItemPlayFailed(mediaItem) {
        if (!this.currentDispatchPlan) return;
        if (!mediaItem) {
            setTimeout(() => this.playNext(), 2000);
            return;
        }
        const plan = this.currentDispatchPlan;
        if (plan.source === 'fallback') {
            setTimeout(() => this.playNext(), 2000);
            return;
        }
        this.failedMediaIds.add(mediaItem.mediaId);
        const total = plan.mediaItems.length;
        if (this.failedMediaIds.size >= total) {
            console.warn('[Player] Todos os itens da playlist falharam (404). Entrando em modo fallback.');
            this.startFallbackMode().then(() => this.playNext());
        } else {
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
        this._onItemPlayFailed(item);
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

        if (this.apiClient.token) {
            this.deviceToken = this.apiClient.token;
        }
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
        this.playbackStartTimeoutMs = options.playbackStartTimeoutMs || 45000;
        this.playbackWatchdogMinMs = options.playbackWatchdogMinMs || 30000;
        this.playbackWatchdogGraceMs = options.playbackWatchdogGraceMs || 15000;
        this.playbackWatchdogDefaultMs = options.playbackWatchdogDefaultMs || 15 * 60 * 1000;
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

    /** Gera mensagem legível a partir do evento de erro (DOM Event ou MediaError). */
    _mediaErrorMessage(e, element, type, url) {
        if (!e) return type + ' error';
        // MediaError (video): code 1=ABORTED, 2=NETWORK, 3=DECODE, 4=SRC_NOT_SUPPORTED
        const mediaErr = element && element.error;
        if (mediaErr) {
            const codes = { 1: 'ABORTED', 2: 'NETWORK', 3: 'DECODE', 4: 'SRC_NOT_SUPPORTED' };
            const codeStr = codes[mediaErr.code] || ('CODE_' + mediaErr.code);
            const detail = mediaErr.message ? ': ' + mediaErr.message : '';
            return 'Video ' + codeStr + detail + (url ? ' (' + url + ')' : '');
        }
        if (e.message) return e.message;
        if (e.type) return type + ' error: ' + e.type;
        return type + ' error';
    }

    async play(mediaItem, url) {
        return new Promise((resolve, reject) => {
            this._stopSilent();
            this._startedAt = Date.now();
            const mt = (mediaItem.mediaType || 'video').toLowerCase();
            const duration = mediaItem.duration;
            let settled = false;

            // Limpar Blob URL anterior se existir
            if (this._currentBlobURL && this._currentBlobURL.startsWith('blob:')) {
                URL.revokeObjectURL(this._currentBlobURL);
            }
            this._currentBlobURL = url;

            const finish = (err, d) => {
                if (settled) return;
                settled = true;
                const secs = d != null ? d : (Date.now() - this._startedAt) / 1000;
                this._stopSilent();
                if (err) {
                    reject(err);
                } else {
                    this.emit('ended', { duration: secs });
                    resolve({ duration: secs });
                }
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
        let hasActuallyPlayed = false;
        v.src = url;
        v.autoplay = true;
        v.playsInline = true;
        v.setAttribute('playsinline', '');
        v.setAttribute('webkit-playsinline', 'true');
        v.controls = false;
        v.preload = 'auto';
        v.style.width = v.style.height = '100%';
        v.style.objectFit = 'contain';
        // Autoplay com som costuma ser bloqueado; som só ao passar o rato sobre o vídeo (totem com rato / debug).
        v.muted = true;
        v.addEventListener('mouseenter', () => {
            v.muted = false;
            v.play().catch(() => {});
        });
        v.addEventListener('mouseleave', () => {
            v.muted = true;
        });
        v.addEventListener('playing', () => {
            hasActuallyPlayed = true;
        });

        v.onended = () => {
            const secs = durationSec != null ? durationSec : (Date.now() - this._startedAt) / 1000;
            finish(null, secs);
        };
        v.onerror = (e) => {
            const msg = this._mediaErrorMessage(e, v, 'video', url);
            finish(new Error(msg));
        };

        this.container.appendChild(v);
        this.currentElement = v;

        let playbackStarted = false;
        const failIfCurrent = (message) => {
            if (this.currentElement !== v) return;
            finish(new Error(message));
        };
        const startPlayback = () => {
            if (playbackStarted) return;
            playbackStarted = true;
            v.muted = true;
            v.play().catch((err) => {
                console.error('[MediaPlayerHTML5] Falha ao iniciar vídeo:', err);
                finish(new Error((err && err.message) || 'Falha ao iniciar vídeo'));
            });
        };

        if (v.readyState >= 2) {
            startPlayback();
        } else {
            v.addEventListener('loadeddata', startPlayback, { once: true });
            v.addEventListener('canplay', startPlayback, { once: true });
            setTimeout(startPlayback, 2500);
        }

        if (durationSec) {
            setTimeout(() => {
                if (this.currentElement === v) finish(null, durationSec);
            }, durationSec * 1000);
        }
        setTimeout(() => {
            if (this.currentElement === v && !hasActuallyPlayed) {
                failIfCurrent('Watchdog: vídeo não iniciou reprodução dentro do limite');
            }
        }, this.playbackStartTimeoutMs);
        setTimeout(() => {
            const currentTime = Number.isFinite(v.currentTime) ? v.currentTime.toFixed(1) : '-';
            failIfCurrent('Watchdog: vídeo não finalizou dentro do limite (posição=' + currentTime + 's)');
        }, this._videoWatchdogTimeoutMs(durationSec));
    }

    _videoWatchdogTimeoutMs(durationSec) {
        const declaredMs = Number(durationSec) > 0 ? Number(durationSec) * 1000 : null;
        if (declaredMs != null) {
            return Math.max(this.playbackWatchdogMinMs, declaredMs + this.playbackWatchdogGraceMs);
        }
        return this.playbackWatchdogDefaultMs;
    }

    _playImage(url, durationSec, finish) {
        const img = document.createElement('img');
        img.src = url;
        img.style.width = img.style.height = '100%';
        img.style.objectFit = 'contain';
        img.onerror = (e) => {
            const msg = this._mediaErrorMessage(e, img, 'image', url);
            finish(new Error(msg));
        };

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
        const el = this.currentElement;
        // Remover handlers antes de limpar src para evitar que o browser dispare
        // 'error' (Empty src) e nosso onerror chame finish() → erro falso na reprodução
        el.onerror = null;
        el.onended = null;
        if (el.tagName === 'VIDEO') {
            el.pause();
            el.src = '';
        }
        el.remove();
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
