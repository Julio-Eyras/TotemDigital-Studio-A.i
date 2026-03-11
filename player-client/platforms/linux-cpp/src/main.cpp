/**
 * Main - Linux C++ Player
 * Entry point do aplicativo
 */

#include <iostream>
#include <memory>
#include <signal.h>
#include <thread>
#include <chrono>
#include <cstdlib>
#include <ctime>
#include "api/APIClient.h"
#include "core/PlaylistManager.h"
#include "core/HeartbeatService.h"
#include "core/Scheduler.h"
#include "player/MediaPlayer.h"
#include "storage/StorageHelper.h"
#include "utils/Logger.h"
#include <jsoncpp/json/json.h>

bool g_running = true;

void signalHandler(int signal) {
    std::cout << "Received signal " << signal << ", shutting down..." << std::endl;
    g_running = false;
}

int main(int argc, char* argv[]) {
    // Configurar signal handlers
    signal(SIGINT, signalHandler);
    signal(SIGTERM, signalHandler);

    // Configuração (deveria vir de arquivo ou variáveis de ambiente)
    std::string apiBaseURL = getenv("API_BASE_URL") ? getenv("API_BASE_URL") : "http://localhost:3000";
    std::string totemUIN = getenv("TOTEM_UIN") ? getenv("TOTEM_UIN") : "";
    std::string totemSecret = getenv("TOTEM_SECRET") ? getenv("TOTEM_SECRET") : "";

    try {
    // Inicializar componentes
    auto apiClient = std::make_shared<APIClient>(apiBaseURL, totemUIN, totemSecret);
    auto logger = std::make_shared<Logger>(apiClient, LogLevel::INFO);
    auto playlistManager = std::make_shared<PlaylistManager>(apiClient);
    auto scheduler = std::make_shared<Scheduler>();
    auto heartbeatService = std::make_shared<HeartbeatService>(apiClient, 30000);
    auto mediaPlayer = std::make_shared<MediaPlayer>();
    SmartSignage::StorageHelper storageHelper;
    storageHelper.ensurePropagandasDirs();

        // Aplicar config da API (storage externo/interno)
        try {
            Json::Value config = apiClient->getConfig();
            if (config.isMember("storageUseExternalFirst") && config["storageUseExternalFirst"].isBool()) {
                storageHelper.setUseExternalFirst(config["storageUseExternalFirst"].asBool());
            }
        } catch (const std::exception& e) {
            std::cerr << "[Main] Erro ao obter config (usando defaults): " << e.what() << std::endl;
        }

        // Autenticar totem
        if (!apiClient->authenticateTotem()) {
            logger->error("Failed to authenticate totem", std::exception());
            return 1;
        }

        logger->info("Totem authenticated successfully");

        // Iniciar heartbeat
        heartbeatService->start();

        // Carregar playlist inicial
        playlistManager->loadPlaylist();

        // Loop principal
        while (g_running) {
            // Carregar playlist se necessário
            if (playlistManager->needsUpdate()) {
                playlistManager->loadPlaylist();
            }

            auto item = playlistManager->getNextItem();
            if (item) {
                if (scheduler->shouldDisplay(*item)) {
                    // Preferir path local em propagandas (design 3.3)
                    std::string localPath = storageHelper.resolveMediaPath(std::to_string(item->id), "");
                    if (!localPath.empty()) {
                        PlaylistItem localItem = *item;
                        localItem.url = "file://" + localPath;
                        mediaPlayer->play(localItem);
                    } else {
                        mediaPlayer->play(*item);
                    }
                    mediaPlayer->waitForCompletion();
                } else {
                    // Item não agendado, pular
                    logger->debug("Item skipped due to schedule");
                }
            } else {
                // Nenhum item, aguardar e recarregar
                logger->warn("No items in playlist");
                std::this_thread::sleep_for(std::chrono::seconds(5));
                playlistManager->loadPlaylist();
            }
        }

        // Cleanup
        heartbeatService->stop();
        logger->info("Application shutting down");

    } catch (const std::exception& e) {
        std::cerr << "Error: " << e.what() << std::endl;
        return 1;
    }

    return 0;
}

