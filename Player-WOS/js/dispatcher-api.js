class DispatcherApi {
  constructor(serverUrl, uin, deviceId, platform) {
    this.serverUrl = String(serverUrl || "").replace(/\/$/, "");
    this.uin = uin;
    this.deviceId = window.PlayerProtocol
      ? window.PlayerProtocol.canonicalDeviceId(deviceId)
      : String(deviceId || "").trim().toUpperCase();
    this.platform = platform || "webos";
    this.token = null;
    this._syncUnsupported = false;
    this.lastHeartbeat = null;
  }

  qs(obj) {
    return new URLSearchParams(obj).toString();
  }

  resolveUrl(url) {
    if (/^https?:\/\//i.test(url) || /^file:\/\//i.test(url)) return url;
    return `${this.serverUrl}${url.startsWith("/") ? "" : "/"}${url}`;
  }

  async getToken() {
    const url = `${this.serverUrl}/api/player/token?${this.qs({
      uin: this.uin,
      deviceId: this.deviceId,
      platform: this.platform,
      appVersion: "2.15.0"
    })}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`token HTTP ${res.status}`);
    const data = await res.json();
    if (!data.token) throw new Error("token vazio");
    this.token = data.token;
    return this.token;
  }

  _parse(json) {
    const proto = window.PlayerProtocol;
    if (proto && proto.parseSyncOrHeartbeat) {
      const parsed = proto.parseSyncOrHeartbeat(json);
      if (parsed.token) this.token = parsed.token;
      this.lastHeartbeat = parsed;
      return parsed;
    }
    if (json.token) this.token = json.token;
    return json;
  }

  async heartbeat(metrics, knownPlanVersion) {
    if (!this.token) await this.getToken();
    const hbBody = {
      uin: this.uin,
      deviceId: this.deviceId,
      status: "online",
      platform: this.platform,
      version: "2.15.0",
      metrics: metrics || {}
    };
    if (!this._syncUnsupported) {
      const syncBody = {
        schemaVersion: 1,
        syncId: window.PlayerProtocol && window.PlayerProtocol.uuid
          ? window.PlayerProtocol.uuid()
          : String(Date.now()),
        heartbeat: hbBody
      };
      if (knownPlanVersion) syncBody.knownPlanVersion = knownPlanVersion;
      const url = `${this.serverUrl}/api/player/sync?${this.qs({
        uin: this.uin, token: this.token, deviceId: this.deviceId
      })}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(syncBody)
      });
      if (res.status === 401) {
        this.token = null;
        await this.getToken();
        return this.heartbeat(metrics, knownPlanVersion);
      }
      if (res.status === 404 || res.status === 405) {
        this._syncUnsupported = true;
      } else {
        if (!res.ok) throw new Error(`sync HTTP ${res.status}`);
        return this._parse(await res.json());
      }
    }
    const url = `${this.serverUrl}/api/player/heartbeat?${this.qs({
      uin: this.uin, token: this.token, deviceId: this.deviceId
    })}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(hbBody)
    });
    if (res.status === 401) {
      this.token = null;
      await this.getToken();
      return this.heartbeat(metrics, knownPlanVersion);
    }
    if (!res.ok) throw new Error(`heartbeat HTTP ${res.status}`);
    return this._parse(await res.json());
  }

  async getDispatchPlan() {
    if (!this.token) await this.heartbeat();
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    const url = `${this.serverUrl}/api/player/dispatch?${this.qs({
      uin: this.uin,
      token: this.token,
      deviceId: this.deviceId,
      timezone: tz
    })}`;
    const res = await fetch(url);
    if (res.status === 401) {
      this.token = null;
      await this.heartbeat();
      return this.getDispatchPlan();
    }
    if (!res.ok) throw new Error(`dispatch HTTP ${res.status}`);
    return res.json();
  }

  async reportCommandResult(requestId, status, result, error) {
    const body = {
      uin: this.uin,
      token: this.token,
      requestId: String(requestId),
      status: status === "failed" || status === "error" ? "failed" : "completed"
    };
    if (result) body.result = result;
    if (error) body.error = String(error);
    const res = await fetch(`${this.serverUrl}/api/player/command-result`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error(`command-result HTTP ${res.status}`);
    return res.json();
  }

  async getPlayerConfig() {
    const res = await fetch(`${this.serverUrl}/api/player/config`);
    if (!res.ok) throw new Error(`config HTTP ${res.status}`);
    return res.json();
  }
}

window.DispatcherApi = DispatcherApi;
