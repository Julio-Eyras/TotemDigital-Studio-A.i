#pragma once

#include "config/PlayerConfig.hpp"

namespace player::config {

/** Intervalos de poll com sonolência / idle — parity AdaptivePollScheduler. */
class PollAdaptive {
public:
  explicit PollAdaptive(const PlayerConfig& cfg);

  void onHeartbeatSuccess(bool unchanged, bool idle);
  void onDispatchSuccess(bool unchanged, bool idle);
  void onFailure();
  void wake();
  void replaceConfig(const PlayerConfig& cfg);

  int heartbeatIntervalMs() const { return heartbeatMs_; }
  int dispatchIntervalMs() const { return dispatchMs_; }

private:
  PlayerConfig cfg_;
  int heartbeatMs_;
  int dispatchMs_;
  int hbStreak_ = 0;
  int dpStreak_ = 0;
};

}  // namespace player::config
