#pragma once

#include "api/DispatcherClient.hpp"
#include "cache/MediaCache.hpp"
#include "config/DisplaySchedule.hpp"
#include "config/PlayerConfig.hpp"
#include "config/PollAdaptive.hpp"
#include "playback/IMediaBackend.hpp"
#include "remote/CommandExecutor.hpp"
#include "util/Paths.hpp"

#include <atomic>
#include <memory>
#include <optional>
#include <string>

namespace player::playback {

class PlayerOrchestrator {
public:
  PlayerOrchestrator(config::PlayerConfig cfg, util::DataLayout layout);

  void run();  // bloqueante
  void requestStop();

private:
  config::PlayerConfig cfg_;
  util::DataLayout layout_;
  config::DisplaySchedule schedule_;
  config::PollAdaptive poll_;
  api::DispatcherClient client_;
  cache::MediaCache cache_;
  remote::CommandExecutor commands_;
  std::unique_ptr<IMediaBackend> backend_;
  std::atomic<bool> stop_{false};
  std::optional<std::string> knownPlanVersion_;
  api::DispatchPlan plan_;
  std::string planSource_ = "UNAVAILABLE";
  size_t index_ = 0;
  std::string lastOtaVersion_;

  bool ensureToken();
  void tickHeartbeat();
  void tickDispatch(bool force);
  void persistPlan();
  void loadPersistedPlan();
  void playCurrent();
  void maybeApplyOta(const std::optional<nlohmann::json>& ota);
  api::DispatchPlan buildFallbackPlan() const;
};

}  // namespace player::playback
