class PlayerEventsClient {
  constructor(api) {
    this.api = api;
  }

  async sendEvent(eventType, mediaItem, extra = {}) {
    try {
      if (!this.api.token) await this.api.heartbeat();
      const url = `${this.api.serverUrl}/api/player/event?${new URLSearchParams({
        uin: this.api.uin,
        token: this.api.token,
        deviceId: this.api.deviceId
      })}`;

      const body = {
        eventType,
        mediaId: mediaItem?.mediaId || undefined,
        playlistId: extra.playlistId || undefined,
        campaignId: extra.campaignId || undefined,
        duration: extra.durationSeconds || undefined,
        completed: extra.completed,
        metadata: {
          player: "Player-WOS",
          deviceId: this.api.deviceId
        }
      };

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      if (res.status === 401) {
        await this.api.heartbeat();
        return this.sendEvent(eventType, mediaItem, extra);
      }
    } catch (err) {
      WosLogger.warn("EVENT", `Falha telemetria ${eventType}: ${err.message}`);
    }
  }
}

window.PlayerEventsClient = PlayerEventsClient;
