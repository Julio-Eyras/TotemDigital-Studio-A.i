#include "config/PollAdaptive.hpp"

#include <algorithm>
#include <cmath>

namespace player::config {

PollAdaptive::PollAdaptive(const PlayerConfig& cfg)
    : cfg_(cfg),
      heartbeatMs_(cfg.batimentoCardiaco * 1000),
      dispatchMs_(cfg.maxSecondsWithoutServerCheck * 1000) {}

void PollAdaptive::wake() {
  hbStreak_ = 0;
  dpStreak_ = 0;
  heartbeatMs_ = cfg_.batimentoCardiaco * 1000;
  dispatchMs_ = cfg_.maxSecondsWithoutServerCheck * 1000;
}

void PollAdaptive::onFailure() {
  heartbeatMs_ = std::min(heartbeatMs_ * 2, cfg_.pollAdaptive.maxHeartbeatSeconds * 1000);
  dispatchMs_ = std::min(dispatchMs_ * 2, cfg_.pollAdaptive.maxDispatchSeconds * 1000);
  hbStreak_ = 0;
  dpStreak_ = 0;
}

void PollAdaptive::onHeartbeatSuccess(bool unchanged, bool idle) {
  if (!cfg_.pollAdaptive.enabled) {
    heartbeatMs_ = (idle ? cfg_.pollAdaptive.idleHeartbeatSeconds : cfg_.batimentoCardiaco) * 1000;
    return;
  }
  if (idle) {
    heartbeatMs_ = cfg_.pollAdaptive.idleHeartbeatSeconds * 1000;
    hbStreak_ = 0;
    return;
  }
  if (unchanged) {
    ++hbStreak_;
    if (hbStreak_ >= cfg_.pollAdaptive.unchangedStreakBeforeSleep) {
      heartbeatMs_ = static_cast<int>(std::min(
          heartbeatMs_ * cfg_.pollAdaptive.sleepGrowthFactor,
          static_cast<double>(cfg_.pollAdaptive.maxHeartbeatSeconds * 1000)));
    }
  } else {
    wake();
  }
}

void PollAdaptive::onDispatchSuccess(bool unchanged, bool idle) {
  if (!cfg_.pollAdaptive.enabled) {
    dispatchMs_ = (idle ? cfg_.pollAdaptive.idleDispatchSeconds : cfg_.maxSecondsWithoutServerCheck) * 1000;
    return;
  }
  if (idle) {
    dispatchMs_ = cfg_.pollAdaptive.idleDispatchSeconds * 1000;
    dpStreak_ = 0;
    return;
  }
  if (unchanged) {
    ++dpStreak_;
    if (dpStreak_ >= cfg_.pollAdaptive.unchangedStreakBeforeSleep) {
      dispatchMs_ = static_cast<int>(std::min(
          dispatchMs_ * cfg_.pollAdaptive.sleepGrowthFactor,
          static_cast<double>(cfg_.pollAdaptive.maxDispatchSeconds * 1000)));
    }
  } else {
    dpStreak_ = 0;
    dispatchMs_ = cfg_.maxSecondsWithoutServerCheck * 1000;
  }
}

}  // namespace player::config
