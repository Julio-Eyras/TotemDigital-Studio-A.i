/**
 * HeartbeatService — contrato Player-AD 2.15
 * Preferir POST /api/player/sync; fallback heartbeat. Processa pendingCommands.
 */
class HeartbeatService {
  constructor(apiUrl, tvId, interval = 30000, deviceId = null) {
    this.apiUrl = apiUrl;
    this.tvId = tvId;
    this.interval = interval;
    this.deviceId = (window.PlayerProtocol
      ? window.PlayerProtocol.canonicalDeviceId(deviceId)
      : String(deviceId || "").trim().toUpperCase()) || null;
    this.heartbeatInterval = null;
    this.startTime = Date.now();
    this.token = null;
    this.getPlayerStatus = null;
    this.getCurrentStream = null;
    this.knownPlanVersion = null;
    this._syncUnsupported = false;
    this.commandRunner = null;
    this.onHeartbeatResult = null;
    this.onRefreshDispatch = null;
    this.onPurgeCache = null;
  }

  _dispatchApiBase() {
    let b = String(this.apiUrl || "").replace(/\/$/, "");
    if (!b.endsWith("/api")) b = `${b}/api`;
    return b;
  }

  setToken(token) {
    this.token = token;
  }

  setDeviceId(deviceId) {
    this.deviceId = window.PlayerProtocol
      ? window.PlayerProtocol.canonicalDeviceId(deviceId)
      : String(deviceId || "").trim().toUpperCase() || null;
  }

  setCallbacks(getPlayerStatus, getCurrentStream) {
    this.getPlayerStatus = getPlayerStatus;
    this.getCurrentStream = getCurrentStream;
  }

  _ensureCommands() {
    if (this.commandRunner || !window.PlayerProtocol) return;
    const self = this;
    this.commandRunner = window.PlayerProtocol.createCommandRunner({
      platform: "tizen",
      reportResult: (id, status, result, error) => self.reportCommandResult(id, status, result, error),
      hooks: {
        refresh_dispatch: async () => {
          if (self.onRefreshDispatch) await self.onRefreshDispatch();
          return { refreshed: true };
        },
        sync_now: async () => {
          if (self.onRefreshDispatch) await self.onRefreshDispatch();
          return { refreshed: true };
        },
        content_version_check: async () => {
          if (self.onRefreshDispatch) await self.onRefreshDispatch();
          return { checked: true };
        },
        purge_cache: async () => {
          if (self.onPurgeCache) return (await self.onPurgeCache()) || { purged: true };
          return { purged: false, note: "cache tizen limitado" };
        },
        invalidate_media: async () => {
          if (self.onRefreshDispatch) await self.onRefreshDispatch();
          return { invalidated: true };
        },
        invalidate_playlist: async () => {
          if (self.onRefreshDispatch) await self.onRefreshDispatch();
          return { invalidated: true };
        },
        invalidate_campaign: async () => {
          if (self.onRefreshDispatch) await self.onRefreshDispatch();
          return { invalidated: true };
        },
        config: async () => ({ applied: false, note: "config remota parcial" }),
        apply_player_config: async () => ({ applied: false, note: "config remota parcial" }),
        display_force_on: async () => {
          document.body.style.opacity = "1";
          return { forceMode: "on" };
        },
        display_force_off: async () => {
          document.body.style.opacity = "0";
          return { forceMode: "off" };
        },
        display_force_clear: async () => {
          document.body.style.opacity = "1";
          return { forceMode: null };
        },
        restart: async () => { location.reload(); return { reloaded: true }; },
        restart_app: async () => { location.reload(); return { reloaded: true }; },
      }
    });
  }

  async reportCommandResult(requestId, status, result, error) {
    const body = {
      uin: this.tvId,
      token: this.token,
      requestId: String(requestId),
      status: status === "failed" || status === "error" ? "failed" : "completed"
    };
    if (result) body.result = result;
    if (error) body.error = String(error);
    const res = await fetch(`${this._dispatchApiBase()}/player/command-result`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error(`command-result HTTP ${res.status}`);
    return res.json();
  }

  start() {
    if (this.heartbeatInterval) {
      console.warn("[Heartbeat] Service já está ativo");
      return;
    }
    this._ensureCommands();
    if (window.PlayerProtocol && window.PlayerProtocol.createPollAdaptive) {
      this._poll = window.PlayerProtocol.createPollAdaptive({ heartbeatMs: this.interval });
    }
    this.sendHeartbeat();
    const arm = () => {
      if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
      const ms = this._poll ? this._poll.intervalMs() : this.interval;
      this.heartbeatInterval = setInterval(() => {
        this.sendHeartbeat();
      }, ms);
    };
    arm();
    this._rearmHb = arm;
  }

  stop() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  async sendHeartbeat() {
    try {
      const uptime = Math.floor((Date.now() - this.startTime) / 1000);
      const rawStatus = this.getPlayerStatus ? this.getPlayerStatus() : null;
      const currentStream = this.getCurrentStream ? this.getCurrentStream() : null;
      const statusLine =
        typeof rawStatus === "string" && rawStatus.trim() !== "" ? rawStatus : "online";
      const heartbeat = {
        status: statusLine,
        platform: "tizen",
        version: "2.15.0",
        metrics: {
          uptime,
          current_stream: currentStream,
          timestamp: new Date().toISOString()
        },
        executedCommands: []
      };

      let json = null;
      if (!this._syncUnsupported && this.token) {
        const qs = new URLSearchParams({ uin: this.tvId, token: this.token });
        if (this.deviceId) qs.set("deviceId", this.deviceId);
        const syncBody = {
          schemaVersion: 1,
          syncId: window.PlayerProtocol && window.PlayerProtocol.uuid
            ? window.PlayerProtocol.uuid()
            : String(Date.now()),
          heartbeat
        };
        if (this.knownPlanVersion) syncBody.knownPlanVersion = this.knownPlanVersion;
        const res = await fetch(`${this._dispatchApiBase()}/player/sync?${qs}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(syncBody)
        });
        if (res.status === 404 || res.status === 405) this._syncUnsupported = true;
        else if (res.ok) json = await res.json();
        else throw new Error(`HTTP ${res.status}`);
      }
      if (!json) {
        const qs = new URLSearchParams({ uin: this.tvId });
        if (this.token) qs.set("token", this.token);
        if (this.deviceId) qs.set("deviceId", this.deviceId);
        const res = await fetch(`${this._dispatchApiBase()}/player/heartbeat?${qs}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(heartbeat)
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        json = await res.json();
      }

      const parsed = window.PlayerProtocol && window.PlayerProtocol.parseSyncOrHeartbeat
        ? window.PlayerProtocol.parseSyncOrHeartbeat(json)
        : json;
      if (parsed.pollAdaptive && this._poll) this._poll.applyServer(parsed.pollAdaptive);
      if (this._poll) {
        this._poll.onSuccess(!!parsed.planVersion && parsed.planVersion === this.knownPlanVersion, false);
        this.interval = this._poll.intervalMs();
        if (this._rearmHb) this._rearmHb();
      }
      if (parsed.token) this.token = parsed.token;
      if (parsed.planVersion) this.knownPlanVersion = parsed.planVersion;
      this._ensureCommands();
      if (this.commandRunner && parsed.pendingCommands) {
        await this.commandRunner.handleAll(parsed.pendingCommands);
      }
      if (this.onHeartbeatResult) this.onHeartbeatResult(parsed);
      if (parsed.needsDispatch && this.onRefreshDispatch) {
        await this.onRefreshDispatch();
      }
      return parsed;
    } catch (error) {
      console.warn("[Heartbeat] Erro ao enviar heartbeat:", error.message);
      if (this._poll) this._poll.onFailure();
      return null;
    }
  }

  getUptime() {
    return Math.floor((Date.now() - this.startTime) / 1000);
  }
}

window.HeartbeatService = HeartbeatService;
