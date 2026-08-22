#pragma once

#include <string>

namespace player::util {

enum class LogLevel { Info, Warn, Error };

class Logger {
public:
  static void init(const std::string& logFilePath);
  static void i(const std::string& category, const std::string& message);
  static void w(const std::string& category, const std::string& message);
  static void e(const std::string& category, const std::string& message);

private:
  static void write(LogLevel level, const std::string& category, const std::string& message);
  static std::string logPath_;
};

}  // namespace player::util
