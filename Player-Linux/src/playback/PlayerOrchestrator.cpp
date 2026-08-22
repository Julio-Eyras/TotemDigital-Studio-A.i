#include "playback/PlayerOrchestrator.hpp"

#include "util/Logger.hpp"
#include "version.hpp"

#include <chrono>
#include <fstream>
#include <thread>

namespace player::playback {

PlayerOrchestrator::PlayerOrchestrator(config::PlayerConfig cfg, util::DataLayout layout)
    : cfg_(std::move(cfg)),
      layout_(std::move(layout)),
      schedule_(config::loadSchedule(layout_.schedulePath)),
      poll_(cfg_),
      client_(cfg_),
      cache_(cfg_, layout_.propagandasDir, layout_.metadataPath),
      commands_(cfg_, schedule_, layout_.schedulePath, layout_.configPath, cache_, client_),
      backend_(createMediaBackend()) {
  commands_.setOnRefreshDispatch([this] { tickDispatch(true); });
  commands_.setOnRestart([this] {
    util::Logger::w("WATCHDOG", "restart_app pedido");
    stop_ = true;
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
  auto hb = client_.heartbeatOrSync(client_.token(), knownPlanVersion_);
  if (!hb.ok) {
    if (hb.httpStatus == 401) {
      client_.setToken("");
      ensureToken();
    }
    poll_.onFailure();
    util::Logger::w("HEARTBEAT", "falhou HTTP " + std::to_string(hb.httpStatus));
    return;
  }
  if (hb.displaySchedule) {
    schedule_ = config::mergeFromServer(schedule_, *hb.displaySchedule);
    config::saveSchedule(layout_.schedulePath, schedule_);
    util::Logger::i(
        "DISPLAY",
        "Schedule atualizado enabled=" + std::string(schedule_.enabled ? "true" : "false") + " " +
            schedule_.onTime + "-" + schedule_.offTime +
            (schedule_.forceMode ? (" force=" + *schedule_.forceMode) : ""));
  }
  commands_.handleAll(hb.pendingCommands, client_.token());
  const bool unchanged =
      hb.planVersion && knownPlanVersion_ && *hb.planVersion == *knownPlanVersion_;
  const bool idle = !schedule_.isDisplayActiveNow();
  poll_.onHeartbeatSuccess(unchanged, idle);
  util::Logger::i("HEARTBEAT",
                  std::string("OK — próximo em ") + std::to_string(poll_.heartbeatIntervalMs() / 1000) +
                      "s needsDispatch=" + (hb.needsDispatch ? "true" : "false") +
                      " idle=" + (idle ? "true" : "false"));
  if (hb.needsDispatch) tickDispatch(true);
}

void PlayerOrchestrator::tickDispatch(bool force) {
  if (!force && !plan_.mediaItems.empty()) {
    // safety path still allowed by caller
  }
  if (!ensureToken()) return;
  util::Logger::i("LIFECYCLE", "DispatchPlan + pré-cache");
  auto dr = client_.getDispatchPlan(client_.token(), schedule_.timezone);
  if (!dr.ok) {
    poll_.onFailure();
    util::Logger::w("DISPATCH", "falhou HTTP " + std::to_string(dr.httpStatus));
    return;
  }
  const bool changed = dr.plan.planVersion.empty() || !knownPlanVersion_ ||
                       dr.plan.planVersion != *knownPlanVersion_;
  plan_ = std::move(dr.plan);
  planSource_ = "ONLINE";
  if (!plan_.planVersion.empty()) knownPlanVersion_ = plan_.planVersion;
  index_ = 0;
  persistPlan();
  util::Logger::i("DISPATCH",
                  "DispatchPlan recebido — playlist=\"" + plan_.playlistName + "\" itens=" +
                      std::to_string(plan_.mediaItems.size()) + " source=ONLINE");
  for (const auto& m : plan_.mediaItems) cache_.ensureLocal(m);
  poll_.onDispatchSuccess(!changed, !schedule_.isDisplayActiveNow());
}

void PlayerOrchestrator::playCurrent() {
  if (plan_.mediaItems.empty()) {
    util::Logger::w("PLAYBACK", "Plano vazio — aguardar dispatch");
    std::this_thread::sleep_for(std::chrono::seconds(5));
    tickDispatch(true);
    return;
  }
  if (index_ >= plan_.mediaItems.size()) {
    util::Logger::i("PLAYBACK", "Ciclo completo — repetindo fila");
    index_ = 0;
  }
  auto item = plan_.mediaItems[index_];
  if (!cfg_.acceptImagesInPlaylist && item.mediaType.find("image") != std::string::npos) {
    ++index_;
    return;
  }
  const std::string path = cache_.ensureLocal(item);
  if (path.empty()) {
    util::Logger::w("PLAYBACK", "Sem ficheiro local mediaId=" + item.mediaId);
    ++index_;
    return;
  }
  util::Logger::i("PLAYBACK", "Início mediaId=" + item.mediaId + " playlist=\"" + plan_.playlistName + "\"");
  backend_->playFile(path, item.mediaType, item.durationSeconds, cfg_.allowPlaybackAudio);
  while (!stop_ && backend_->isPlaying()) {
    if (!schedule_.isDisplayActiveNow()) {
      util::Logger::i("DISPLAY", "Fora do horário — saída em preto (player activo)");
      backend_->stop();
      break;
    }
    std::this_thread::sleep_for(std::chrono::milliseconds(200));
  }
  util::Logger::i("PLAYBACK", "Fim mediaId=" + item.mediaId);
  ++index_;
}

void PlayerOrchestrator::run() {
  util::Logger::i("WATCHDOG",
                  std::string("Loop Player-Linux ") + PLAYER_LINUX_VERSION_STR +
                      " parity AD " + PLAYER_LINUX_PARITY_STR);
  tickHeartbeat();
  tickDispatch(true);

  auto nextHb = std::chrono::steady_clock::now();
  auto nextDp = std::chrono::steady_clock::now() + std::chrono::milliseconds(poll_.dispatchIntervalMs());

  while (!stop_) {
    const auto now = std::chrono::steady_clock::now();
    if (now >= nextHb) {
      tickHeartbeat();
      nextHb = now + std::chrono::milliseconds(poll_.heartbeatIntervalMs());
    }
    if (now >= nextDp) {
      tickDispatch(false);
      nextDp = now + std::chrono::milliseconds(poll_.dispatchIntervalMs());
    }

    if (!schedule_.isDisplayActiveNow()) {
      util::Logger::i("DISPLAY", "Idle preto — keep-alive");
      std::this_thread::sleep_for(std::chrono::seconds(
          std::max(5, schedule_.keepAliveIntervalMinutes * 60 / 12)));
      continue;
    }
    playCurrent();
  }
}

}  // namespace player::playback
