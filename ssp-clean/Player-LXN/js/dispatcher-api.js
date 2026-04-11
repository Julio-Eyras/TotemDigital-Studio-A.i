class DispatcherApi {
  constructor(serverUrl, uin, deviceId) {
    this.serverUrl = String(serverUrl || "").replace(/\/$/, "");
    this.uin = uin;
    this.deviceId = deviceId;
    this.token = null;
  }
  qs(o) { return new URLSearchParams(o).toString(); }
  resolveUrl(url) {
    if (/^(https?:|file:)/i.test(url)) return url;
    return `${this.serverUrl}${url.startsWith("/") ? "" : "/"}${url}`;
  }
  async getToken() {
    const r = await fetch(`${this.serverUrl}/api/player/token?${this.qs({ uin: this.uin, deviceId: this.deviceId })}`);
    if (!r.ok) throw new Error(`token HTTP ${r.status}`);
    const j = await r.json();
    if (!j.token) throw new Error("token vazio");
    this.token = j.token;
    return this.token;
  }
  async heartbeat() {
    if (!this.token) await this.getToken();
    const r = await fetch(`${this.serverUrl}/api/player/heartbeat?${this.qs({ uin: this.uin, token: this.token, deviceId: this.deviceId })}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uin: this.uin, deviceId: this.deviceId })
    });
    if (r.status === 401) { this.token = null; return this.heartbeat(); }
    if (!r.ok) throw new Error(`heartbeat HTTP ${r.status}`);
    const j = await r.json();
    this.token = j.token || this.token;
    return this.token;
  }
  async getDispatchPlan() {
    if (!this.token) await this.heartbeat();
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    const r = await fetch(`${this.serverUrl}/api/player/dispatch?${this.qs({ uin: this.uin, token: this.token, deviceId: this.deviceId, timezone: tz })}`);
    if (r.status === 401) { this.token = null; return this.getDispatchPlan(); }
    if (!r.ok) throw new Error(`dispatch HTTP ${r.status}`);
    return r.json();
  }
}
window.DispatcherApi = DispatcherApi;
