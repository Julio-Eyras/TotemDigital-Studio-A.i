#pragma once

#include <cstdint>
#include <optional>
#include <set>
#include <string>

#include <nlohmann/json.hpp>

namespace player::config {

struct DisplaySchedule {
  bool enabled = false;
  std::string timezone = "America/Sao_Paulo";
  std::set<int> daysOfWeek{0, 1, 2, 3, 4, 5, 6};
  std::string onTime = "08:00";
  std::string offTime = "22:00";
  bool keepAliveWhileOff = true;
  int keepAliveIntervalMinutes = 10;
  std::optional<std::string> forceMode;  // on | off

  static DisplaySchedule fromJson(const nlohmann::json& j);
  nlohmann::json toJson() const;
  bool isDisplayActiveNow(std::int64_t nowMs = -1) const;
  DisplaySchedule withForceMode(std::optional<std::string> mode) const;
};

DisplaySchedule loadSchedule(const std::string& path);
void saveSchedule(const std::string& path, const DisplaySchedule& s);

/** Merge: se servidor não envia forceMode, preservar o local (parity Player-AD 2.13). */
DisplaySchedule mergeFromServer(const DisplaySchedule& local, const nlohmann::json& serverJson);

}  // namespace player::config
