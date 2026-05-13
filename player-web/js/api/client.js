/**
 * API Client - Browser (player-web-cache)
 * Cliente HTTP para comunicação com backend usando fetch API.
 * Integrado à estrutura Dispatcher e envio de informações transacionais.
 * Versão com suporte a download de mídias para cache.
 */

class APIClient {
    constructor(baseURL, totemUIN, totemSecret) {
        this.baseURL = baseURL.replace(/\/$/, '');
        this.totemUIN = totemUIN || '';
        this.totemSecret = totemSecret || '';
        this.token = null;
        this.deviceId = null;
    }

    /**
     * Faz requisição HTTP usando fetch
     * @param {string} endpoint - Ex: /api/player/token ou /api/player/dispatch?uin=...
     * @param {string} method - GET, POST, etc.
     * @param {object|null} data - Body para POST/PUT
     */
    async request(endpoint, method = 'GET', data = null) {
        const url = new URL(endpoint, this.baseURL);

        const options = {
            method: method,
            headers: { 'Content-Type': 'application/json' }
        };

        if (data && (method === 'POST' || method === 'PUT')) {
            options.body = JSON.stringify(data);
        }

        const response = await fetch(url, options);

        if (!response.ok) {
            const err = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
            throw new Error(err.error || `HTTP ${response.status}`);
        }

        return await response.json();
    }

    /**
     * Requisição com query params (ex.: heartbeat, event).
     * Backend /api/player/* usa uin e token em query.
     */
    async requestWithQuery(endpoint, method, queryParams, body = null) {
        const params = new URLSearchParams(queryParams);
        const url = `${this.baseURL}${endpoint}?${params}`;

        const options = {
            method: method,
            headers: { 'Content-Type': 'application/json' }
        };

        if (body && (method === 'POST' || method === 'PUT')) {
            options.body = JSON.stringify(body);
        }

        const response = await fetch(url, options);

        if (!response.ok) {
            const err = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
            throw new Error(err.error || `HTTP ${response.status}`);
        }

        return await response.json();
    }

    /**
     * Obtém token de dispositivo (HMAC do backend)
     */
    async getDeviceToken(uin, deviceId, platform, appVersion) {
        const q = new URLSearchParams({
            uin: uin || this.totemUIN,
            deviceId: deviceId || this.deviceId || '',
            platform: platform || 'browser',
            appVersion: appVersion || '2.2.0'
        });

        const response = await this.request(`/api/player/token?${q}`);

        if (response.token) {
            this.token = response.token;
        }
        if (deviceId) {
            this.deviceId = deviceId;
        }

        return response;
    }

    /**
     * GET /api/player/token + POST /api/player/heartbeat (arranque antes do dispatch).
     * Para métricas ricas (ex.: cacheSize), prefira heartbeat manual após o primeiro getDeviceToken.
     */
    async dispatcherStartupSequence({ uin, deviceId, platform, appVersion }) {
        await this.getDeviceToken(uin, deviceId, platform, appVersion);
        return this.sendHeartbeat({
            uin,
            deviceId,
            platform,
            version: appVersion,
            status: 'online',
            metrics: { phase: 'startup' },
            executedCommands: []
        });
    }

    /**
     * Obtém DispatchPlan do Dispatcher-Totem
     */
    async getDispatchPlan(uin, token, deviceId, timestamp, timezone) {
        const params = new URLSearchParams({
            uin: uin || this.totemUIN,
            token: token || this.token
        });
        if (deviceId || this.deviceId) params.append('deviceId', deviceId || this.deviceId);
        if (timestamp) params.append('timestamp', timestamp);
        if (timezone) params.append('timezone', timezone);

        const response = await this.request(`/api/player/dispatch?${params}`);

        if (!response || typeof response.success !== 'boolean') {
            throw new Error(response?.error || 'Não foi possível obter DispatchPlan');
        }

        return response;
    }

    /**
     * Envia heartbeat. uin/token/deviceId em query; métricas no body.
     * Atualiza this.token com o novo token retornado.
     */
    async sendHeartbeat(data) {
        const uin = data.uin || this.totemUIN;
        const token = data.token || this.token;
        if (!uin || !token) {
            throw new Error('UIN e token são obrigatórios para heartbeat');
        }

        const queryParams = {
            uin,
            token
        };
        if (data.deviceId || this.deviceId) {
            queryParams.deviceId = data.deviceId || this.deviceId;
        }

        const body = {
            executedCommands: data.executedCommands || [],
            metrics: data.metrics || {},
            status: data.status || 'online',
            version: data.version,
            platform: data.platform,
            firmwareVersion: data.firmwareVersion,
            config: data.config,
            ipAddress: data.ipAddress
        };

        const response = await this.requestWithQuery(
            '/api/player/heartbeat',
            'POST',
            queryParams,
            body
        );

        if (response.token) {
            this.token = response.token;
        }

        return response;
    }

    /**
     * Envia evento transacional (playback, exibição, etc.)
     */
    async sendEvent(payload) {
        const uin = payload.uin || this.totemUIN;
        const token = payload.token || this.token;
        if (!uin) {
            throw new Error('UIN é obrigatório para evento');
        }

        const queryParams = { uin };
        if (token) queryParams.token = token;
        const deviceId = payload.deviceId || this.deviceId;
        if (deviceId) queryParams.deviceId = deviceId;

        const metadata = { ...(payload.metadata || {}) };
        if (deviceId && metadata.deviceId == null) metadata.deviceId = deviceId;
        if (metadata.player == null) metadata.player = 'player-web';

        const body = {
            eventType: payload.eventType,
            mediaId: payload.mediaId,
            playlistId: payload.playlistId,
            campaignId: payload.campaignId,
            duration: payload.duration,
            completed: payload.completed,
            metadata
        };

        return await this.requestWithQuery('/api/player/event', 'POST', queryParams, body);
    }

    /**
     * Baixa uma mídia específica para cache
     * @param {string} mediaId - ID da mídia
     * @returns {Promise<Response>} Response com o Blob da mídia
     */
    async downloadMedia(mediaId) {
        const params = new URLSearchParams({
            uin: this.totemUIN,
            token: this.token
        });
        params.append('mediaId', mediaId);

        const url = `${this.baseURL}/api/player/media?${params}`;
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Accept': '*/*'
            }
        });

        if (!response.ok) {
            // Fallback: tentar baixar diretamente da URL se o endpoint não existir
            // Isso permite que o MediaCacheManager use a URL direta do mediaItem
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return response;
    }
}

window.APIClient = APIClient;
