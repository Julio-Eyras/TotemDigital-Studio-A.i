#ifndef PLAYLIST_MANAGER_H
#define PLAYLIST_MANAGER_H

#include <string>
#include <memory>
#include <vector>
#include <jsoncpp/json/json.h>
#include "api/APIClient.h"

struct PlaylistItem {
    int id;
    std::string type;
    std::string url;
    int duration;
    std::string name;
    Json::Value schedule;
};

class PlaylistManager {
public:
    PlaylistManager(std::shared_ptr<APIClient> apiClient);
    bool loadPlaylist();
    PlaylistItem* getNextItem();
    PlaylistItem* getCurrentItem();
    bool needsUpdate(long updateInterval = 300000);
    void reset();

private:
    std::shared_ptr<APIClient> apiClient;
    Json::Value currentPlaylist;
    size_t currentIndex;
    long lastUpdate;
    std::vector<PlaylistItem> items;

    bool validatePlaylist(const Json::Value& playlist);
};

#endif // PLAYLIST_MANAGER_H

