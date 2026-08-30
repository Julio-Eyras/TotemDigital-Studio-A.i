#pragma once

#include <atomic>
#include <cstddef>
#include <cstdint>
#include <functional>
#include <sstream>
#include <string>
#include <thread>

namespace player::ops {

struct DebugSnapshot {
  std::string version;
  std::string parity;
  std::string uin;
  std::string deviceId;
  std::string serverUrl;
  std::string planSource;
  std::string planVersion;
  std::size_t itemCount = 0;
  std::string lastOta;
};

inline std::string formatDebugOverlay(const DebugSnapshot& s) {
  std::ostringstream o;
  o << "Player debug (3x OK / clique)\n"
    << "version: " << s.version << "\n"
    << "parity: " << s.parity << "\n"
    << "uin: " << s.uin << "\n"
    << "deviceId: " << s.deviceId << "\n"
    << "serverUrl: " << s.serverUrl << "\n"
    << "planSource: " << s.planSource << "\n"
    << "planVersion: " << s.planVersion << "\n"
    << "items: " << s.itemCount << "\n"
    << "lastOta: " << s.lastOta << "\n"
    << "\nSIGUSR1 / kiosk-escape.sh tambem abre. Clique no painel para fechar.\n";
  return o.str();
}

struct TapState {
  int count = 0;
  std::int64_t lastMs = 0;
};

/** 3 toques em 1200 ms (paridade WOS/Tizen / Player-AD). */
inline bool noteDebugTap(TapState& st, std::int64_t nowMs, int required = 3, int windowMs = 1200) {
  st.count = (nowMs - st.lastMs > windowMs) ? 1 : st.count + 1;
  st.lastMs = nowMs;
  if (st.count >= required) {
    st.count = 0;
    return true;
  }
  return false;
}

void requestDebugOverlay();
bool takeDebugOverlay();

class DebugUi {
public:
  void start(std::function<DebugSnapshot()> snap);
  void stop();

private:
  void loop();
  std::function<DebugSnapshot()> snap_;
  std::thread th_;
  std::atomic<bool> running_{false};
};

}  // namespace player::ops
