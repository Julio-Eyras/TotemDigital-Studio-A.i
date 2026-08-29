#include "ops/FieldOps.hpp"
#include "config/PlayerConfig.hpp"
#include "playback/PlayerOrchestrator.hpp"
#include "util/Logger.hpp"
#include "util/Paths.hpp"
#include "version.hpp"

#include <cstdlib>
#include <cstring>
#include <iostream>
#include <string>

#ifndef _WIN32
#include <csignal>
#endif

namespace {

player::playback::PlayerOrchestrator* gOrch = nullptr;

#ifndef _WIN32
void onSigUsr1(int) {
  player::ops::releaseKiosk();
}

void onSigTerm(int) {
  if (gOrch) gOrch->requestStop();
}
#endif

void printHelp(const char* argv0) {
  std::cout
      << "Player-Linux " << PLAYER_LINUX_VERSION_STR
      << " (parity Player-AD " << PLAYER_LINUX_PARITY_STR << ")\n"
      << "Uso: " << argv0 << " [--config PATH] [--data-dir PATH]\n"
      << "  --config    player-config.json (default: <data-dir>/player-config.json)\n"
      << "  --data-dir  raiz de dados (default: ./data ou PLAYER_LINUX_DATA)\n";
}

}  // namespace

int main(int argc, char** argv) {
  std::string dataDir;
  std::string configPath;
  if (const char* env = std::getenv("PLAYER_LINUX_DATA")) dataDir = env;

  for (int i = 1; i < argc; ++i) {
    if (std::strcmp(argv[i], "--help") == 0 || std::strcmp(argv[i], "-h") == 0) {
      printHelp(argv[0]);
      return 0;
    }
    if (std::strcmp(argv[i], "--data-dir") == 0 && i + 1 < argc) dataDir = argv[++i];
    else if (std::strcmp(argv[i], "--config") == 0 && i + 1 < argc) configPath = argv[++i];
  }
  if (dataDir.empty()) dataDir = "./data";

  const auto layout = player::util::resolveDataLayout(dataDir);
  player::util::ensureDirectories(layout);
  player::util::Logger::init(layout.logPath);

  const std::string preferred = configPath.empty() ? layout.configPath : configPath;
  const std::string fallbackExample = "config/exemplo-player-config.json";
  auto cfg = player::config::loadPlayerConfig(preferred, fallbackExample);
  if (!cfg.storagePathOverride.empty()) {
    // se config aponta outro root, re-resolver (parity storagePathOverride)
  }
  if (!cfg.isValid()) {
    player::util::Logger::e("SETUP", "Config inválida — preencha serverUrl, uin, deviceId");
    player::util::Logger::e("SETUP", "Copie config/exemplo-player-config.json para " + preferred);
    return 2;
  }
  player::config::savePlayerConfig(layout.configPath, cfg);
  player::ops::applyKiosk(cfg.kioskMode, cfg.displayRotation);
  player::util::Logger::i("SETUP",
                          "Início platform=" PLAYER_LINUX_PLATFORM " version=" PLAYER_LINUX_VERSION_STR
                          " server=" +
                              cfg.serverUrl + " deviceId=" + cfg.deviceId);

#ifndef _WIN32
  std::signal(SIGUSR1, onSigUsr1);
  std::signal(SIGTERM, onSigTerm);
  std::signal(SIGINT, onSigTerm);
#endif

  player::playback::PlayerOrchestrator orch(cfg, layout);
  gOrch = &orch;
  orch.run();
  gOrch = nullptr;
  return 0;
}
