#include "util/Paths.hpp"

#include <filesystem>
#include <system_error>

namespace fs = std::filesystem;

namespace player::util {

DataLayout resolveDataLayout(const std::string& dataRoot) {
  DataLayout L;
  L.root = dataRoot;
  L.configPath = dataRoot + "/player-config.json";
  L.schedulePath = dataRoot + "/display-schedule.json";
  L.logPath = dataRoot + "/player-linux-operations.log";
  L.lastPlanPath = dataRoot + "/last-dispatch-plan.json";
  L.planSourcePath = dataRoot + "/current-plan-source.txt";
  L.propagandasDir = dataRoot + "/propagandas";
  L.vinhetasDir = dataRoot + "/vinhetas";
  L.metadataPath = L.propagandasDir + "/metadata.json";
  L.telemetryDir = dataRoot + "/telemetry";
  L.receiptsPath = dataRoot + "/remote-command-receipts.json";
  L.otaDir = dataRoot + "/ota";
  L.screenshotsDir = dataRoot + "/screenshots";
  L.brandingDir = dataRoot + "/branding";
  return L;
}

void ensureDirectories(const DataLayout& layout) {
  std::error_code ec;
  fs::create_directories(layout.root, ec);
  fs::create_directories(layout.propagandasDir, ec);
  fs::create_directories(layout.vinhetasDir, ec);
  fs::create_directories(layout.telemetryDir, ec);
  fs::create_directories(layout.otaDir, ec);
  fs::create_directories(layout.screenshotsDir, ec);
  fs::create_directories(layout.brandingDir, ec);
}

}  // namespace player::util
