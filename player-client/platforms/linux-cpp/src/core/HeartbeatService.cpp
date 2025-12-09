#include "core/HeartbeatService.h"
#include <iostream>
#include <chrono>
#include <unistd.h>
#include <sys/resource.h>

HeartbeatService::HeartbeatService(std::shared_ptr<APIClient> apiClient, long interval)
    : apiClient(apiClient), interval(interval), running(false), lastHeartbeat(0), consecutiveFailures(0) {
}

HeartbeatService::~HeartbeatService() {
    stop();
}

void HeartbeatService::start() {
    if (running) {
        return;
    }

    running = true;
    heartbeatThread = std::thread(&HeartbeatService::heartbeatLoop, this);
}

void HeartbeatService::stop() {
    if (!running) {
        return;
    }

    running = false;
    if (heartbeatThread.joinable()) {
        heartbeatThread.join();
    }
}

void HeartbeatService::heartbeatLoop() {
    sendHeartbeat(); // Enviar imediatamente

    while (running) {
        std::this_thread::sleep_for(std::chrono::milliseconds(interval));
        if (running) {
            sendHeartbeat();
        }
    }
}

void HeartbeatService::sendHeartbeat() {
    try {
        Json::Value data;
        data["status"] = "online";
        data["timestamp"] = std::to_string(std::time(nullptr));
        data["metrics"] = getSystemMetrics();

        if (apiClient->sendHeartbeat(data)) {
            lastHeartbeat = std::time(nullptr);
            consecutiveFailures = 0;
        } else {
            consecutiveFailures++;
            if (consecutiveFailures >= maxFailures) {
                std::cerr << "Max heartbeat failures reached" << std::endl;
                stop();
                onCriticalFailure();
            }
        }
    } catch (const std::exception& e) {
        std::cerr << "Heartbeat error: " << e.what() << std::endl;
        consecutiveFailures++;
        if (consecutiveFailures >= maxFailures) {
            stop();
            onCriticalFailure();
        }
    }
}

Json::Value HeartbeatService::getSystemMetrics() {
    Json::Value metrics;
    metrics["uptime"] = static_cast<int>(std::time(nullptr));

    struct rusage usage;
    if (getrusage(RUSAGE_SELF, &usage) == 0) {
        Json::Value memory;
        memory["used"] = static_cast<long long>(usage.ru_maxrss * 1024); // KB to bytes
        metrics["memory"] = memory;
    }

    return metrics;
}

void HeartbeatService::onCriticalFailure() {
    std::cerr << "Critical heartbeat failure" << std::endl;
}

bool HeartbeatService::isConnected() {
    if (lastHeartbeat == 0) {
        return false;
    }

    long now = std::time(nullptr);
    return (now - lastHeartbeat) < (interval / 1000 * 2);
}

