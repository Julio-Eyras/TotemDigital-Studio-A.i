/**
 * API Client - Browser (player-web)
 * Cliente HTTP para comunicação com backend usando fetch API
 */

class APIClient {
    constructor(baseURL, totemUIN, totemSecret) {
        this.baseURL = baseURL;
        this.totemUIN = totemUIN;
        this.totemSecret = totemSecret;
        this.token = null;
    }

    /**
     * Faz requisição HTTP usando fetch
     */
    async request(endpoint, method = 'GET', data = null) {
        const url = new URL(endpoint, this.baseURL);
        
        const options = {
            method: method,
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
        
        if (data) {
            options.body = JSON.stringify(data);
        }
        
        const response = await fetch(url, options);
        
        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
            throw new Error(error.error || `HTTP ${response.status}`);
        }
        
        return await response.json();
    }

    /**
     * Gera token de totem (HMAC)
     */
    generateTotemToken() {
        const timestamp = Date.now();
        const message = `${this.totemUIN}:${timestamp}`;
        
        // Usar Web Crypto API para HMAC
        // Nota: Em produção, usar biblioteca como crypto-js
        // Por enquanto, usar método simples
        return btoa(message).substring(0, 32);
    }

    /**
     * Obtém token de dispositivo
     */
    async getDeviceToken(uin, deviceId, platform, appVersion) {
        const params = new URLSearchParams({
            uin,
            deviceId: deviceId || '',
            platform: platform || 'browser',
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
}

// Exportar para uso global
window.APIClient = APIClient;
