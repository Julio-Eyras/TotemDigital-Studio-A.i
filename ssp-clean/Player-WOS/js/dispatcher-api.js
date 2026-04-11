class DispatcherApi {
  constructor(serverUrl, uin, deviceId) {
    this.serverUrl = String(serverUrl || "").replace(/\/$/, "");
    this.uin = uin;
    this.deviceId = deviceId;
    this.token = null;
  }

  qs(obj) {
    return new URLSearchParams(obj).toString();
  }

  resolveUrl(url) {
    if (/^https?:\/\//i.test(url) || /^file:\/\//i.test(url)) return url;
    return `${this.serverUrl}${url.startsWith("/") ? "" : "/"}${url}`;
  }

  async getToken() {
    const url = `${this.serverUrl}/api/player/token?${this.qs({ uin: this.uin, deviceId: this.deviceId })}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`token HTTP ${res.status}`);
    const data = await res.json();
    if (!data.token) throw new Error("token vazio");
    this.token = data.token;
    return this.token;
  }

  async heartbeat() {
    if (!this.token) await this.getToken();
    const url = `${this.serverUrl}/api/player/heartbeat?${this.qs({ uin: this.uin, token: this.token, deviceId: this.deviceId })}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uin: this.uin, deviceId: this.deviceId })
    });
    if (res.status === 401) {
      this.token = null;
      await this.getToken();
      return this.heartbeat();
    }
    if (!res.ok) throw new Error(`heartbeat HTTP ${res.status}`);
    const data = await res.json();
    this.token = data.token || this.token;
    return this.token;
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
}

window.DispatcherApi = DispatcherApi;
