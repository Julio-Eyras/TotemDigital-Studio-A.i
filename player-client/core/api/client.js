/**
 * API Client - Core
 * Cliente HTTP compartilhado para comunicação com o backend
 */

class APIClient {
  constructor(baseURL, totemUIN, totemSecret) {
    this.baseURL = baseURL;
    this.totemUIN = totemUIN;
    this.totemSecret = totemSecret;
    this.token = null;
    this.refreshToken = null;
  }

  /**
   * Gera token de autenticação do totem
   */
  async generateTotemToken() {
    const timestamp = Date.now();
    const data = `${this.totemUIN}:${timestamp}`;
    
    // Usar Web Crypto API (browser) ou crypto (Node.js)
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      // Browser/WebOS
      const encoder = new TextEncoder();
      const keyData = encoder.encode(this.totemSecret);
      const messageData = encoder.encode(data);
      
      const key = await crypto.subtle.importKey(
        'raw',
        keyData,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );
      
      const signature = await crypto.subtle.sign('HMAC', key, messageData);
      const token = Array.from(new Uint8Array(signature))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
      
      return `${timestamp}:${token}`;
    } else if (typeof require !== 'undefined') {
      // Node.js
      const crypto = require('crypto');
      const token = crypto
        .createHmac('sha256', this.totemSecret)
        .update(data)
        .digest('hex');
      return `${timestamp}:${token}`;
    } else {
      // Fallback simples (não seguro, apenas para desenvolvimento)
      return `${timestamp}:${btoa(data)}`;
    }
  }

  /**
   * Faz requisição HTTP com tratamento de erros melhorado
   */
  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    // Adicionar token de autenticação do totem
    if (this.totemUIN && this.totemSecret) {
      try {
        const token = await this.generateTotemToken();
        headers['X-Totem-Token'] = token;
        headers['X-Totem-UIN'] = this.totemUIN;
      } catch (error) {
        console.warn('Failed to generate totem token:', error);
      }
    }

    // Adicionar JWT se disponível
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const config = {
      method: options.method || 'GET',
      headers,
      ...options,
    };

    if (options.body) {
      config.body = JSON.stringify(options.body);
    }

    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: response.statusText }));
        
        // Tratamento específico para erros de validação
        if (response.status === 403) {
          const validationError = new Error(error.error || 'Acesso negado');
          validationError.status = 403;
          validationError.code = 'FORBIDDEN';
          validationError.details = error.details || error.message;
          throw validationError;
        }
        
        if (response.status === 400) {
          const validationError = new Error(error.error || 'Dados inválidos');
          validationError.status = 400;
          validationError.code = 'BAD_REQUEST';
          validationError.details = error.details || error.message;
          throw validationError;
        }
        
        throw new Error(error.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      
      // Validar se resposta contém informações de contrato válido
      if (data.contract_valid === false) {
        console.warn('Campanha sem contrato válido:', data);
        // Não lançar erro, apenas logar - o player pode usar fallback
      }
      
      return data;
    } catch (error) {
      console.error('API Request Error:', error);
      
      // Logar erro de validação para debugging
      if (error.status === 403 || error.status === 400) {
        this.logValidationError(endpoint, error);
      }
      
      throw error;
    }
  }

  /**
   * Loga erros de validação para debugging
   */
  logValidationError(endpoint, error) {
    const logData = {
      endpoint,
      status: error.status,
      code: error.code,
      message: error.message,
      details: error.details,
      timestamp: new Date().toISOString(),
      uin: this.totemUIN
    };
    
    console.warn('[Validation Error]', logData);
    
    // Tentar enviar log para backend se disponível
    if (this.token && this.baseURL) {
      this.sendErrorLog(error, logData).catch(err => {
        console.warn('Failed to send validation error log:', err);
      });
    }
  }

  /**
   * Autentica totem no backend
   */
  async authenticateTotem() {
    try {
      const response = await this.request('/api/player/register', {
        method: 'POST',
        body: {
          uin: this.totemUIN,
        },
      });

      if (response.token) {
        this.token = response.token;
        this.refreshToken = response.refreshToken;
        return true;
      }

      return false;
    } catch (error) {
      console.error('Totem authentication failed:', error);
      return false;
    }
  }

  /**
   * Obtém playlist do totem
   */
  async getPlaylist() {
    return this.request('/api/player/playlist');
  }

  /**
   * Obtém configurações do player
   */
  async getConfig() {
    return this.request('/api/player/config');
  }

  /**
   * Envia heartbeat
   */
  async sendHeartbeat(data) {
    return this.request('/api/player/heartbeat', {
      method: 'POST',
      body: data,
    });
  }

  /**
   * Obtém mídia por ID
   */
  async getMedia(mediaId) {
    return this.request(`/api/player/media/${mediaId}`);
  }

  /**
   * Baixa arquivo de mídia
   */
  async downloadMedia(mediaId) {
    const url = `${this.baseURL}/api/player/media/${mediaId}/download`;
    const headers = {};

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    if (this.totemUIN && this.totemSecret) {
      const token = await this.generateTotemToken();
      headers['X-Totem-Token'] = token;
      headers['X-Totem-UIN'] = this.totemUIN;
    }

    const response = await fetch(url, { headers });
    
    if (!response.ok) {
      throw new Error(`Download failed: ${response.statusText}`);
    }

    return response;
  }

  /**
   * Envia log de erro
   */
  async sendErrorLog(error, metadata = {}) {
    return this.request('/api/logs/frontend-error', {
      method: 'POST',
      body: {
        error: error.message || String(error),
        stack: error.stack,
        metadata: {
          ...metadata,
          platform: 'webos',
          timestamp: new Date().toISOString(),
        },
      },
    }).catch(err => {
      console.error('Failed to send error log:', err);
    });
  }
}

// Exportar para diferentes ambientes
if (typeof module !== 'undefined' && module.exports) {
  module.exports = APIClient;
} else {
  window.APIClient = APIClient;
}

