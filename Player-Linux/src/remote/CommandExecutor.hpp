#pragma once

#include "api/DispatcherClient.hpp"
#include "cache/MediaCache.hpp"
#include "config/DisplaySchedule.hpp"
#include "ops/FieldOps.hpp"
#include "config/PlayerConfig.hpp"
#include "remote/CommandReceipts.hpp"

#include <functional>
#include <string>

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
                  std::string receiptsPath,
                  std::string otaDir,
                  std::string shotsDir);

  void setOnRefreshDispatch(std::function<void()> fn) { onRefreshDispatch_ = std::move(fn); }
  void setOnRestart(RestartFn fn) { onRestart_ = std::move(fn); }
  void setOnQueueOta(std::function<void(ops::OtaPackage, bool rollback)> fn) {
    onQueueOta_ = std::move(fn);
  }
  void setOnReboot(std::function<void()> fn) { onReboot_ = std::move(fn); }

  void handleAll(const std::vector<api::PendingCommand>& cmds, const std::string& token);

private:
  config::PlayerConfig& cfg_;
  config::DisplaySchedule& schedule_;
  std::string schedulePath_;
  std::string configPath_;
  std::string receiptsPath_;
  std::string otaDir_;
  std::string shotsDir_;
  cache::MediaCache& cache_;
  api::DispatcherClient& client_;
  CommandReceipts receipts_;
  std::function<void()> onRefreshDispatch_;
  RestartFn onRestart_;
  std::function<void(ops::OtaPackage, bool rollback)> onQueueOta_;
  std::function<void()> onReboot_;

  void handleOne(const api::PendingCommand& cmd, const std::string& token);
  static std::string apiStatus(const std::string& status);
};

}  // namespace player::remote
