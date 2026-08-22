#pragma once

#include <cstdint>
#include <optional>
#include <string>

#include <nlohmann/json.hpp>

namespace player::config {

struct PollAdaptiveConfig {
  bool enabled = true;
  int unchangedStreakBeforeSleep = 2;
  double sleepGrowthFactor = 2.0;
  int maxHeartbeatSeconds = 600;
  int maxDispatchSeconds = 1800;
  int idleHeartbeatSeconds = 120;
  int idleDispatchSeconds = 600;
};

struct PlayerConfig {
  std::string serverUrl = "https://totemdigital.app.br";
  std::string uin;
  std::string deviceId;
  bool acceptImagesInPlaylist = true;
  bool allowPlaybackAudio = false;
  int mediaTransitionEnabled = 1;
  int fallbackPropagandasPerVinheta = 3;
  int batimentoCardiaco = 30;
  int maxSecondsWithoutServerCheck = 180;
  PollAdaptiveConfig pollAdaptive;
  std::string storage = "path_override";
  std::string storagePathOverride;
  int maxCacheSizeMb = 1000;
  std::optional<int> maxCachePercentOfVolume;
  std::string kioskMode = "strong";
  int displayRotation = 0;
  std::string screenOrientation = "portrait";

  static PlayerConfig defaults();
  static PlayerConfig fromJson(const nlohmann::json& j);
  nlohmann::json toJson() const;
  bool isValid() const;
};

PlayerConfig loadPlayerConfig(const std::string& preferredPath, const std::string& fallbackPath);
void savePlayerConfig(const std::string& path, const PlayerConfig& cfg);

}  // namespace player::config
