#ifndef SCHEDULER_H
#define SCHEDULER_H

#include <string>
#include <vector>
#include <ctime>
#include <jsoncpp/json/json.h>

struct PlaylistItem {
    int id;
    std::string type;
    std::string url;
    int duration;
    std::string name;
    Json::Value schedule;
};

class Scheduler {
public:
    Scheduler();
    bool shouldDisplay(const PlaylistItem& item, std::time_t currentTime = std::time(nullptr));
    std::vector<PlaylistItem> filterScheduledItems(const std::vector<PlaylistItem>& items, std::time_t currentTime = std::time(nullptr));
    void setTimezone(const std::string& timezone);

private:
    std::string timezone;
    int timeToMinutes(const std::string& timeString);
    std::time_t getLocalTime(std::time_t time);
};

#endif // SCHEDULER_H

