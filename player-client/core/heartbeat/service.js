/**
 * Heartbeat Service - Core
 * Sistema de heartbeat para comunicação com o backend
 */

class HeartbeatService {
  constructor(apiClient, interval = 30000) {
    this.apiClient = apiClient;
    this.interval = interval; // 30 segundos padrão
    this.intervalId = null;
    this.isRunning = false;
    this.lastHeartbeat = null;
    this.consecutiveFailures = 0;
    this.maxFailures = 5;
  }

  /**
   * Inicia serviço de heartbeat.
   * Requer APIClient com totemUIN e token (ex.: após getDeviceToken); caso contrário o servidor responde 401.
   */
  start() {
    if (this.isRunning) {
      return;
    }

    const ac = this.apiClient;
    if (!ac?.totemUIN) {
      console.warn('[HeartbeatService] apiClient.totemUIN ausente — heartbeat vai falhar até configurar UIN.');
    }
    if (!ac?.token) {
      console.warn('[HeartbeatService] apiClient.token ausente — chame getDeviceToken() (ou equivalente) antes de start().');
    }

    this.isRunning = true;
    this.sendHeartbeat(); // Enviar imediatamente
    this.intervalId = setInterval(() => this.sendHeartbeat(), this.interval);
  }

  /**
   * Para serviço de heartbeat
   */
  stop() {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /**
   * Envia heartbeat
   */
  async sendHeartbeat() {
    try {
      const data = {
        status: 'online',
        timestamp: new Date().toISOString(),
        // Adicionar métricas do sistema se disponível
        metrics: this.getSystemMetrics(),
      };

      await this.apiClient.sendHeartbeat(data);
      this.lastHeartbeat = new Date();
      this.consecutiveFailures = 0;
    } catch (error) {
      console.error('Heartbeat failed:', error);
      this.consecutiveFailures++;

      if (this.consecutiveFailures >= this.maxFailures) {
        console.error('Max heartbeat failures reached. Stopping heartbeat.');
        this.stop();
        // Notificar sistema de erro crítico
        this.onCriticalFailure();
      }
    }
  }

  /**
   * Obtém métricas do sistema (implementar por plataforma)
   */
  getSystemMetrics() {
    // Implementação específica por plataforma
    return {
      uptime: process.uptime ? process.uptime() : 0,
      memory: process.memoryUsage ? process.memoryUsage() : {},
    };
  }

  /**
   * Callback para falha crítica
   */
  onCriticalFailure() {
    // Implementar lógica de recuperação ou notificação
    console.error('Critical heartbeat failure');
  }

  /**
   * Verifica se está conectado
   */
  isConnected() {
    if (!this.lastHeartbeat) {
      return false;
    }

    const now = new Date();
    const diff = now - this.lastHeartbeat;
    return diff < this.interval * 2; // Considera desconectado se passou 2x o intervalo
  }
}

// Exportar para diferentes ambientes
if (typeof module !== 'undefined' && module.exports) {
  module.exports = HeartbeatService;
} else {
  window.HeartbeatService = HeartbeatService;
}

