#pragma once

#include "ops/FieldOps.hpp"
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
#include <mutex>
#include <optional>
#include <string>
#include <thread>

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
  std::recursive_mutex mu_;
  std::optional<std::string> knownPlanVersion_;
  api::DispatchPlan plan_;
  std::string planSource_ = "UNAVAILABLE";
  size_t index_ = 0;
  std::string lastOtaVersion_;
  std::atomic<bool> interruptPlayback_{false};
  enum class PendingOp { None, OtaInstall, OtaRollback, Reboot };
  PendingOp pendingOp_{PendingOp::None};
  std::string pendingOtaVersion_;

  bool ensureToken();
  void tickHeartbeat();
  void tickDispatch(bool force);
  void persistPlan();
  void loadPersistedPlan();
  void playCurrent();
  void playBrandingSplash();
  void netLoop();
  void drainPendingOps();
  void queueOtaInstall(const ops::OtaPackage& pkg, bool rollback);
  void rotateTelemetryIfNeeded();
  void emitPlaybackEvent(const std::string& eventType,
                         const api::MediaItem& item,
                         const nlohmann::json& extra);
  void maybeQueueOta(const std::optional<nlohmann::json>& ota);
  api::DispatchPlan buildFallbackPlan() const;
};

}  // namespace player::playback
