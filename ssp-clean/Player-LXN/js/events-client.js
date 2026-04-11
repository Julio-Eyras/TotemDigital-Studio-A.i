class PlayerEventsClient {
  constructor(api) { this.api = api; }
  async sendEvent(eventType, mediaItem, extra = {}) {
    try {
      if (!this.api.token) await this.api.heartbeat();
      const url = `${this.api.serverUrl}/api/player/event?${new URLSearchParams({
        uin: this.api.uin, token: this.api.token, deviceId: this.api.deviceId
      })}`;
      const body = {
        eventType,
        mediaId: mediaItem?.mediaId || undefined,
        playlistId: extra.playlistId || undefined,
        campaignId: extra.campaignId || undefined,
        duration: extra.durationSeconds || undefined,
        completed: extra.completed,
        metadata: { player: "Player-LXN", deviceId: this.api.deviceId }
      };
      const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (r.status === 401) { await this.api.heartbeat(); return this.sendEvent(eventType, mediaItem, extra); }
    } catch (e) {
      LxnLogger.warn("EVENT", `Falha telemetria ${eventType}: ${e.message}`);
    }
  }
}
window.PlayerEventsClient = PlayerEventsClient;
