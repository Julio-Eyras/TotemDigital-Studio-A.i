#include "config/DisplaySchedule.hpp"

#include <chrono>
#include <fstream>
#include <sstream>

namespace player::config {

namespace {

int parseHmToMinutes(const std::string& hm) {
  if (hm.size() < 4) return 0;
  const auto colon = hm.find(':');
  if (colon == std::string::npos) return 0;
  int h = std::atoi(hm.substr(0, colon).c_str());
  int m = std::atoi(hm.substr(colon + 1).c_str());
  return h * 60 + m;
}

}  // namespace

DisplaySchedule DisplaySchedule::fromJson(const nlohmann::json& j) {
  DisplaySchedule s;
  if (!j.is_object()) return s;
  s.enabled = j.value("enabled", false);
  s.timezone = j.value("timezone", "America/Sao_Paulo");
  s.daysOfWeek.clear();
  if (j.contains("daysOfWeek") && j["daysOfWeek"].is_array()) {
    for (const auto& d : j["daysOfWeek"]) {
      int v = d.get<int>();
      if (v >= 0 && v <= 6) s.daysOfWeek.insert(v);
    }
  }
  if (s.daysOfWeek.empty()) s.daysOfWeek = {0, 1, 2, 3, 4, 5, 6};
  s.onTime = j.value("onTime", "08:00");
  s.offTime = j.value("offTime", "22:00");
  s.keepAliveWhileOff = j.value("keepAliveWhileOff", true);
  s.keepAliveIntervalMinutes = std::max(5, std::min(30, j.value("keepAliveIntervalMinutes", 10)));
  if (j.contains("forceMode") && !j["forceMode"].is_null()) {
    const auto fm = j["forceMode"].get<std::string>();
    if (fm == "on" || fm == "off") s.forceMode = fm;
  }
  return s;
}

nlohmann::json DisplaySchedule::toJson() const {
  nlohmann::json days = nlohmann::json::array();
  for (int d : daysOfWeek) days.push_back(d);
  nlohmann::json j = {
      {"enabled", enabled},
      {"timezone", timezone},
      {"daysOfWeek", days},
      {"onTime", onTime},
      {"offTime", offTime},
      {"keepAliveWhileOff", keepAliveWhileOff},
      {"keepAliveIntervalMinutes", keepAliveIntervalMinutes},
  };
  if (forceMode) j["forceMode"] = *forceMode;
  else j["forceMode"] = nullptr;
  return j;
}

DisplaySchedule DisplaySchedule::withForceMode(std::optional<std::string> mode) const {
  DisplaySchedule c = *this;
  c.forceMode = std::move(mode);
  return c;
}

bool DisplaySchedule::isDisplayActiveNow(std::int64_t nowMs) const {
  if (forceMode && *forceMode == "on") return true;
  if (forceMode && *forceMode == "off") return false;
  if (!enabled) return true;

  using namespace std::chrono;
  system_clock::time_point tp;
  if (nowMs < 0) tp = system_clock::now();
  else tp = system_clock::time_point(milliseconds(nowMs));
  const std::time_t t = system_clock::to_time_t(tp);
  std::tm tm{};
#ifdef _WIN32
  localtime_s(&tm, &t);
#else
  localtime_r(&t, &tm);
#endif
  // tm_wday: 0=Sunday … 6=Saturday — igual ao JS getDay / Player-AD
  const int dayJs = tm.tm_wday;
  if (daysOfWeek.find(dayJs) == daysOfWeek.end()) return false;

  const int nowMins = tm.tm_hour * 60 + tm.tm_min;
  const int on = parseHmToMinutes(onTime);
  const int off = parseHmToMinutes(offTime);
  if (on == off) return true;
  if (on < off) return nowMins >= on && nowMins < off;
  // atravessa meia-noite
  return nowMins >= on || nowMins < off;
}

DisplaySchedule loadSchedule(const std::string& path) {
  std::ifstream in(path);
  if (!in) return DisplaySchedule{};
  try {
    nlohmann::json j;
    in >> j;
    return DisplaySchedule::fromJson(j);
  } catch (...) {
    return DisplaySchedule{};
  }
}

void saveSchedule(const std::string& path, const DisplaySchedule& s) {
  std::ofstream out(path);
  if (!out) return;
  out << s.toJson().dump(2);
}

DisplaySchedule mergeFromServer(const DisplaySchedule& local, const nlohmann::json& serverJson) {
  DisplaySchedule incoming = DisplaySchedule::fromJson(serverJson);
  if (!serverJson.contains("forceMode") || serverJson["forceMode"].is_null()) {
    incoming.forceMode = local.forceMode;
  }
  return incoming;
}

}  // namespace player::config
