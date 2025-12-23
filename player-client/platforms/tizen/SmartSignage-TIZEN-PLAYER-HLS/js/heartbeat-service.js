/**
 * HeartbeatService - Envia status periódico para o backend
 * Intervalo padrão: 30 segundos
 */

class HeartbeatService {
  constructor(apiUrl, tvId, interval = 30000) {
    this.apiUrl = apiUrl;
    this.tvId = tvId;
    this.interval = interval;
    this.heartbeatInterval = null;
    this.startTime = Date.now();
    this.token = null;
    this.getPlayerStatus = null; // Callback para obter status do player
    this.getCurrentStream = null; // Callback para obter stream atual
  }

  /**
   * Define token de autenticação
   */
  setToken(token) {
    this.token = token;
  }

  /**
   * Define callbacks para obter informações do player
   */
  setCallbacks(getPlayerStatus, getCurrentStream) {
    this.getPlayerStatus = getPlayerStatus;
    this.getCurrentStream = getCurrentStream;
  }

  /**
   * Inicia envio de heartbeats
   */
  start() {
    if (this.heartbeatInterval) {
      console.warn('[Heartbeat] Service já está ativo');
      return;
    }

    console.log(`[Heartbeat] Iniciando service (intervalo: ${this.interval}ms)`);

    // Enviar heartbeat imediatamente
    this.sendHeartbeat();

    // Depois, enviar periodicamente
    this.heartbeatInterval = setInterval(() => {
      this.sendHeartbeat();
    }, this.interval);
  }

  /**
   * Para o serviço de heartbeat
   */
  stop() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
      console.log('[Heartbeat] Service parado');
    }
  }

  /**
   * Envia heartbeat para o backend
   */
  async sendHeartbeat() {
    try {
      const uptime = Math.floor((Date.now() - this.startTime) / 1000);
      
      // Obter status do player via callback
      const status = this.getPlayerStatus ? this.getPlayerStatus() : 'UNKNOWN';
      const currentStream = this.getCurrentStream ? this.getCurrentStream() : null;

      const data = {
        status: status,
        uptime: uptime,
        current_stream: currentStream,
        timestamp: new Date().toISOString()
      };

      let url = `${this.apiUrl}/player/heartbeat?uin=${this.tvId}`;

      // Adicionar token como query param (formato esperado pelo backend)
      if (this.token) {
        url += `&token=${encodeURIComponent(this.token)}`;
      }

      const headers = {
        'Content-Type': 'application/json'
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      
      // Atualizar token se recebido na resposta
      if (result.token) {
        this.token = result.token;
      }

      console.log('[Heartbeat] Enviado com sucesso:', { status, uptime });
      return result;
    } catch (error) {
      console.warn('[Heartbeat] Erro ao enviar heartbeat:', error.message);
      return null;
    }
  }

  /**
   * Obtém uptime em segundos
   */
  getUptime() {
    return Math.floor((Date.now() - this.startTime) / 1000);
  }
}

// Exportar para uso global
window.HeartbeatService = HeartbeatService;

