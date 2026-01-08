#include "core/PlaylistManager.h"
#include <iostream>

PlaylistManager::PlaylistManager(std::shared_ptr<APIClient> apiClient)
    : apiClient(apiClient), currentIndex(0), lastUpdate(0) {
}

bool PlaylistManager::loadPlaylist() {
    try {
        Json::Value playlist = apiClient->getPlaylist();
        if (validatePlaylist(playlist)) {
            // Validar se campanha tem contrato válido (se aplicável)
            if (playlist.isMember("campaign_id") && playlist.isMember("contract_valid")) {
                if (playlist["contract_valid"].asBool() == false) {
                    std::cerr << "[PlaylistManager] Warning: Campanha sem contrato válido. Filtrando itens..." << std::endl;
                    // Filtrar itens de campanha sem contrato válido
                    Json::Value filteredItems(Json::arrayValue);
                    for (const auto& item : playlist["items"]) {
                        if (!item.isMember("campaign_id") || 
                            (item.isMember("contract_valid") && item["contract_valid"].asBool() != false)) {
                            filteredItems.append(item);
                        }
                    }
                    playlist["items"] = filteredItems;
                    
                    // Se não restar itens, retornar false
                    if (filteredItems.size() == 0) {
                        std::cerr << "[PlaylistManager] Error: Nenhum item válido após filtrar campanha sem contrato" << std::endl;
                        return false;
                    }
                }
            }
            
            // Validar acesso ao totem (se informação disponível)
            if (playlist.isMember("access_granted") && playlist["access_granted"].asBool() == false) {
                std::cerr << "[PlaylistManager] Error: Acesso ao totem negado via contratos/planos" << std::endl;
                return false;
            }

            currentPlaylist = playlist;
            lastUpdate = std::time(nullptr) * 1000;
            currentIndex = 0;

            // Converter para vector
            items.clear();
            for (const auto& item : playlist["items"]) {
                PlaylistItem pi;
                pi.id = item["id"].asInt();
                pi.type = item["type"].asString();
                pi.url = item["url"].asString();
                pi.duration = item.get("duration", 0).asInt();
                pi.name = item.get("name", "").asString();
                pi.schedule = item.get("schedule", Json::Value());
                items.push_back(pi);
            }

            return true;
        }
        return false;
    } catch (const std::exception& e) {
        std::cerr << "[PlaylistManager] Failed to load playlist: " << e.what() << std::endl;
        
        // Tratamento específico para erros de validação
        std::string errorMsg = e.what();
        if (errorMsg.find("FORBIDDEN") != std::string::npos) {
            std::cerr << "[PlaylistManager] Acesso negado: totem não acessível através de contratos/planos ativos" << std::endl;
        }
        
        return false;
    }
}

bool PlaylistManager::validatePlaylist(const Json::Value& playlist) {
    if (!playlist.isMember("items") || !playlist["items"].isArray()) {
        return false;
    }

    for (const auto& item : playlist["items"]) {
        if (!item.isMember("id") || !item.isMember("type") || !item.isMember("url")) {
            return false;
        }
    }

    return true;
}

PlaylistItem* PlaylistManager::getNextItem() {
    if (items.empty()) {
        return nullptr;
    }

    PlaylistItem* item = &items[currentIndex];
    currentIndex = (currentIndex + 1) % items.size();
    return item;
}

PlaylistItem* PlaylistManager::getCurrentItem() {
    if (items.empty()) {
        return nullptr;
    }

    return &items[currentIndex];
}

bool PlaylistManager::needsUpdate(long updateInterval) {
    if (lastUpdate == 0) {
        return true;
    }

    long now = std::time(nullptr) * 1000;
    return (now - lastUpdate) >= updateInterval;
}

void PlaylistManager::reset() {
    currentPlaylist = Json::Value();
    currentIndex = 0;
    lastUpdate = 0;
    items.clear();
}

