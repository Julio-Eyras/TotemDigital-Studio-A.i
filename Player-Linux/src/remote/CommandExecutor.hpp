#pragma once

#include "api/DispatcherClient.hpp"
#include "cache/MediaCache.hpp"
#include "config/DisplaySchedule.hpp"
#include "config/PlayerConfig.hpp"

#include <functional>
#include <string>
#include <unordered_set>

namespace player::remote {

class CommandExecutor {
public:
  using RestartFn = std::function<void()>;

  CommandExecutor(config::PlayerConfig& cfg,
                  config::DisplaySchedule& schedule,
                  const std::string& schedulePath,
                  const std::string& configPath,
                  cache::MediaCache& cache,
                  api::DispatcherClient& client,
                  std::string receiptsPath);

  void setOnRefreshDispatch(std::function<void()> fn) { onRefreshDispatch_ = std::move(fn); }
  void setOnRestart(RestartFn fn) { onRestart_ = std::move(fn); }

  void handleAll(const std::vector<api::PendingCommand>& cmds, const std::string& token);

private:
  config::PlayerConfig& cfg_;
  config::DisplaySchedule& schedule_;
  std::string schedulePath_;
  std::string configPath_;
  std::string receiptsPath_;
  cache::MediaCache& cache_;
  api::DispatcherClient& client_;
  std::unordered_set<std::string> seenIds_;
  std::function<void()> onRefreshDispatch_;
  RestartFn onRestart_;

  void loadReceipts();
  void saveReceipts();
  void remember(const std::string& id);
  void handleOne(const api::PendingCommand& cmd, const std::string& token);
  static std::string apiStatus(const std::string& status);
};

}  // namespace player::remote
