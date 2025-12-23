#ifndef HEARTBEAT_SERVICE_H
#define HEARTBEAT_SERVICE_H

#include <memory>
#include <thread>
#include <atomic>
#include <jsoncpp/json/json.h>
#include "api/APIClient.h"

class HeartbeatService {
public:
    HeartbeatService(std::shared_ptr<APIClient> apiClient, long interval = 30000);
    ~HeartbeatService();

    void start();
    void stop();
    bool isConnected();

private:
    std::shared_ptr<APIClient> apiClient;
    long interval;
    std::thread heartbeatThread;
    std::atomic<bool> running;
    long lastHeartbeat;
    int consecutiveFailures;
    static const int maxFailures = 5;

    void heartbeatLoop();
    Json::Value getSystemMetrics();
    void onCriticalFailure();
};

#endif // HEARTBEAT_SERVICE_H

