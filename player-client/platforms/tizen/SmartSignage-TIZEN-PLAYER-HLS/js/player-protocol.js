/**
 * Contrato Player-AD 2.15 (/api/player/* + RN-PAD) para players JS.
 * Copiar para Player-WOS e Tizen se alterar aqui.
 */
(function (root) {
  var STORAGE_KEY = "player-ad.processed-command-ids";
  var MAX_IDS = 200;
  var ACK_BEFORE = {
    restart: 1,
    restart_app: 1,
    reboot: 1,
    reset_board: 1,
    config: 1,
    apply_player_config: 1,
    configure_wifi: 1,
    purge_cache: 1,
    invalidate_media: 1,
    invalidate_playlist: 1,
    invalidate_campaign: 1,
    screenshot: 1,
    capture_screen: 1,
  };
  var ND_WEB = {
    reboot: 1,
    reset_board: 1,
    configure_wifi: 1,
    capture_screen: 1,
    screenshot: 1,
    update: 1,
    ota_rollback: 1,
    restart: 1,
    restart_app: 1,
  };
  var ND_SMART_TV = {
    reboot: 1,
    reset_board: 1,
    configure_wifi: 1,
    capture_screen: 1,
    screenshot: 1,
    update: 1,
    ota_rollback: 1,
  };

  function canonicalDeviceId(value) {
    return String(value || "").trim().toUpperCase();
  }

  function uuid() {
    if (root.crypto && root.crypto.randomUUID) return root.crypto.randomUUID();
    return "sync-" + Date.now() + "-" + Math.random().toString(16).slice(2);
  }

  function unwrapHeartbeat(json) {
    if (!json || typeof json !== "object") return {};
    var data = json.data && typeof json.data === "object" ? json.data : json;
    if (data.heartbeat && typeof data.heartbeat === "object") return data.heartbeat;
    return data;
  }

  function parsePendingCommands(hb) {
    var arr = hb.pendingCommands || hb.pending_commands || [];
    if (!Array.isArray(arr)) return [];
    var out = [];
    for (var i = 0; i < arr.length; i++) {
      var obj = arr[i];
      if (!obj) continue;
      var id = obj.id != null ? String(obj.id) : obj.requestId != null ? String(obj.requestId) : "";
      var type = String(obj.type || "").trim();
      if (!id || !type) continue;
      out.push({
        id: id,
        type: type,
        data: obj.data || obj.command_data || {},
      });
    }
    return out;
  }

  function parseSyncOrHeartbeat(json) {
    var hb = unwrapHeartbeat(json);
    var planVersion = String(hb.planVersion || hb.plan_version || "").trim() || null;
    var hasNeeds =
      Object.prototype.hasOwnProperty.call(hb, "needsDispatch") ||
      Object.prototype.hasOwnProperty.call(hb, "needs_dispatch") ||
      Object.prototype.hasOwnProperty.call(hb, "planVersion") ||
      Object.prototype.hasOwnProperty.call(hb, "plan_version");
    var needsDispatch = false;
    if (Object.prototype.hasOwnProperty.call(hb, "needsDispatch")) needsDispatch = !!hb.needsDispatch;
    else if (Object.prototype.hasOwnProperty.call(hb, "needs_dispatch")) needsDispatch = !!hb.needs_dispatch;
    return {
      token: hb.token || json.token || null,
      pendingCommands: parsePendingCommands(hb),
      needsDispatch: needsDispatch,
      supportsPlanVersion: hasNeeds,
      planVersion: planVersion,
      displaySchedule: hb.displaySchedule || hb.display_schedule || null,
      pollAdaptive: hb.pollAdaptive || hb.poll_adaptive || null,
      otaUpdate: hb.otaUpdate || hb.ota_update || null,
    };
  }

  function isVinhetaItem(item) {
    if (!item) return false;
    var mt = String(item.mediaType || item.media_type || "").toLowerCase();
    if (mt.indexOf("vinheta") >= 0) return true;
    var tags = item.tags || [];
    for (var i = 0; i < tags.length; i++) {
      if (String(tags[i]).toLowerCase().indexOf("vinheta") >= 0) return true;
    }
    return false;
  }

  function stripVinhetasFromOnlinePlan(plan) {
    if (!plan || !Array.isArray(plan.mediaItems)) return plan;
    return Object.assign({}, plan, {
      mediaItems: plan.mediaItems.filter(function (it) {
        return !isVinhetaItem(it);
      }),
    });
  }

  function mediaItemCount(plan) {
    if (!plan) return 0;
    var items = plan.mediaItems || plan.media_items;
    return Array.isArray(items) ? items.length : 0;
  }

  function resolvePlanState(response, count) {
    var payload = (response && response.data) || response || {};
    var plan = payload.plan || (response && response.plan) || {};
    var explicit = String(payload.planState || payload.plan_state || plan.planState || "")
      .trim()
      .toUpperCase();
    var n = count != null ? count : mediaItemCount(plan);
    if (explicit === "ACTIVE") return n > 0 ? "ACTIVE" : "EMPTY";
    if (explicit === "EMPTY") return "EMPTY";
    if (explicit === "UNAVAILABLE") return "UNAVAILABLE";
    return n > 0 ? "ACTIVE" : "EMPTY";
  }

  function loadProcessedIds() {
    try {
      var raw = root.localStorage && root.localStorage.getItem(STORAGE_KEY);
      var arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr.map(String) : [];
    } catch (e) {
      return [];
    }
  }

  function saveProcessedIds(ids) {
    try {
      if (root.localStorage) root.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids.slice(-MAX_IDS)));
    } catch (e) {}
  }

  function rememberProcessed(id) {
    var ids = loadProcessedIds();
    if (ids.indexOf(id) >= 0) return;
    ids.push(id);
    saveProcessedIds(ids);
  }

  function wasProcessed(id) {
    return loadProcessedIds().indexOf(String(id)) >= 0;
  }

  function commandAvailability(type, platform) {
    var t = String(type || "").trim().toLowerCase();
    if (platform === "web" && ND_WEB[t]) return "unsupported";
    if ((platform === "webos" || platform === "tizen") && ND_SMART_TV[t]) return "unsupported";
    return "execute";
  }

  function ackBefore(type) {
    return !!ACK_BEFORE[String(type || "").trim().toLowerCase()];
  }

  function htmlDurationSeconds(declared) {
    var n = Number(declared);
    if (!n || n < 30) return 60;
    return n;
  }

  function imageDurationSeconds(declared) {
    var n = Number(declared);
    return n > 0 ? n : 10;
  }

  /**
   * @param {{
   *   platform: 'web'|'webos'|'tizen',
   *   reportResult: function(id, status, result, error): Promise<any>,
   *   hooks: Record<string, function(cmd): Promise<any>|any>
   * }} opts
   */
  function createCommandRunner(opts) {
    var platform = opts.platform;
    var reportResult = opts.reportResult;
    var hooks = opts.hooks || {};

    async function ack(id, status, result, error) {
      return reportResult(id, status, result || {}, error || "");
    }

    async function handleOne(cmd) {
      if (!cmd || !cmd.id) return;
      var type = String(cmd.type || "").trim().toLowerCase();
      if (wasProcessed(cmd.id)) {
        await ack(cmd.id, "completed", { duplicate: true, alreadyProcessed: true }, "");
        return;
      }
      if (commandAvailability(type, platform) === "unsupported") {
        rememberProcessed(cmd.id);
        await ack(cmd.id, "completed", { unsupported: true, type: type, platform: platform }, "");
        return;
      }
      var before = ackBefore(type);
      if (before) rememberProcessed(cmd.id);
      try {
        var hook = hooks[type];
        var result = {};
        if (typeof hook === "function") result = (await hook(cmd)) || {};
        else if (hooks.unknown) result = (await hooks.unknown(cmd)) || {};
        else throw new Error("tipo desconhecido: " + type);
        if (!before) rememberProcessed(cmd.id);
        await ack(cmd.id, "completed", result, "");
      } catch (err) {
        var msg = err && err.message ? err.message : String(err);
        if (!before) rememberProcessed(cmd.id);
        await ack(cmd.id, "failed", {}, msg);
      }
    }

    return {
      handleAll: async function (commands) {
        if (!Array.isArray(commands) || !commands.length) return;
        for (var i = 0; i < commands.length; i++) {
          try {
            await handleOne(commands[i]);
          } catch (e) {}
        }
      },
    };
  }

  root.PlayerProtocol = {
    canonicalDeviceId: canonicalDeviceId,
    uuid: uuid,
    parseSyncOrHeartbeat: parseSyncOrHeartbeat,
    stripVinhetasFromOnlinePlan: stripVinhetasFromOnlinePlan,
    resolvePlanState: resolvePlanState,
    mediaItemCount: mediaItemCount,
    createCommandRunner: createCommandRunner,
    htmlDurationSeconds: htmlDurationSeconds,
    imageDurationSeconds: imageDurationSeconds,
    commandAvailability: commandAvailability,
  };
})(typeof window !== "undefined" ? window : globalThis);
