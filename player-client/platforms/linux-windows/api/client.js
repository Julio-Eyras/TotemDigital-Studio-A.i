/**
 * API Client - Linux/Windows
 * Cliente HTTP para comunicação com backend
 */

const http = require('http');
const https = require('https');
const crypto = require('crypto');

class APIClient {
    constructor(baseURL, totemUIN, totemSecret) {
        this.baseURL = baseURL;
        this.totemUIN = totemUIN;
        this.totemSecret = totemSecret;
        this.token = null;
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
        const params = new URLSearchParams({
            uin,
            deviceId: deviceId || '',
            platform: platform || 'unknown',
            appVersion: appVersion || '2.1.0'
        });
        
        const response = await this.request(`/api/player/token?${params}`);
        
        if (response.token) {
            this.token = response.token;
        }
        
        return response;
    }

    /**
     * Obtém DispatchPlan do dispatcher
     */
    async getDispatchPlan(uin, token, deviceId, timestamp, timezone) {
        const params = new URLSearchParams({
            uin,
            token
        });
        
        if (deviceId) params.append('deviceId', deviceId);
        if (timestamp) params.append('timestamp', timestamp);
        if (timezone) params.append('timezone', timezone);
        
        const response = await this.request(`/api/player/dispatch?${params}`);
        
        if (response.success && response.plan) {
            return response;
        }
        
        throw new Error(response.error || 'Não foi possível obter DispatchPlan');
    }

    /**
     * Envia heartbeat
     */
    async sendHeartbeat(data) {
        return await this.request('/api/player/heartbeat', 'POST', data);
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
