/**
 * API Client - Linux/Windows
 * Cliente HTTP para comunicação com backend
 */

const http = require('http');
const https = require('https');
const crypto = require('crypto');
const normalizeDeviceId = (value) => String(value || '').trim().toUpperCase();

class APIClient {
    constructor(baseURL, totemUIN, totemSecret) {
        this.baseURL = baseURL;
        this.totemUIN = totemUIN;
        this.totemSecret = totemSecret;
        this.token = null;
        this.deviceId = null;
    }

    /**
     * Faz requisição HTTP
     */
    async request(endpoint, method = 'GET', data = null) {
        return new Promise((resolve, reject) => {
            const url = new URL(endpoint, this.baseURL);
            const client = url.protocol === 'https:' ? https : http;
            
            const options = {
                method: method,
                hostname: url.hostname,
                port: url.port || (url.protocol === 'https:' ? 443 : 80),
                path: url.pathname + url.search,
                headers: {
                    'Content-Type': 'application/json'
                }
            };
            
            // Adicionar headers de autenticação
            if (this.totemUIN && this.totemSecret) {
                options.headers['X-Totem-Token'] = this.generateTotemToken();
                options.headers['X-Totem-UIN'] = this.totemUIN;
            }
            
            if (this.token) {
                options.headers['Authorization'] = `Bearer ${this.token}`;
            }
            
            const req = client.request(options, (res) => {
                let body = '';
                res.on('data', chunk => body += chunk);
                res.on('end', () => {
                    try {
                        const json = JSON.parse(body);
                        if (res.statusCode >= 200 && res.statusCode < 300) {
                            resolve(json);
                        } else {
                            reject(new Error(`HTTP ${res.statusCode}: ${json.error || body}`));
                        }
                    } catch (e) {
                        resolve(body);
                    }
                });
            });
            
            req.on('error', reject);
            
            if (data) {
                req.write(JSON.stringify(data));
            }
            
            req.end();
        });
    }

    /**
     * Gera token de totem (HMAC)
     */
    generateTotemToken() {
        const timestamp = Date.now();
        const message = `${this.totemUIN}:${timestamp}`;
        const hmac = crypto.createHmac('sha256', this.totemSecret);
        hmac.update(message);
        return hmac.digest('hex');
    }

    /**
     * Obtém token de dispositivo
     */
    async getDeviceToken(uin, deviceId, platform, appVersion) {
        const normalizedDeviceId = normalizeDeviceId(deviceId);
        const params = new URLSearchParams({
            uin,
            deviceId: normalizedDeviceId,
            platform: platform || 'unknown',
            appVersion: appVersion || '2.1.0'
        });
        
        const response = await this.request(`/api/player/token?${params}`);
        
        if (response.token) {
            this.token = response.token;
        }
        if (normalizedDeviceId) {
            this.deviceId = normalizedDeviceId;
        }
        
        return response;
    }

    /**
     * GET /api/player/token + POST /api/player/heartbeat (contrato de arranque antes do dispatch).
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
        });
    }

    /**
     * Obtém DispatchPlan do dispatcher
     */
    async getDispatchPlan(uin, token, deviceId, timestamp, timezone) {
        const params = new URLSearchParams({
            uin,
            token
        });
        
        const normalizedDeviceId = normalizeDeviceId(deviceId || this.deviceId);
        if (normalizedDeviceId) params.append('deviceId', normalizedDeviceId);
        if (timestamp) params.append('timestamp', timestamp);
        if (timezone) params.append('timezone', timezone);
        
        const response = await this.request(`/api/player/dispatch?${params}`);
        
        if (response.success && response.plan) {
            return response;
        }
        
        throw new Error(response.error || 'Não foi possível obter DispatchPlan');
    }

    /**
     * Envia heartbeat (query uin/token/deviceId + body — alinhado ao DispatcherRouter).
     * Atualiza this.token se a resposta trouxer token novo.
     */
    async sendHeartbeat(data = {}) {
        const uin = data.uin || this.totemUIN;
        const token = data.token || this.token;
        if (!uin || !token) {
            throw new Error('UIN e token são obrigatórios para heartbeat');
        }

        const params = new URLSearchParams({ uin, token });
        const deviceId = normalizeDeviceId(data.deviceId || this.deviceId);
        if (deviceId) params.append('deviceId', deviceId);

        const body = {
            executedCommands: data.executedCommands || [],
            metrics: data.metrics || {},
            status: data.status || 'online',
            version: data.version,
            platform: data.platform,
            firmwareVersion: data.firmwareVersion,
            config: data.config,
            ipAddress: data.ipAddress,
        };

        const response = await this.request(`/api/player/heartbeat?${params.toString()}`, 'POST', body);
        if (response && response.token) {
            this.token = response.token;
        }
        return response;
    }

    /**
     * Envia evento de playback (Dispatcher) — query uin/token/deviceId.
     */
    async sendEvent(payload) {
        const uin = payload.uin || this.totemUIN;
        const token = payload.token || this.token;
        if (!uin) {
            throw new Error('UIN é obrigatório para evento');
        }

        const params = new URLSearchParams({ uin });
        if (token) params.append('token', token);
        const deviceId = normalizeDeviceId(payload.deviceId || this.deviceId);
        if (deviceId) params.append('deviceId', deviceId);

        const metadata = { ...(payload.metadata || {}) };
        if (deviceId && metadata.deviceId == null) metadata.deviceId = deviceId;
        if (metadata.player == null) metadata.player = 'player-client-linux-windows';

        const body = {
            eventType: payload.eventType,
            mediaId: payload.mediaId,
            playlistId: payload.playlistId,
            campaignId: payload.campaignId,
            duration: payload.duration,
            completed: payload.completed,
            metadata,
        };

        return await this.request(`/api/player/event?${params.toString()}`, 'POST', body);
    }

    /**
     * Baixa arquivo de mídia
     */
    async downloadMedia(mediaId) {
        return new Promise((resolve, reject) => {
            const url = new URL(`/api/media/${mediaId}/download`, this.baseURL);
            const client = url.protocol === 'https:' ? https : http;
            
            const options = {
                hostname: url.hostname,
                port: url.port || (url.protocol === 'https:' ? 443 : 80),
                path: url.pathname + url.search,
                headers: {}
            };
            
            if (this.token) {
                options.headers['Authorization'] = `Bearer ${this.token}`;
            }
            
            if (this.totemUIN && this.totemSecret) {
                options.headers['X-Totem-Token'] = this.generateTotemToken();
                options.headers['X-Totem-UIN'] = this.totemUIN;
            }
            
            const req = client.request(options, (res) => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve(res);
                } else {
                    reject(new Error(`HTTP ${res.statusCode}`));
                }
            });
            
            req.on('error', reject);
            req.end();
        });
    }
}

module.exports = APIClient;
