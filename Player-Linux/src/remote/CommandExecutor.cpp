#include "remote/CommandExecutor.hpp"

#include "config/PlayerConfig.hpp"
#include "ops/FieldOps.hpp"
#include "util/Logger.hpp"
#include "version.hpp"

#include <cstdlib>
#include <fstream>
#include <optional>
#include <stdexcept>

#include <nlohmann/json.hpp>

namespace player::remote {

namespace {

const char* NON_RETRYABLE[] = {
    "restart",         "restart_app",      "reboot",       "reset_board",
    "config",          "apply_player_config", "configure_wifi", "purge_cache",
    "invalidate_media", "invalidate_playlist", "invalidate_campaign",
    "screenshot",      "capture_screen", "update", "ota_rollback",
};

bool isNonRetryable(const std::string& type) {
  for (const char* t : NON_RETRYABLE) {
    if (type == t) return true;
  }
  return false;
}

}  // namespace

CommandExecutor::CommandExecutor(config::PlayerConfig& cfg,
                                 config::DisplaySchedule& schedule,
                                 const std::string& schedulePath,
                                 const std::string& configPath,
                                 cache::MediaCache& cache,
                                 api::DispatcherClient& client,
                                 std::string receiptsPath,
                                 std::string otaDir,
                                 std::string shotsDir)
    : cfg_(cfg),
      schedule_(schedule),
      schedulePath_(schedulePath),
      configPath_(configPath),
      receiptsPath_(std::move(receiptsPath)),
      otaDir_(std::move(otaDir)),
      shotsDir_(std::move(shotsDir)),
      cache_(cache),
      client_(client) {
  loadReceipts();
}

void CommandExecutor::loadReceipts() {
  std::ifstream in(receiptsPath_);
  if (!in) return;
  try {
    nlohmann::json j;
    in >> j;
    if (j.is_array()) {
      for (const auto& v : j) {
        if (v.is_string()) seenIds_.insert(v.get<std::string>());
      }
    }
  } catch (...) {
  }
}

void CommandExecutor::saveReceipts() {
  nlohmann::json arr = nlohmann::json::array();
  for (const auto& id : seenIds_) arr.push_back(id);
  std::ofstream out(receiptsPath_);
  if (out) out << arr.dump();
}

void CommandExecutor::remember(const std::string& id) {
  seenIds_.insert(id);
  if (seenIds_.size() > 200) seenIds_.clear();
  saveReceipts();
}

std::string CommandExecutor::apiStatus(const std::string& status) {
  if (status == "failed" || status == "error") return "failed";
  return "completed";
}

void CommandExecutor::handleAll(const std::vector<api::PendingCommand>& cmds, const std::string& token) {
  for (const auto& c : cmds) handleOne(c, token);
}

void CommandExecutor::handleOne(const api::PendingCommand& cmd, const std::string& token) {
  if (cmd.id.empty()) return;
  if (seenIds_.count(cmd.id)) {
    client_.reportCommandResult(token, cmd.id, "completed",
                                nlohmann::json{{"duplicate", true}, {"alreadyProcessed", true}}, "");
    return;
  }

  util::Logger::i("REMOTE_CMD", "type=" + cmd.type + " id=" + cmd.id);
  std::string status = "completed";
  std::string error;
  nlohmann::json result = nlohmann::json::object();
  const bool before = isNonRetryable(cmd.type);
  if (before) remember(cmd.id);

  try {
    if (cmd.type == "purge_cache") {
      cache_.purgeAll();
    } else if (cmd.type == "invalidate_media" || cmd.type == "invalidate_playlist" ||
               cmd.type == "invalidate_campaign") {
      cache_.purgeAll();
      if (onRefreshDispatch_) onRefreshDispatch_();
    } else if (cmd.type == "refresh_dispatch" || cmd.type == "sync_now" ||
               cmd.type == "content_version_check") {
      if (onRefreshDispatch_) onRefreshDispatch_();
    } else if (cmd.type == "display_force_on") {
      schedule_ = schedule_.withForceMode("on");
      config::saveSchedule(schedulePath_, schedule_);
    } else if (cmd.type == "display_force_off") {
      schedule_ = schedule_.withForceMode("off");
      config::saveSchedule(schedulePath_, schedule_);
    } else if (cmd.type == "display_force_clear") {
      schedule_ = schedule_.withForceMode(std::nullopt);
      config::saveSchedule(schedulePath_, schedule_);
    } else if (cmd.type == "apply_player_config" || cmd.type == "config") {
      if (cmd.data.is_object()) {
        auto merged = config::PlayerConfig::fromJson(cmd.data);
        if (merged.uin.empty()) merged.uin = cfg_.uin;
        if (merged.deviceId.empty()) merged.deviceId = cfg_.deviceId;
        if (merged.serverUrl.empty()) merged.serverUrl = cfg_.serverUrl;
        cfg_ = merged;
        config::savePlayerConfig(configPath_, cfg_);
        ops::applyKiosk(cfg_.kioskMode, cfg_.displayRotation);
        util::Logger::i("REMOTE_CMD", "Config remota aplicada");
      }
    } else if (cmd.type == "restart" || cmd.type == "restart_app") {
      client_.reportCommandResult(token, cmd.id, "completed", result, "");
      if (onRestart_) onRestart_();
      return;
    } else if (cmd.type == "reboot" || cmd.type == "reset_board") {
      client_.reportCommandResult(token, cmd.id, "completed", result, "");
#ifdef _WIN32
      util::Logger::w("REMOTE_CMD", "reboot não suportado neste SO de build");
#else
      util::Logger::w("REMOTE_CMD", "reboot solicitado");
      std::system("systemctl reboot || reboot");
#endif
      return;
    } else if (cmd.type == "configure_wifi") {
      result = ops::configureWifi(cmd.data);
    } else if (cmd.type == "capture_screen" || cmd.type == "screenshot") {
      result = ops::captureScreenshot(shotsDir_);
    } else if (cmd.type == "update") {
      auto pkg = ops::parseOta(cmd.data.contains("otaUpdate") ? cmd.data["otaUpdate"] : cmd.data);
      if (!pkg) throw std::runtime_error("payload OTA inválido");
      client_.reportCommandResult(token, cmd.id, "completed",
                                  nlohmann::json{{"accepted", true}, {"version", pkg->version}}, "");
      client_.reportOtaStatus(token, PLAYER_LINUX_VERSION_STR, "downloading", pkg->version, "");
      try {
        result = ops::applyOta(*pkg, cfg_.serverUrl, otaDir_, cfg_.uin, token);
        client_.reportOtaStatus(token, pkg->version, "up_to_date", pkg->version, "");
      } catch (const std::exception& ex) {
        client_.reportOtaStatus(token, PLAYER_LINUX_VERSION_STR, "failed", pkg->version, ex.what());
        throw;
      }
      return;
    } else if (cmd.type == "ota_rollback") {
      client_.reportCommandResult(token, cmd.id, "completed", nlohmann::json{{"accepted", true}}, "");
      result = ops::rollbackOta(otaDir_);
      client_.reportOtaStatus(token, PLAYER_LINUX_VERSION_STR, "rollback", "", "");
      client_.reportCommandResult(token, cmd.id, "completed", result, "");
      return;
    } else {
      error = "tipo desconhecido";
      status = "failed";
    }
  } catch (const std::exception& ex) {
    status = "failed";
    error = ex.what();
  }

  if (!before) remember(cmd.id);
  client_.reportCommandResult(token, cmd.id, apiStatus(status), result, error);
}

}  // namespace player::remote
