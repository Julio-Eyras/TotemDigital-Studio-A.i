#include "cache/MediaCache.hpp"

#include "util/Logger.hpp"

#include <fstream>
#include <filesystem>

#include <curl/curl.h>

namespace fs = std::filesystem;

namespace player::cache {

namespace {

size_t fileWrite(char* ptr, size_t size, size_t nmemb, void* stream) {
  auto* out = static_cast<std::ofstream*>(stream);
  out->write(ptr, static_cast<std::streamsize>(size * nmemb));
  return size * nmemb;
}

}  // namespace

MediaCache::MediaCache(config::PlayerConfig cfg, std::string propagandasDir, std::string metadataPath)
    : cfg_(std::move(cfg)), dir_(std::move(propagandasDir)), metadataPath_(std::move(metadataPath)) {
  loadMetadata();
}

void MediaCache::loadMetadata() {
  std::ifstream in(metadataPath_);
  if (!in) {
    metadata_ = nlohmann::json::object();
    return;
  }
  try {
    in >> metadata_;
    if (!metadata_.is_object()) metadata_ = nlohmann::json::object();
  } catch (...) {
    metadata_ = nlohmann::json::object();
  }
}

void MediaCache::saveMetadata() {
  std::ofstream out(metadataPath_);
  if (out) out << metadata_.dump(2);
}

std::string MediaCache::extensionFor(const api::MediaItem& item) const {
  const auto t = item.mediaType;
  if (t.find("image") != std::string::npos || t.find("jpeg") != std::string::npos) return ".jpg";
  if (t.find("png") != std::string::npos) return ".png";
  if (t.find("html") != std::string::npos || t.find("web") != std::string::npos) return ".html";
  if (item.url.find(".webm") != std::string::npos) return ".webm";
  return ".mp4";
}

bool MediaCache::downloadUrl(const std::string& url, const std::string& destPath) {
  CURL* curl = curl_easy_init();
  if (!curl) return false;
  std::ofstream out(destPath, std::ios::binary);
  if (!out) {
    curl_easy_cleanup(curl);
    return false;
  }
  curl_easy_setopt(curl, CURLOPT_URL, url.c_str());
  curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, fileWrite);
  curl_easy_setopt(curl, CURLOPT_WRITEDATA, &out);
  curl_easy_setopt(curl, CURLOPT_FOLLOWLOCATION, 1L);
  curl_easy_setopt(curl, CURLOPT_CONNECTTIMEOUT, 20L);
  curl_easy_setopt(curl, CURLOPT_TIMEOUT, 120L);
  const CURLcode res = curl_easy_perform(curl);
  long status = 0;
  curl_easy_getinfo(curl, CURLINFO_RESPONSE_CODE, &status);
  curl_easy_cleanup(curl);
  out.close();
  if (res != CURLE_OK || status < 200 || status >= 300) {
    std::error_code ec;
    fs::remove(destPath, ec);
    return false;
  }
  return true;
}

std::string MediaCache::ensureLocal(const api::MediaItem& item) {
  const std::string ext = extensionFor(item);
  const std::string path = dir_ + "/" + item.mediaId + ext;
  const bool exists = fs::exists(path);
  std::string cachedVersion;
  if (metadata_.contains(item.mediaId) && metadata_[item.mediaId].contains("contentVersion"))
    cachedVersion = metadata_[item.mediaId]["contentVersion"].get<std::string>();

  if (exists && (item.contentVersion.empty() || item.contentVersion == cachedVersion)) {
    return path;
  }

  if (item.url.empty()) {
    util::Logger::w("CACHE", "Sem URL para mediaId=" + item.mediaId);
    return exists ? path : "";
  }

  // Rejeitar SVG/HTML remotos perigosos como binário de vídeo (parity)
  const auto urlLower = item.url;
  if (urlLower.find(".svg") != std::string::npos) {
    util::Logger::w("CACHE", "Download rejeitado (svg) mediaId=" + item.mediaId);
    return "";
  }

  util::Logger::i("CACHE", "Download mediaId=" + item.mediaId);
  if (!downloadUrl(item.url, path)) {
    util::Logger::e("CACHE", "Falha download mediaId=" + item.mediaId);
    return exists ? path : "";
  }
  metadata_[item.mediaId] = {
      {"contentVersion", item.contentVersion},
      {"path", path},
  };
  saveMetadata();
  return path;
}

void MediaCache::purgeAll() {
  std::error_code ec;
  for (const auto& e : fs::directory_iterator(dir_, ec)) {
    if (!e.is_regular_file()) continue;
    if (e.path().filename() == "metadata.json") continue;
    fs::remove(e.path(), ec);
  }
  metadata_ = nlohmann::json::object();
  saveMetadata();
  util::Logger::i("CACHE", "purge_cache concluído");
}

void MediaCache::invalidateMediaId(const std::string& mediaId) {
  metadata_.erase(mediaId);
  saveMetadata();
  std::error_code ec;
  for (const auto& e : fs::directory_iterator(dir_, ec)) {
    if (e.path().stem() == mediaId) fs::remove(e.path(), ec);
  }
}

}  // namespace player::cache
