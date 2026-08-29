class PlayerControllerWOS {
  constructor(config, api, eventsClient) {
    this.config = config;
    this.api = api;
    this.eventsClient = eventsClient;
    this.video = document.getElementById("videoPlayer");
    this.image = document.getElementById("imagePlayer");
    this.stopped = false;
    this.plan = null;
    this.planState = "UNAVAILABLE";
    this.knownPlanVersion = null;
    this.needsDispatch = true;
    this.forceMode = null;
    this.commandRunner = null;
  }

  _ensureCommands() {
    if (this.commandRunner || !window.PlayerProtocol) return;
    const self = this;
    this.commandRunner = window.PlayerProtocol.createCommandRunner({
      platform: "webos",
      reportResult: (id, status, result, error) =>
        this.api.reportCommandResult(id, status, result, error),
      hooks: {
        refresh_dispatch: async () => { self.needsDispatch = true; await self.tryRefreshOnlinePlan(true); return { refreshed: true }; },
        sync_now: async () => { self.needsDispatch = true; await self.tryRefreshOnlinePlan(true); return { refreshed: true }; },
        content_version_check: async () => { self.needsDispatch = true; await self.tryRefreshOnlinePlan(true); return { checked: true }; },
        purge_cache: async () => {
          localStorage.removeItem("player-wos.last-dispatch-plan");
          return { purged: true };
        },
        invalidate_media: async () => {
          localStorage.removeItem("player-wos.last-dispatch-plan");
          self.needsDispatch = true;
          await self.tryRefreshOnlinePlan(true);
          return { invalidated: true };
        },
        invalidate_playlist: async () => {
          localStorage.removeItem("player-wos.last-dispatch-plan");
          self.needsDispatch = true;
          await self.tryRefreshOnlinePlan(true);
          return { invalidated: true };
        },
        invalidate_campaign: async () => {
          localStorage.removeItem("player-wos.last-dispatch-plan");
          self.needsDispatch = true;
          await self.tryRefreshOnlinePlan(true);
          return { invalidated: true };
        },
        config: async (cmd) => self._applyConfig(cmd.data),
        apply_player_config: async (cmd) => self._applyConfig(cmd.data),
        display_force_on: async () => { self.forceMode = "on"; self._setIdle(false); return { forceMode: "on" }; },
        display_force_off: async () => { self.forceMode = "off"; self._setIdle(true); return { forceMode: "off" }; },
        display_force_clear: async () => { self.forceMode = null; self._setIdle(false); return { forceMode: null }; },
        restart: async () => { window.location.reload(); return { reloaded: true }; },
        restart_app: async () => { window.location.reload(); return { reloaded: true }; },
      }
    });
  }

  _applyConfig(data) {
    if (!data || typeof data !== "object") return { applied: false };
    Object.assign(this.config, data);
    if (data.deviceId) this.api.deviceId = window.PlayerProtocol.canonicalDeviceId(data.deviceId);
    localStorage.setItem("player-config.json", JSON.stringify(this.config));
    return { applied: true };
  }

  _setIdle(idle) {
    let veil = document.getElementById("display-idle-veil");
    if (!veil) {
      veil = document.createElement("div");
      veil.id = "display-idle-veil";
      veil.style.cssText = "position:fixed;inset:0;background:#000;z-index:9999;display:none;";
      document.body.appendChild(veil);
    }
    veil.style.display = idle ? "block" : "none";
  }

  parsePlan(dispatchJson) {
    const p = dispatchJson?.plan || {};
      const mediaItems = Array.isArray(p.mediaItems) ? p.mediaItems.map((it) => ({
      mediaId: Number(it.mediaId || 0),
      url: this.api.resolveUrl(String(it.url || "")),
      duration: Number(it.duration || 0) || null,
      mediaType: String(it.mediaType || "").toLowerCase(),
      tags: it.tags || []
    })).filter((it) => it.url) : [];
    const plan = {
      playlistId: Number(p.playlistId || 0),
      playlistName: p.playlistName || "DispatchPlan",
      campaignId: Number(p.campaignId || 0) || null,
      planVersion: p.planVersion || p.plan_version || null,
      mediaItems
    };
    return window.PlayerProtocol ? window.PlayerProtocol.stripVinhetasFromOnlinePlan(plan) : plan;
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
    this._ensureCommands();
    try {
      const hb = await this.api.heartbeat(null, this.knownPlanVersion);
      if (this.commandRunner && hb && hb.pendingCommands) {
        await this.commandRunner.handleAll(hb.pendingCommands);
      }
      if (hb && typeof hb.needsDispatch === "boolean") this.needsDispatch = hb.needsDispatch;
      if (hb && hb.planVersion) this.knownPlanVersion = hb.planVersion;
      if (this.needsDispatch || !this.plan) {
        const json = await this.api.getDispatchPlan();
        localStorage.setItem("player-wos.last-dispatch-plan", JSON.stringify(json));
        localStorage.setItem("player-wos.current-plan-source", "ONLINE");
        this.plan = this.parsePlan(json);
        const proto = window.PlayerProtocol;
        const count = proto ? proto.mediaItemCount(this.plan) : (this.plan.mediaItems || []).length;
        this.planState = proto ? proto.resolvePlanState(json, count) : (count ? "ACTIVE" : "EMPTY");
        this.needsDispatch = false;
        if (this.plan.planVersion) this.knownPlanVersion = this.plan.planVersion;
      }
    } catch (err) {
      WosLogger.warn("DISPATCH", `Falha online, tentando persistido: ${err.message}`);
      this.planState = "UNAVAILABLE";
      const persisted = localStorage.getItem("player-wos.last-dispatch-plan");
      if (persisted) {
        this.plan = this.parsePlan(JSON.parse(persisted));
        localStorage.setItem("player-wos.current-plan-source", "PERSISTED");
        this.planState = "ACTIVE";
      } else {
        this.plan = this.fallbackPlan();
        localStorage.setItem("player-wos.current-plan-source", "FALLBACK_LOCAL");
        this.planState = this.plan ? "ACTIVE" : "EMPTY";
      }
    }
    if (this.planState === "EMPTY") {
      WosLogger.info("DISPATCH", "EMPTY_PLAN — sem fallback (RN-PAD-001)");
      await this.playLoop();
      return;
    }
    if (!this.plan || !this.plan.mediaItems.length) {
      throw new Error("Sem plano para reproduzir (online/persistido/fallback)");
    }
    await this.playLoop();
  }

  async playLoop() {
    let idx = 0;
    while (!this.stopped) {
      if (this.forceMode === "off") {
        this._setIdle(true);
        await new Promise((r) => setTimeout(r, 15000));
        continue;
      }
      this._setIdle(false);
      if (this.planState === "EMPTY" || !this.plan || !this.plan.mediaItems.length) {
        await new Promise((r) => setTimeout(r, 30000));
        await this.tryRefreshOnlinePlan(false);
        continue;
      }
      const item = this.plan.mediaItems[idx % this.plan.mediaItems.length];
      await this.playItem(item);
      idx = (idx + 1) % this.plan.mediaItems.length;
      if (idx === 0) await this.tryRefreshOnlinePlan(false);
    }
  }

  async tryRefreshOnlinePlan(force) {
    try {
      const hb = await this.api.heartbeat(null, this.knownPlanVersion);
      if (this.commandRunner && hb && hb.pendingCommands) {
        await this.commandRunner.handleAll(hb.pendingCommands);
      }
      if (hb && typeof hb.needsDispatch === "boolean") this.needsDispatch = hb.needsDispatch;
      if (hb && hb.planVersion) this.knownPlanVersion = hb.planVersion;
      if (!force && !this.needsDispatch) return;
      const json = await this.api.getDispatchPlan();
      const next = this.parsePlan(json);
      const proto = window.PlayerProtocol;
      const count = proto ? proto.mediaItemCount(next) : (next.mediaItems || []).length;
      this.planState = proto ? proto.resolvePlanState(json, count) : (count ? "ACTIVE" : "EMPTY");
      this.needsDispatch = false;
      if (count) {
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
      this.video.playsInline = true;
      this.video.muted = true;
      this.video.onmouseenter = () => {
        this.video.muted = false;
        this.video.play().catch(() => {});
      };
      this.video.onmouseleave = () => {
        this.video.muted = true;
      };
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
