#pragma once

#include <string>

namespace player::util {

struct DataLayout {
  std::string root;
  std::string configPath;
  std::string schedulePath;
  std::string logPath;
  std::string lastPlanPath;
  std::string planSourcePath;
  std::string propagandasDir;
  std::string vinhetasDir;
  std::string metadataPath;
  std::string telemetryDir;
};

DataLayout resolveDataLayout(const std::string& dataRoot);
void ensureDirectories(const DataLayout& layout);

}  // namespace player::util
