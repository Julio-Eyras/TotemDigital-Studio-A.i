#include "playback/PlayerOrchestrator.hpp"

#include "ops/FieldOps.hpp"
#include "util/Logger.hpp"
#include "util/SystemdWatchdog.hpp"
#include "util/TelemetryRotate.hpp"
#include "version.hpp"

#include <algorithm>
#include <chrono>
#include <cctype>
#include <cstdlib>
#include <filesystem>
#include <fstream>
#include <mutex>
#include <stdexcept>
#include <thread>
#include <vector>

namespace player::playback {

namespace fs = std::filesystem;

namespace {

std::string lowerCopy(std::string s) {
  for (char& c : s) c = static_cast<char>(std::tolower(static_cast<unsigned char>(c)));
  return s;
}

std::string guessType(const std::string& name) {
  const auto n = lowerCopy(name);
  if (n.size() >= 5 && (n.compare(n.size() - 5, 5, ".html") == 0 || n.compare(n.size() - 4, 4, ".htm") == 0))
    return "html";
  if (n.size() >= 4 && (n.compare(n.size() - 4, 4, ".jpg") == 0 || n.compare(n.size() - 4, 4, ".png") == 0))
    return "image";
  if (n.size() >= 5 && (n.compare(n.size() - 5, 5, ".jpeg") == 0 || n.compare(n.size() - 5, 5, ".webp") == 0))
    return "image";
  return "video";
}

bool isFallbackName(const std::string& name) {
  if (name == "metadata.json") return false;
  const auto n = lowerCopy(name);
  return n.size() >= 4 &&
         (n.compare(n.size() - 4, 4, ".mp4") == 0 || n.compare(n.size() - 5, 5, ".webm") == 0 ||
          n.compare(n.size() - 4, 4, ".mov") == 0 || n.compare(n.size() - 4, 4, ".jpg") == 0 ||
          n.compare(n.size() - 5, 5, ".jpeg") == 0 || n.compare(n.size() - 4, 4, ".png") == 0 ||
          n.compare(n.size() - 5, 5, ".html") == 0 || n.compare(n.size() - 4, 4, ".htm") == 0);
}

std::vector<std::string> listMedia(const std::string& dir) {
  std::vector<std::string> out;
  std::error_code ec;
  if (!fs::exists(dir, ec) || !fs::is_directory(dir, ec)) return out;
  for (const auto& e : fs::directory_iterator(dir, ec)) {
    if (!e.is_regular_file()) continue;
    const auto name = e.path().filename().string();
    if (!isFallbackName(name)) continue;
    if (e.file_size(ec) == 0) continue;
    out.push_back(e.path().string());
  }
  std::sort(out.begin(), out.end(), [](const std::string& a, const std::string& b) {
    return lowerCopy(a) < lowerCopy(b);
  });
  return out;
}

api::MediaItem itemFromPath(const std::string& path, int order) {
  api::MediaItem m;
  m.mediaId = fs::path(path).stem().string();
  m.url = "file://" + path;
  m.mediaType = guessType(path);
  m.order = order;
  if (m.mediaType == "image") m.durationSeconds = 10;
  else if (m.mediaType == "html") m.durationSeconds = 60;
  return m;
}

}  // namespace

PlayerOrchestrator::PlayerOrchestrator(config::PlayerConfig cfg, util::DataLayout layout)
    : cfg_(std::move(cfg)),
      layout_(std::move(layout)),
      schedule_(config::loadSchedule(layout_.schedulePath)),
      poll_(cfg_),
      client_(cfg_),
      cache_(cfg_, layout_.propagandasDir, layout_.metadataPath),
      commands_(cfg_, schedule_, layout_.schedulePath, layout_.configPath, cache_, client_,
                layout_.receiptsPath, layout_.otaDir, layout_.screenshotsDir),
      backend_(createMediaBackend()) {
  commands_.setOnRefreshDispatch([this] { tickDispatch(true); });
  commands_.setOnRestart([this] {
    util::Logger::w("WATCHDOG", "restart_app pedido");
    stop_ = true;
  });
  commands_.setOnQueueOta([this](ops::OtaPackage pkg, bool rollback) { queueOtaInstall(pkg, rollback); });
  commands_.setOnReboot([this] {
    interruptPlayback_ = true;
    std::lock_guard<std::recursive_mutex> lock(mu_);
    pendingOp_ = PendingOp::Reboot;
  });
  loadPersistedPlan();
}

void PlayerOrchestrator::requestStop() { stop_ = true; }

bool PlayerOrchestrator::ensureToken() {
  if (!client_.token().empty()) return true;
  auto t = client_.getToken();
  return t.has_value();
}

void PlayerOrchestrator::persistPlan() {
  std::ofstream out(layout_.lastPlanPath);
  if (!out) return;
  nlohmann::json j;
  j["playlistId"] = plan_.playlistId;
  j["playlistName"] = plan_.playlistName;
  j["planVersion"] = plan_.planVersion;
  j["planState"] = plan_.mediaItems.empty()
                       ? (planSource_ == "UNAVAILABLE" ? "UNAVAILABLE" : "EMPTY")
                       : "ACTIVE";
  j["mediaItems"] = nlohmann::json::array();
  for (const auto& m : plan_.mediaItems) {
    nlohmann::json it;
    it["mediaId"] = m.mediaId;
    it["url"] = m.url;
    it["mediaType"] = m.mediaType;
    it["duration"] = m.durationSeconds;
    it["order"] = m.order;
    it["metadata"] = {{"contentVersion", m.contentVersion}};
    j["mediaItems"].push_back(it);
  }
  out << j.dump(2);
  std::ofstream src(layout_.planSourcePath);
  if (src) src << planSource_;
}

void PlayerOrchestrator::loadPersistedPlan() {
  std::ifstream in(layout_.lastPlanPath);
  if (!in) return;
  try {
    nlohmann::json j;
    in >> j;
    plan_ = api::parseDispatchPlan(j);
    planSource_ = "PERSISTED";
    if (!plan_.planVersion.empty()) knownPlanVersion_ = plan_.planVersion;
    util::Logger::i("DISPATCH", "Plano persistido carregado itens=" + std::to_string(plan_.mediaItems.size()));
  } catch (...) {
  }
}

void PlayerOrchestrator::tickHeartbeat() {
  util::Logger::i("LIFECYCLE", "Heartbeat — token/sessão/comandos");
  if (!ensureToken()) {
    poll_.onFailure();
    return;
  }
  std::optional<std::string> known;
  {
    std::lock_guard<std::recursive_mutex> lock(mu_);
    known = knownPlanVersion_;
  }
  auto hb = client_.heartbeatOrSync(client_.token(), known);
  if (!hb.ok) {
    if (hb.httpStatus == 401) {
      client_.setToken("");
      ensureToken();
    }
    poll_.onFailure();
    util::Logger::w("HEARTBEAT", "falhou HTTP " + std::to_string(hb.httpStatus));
    return;
  }
  bool needsDispatch = false;
  bool idle = false;
  {
    std::lock_guard<std::recursive_mutex> lock(mu_);
    if (hb.displaySchedule) {
      schedule_ = config::mergeFromServer(schedule_, *hb.displaySchedule);
      config::saveSchedule(layout_.schedulePath, schedule_);
      util::Logger::i(
          "DISPLAY",
          "Schedule atualizado enabled=" + std::string(schedule_.enabled ? "true" : "false") + " " +
              schedule_.onTime + "-" + schedule_.offTime +
              (schedule_.forceMode ? (" force=" + *schedule_.forceMode) : ""));
    }
    if (hb.pollAdaptive) {
      cfg_.mergePollAdaptive(*hb.pollAdaptive);
      poll_.replaceConfig(cfg_);
    }
    idle = !schedule_.isDisplayActiveNow();
    const bool unchanged =
        hb.planVersion && knownPlanVersion_ && *hb.planVersion == *knownPlanVersion_;
    poll_.onHeartbeatSuccess(unchanged, idle);
    needsDispatch = hb.needsDispatch;
  }
  commands_.handleAll(hb.pendingCommands, client_.token());
  maybeQueueOta(hb.otaUpdate);
  util::Logger::i("HEARTBEAT",
                  std::string("OK — próximo em ") + std::to_string(poll_.heartbeatIntervalMs() / 1000) +
                      "s needsDispatch=" + (needsDispatch ? "true" : "false") +
                      " idle=" + (idle ? "true" : "false"));
  if (needsDispatch) tickDispatch(true);
}

void PlayerOrchestrator::tickDispatch(bool force) {
  {
    std::lock_guard<std::recursive_mutex> lock(mu_);
    if (!force && !plan_.mediaItems.empty()) {
      return;
    }
  }
  if (!ensureToken()) return;
  std::string tz;
  {
    std::lock_guard<std::recursive_mutex> lock(mu_);
    tz = schedule_.timezone;
  }
  util::Logger::i("LIFECYCLE", "DispatchPlan + pré-cache");
  auto dr = client_.getDispatchPlan(client_.token(), tz);
  if (!dr.ok) {
    poll_.onFailure();
    util::Logger::w("DISPATCH", "falhou HTTP " + std::to_string(dr.httpStatus));
    std::lock_guard<std::recursive_mutex> lock(mu_);
    if (plan_.mediaItems.empty() && planSource_ != "EMPTY_PLAN") {
      auto fb = buildFallbackPlan();
      if (!fb.mediaItems.empty()) {
        plan_ = std::move(fb);
        planSource_ = "FALLBACK_LOCAL";
        index_ = 0;
        persistPlan();
        util::Logger::i("DISPATCH", "FALLBACK_LOCAL mix N:1 itens=" +
                                        std::to_string(plan_.mediaItems.size()));
      }
    }
    return;
  }
  std::vector<api::MediaItem> toCache;
  {
    std::lock_guard<std::recursive_mutex> lock(mu_);
    const bool changed = dr.plan.planVersion.empty() || !knownPlanVersion_ ||
                         dr.plan.planVersion != *knownPlanVersion_;
    plan_ = std::move(dr.plan);
    planSource_ = plan_.mediaItems.empty() ? "EMPTY_PLAN" : "ONLINE";
    if (!plan_.planVersion.empty()) knownPlanVersion_ = plan_.planVersion;
    index_ = 0;
    persistPlan();
    toCache = plan_.mediaItems;
    util::Logger::i("DISPATCH",
                    std::string(plan_.mediaItems.empty() ? "EMPTY_PLAN — " : "") +
                        "DispatchPlan recebido — playlist=\"" + plan_.playlistName + "\" itens=" +
                        std::to_string(plan_.mediaItems.size()) + " source=" + planSource_);
    poll_.onDispatchSuccess(!changed, !schedule_.isDisplayActiveNow());
  }
  for (const auto& m : toCache) cache_.ensureLocal(m);
}

void PlayerOrchestrator::playCurrent() {
  api::MediaItem item;
  std::string source;
  std::string playlistName;
  {
    std::lock_guard<std::recursive_mutex> lock(mu_);
    source = planSource_;
    playlistName = plan_.playlistName;
    if (plan_.mediaItems.empty()) {
      item.mediaId.clear();
    } else {
      if (index_ >= plan_.mediaItems.size()) {
        util::Logger::i("PLAYBACK", "Ciclo completo — repetindo fila");
        index_ = 0;
      }
      item = plan_.mediaItems[index_];
      if (!cfg_.acceptImagesInPlaylist && item.mediaType.find("image") != std::string::npos) {
        ++index_;
        return;
      }
    }
  }
  if (item.mediaId.empty() && item.url.empty()) {
    util::Logger::i("PLAYBACK", source + " — plano vazio; aguardar needsDispatch (RN-PAD-001)");
    std::this_thread::sleep_for(std::chrono::seconds(30));
    return;
  }
  const std::string path = cache_.ensureLocal(item);
  if (path.empty()) {
    util::Logger::w("PLAYBACK", "Sem ficheiro local mediaId=" + item.mediaId);
    std::lock_guard<std::recursive_mutex> lock(mu_);
    ++index_;
    return;
  }
  if (cfg_.mediaTransitionEnabled) {
    backend_->playBlackVeil(300);
  }
  util::Logger::i("PLAYBACK", "Início mediaId=" + item.mediaId + " playlist=\"" + playlistName +
                                  "\" source=" + source);
  const bool isHtml = item.mediaType.find("html") != std::string::npos ||
                      item.mediaType.find("web") != std::string::npos;
  const bool isImage = item.mediaType.find("image") != std::string::npos;
  const char* startType = isHtml ? "html_display" : (isImage ? "image_display" : "video_playback_start");
  emitPlaybackEvent(startType, item, nlohmann::json::object());
  const bool started =
      backend_->playFile(path, item.mediaType, item.durationSeconds, cfg_.allowPlaybackAudio);
  if (!started) {
    util::Logger::w("PLAYBACK", "skip item (backend falhou) mediaId=" + item.mediaId);
    std::lock_guard<std::recursive_mutex> lock(mu_);
    ++index_;
    return;
  }
  while (!stop_ && backend_->isPlaying()) {
    util::systemdNotifyWatchdog();
    if (interruptPlayback_) {
      backend_->stop();
      break;
    }
    if (!schedule_.isDisplayActiveNow()) {
      util::Logger::i("DISPLAY", "Fora do horário — saída em preto (player activo)");
      backend_->stop();
      break;
    }
    std::this_thread::sleep_for(std::chrono::milliseconds(200));
  }
  util::Logger::i("PLAYBACK", "Fim mediaId=" + item.mediaId);
  if (!isHtml && !isImage) {
    emitPlaybackEvent("video_playback_end", item, nlohmann::json{{"completed", true}});
  }
  std::lock_guard<std::recursive_mutex> lock(mu_);
  ++index_;
}

void PlayerOrchestrator::playBrandingSplash() {
  const std::string logo = layout_.brandingDir + "/logo.png";
  std::error_code ec;
  if (!fs::exists(logo, ec) || !fs::is_regular_file(logo, ec)) {
    util::Logger::i("BRANDING", "sem " + logo + " — splash omitido (copie com scripts/apply-branding.sh)");
    return;
  }
  util::Logger::i("BRANDING", "splash 3s " + logo);
  backend_->playFile(logo, "image", 3, false);
  while (!stop_ && backend_->isPlaying()) {
    std::this_thread::sleep_for(std::chrono::milliseconds(200));
  }
  backend_->stop();
}

void PlayerOrchestrator::run() {
  util::Logger::i("WATCHDOG",
                  std::string("Loop Player-Linux ") + PLAYER_LINUX_VERSION_STR +
                      " parity AD " + PLAYER_LINUX_PARITY_STR);
  util::systemdNotifyReady();
  playBrandingSplash();
  if (auto remote = client_.fetchPlayerConfig()) {
    if (remote->contains("heartbeatInterval") && (*remote)["heartbeatInterval"].is_number()) {
      int v = (*remote)["heartbeatInterval"].get<int>();
      if (v > 120) v = std::max(15, v / 1000);
      cfg_.batimentoCardiaco = std::max(15, v);
      poll_.replaceConfig(cfg_);
      util::Logger::i("SETUP", "GET /api/player/config heartbeat=" +
                                   std::to_string(cfg_.batimentoCardiaco) + "s");
    }
  }
  tickHeartbeat();
  tickDispatch(true);

  std::thread net([this] { netLoop(); });
  while (!stop_) {
    util::systemdNotifyWatchdog();
    if (ops::takeKioskEscape()) ops::releaseKiosk();
    drainPendingOps();
    if (stop_) break;
    if (!schedule_.isDisplayActiveNow()) {
      util::Logger::i("DISPLAY", "Idle preto — keep-alive");
      const int idleSec = std::max(5, schedule_.keepAliveIntervalMinutes * 60 / 12);
      for (int i = 0; i < idleSec && !stop_; ++i) {
        util::systemdNotifyWatchdog();
        if (ops::takeKioskEscape()) ops::releaseKiosk();
        drainPendingOps();
        if (interruptPlayback_) break;
        std::this_thread::sleep_for(std::chrono::seconds(1));
      }
      continue;
    }
    playCurrent();
  }
  net.join();
}

void PlayerOrchestrator::netLoop() {
  auto nextHb = std::chrono::steady_clock::now();
  auto nextDp = std::chrono::steady_clock::now() + std::chrono::milliseconds(poll_.dispatchIntervalMs());
  while (!stop_) {
    util::systemdNotifyWatchdog();
    const auto now = std::chrono::steady_clock::now();
    if (now >= nextHb) {
      tickHeartbeat();
      nextHb = now + std::chrono::milliseconds(poll_.heartbeatIntervalMs());
    }
    if (now >= nextDp) {
      tickDispatch(false);
      nextDp = now + std::chrono::milliseconds(poll_.dispatchIntervalMs());
    }
    std::this_thread::sleep_for(std::chrono::milliseconds(200));
  }
}

void PlayerOrchestrator::rotateTelemetryIfNeeded() {
  const std::string path = layout_.telemetryDir + "/events-v2.jsonl";
  (void)util::rotateJsonlIfNeeded(path, 8ull * 1024ull * 1024ull);
}

void PlayerOrchestrator::queueOtaInstall(const ops::OtaPackage& pkg, bool rollback) {
  interruptPlayback_ = true;
  std::lock_guard<std::recursive_mutex> lock(mu_);
  if (rollback) {
    pendingOp_ = PendingOp::OtaRollback;
    util::Logger::i("OTA", "rollback em fila — a parar playback");
    return;
  }
  pendingOp_ = PendingOp::OtaInstall;
  pendingOtaVersion_ = pkg.version;
  lastOtaVersion_ = pkg.version;
  util::Logger::i("OTA", "install em fila " + pkg.version + " — a parar playback");
}

void PlayerOrchestrator::drainPendingOps() {
  if (ops::takeKioskEscape()) ops::releaseKiosk();
  PendingOp op = PendingOp::None;
  std::string ver;
  {
    std::lock_guard<std::recursive_mutex> lock(mu_);
    if (pendingOp_ == PendingOp::None && !interruptPlayback_) return;
    op = pendingOp_;
    ver = pendingOtaVersion_;
    pendingOp_ = PendingOp::None;
    interruptPlayback_ = false;
  }
  if (op == PendingOp::None) {
    backend_->stop();
    return;
  }
  backend_->stop();
  if (op == PendingOp::OtaInstall) {
    try {
      ops::installIncomingDeb(layout_.otaDir, ver);
      client_.reportOtaStatus(client_.token(), ver, "up_to_date", ver, "");
    } catch (const std::exception& ex) {
      util::Logger::e("OTA", std::string("install falhou: ") + ex.what());
      client_.reportOtaStatus(client_.token(), PLAYER_LINUX_VERSION_STR, "failed", ver,
                              ex.what());
      return;
    }
    util::Logger::i("OTA", "a sair para systemd relançar o binário novo");
    std::_Exit(0);
  }
  if (op == PendingOp::OtaRollback) {
    try {
      ops::rollbackOta(layout_.otaDir);
      client_.reportOtaStatus(client_.token(), PLAYER_LINUX_VERSION_STR, "rollback", "", "");
    } catch (const std::exception& ex) {
      util::Logger::e("OTA", std::string("rollback falhou: ") + ex.what());
      return;
    }
    std::_Exit(0);
  }
  if (op == PendingOp::Reboot) {
#ifndef _WIN32
    util::Logger::w("REMOTE_CMD", "reboot após parar playback");
    (void)std::system("systemctl reboot || reboot");
#endif
  }
}

void PlayerOrchestrator::emitPlaybackEvent(const std::string& eventType,
                                           const api::MediaItem& item,
                                           const nlohmann::json& extra) {
  nlohmann::json body = extra.is_object() ? extra : nlohmann::json::object();
  body["eventType"] = eventType;
  bool numeric = !item.mediaId.empty() &&
                 std::all_of(item.mediaId.begin(), item.mediaId.end(),
                             [](unsigned char c) { return std::isdigit(c); });
  if (numeric) {
    try {
      body["mediaId"] = std::stoll(item.mediaId);
    } catch (...) {
      numeric = false;
    }
  }
  if (!body.contains("metadata") || !body["metadata"].is_object()) body["metadata"] = nlohmann::json::object();
  body["metadata"]["mediaKey"] = item.mediaId;
  body["metadata"]["mediaType"] = item.mediaType;
  body["metadata"]["planSource"] = planSource_;
  rotateTelemetryIfNeeded();
  const std::string path = layout_.telemetryDir + "/events-v2.jsonl";
  {
    std::ofstream out(path, std::ios::app);
    if (out) out << body.dump() << "\n";
  }
  const std::string tok = client_.token();
  if (!tok.empty()) {
    if (!client_.postEvent(tok, body)) {
      util::Logger::w("TELEMETRY", std::string("POST /api/player/event falhou type=") + eventType);
    }
  }
}

void PlayerOrchestrator::maybeQueueOta(const std::optional<nlohmann::json>& ota) {
  if (!ota) return;
  auto pkg = ops::parseOta(*ota);
  if (!pkg) return;
  if (pkg->version == lastOtaVersion_ || pkg->version == PLAYER_LINUX_VERSION_STR) return;
  const std::string tok = client_.token();
  util::Logger::i("OTA", "heartbeat OTA " + pkg->version);
  client_.reportOtaStatus(tok, PLAYER_LINUX_VERSION_STR, "downloading", pkg->version, "");
  try {
    ops::downloadOtaDeb(*pkg, cfg_.serverUrl, layout_.otaDir, cfg_.uin, tok);
  } catch (const std::exception& ex) {
    util::Logger::e("OTA", std::string("download falhou: ") + ex.what());
    client_.reportOtaStatus(tok, PLAYER_LINUX_VERSION_STR, "failed", pkg->version, ex.what());
    return;
  }
  queueOtaInstall(*pkg, false);
}

api::DispatchPlan PlayerOrchestrator::buildFallbackPlan() const {
  api::DispatchPlan plan;
  const auto ads = listMedia(layout_.propagandasDir);
  const auto vins = listMedia(layout_.vinhetasDir);
  if (ads.empty() && vins.empty()) return plan;

  const int n = std::max(1, cfg_.fallbackPropagandasPerVinheta);
  plan.playlistId = "fallback-local";
  plan.playlistName = "Fallback local " + std::to_string(n) + ":1";
  plan.planVersion = "FALLBACK_LOCAL";

  int order = 1;
  if (vins.empty()) {
    for (const auto& a : ads) plan.mediaItems.push_back(itemFromPath(a, order++));
  } else if (ads.empty()) {
    for (const auto& v : vins) plan.mediaItems.push_back(itemFromPath(v, order++));
  } else {
    size_t ai = 0;
    size_t vi = 0;
    while (ai < ads.size() || vi < vins.size()) {
      for (int k = 0; k < n && ai < ads.size(); ++k) {
        plan.mediaItems.push_back(itemFromPath(ads[ai++], order++));
      }
      if (vi < vins.size()) plan.mediaItems.push_back(itemFromPath(vins[vi++], order++));
    }
  }
  if (!cfg_.acceptImagesInPlaylist) {
    std::vector<api::MediaItem> kept;
    for (auto& m : plan.mediaItems) {
      if (m.mediaType.find("image") == std::string::npos) kept.push_back(std::move(m));
    }
    plan.mediaItems = std::move(kept);
  }
  return plan;
}

}  // namespace player::playback
