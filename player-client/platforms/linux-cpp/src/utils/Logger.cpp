#include "utils/Logger.h"
#include <iostream>
#include <ctime>
#include <iomanip>
#include <sstream>

Logger::Logger(std::shared_ptr<APIClient> apiClient, LogLevel level)
    : apiClient(apiClient), level(level) {
}

void Logger::error(const std::string& message, const std::exception& error) {
    if (shouldLog(LogLevel::ERROR)) {
        std::cerr << "[ERROR] " << message;
        try {
            std::string what = error.what();
            if (!what.empty()) {
                std::cerr << ": " << what;
            }
        } catch (...) {
            // Ignorar se error.what() falhar
        }
        std::cerr << std::endl;

        // Enviar ao backend
        if (apiClient) {
            std::string stack = ""; // Stack trace não disponível em C++
            Json::Value metadata;
            apiClient->sendErrorLog(message, stack, metadata);
        }
    }
}

void Logger::warn(const std::string& message) {
    if (shouldLog(LogLevel::WARN)) {
        std::cout << "[WARN] " << message << std::endl;
    }
}

void Logger::info(const std::string& message) {
    if (shouldLog(LogLevel::INFO)) {
        std::cout << "[INFO] " << message << std::endl;
    }
}

void Logger::debug(const std::string& message) {
    if (shouldLog(LogLevel::DEBUG)) {
        std::cout << "[DEBUG] " << message << std::endl;
    }
}

bool Logger::shouldLog(LogLevel msgLevel) {
    return static_cast<int>(msgLevel) <= static_cast<int>(level);
}

void Logger::setLevel(LogLevel newLevel) {
    level = newLevel;
}

