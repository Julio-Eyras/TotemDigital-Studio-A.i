#ifndef LOGGER_H
#define LOGGER_H

#include <string>
#include <memory>
#include "api/APIClient.h"

enum class LogLevel {
    ERROR = 0,
    WARN = 1,
    INFO = 2,
    DEBUG = 3
};

class Logger {
public:
    Logger(std::shared_ptr<APIClient> apiClient, LogLevel level = LogLevel::INFO);
    void error(const std::string& message, const std::exception& error = std::exception());
    void warn(const std::string& message);
    void info(const std::string& message);
    void debug(const std::string& message);
    void setLevel(LogLevel level);

private:
    std::shared_ptr<APIClient> apiClient;
    LogLevel level;
    bool shouldLog(LogLevel msgLevel);
};

#endif // LOGGER_H

