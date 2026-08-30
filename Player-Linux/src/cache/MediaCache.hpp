#pragma once

#include "api/DispatcherClient.hpp"
#include "config/PlayerConfig.hpp"

#include <string>
#include <unordered_map>

namespace player::cache {

class MediaCache {
public:
  MediaCache(config::PlayerConfig cfg, std::string propagandasDir, std::string metadataPath);

  /** Devolve path local se em cache e contentVersion ok; senão tenta download. */
  std::string ensureLocal(const api::MediaItem& item);

  void purgeAll();
  void invalidateMediaId(const std::string& mediaId);

  /** Hit se o ficheiro existe e a contentVersion bate (ou o item não traz versão). */
  static bool cacheVersionHit(bool fileExists, const std::string& itemVersion,
                              const std::string& cachedVersion);

private:
  config::PlayerConfig cfg_;
  std::string dir_;
  std::string metadataPath_;
  nlohmann::json metadata_ = nlohmann::json::object();

  void loadMetadata();
  void saveMetadata();
  std::string extensionFor(const api::MediaItem& item) const;
  bool downloadUrl(const std::string& url, const std::string& destPath);
  void evictIfNeeded(const std::string& keepPath);
};

}  // namespace player::cache
