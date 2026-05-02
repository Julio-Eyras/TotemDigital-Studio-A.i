class PlayerControllerLXN {
  constructor(config, api, eventsClient) {
    this.config = config;
    this.api = api;
    this.eventsClient = eventsClient;
    this.video = document.getElementById("videoPlayer");
    this.image = document.getElementById("imagePlayer");
    this.plan = null;
  }
  parsePlan(json) {
    const p = json?.plan || {};
    const items = Array.isArray(p.mediaItems) ? p.mediaItems.map((it) => ({
      mediaId: Number(it.mediaId || 0),
      url: this.api.resolveUrl(String(it.url || "")),
      duration: Number(it.duration || 0) || null,
      mediaType: String(it.mediaType || "").toLowerCase()
    })).filter((x) => x.url) : [];
    return { playlistId: Number(p.playlistId || 0), playlistName: p.playlistName || "DispatchPlan", campaignId: Number(p.campaignId || 0) || null, mediaItems: items };
  }
  fallbackPlan() {
    const ads = this.config.fallbackPropagandas || [];
    const vins = this.config.fallbackVinhetas || [];
    if (!ads.length || !vins.length) return null;
    const n = Math.max(1, Number(this.config.fallbackPropagandasPerVinheta || 3));
    const items = [];
    for (let i = 0; i < n; i += 1) items.push({ mediaId: 0, url: ads[i % ads.length], mediaType: "video", duration: null });
    items.push({ mediaId: 0, url: vins[0], mediaType: "video", duration: null });
    return { playlistId: 0, playlistName: `Fallback ${n}:1`, campaignId: null, mediaItems: items };
  }
  async start() {
    try {
      await this.api.heartbeat();
      const json = await this.api.getDispatchPlan();
      localStorage.setItem("player-lxn.last-dispatch-plan", JSON.stringify(json));
      this.plan = this.parsePlan(json);
      localStorage.setItem("player-lxn.current-plan-source", "ONLINE");
    } catch (_) {
      const persisted = localStorage.getItem("player-lxn.last-dispatch-plan");
      if (persisted) {
        this.plan = this.parsePlan(JSON.parse(persisted));
        localStorage.setItem("player-lxn.current-plan-source", "PERSISTED");
      } else {
        this.plan = this.fallbackPlan();
        localStorage.setItem("player-lxn.current-plan-source", "FALLBACK_LOCAL");
      }
    }
    if (!this.plan || !this.plan.mediaItems.length) throw new Error("Sem plano de playback");
    let idx = 0;
    while (true) {
      await this.playItem(this.plan.mediaItems[idx]);
      idx = (idx + 1) % this.plan.mediaItems.length;
    }
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
    await new Promise((r) => setTimeout(r, (item.duration || this.config.imageDurationSeconds || 20) * 1000));
    this.image.style.display = "none";
  }
  async playVideo(item) {
    this.image.style.display = "none";
    this.video.style.display = "block";
    await this.eventsClient.sendEvent("video_playback_start", item, { playlistId: this.plan.playlistId, campaignId: this.plan.campaignId });
    await new Promise((resolve) => {
      const done = () => {
        this.video.removeEventListener("ended", done);
        this.video.removeEventListener("error", done);
        resolve();
      };
      this.video.addEventListener("ended", done);
      this.video.addEventListener("error", done);
      this.video.src = item.url;
      this.video.playsInline = true;
      this.video.muted = true;
      this.video.onmouseenter = () => {
        this.video.muted = false;
        this.video.play().catch(() => {});
      };
      this.video.onmouseleave = () => {
        this.video.muted = true;
      };
      this.video.play().catch(done);
    });
    await this.eventsClient.sendEvent("video_playback_end", item, { playlistId: this.plan.playlistId, campaignId: this.plan.campaignId, durationSeconds: Math.floor(this.video.currentTime || 0), completed: true });
  }
}
window.PlayerControllerLXN = PlayerControllerLXN;
