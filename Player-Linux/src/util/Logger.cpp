#include "util/Logger.hpp"

#include <chrono>
#include <ctime>
#include <fstream>
#include <iostream>
#include <mutex>
#include <sstream>

namespace player::util {

std::string Logger::logPath_;
static std::mutex g_logMutex;

void Logger::init(const std::string& logFilePath) {
  logPath_ = logFilePath;
  i("LOG", "Logger iniciado → " + logPath_);
}

void Logger::i(const std::string& category, const std::string& message) {
  write(LogLevel::Info, category, message);
}
void Logger::w(const std::string& category, const std::string& message) {
  write(LogLevel::Warn, category, message);
}
void Logger::e(const std::string& category, const std::string& message) {
  write(LogLevel::Error, category, message);
}

void Logger::write(LogLevel level, const std::string& category, const std::string& message) {
  const char* tag = level == LogLevel::Info ? "I" : (level == LogLevel::Warn ? "W" : "E");
  using clock = std::chrono::system_clock;
  const auto now = clock::now();
  const auto ms = std::chrono::duration_cast<std::chrono::milliseconds>(now.time_since_epoch()) % 1000;
  std::time_t t = clock::to_time_t(now);
  std::tm tm{};
#ifdef _WIN32
  localtime_s(&tm, &t);
#else
  localtime_r(&t, &tm);
#endif
  char buf[64];
  std::strftime(buf, sizeof(buf), "%Y-%m-%d %H:%M:%S", &tm);
  std::ostringstream line;
  line << buf << '.' << (ms.count() < 100 ? (ms.count() < 10 ? "00" : "0") : "") << ms.count()
       << " [" << tag << "] [" << category << "] " << message;

  std::lock_guard<std::mutex> lock(g_logMutex);
  std::cout << "Player-Linux: " << line.str() << std::endl;
  if (!logPath_.empty()) {
    std::ofstream out(logPath_, std::ios::app);
    if (out) out << line.str() << '\n';
  }
}

}  // namespace player::util
