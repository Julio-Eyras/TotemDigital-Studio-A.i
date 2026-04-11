class PlayerControllerWOS {
  constructor(config, api, eventsClient) {
    this.config = config;
    this.api = api;
    this.eventsClient = eventsClient;
    this.video = document.getElementById("videoPlayer");
    this.image = document.getElementById("imagePlayer");
    this.stopped = false;
    this.plan = null;
  }

  parsePlan(dispatchJson) {
    const p = dispatchJson?.plan || {};
    const mediaItems = Array.isArray(p.mediaItems) ? p.mediaItems.map((it) => ({
      mediaId: Number(it.mediaId || 0),
      url: this.api.resolveUrl(String(it.url || "")),
      duration: Number(it.duration || 0) || null,
      mediaType: String(it.mediaType || "").toLowerCase()
    })).filter((it) => it.url) : [];
    return {
      playlistId: Number(p.playlistId || 0),
      playlistName: p.playlistName || "DispatchPlan",
      campaignId: Number(p.campaignId || 0) || null,
      mediaItems
    };
  }

  fallbackPlan() {
    const ads = this.config.fallbackPropagandas || [];
    const vins = this.config.fallbackVinhetas || [];
    if (!ads.length || !vins.length) return null;
    const n = Math.max(1, Number(this.config.fallbackPropagandasPerVinheta || 3));
    const items = [];
    for (let i = 0; i < n; i += 1) items.push({ mediaId: 0, url: ads[i % ads.length], duration: null, mediaType: "video" });
    items.push({ mediaId: 0, url: vins[0], duration: null, mediaType: "video" });
    return { playlistId: 0, playlistName: `Fallback ${n}:1`, campaignId: null, mediaItems: items };
  }

  async start() {
    try {
      await this.api.heartbeat();
      const json = await this.api.getDispatchPlan();
      localStorage.setItem("player-wos.last-dispatch-plan", JSON.stringify(json));
      localStorage.setItem("player-wos.current-plan-source", "ONLINE");
      this.plan = this.parsePlan(json);
    } catch (err) {
      WosLogger.warn("DISPATCH", `Falha online, tentando persistido: ${err.message}`);
      const persisted = localStorage.getItem("player-wos.last-dispatch-plan");
      if (persisted) {
        this.plan = this.parsePlan(JSON.parse(persisted));
        localStorage.setItem("player-wos.current-plan-source", "PERSISTED");
      } else {
        this.plan = this.fallbackPlan();
        localStorage.setItem("player-wos.current-plan-source", "FALLBACK_LOCAL");
      }
    }
    if (!this.plan || !this.plan.mediaItems.length) {
      throw new Error("Sem plano para reproduzir (online/persistido/fallback)");
    }
    await this.playLoop();
  }

  async playLoop() {
    let idx = 0;
    while (!this.stopped) {
      const item = this.plan.mediaItems[idx];
      await this.playItem(item);
      idx = (idx + 1) % this.plan.mediaItems.length;
      if (idx === 0) await this.tryRefreshOnlinePlan();
    }
  }

  async tryRefreshOnlinePlan() {
    try {
      await this.api.heartbeat();
      const json = await this.api.getDispatchPlan();
      const next = this.parsePlan(json);
      if (next.mediaItems.length) {
        this.plan = next;
        localStorage.setItem("player-wos.last-dispatch-plan", JSON.stringify(json));
        localStorage.setItem("player-wos.current-plan-source", "ONLINE");
      }
    } catch (_) {}
  }

  async playItem(item) {
    const isImage = item.mediaType.includes("image") || /\.(png|jpe?g|webp|gif)$/i.test(item.url);
    if (isImage) return this.playImage(item);
    return this.playVideo(item);
  }

  async playImage(item) {
    if (!this.config.acceptImagesInPlaylist) return;
    this.video.pause();
    this.video.style.display = "none";
    this.image.style.display = "block";
    this.image.src = item.url;
    await this.eventsClient.sendEvent("image_display", item, { playlistId: this.plan.playlistId, campaignId: this.plan.campaignId });
    await new Promise((resolve) => setTimeout(resolve, (item.duration || this.config.imageDurationSeconds || 20) * 1000));
    this.image.style.display = "none";
  }

  async playVideo(item) {
    this.image.style.display = "none";
    this.video.style.display = "block";
    await this.eventsClient.sendEvent("video_playback_start", item, { playlistId: this.plan.playlistId, campaignId: this.plan.campaignId });
    await new Promise((resolve) => {
      const onEnd = () => {
        this.video.removeEventListener("ended", onEnd);
        this.video.removeEventListener("error", onEnd);
        resolve();
      };
      this.video.addEventListener("ended", onEnd);
      this.video.addEventListener("error", onEnd);
      this.video.src = item.url;
      this.video.play().catch(onEnd);
    });
    await this.eventsClient.sendEvent("video_playback_end", item, {
      playlistId: this.plan.playlistId,
      campaignId: this.plan.campaignId,
      durationSeconds: Math.floor(this.video.currentTime || 0),
      completed: true
    });
  }
}

window.PlayerControllerWOS = PlayerControllerWOS;
