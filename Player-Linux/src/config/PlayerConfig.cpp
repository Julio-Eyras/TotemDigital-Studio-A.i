#include "config/PlayerConfig.hpp"

#include <algorithm>
#include <cctype>
#include <fstream>

namespace player::config {

namespace {

int clampInt(int v, int lo, int hi) { return std::max(lo, std::min(hi, v)); }

PollAdaptiveConfig pollFromJson(const nlohmann::json& j) {
  PollAdaptiveConfig p;
  if (!j.is_object()) return p;
  p.enabled = j.value("enabled", true);
  p.unchangedStreakBeforeSleep = clampInt(j.value("unchangedStreakBeforeSleep", 2), 1, 20);
  p.sleepGrowthFactor = std::max(1.1, std::min(4.0, j.value("sleepGrowthFactor", 2.0)));
  p.maxHeartbeatSeconds = clampInt(j.value("maxHeartbeatSeconds", 600), 60, 3600);
  p.maxDispatchSeconds = clampInt(j.value("maxDispatchSeconds", 1800), 120, 7200);
  p.idleHeartbeatSeconds = clampInt(j.value("idleHeartbeatSeconds", 120), 30, 3600);
  p.idleDispatchSeconds = clampInt(j.value("idleDispatchSeconds", 600), 60, 7200);
  return p;
}

}  // namespace

PlayerConfig PlayerConfig::defaults() { return PlayerConfig{}; }

PlayerConfig PlayerConfig::fromJson(const nlohmann::json& j) {
  PlayerConfig c = defaults();
  c.serverUrl = j.value("serverUrl", c.serverUrl);
  c.uin = j.value("uin", c.uin);
  c.deviceId = j.value("deviceId", c.deviceId);
  c.acceptImagesInPlaylist = j.value("acceptImagesInPlaylist", true);
  c.allowPlaybackAudio = j.value("allowPlaybackAudio", false);
  if (j.contains("mediaTransitionEnabled")) {
    if (j["mediaTransitionEnabled"].is_boolean())
      c.mediaTransitionEnabled = j["mediaTransitionEnabled"].get<bool>() ? 1 : 0;
    else
      c.mediaTransitionEnabled = j.value("mediaTransitionEnabled", 1);
  }
  c.fallbackPropagandasPerVinheta = std::max(1, j.value("fallbackPropagandasPerVinheta", 3));
  c.batimentoCardiaco = std::max(15, j.value("batimentoCardiaco", 30));
  c.maxSecondsWithoutServerCheck = std::max(30, j.value("maxSecondsWithoutServerCheck", 180));
  if (j.contains("pollAdaptive")) c.pollAdaptive = pollFromJson(j["pollAdaptive"]);
  c.storage = j.value("storage", c.storage);
  c.storagePathOverride = j.value("storagePathOverride", "");
  c.maxCacheSizeMb = clampInt(j.value("maxCacheSizeMb", 1000), 50, 8192);
  if (j.contains("maxCachePercentOfVolume") && !j["maxCachePercentOfVolume"].is_null())
    c.maxCachePercentOfVolume = j["maxCachePercentOfVolume"].get<int>();
  c.kioskMode = j.value("kioskMode", "strong");
  c.displayRotation = clampInt(j.value("displayRotation", 0), 0, 3);
  c.screenOrientation = j.value("screenOrientation", "portrait");
  // Normalizar deviceId uppercase (parity Android)
  for (char& ch : c.deviceId) ch = static_cast<char>(std::toupper(static_cast<unsigned char>(ch)));
  while (!c.serverUrl.empty() && c.serverUrl.back() == '/') c.serverUrl.pop_back();
  return c;
}

nlohmann::json PlayerConfig::toJson() const {
  nlohmann::json j;
  j["serverUrl"] = serverUrl;
  j["uin"] = uin;
  j["deviceId"] = deviceId;
  j["acceptImagesInPlaylist"] = acceptImagesInPlaylist;
  j["allowPlaybackAudio"] = allowPlaybackAudio;
  j["mediaTransitionEnabled"] = mediaTransitionEnabled;
  j["fallbackPropagandasPerVinheta"] = fallbackPropagandasPerVinheta;
  j["batimentoCardiaco"] = batimentoCardiaco;
  j["maxSecondsWithoutServerCheck"] = maxSecondsWithoutServerCheck;
  j["pollAdaptive"] = {
      {"enabled", pollAdaptive.enabled},
      {"unchangedStreakBeforeSleep", pollAdaptive.unchangedStreakBeforeSleep},
      {"sleepGrowthFactor", pollAdaptive.sleepGrowthFactor},
      {"maxHeartbeatSeconds", pollAdaptive.maxHeartbeatSeconds},
      {"maxDispatchSeconds", pollAdaptive.maxDispatchSeconds},
      {"idleHeartbeatSeconds", pollAdaptive.idleHeartbeatSeconds},
      {"idleDispatchSeconds", pollAdaptive.idleDispatchSeconds},
  };
  j["storage"] = storage;
  j["storagePathOverride"] = storagePathOverride;
  j["maxCacheSizeMb"] = maxCacheSizeMb;
  if (maxCachePercentOfVolume) j["maxCachePercentOfVolume"] = *maxCachePercentOfVolume;
  else j["maxCachePercentOfVolume"] = nullptr;
  j["kioskMode"] = kioskMode;
  j["displayRotation"] = displayRotation;
  j["screenOrientation"] = screenOrientation;
  return j;
}

bool PlayerConfig::isValid() const {
  return !serverUrl.empty() && !uin.empty() && !deviceId.empty();
}

PlayerConfig loadPlayerConfig(const std::string& preferredPath, const std::string& fallbackPath) {
  for (const auto& path : {preferredPath, fallbackPath}) {
    if (path.empty()) continue;
    std::ifstream in(path);
    if (!in) continue;
    try {
      nlohmann::json j;
      in >> j;
      return PlayerConfig::fromJson(j);
    } catch (...) {
      continue;
    }
  }
  return PlayerConfig::defaults();
}

void savePlayerConfig(const std::string& path, const PlayerConfig& cfg) {
  std::ofstream out(path);
  if (!out) return;
  out << cfg.toJson().dump(2);
}

}  // namespace player::config
