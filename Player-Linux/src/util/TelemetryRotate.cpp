#include "util/TelemetryRotate.hpp"

#include <filesystem>

namespace fs = std::filesystem;

namespace player::util {

bool rotateJsonlIfNeeded(const std::string& path, std::uintmax_t maxBytes) {
  std::error_code ec;
  if (!fs::exists(path, ec)) return false;
  const auto sz = fs::file_size(path, ec);
  if (ec || sz < maxBytes) return false;
  fs::rename(path, path + ".1", ec);
  return !ec;
}

}  // namespace player::util
