/**
 * HeartbeatService - Envia status periódico para o backend (Dispatcher)
 * URL: /api/player/heartbeat com query uin, token, deviceId (opcional)
 * Corpo: { status, metrics, executedCommands }
 */

class HeartbeatService {
  constructor(apiUrl, tvId, interval = 30000, deviceId = null) {
    this.apiUrl = apiUrl;
    this.tvId = tvId;
    this.interval = interval;
    this.deviceId = String(deviceId || '').trim().toUpperCase() || null;
    this.heartbeatInterval = null;
    this.startTime = Date.now();
    this.token = null;
    this.getPlayerStatus = null;
    this.getCurrentStream = null;
  }

  /** Base da API sempre terminando em /api (compatível com base com ou sem sufixo) */
  _dispatchApiBase() {
    let b = String(this.apiUrl || '').replace(/\/$/, '');
    if (!b.endsWith('/api')) b = `${b}/api`;
    return b;
  }

  setToken(token) {
    this.token = token;
  }

  setDeviceId(deviceId) {
    this.deviceId = String(deviceId || '').trim().toUpperCase() || null;
  }

  setCallbacks(getPlayerStatus, getCurrentStream) {
    this.getPlayerStatus = getPlayerStatus;
    this.getCurrentStream = getCurrentStream;
  }

  start() {
    if (this.heartbeatInterval) {
      console.warn('[Heartbeat] Service já está ativo');
      return;
    }

    console.log(`[Heartbeat] Iniciando service (intervalo: ${this.interval}ms)`);

    this.sendHeartbeat();

    this.heartbeatInterval = setInterval(() => {
      this.sendHeartbeat();
    }, this.interval);
  }

  stop() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
      console.log('[Heartbeat] Service parado');
    }
  }

  async sendHeartbeat() {
    try {
      const uptime = Math.floor((Date.now() - this.startTime) / 1000);
      const rawStatus = this.getPlayerStatus ? this.getPlayerStatus() : null;
      const currentStream = this.getCurrentStream ? this.getCurrentStream() : null;

      const statusLine =
        typeof rawStatus === 'string' && rawStatus.trim() !== ''
          ? rawStatus
          : 'online';

      const metrics = {
        uptime,
        current_stream: currentStream,
        timestamp: new Date().toISOString(),
      };
      if (rawStatus != null && typeof rawStatus !== 'string') {
        metrics.playerStatus = rawStatus;
      }

      const body = {
        status: statusLine,
        metrics,
        executedCommands: [],
      };

      let url = `${this._dispatchApiBase()}/player/heartbeat?uin=${encodeURIComponent(this.tvId)}`;

      if (this.token) {
        url += `&token=${encodeURIComponent(this.token)}`;
      } else {
        console.warn('[Heartbeat] Sem token; o servidor pode rejeitar o heartbeat');
      }

      if (this.deviceId) {
        url += `&deviceId=${encodeURIComponent(this.deviceId)}`;
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();

      if (result.token) {
        this.token = result.token;
      }

      console.log('[Heartbeat] Enviado com sucesso:', { status: statusLine, uptime });
      return result;
    } catch (error) {
      console.warn('[Heartbeat] Erro ao enviar heartbeat:', error.message);
      return null;
    }
  }

  getUptime() {
    return Math.floor((Date.now() - this.startTime) / 1000);
  }
}

window.HeartbeatService = HeartbeatService;
