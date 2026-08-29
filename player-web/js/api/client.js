/**
 * API Client - Browser (player-web-cache)
 * Cliente HTTP para comunicação com backend usando fetch API.
 * Integrado à estrutura Dispatcher e envio de informações transacionais.
 * Versão com suporte a download de mídias para cache.
 */

const normalizeDeviceId = (value) => String(value || '').trim().toUpperCase();

class APIClient {
    constructor(baseURL, totemUIN, totemSecret) {
        this.baseURL = baseURL.replace(/\/$/, '');
        this.totemUIN = totemUIN || '';
        this.totemSecret = totemSecret || '';
        this.token = null;
        this.deviceId = null;
        this._syncUnsupported = false;
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
        const normalizedDeviceId = normalizeDeviceId(deviceId || this.deviceId);
        const q = new URLSearchParams({
            uin: uin || this.totemUIN,
            deviceId: normalizedDeviceId,
            platform: platform || 'web',
            appVersion: appVersion || '2.15.0'
        });

        const response = await this.request(`/api/player/token?${q}`);

        if (response.token) {
            this.token = response.token;
        }
        if (normalizedDeviceId) {
            this.deviceId = normalizedDeviceId;
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
        const normalizedDeviceId = normalizeDeviceId(deviceId || this.deviceId);
        if (normalizedDeviceId) params.append('deviceId', normalizedDeviceId);
        if (timestamp) params.append('timestamp', timestamp);
        if (timezone) params.append('timezone', timezone);

        const response = await this.request(`/api/player/dispatch?${params}`);

        if (!response || typeof response.success !== 'boolean') {
            throw new Error(response?.error || 'Não foi possível obter DispatchPlan');
        }

        return response;
    }

    async getPlayerConfig() {
        return this.request('/api/player/config');
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
        const normalizedDeviceId = normalizeDeviceId(data.deviceId || this.deviceId);
        if (normalizedDeviceId) {
            queryParams.deviceId = normalizedDeviceId;
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

        return this._attachHeartbeatFields(response);
    }

    _attachHeartbeatFields(response) {
        const proto = typeof window !== 'undefined' && window.PlayerProtocol;
        if (proto && typeof proto.parseSyncOrHeartbeat === 'function') {
            const parsed = proto.parseSyncOrHeartbeat(response);
            if (parsed.token) this.token = parsed.token;
            return Object.assign({}, response, parsed);
        }
        return response;
    }

    /**
     * POST /api/player/sync (preferido) com fallback heartbeat se 404/405.
     */
    async sendSyncOrHeartbeat(data) {
        const uin = data.uin || this.totemUIN;
        const token = data.token || this.token;
        if (!uin || !token) {
            throw new Error('UIN e token são obrigatórios para sync');
        }
        const normalizedDeviceId = normalizeDeviceId(data.deviceId || this.deviceId);
        const queryParams = { uin, token };
        if (normalizedDeviceId) queryParams.deviceId = normalizedDeviceId;

        const heartbeat = {
            executedCommands: data.executedCommands || [],
            metrics: data.metrics || {},
            status: data.status || 'online',
            version: data.version,
            platform: data.platform || 'web',
            firmwareVersion: data.firmwareVersion,
            config: data.config,
            ipAddress: data.ipAddress
        };

        const proto = typeof window !== 'undefined' && window.PlayerProtocol;
        const syncId = proto && proto.uuid ? proto.uuid() : ('sync-' + Date.now());
        const syncBody = {
            schemaVersion: 1,
            syncId: syncId,
            heartbeat: heartbeat
        };
        if (data.knownPlanVersion) syncBody.knownPlanVersion = data.knownPlanVersion;

        if (this._syncUnsupported) {
            return this.sendHeartbeat(data);
        }

        const params = new URLSearchParams(queryParams);
        const url = `${this.baseURL}/api/player/sync?${params}`;
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(syncBody)
        });
        if (response.status === 404 || response.status === 405) {
            this._syncUnsupported = true;
            return this.sendHeartbeat(data);
        }
        if (!response.ok) {
            const err = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
            throw new Error(err.error || `HTTP ${response.status}`);
        }
        const json = await response.json();
        return this._attachHeartbeatFields(json);
    }

    /**
     * POST /api/player/command-result (completed | failed).
     */
    async reportCommandResult(requestId, status, result, error) {
        const uin = this.totemUIN;
        const token = this.token;
        if (!uin || !token) throw new Error('UIN e token são obrigatórios para command-result');
        const body = {
            uin,
            token,
            requestId: String(requestId),
            status: status === 'failed' || status === 'error' ? 'failed' : 'completed'
        };
        if (result && typeof result === 'object') body.result = result;
        if (error) body.error = String(error);
        return this.request('/api/player/command-result', 'POST', body);
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
        const deviceId = normalizeDeviceId(payload.deviceId || this.deviceId);
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
