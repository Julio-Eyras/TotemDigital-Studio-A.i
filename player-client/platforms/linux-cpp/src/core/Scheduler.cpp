#include "core/Scheduler.h"
#include <sstream>
#include <iomanip>
#include <ctime>
#include <jsoncpp/json/json.h>

Scheduler::Scheduler() {
    // Usar timezone do sistema
}

bool Scheduler::shouldDisplay(const PlaylistItem& item, std::time_t currentTime) {
    if (item.schedule.isNull()) {
        return true; // Sem agendamento = sempre exibir
    }

    std::tm* now = std::localtime(&currentTime);

    // Verificar dias da semana
    if (item.schedule.isMember("daysOfWeek") && item.schedule["daysOfWeek"].isArray()) {
        int dayOfWeek = now->tm_wday;
        bool found = false;
        for (const auto& day : item.schedule["daysOfWeek"]) {
            if (day.asInt() == dayOfWeek) {
                found = true;
                break;
            }
        }
        if (!found) {
            return false;
        }
    }

    // Verificar horário
    if (item.schedule.isMember("startTime") && item.schedule.isMember("endTime")) {
        std::string startTime = item.schedule["startTime"].asString();
        std::string endTime = item.schedule["endTime"].asString();

        int currentMinutes = now->tm_hour * 60 + now->tm_min;
        int startMinutes = timeToMinutes(startTime);
        int endMinutes = timeToMinutes(endTime);

        if (startMinutes <= endMinutes) {
            if (currentMinutes < startMinutes || currentMinutes >= endMinutes) {
                return false;
            }
        } else {
            if (currentMinutes < startMinutes && currentMinutes >= endMinutes) {
                return false;
            }
        }
    }

    // Verificar datas
    if (item.schedule.isMember("startDate")) {
        // Implementar verificação de data
    }

    if (item.schedule.isMember("endDate")) {
        // Implementar verificação de data
    }

    return true;
}

std::vector<PlaylistItem> Scheduler::filterScheduledItems(const std::vector<PlaylistItem>& items, std::time_t currentTime) {
    std::vector<PlaylistItem> filtered;
    for (const auto& item : items) {
        if (shouldDisplay(item, currentTime)) {
            filtered.push_back(item);
        }
    }
    return filtered;
}

int Scheduler::timeToMinutes(const std::string& timeString) {
    size_t colonPos = timeString.find(':');
    if (colonPos == std::string::npos) {
        return 0;
    }

    int hours = std::stoi(timeString.substr(0, colonPos));
    int minutes = std::stoi(timeString.substr(colonPos + 1));
    return hours * 60 + minutes;
}

void Scheduler::setTimezone(const std::string& tz) {
    timezone = tz;
    // Implementar mudança de timezone
}

std::time_t Scheduler::getLocalTime(std::time_t time) {
    return time; // Simplificado
}

