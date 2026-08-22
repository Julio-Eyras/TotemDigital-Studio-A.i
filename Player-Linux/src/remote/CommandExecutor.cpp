#include "remote/CommandExecutor.hpp"

#include "config/PlayerConfig.hpp"
#include "util/Logger.hpp"

#include <cstdlib>
#include <optional>

namespace player::remote {

CommandExecutor::CommandExecutor(config::PlayerConfig& cfg,
                                 config::DisplaySchedule& schedule,
                                 const std::string& schedulePath,
                                 const std::string& configPath,
                                 cache::MediaCache& cache,
                                 api::DispatcherClient& client)
    : cfg_(cfg),
      schedule_(schedule),
      schedulePath_(schedulePath),
      configPath_(configPath),
      cache_(cache),
      client_(client) {}

void CommandExecutor::handleAll(const std::vector<api::PendingCommand>& cmds, const std::string& token) {
  for (const auto& c : cmds) handleOne(c, token);
}

void CommandExecutor::handleOne(const api::PendingCommand& cmd, const std::string& token) {
  if (cmd.id.empty() || seenIds_.count(cmd.id)) return;
  seenIds_.insert(cmd.id);
  if (seenIds_.size() > 200) seenIds_.clear();

  util::Logger::i("REMOTE_CMD", "type=" + cmd.type + " id=" + cmd.id);
  std::string status = "ok";
  std::string error;
  nlohmann::json result = nlohmann::json::object();

  try {
    if (cmd.type == "purge_cache") {
      cache_.purgeAll();
    } else if (cmd.type == "invalidate_media" || cmd.type == "invalidate_playlist" ||
               cmd.type == "invalidate_campaign") {
      cache_.purgeAll();
      if (onRefreshDispatch_) onRefreshDispatch_();
    } else if (cmd.type == "refresh_dispatch" || cmd.type == "sync_now") {
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
        // preservar credenciais se omitidas
        if (merged.uin.empty()) merged.uin = cfg_.uin;
        if (merged.deviceId.empty()) merged.deviceId = cfg_.deviceId;
        if (merged.serverUrl.empty()) merged.serverUrl = cfg_.serverUrl;
        cfg_ = merged;
        config::savePlayerConfig(configPath_, cfg_);
        util::Logger::i("REMOTE_CMD", "Config remota aplicada");
      }
    } else if (cmd.type == "restart" || cmd.type == "restart_app") {
      if (onRestart_) onRestart_();
    } else if (cmd.type == "reboot" || cmd.type == "reset_board") {
#ifdef _WIN32
      error = "reboot não suportado neste SO de build";
      status = "error";
#else
      util::Logger::w("REMOTE_CMD", "reboot solicitado");
      std::system("systemctl reboot || reboot");
#endif
    } else if (cmd.type == "configure_wifi" || cmd.type == "update" || cmd.type == "ota_rollback" ||
               cmd.type == "capture_screen" || cmd.type == "screenshot") {
      error = "comando fase-2 ainda não implementado no Player-Linux";
      status = "error";
      util::Logger::w("REMOTE_CMD", error + " (" + cmd.type + ")");
    } else {
      error = "tipo desconhecido";
      status = "error";
    }
  } catch (const std::exception& ex) {
    status = "error";
    error = ex.what();
  }

  client_.reportCommandResult(token, cmd.id, status, result, error);
}

}  // namespace player::remote
