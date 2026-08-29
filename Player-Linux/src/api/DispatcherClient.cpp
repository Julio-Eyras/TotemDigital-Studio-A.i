#include "api/DispatcherClient.hpp"

#include "util/Logger.hpp"
#include "version.hpp"

#include <chrono>
#include <cstdint>
#include <sstream>

#include <curl/curl.h>

namespace player::api {

namespace {

std::string lower(std::string s) {
  for (char& c : s) c = static_cast<char>(std::tolower(static_cast<unsigned char>(c)));
  return s;
}

bool isVinhetaTag(const MediaItem& m) {
  for (const auto& t : m.tags) {
    const auto lt = lower(t);
    if (lt.find("vinheta") != std::string::npos) return true;
  }
  return lower(m.mediaType).find("vinheta") != std::string::npos;
}

}  // namespace

DispatcherClient::DispatcherClient(config::PlayerConfig cfg) : cfg_(std::move(cfg)) {
  curl_global_init(CURL_GLOBAL_DEFAULT);
}

size_t DispatcherClient::writeCallback(char* ptr, size_t size, size_t nmemb, void* userdata) {
  auto* out = static_cast<std::string*>(userdata);
  out->append(ptr, size * nmemb);
  return size * nmemb;
}

std::string DispatcherClient::urlJoin(const std::string& pathWithQuery) const {
  return cfg_.serverUrl + pathWithQuery;
}

bool DispatcherClient::httpRequest(const std::string& method,
                                   const std::string& url,
                                   const std::string& body,
                                   long timeoutSec,
                                   long& outStatus,
                                   std::string& outBody) {
  outBody.clear();
  outStatus = 0;
  CURL* curl = curl_easy_init();
  if (!curl) return false;

  struct curl_slist* headers = nullptr;
  headers = curl_slist_append(headers, "Accept: application/json");
  if (!body.empty()) headers = curl_slist_append(headers, "Content-Type: application/json");

  curl_easy_setopt(curl, CURLOPT_URL, url.c_str());
  curl_easy_setopt(curl, CURLOPT_HTTPHEADER, headers);
  curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, writeCallback);
  curl_easy_setopt(curl, CURLOPT_WRITEDATA, &outBody);
  curl_easy_setopt(curl, CURLOPT_CONNECTTIMEOUT, 8L);
  curl_easy_setopt(curl, CURLOPT_TIMEOUT, timeoutSec);
  curl_easy_setopt(curl, CURLOPT_FOLLOWLOCATION, 1L);
  curl_easy_setopt(curl, CURLOPT_USERAGENT, "Player-Linux/" PLAYER_LINUX_VERSION_STR);

  if (method == "POST") {
    curl_easy_setopt(curl, CURLOPT_POST, 1L);
    curl_easy_setopt(curl, CURLOPT_POSTFIELDS, body.c_str());
  } else if (method != "GET") {
    curl_easy_setopt(curl, CURLOPT_CUSTOMREQUEST, method.c_str());
    if (!body.empty()) curl_easy_setopt(curl, CURLOPT_POSTFIELDS, body.c_str());
  }

  const CURLcode res = curl_easy_perform(curl);
  if (res == CURLE_OK) curl_easy_getinfo(curl, CURLINFO_RESPONSE_CODE, &outStatus);
  curl_slist_free_all(headers);
  curl_easy_cleanup(curl);
  return res == CURLE_OK;
}

std::optional<std::string> DispatcherClient::getToken() {
  const std::string url = urlJoin("/api/player/token?uin=" + cfg_.uin + "&deviceId=" + cfg_.deviceId);
  long status = 0;
  std::string body;
  if (!httpRequest("GET", url, "", 8, status, body) || status < 200 || status >= 300) {
    util::Logger::w("HEARTBEAT", "getToken falhou HTTP " + std::to_string(status));
    return std::nullopt;
  }
  try {
    const auto j = nlohmann::json::parse(body);
    if (j.contains("token")) {
      token_ = j["token"].get<std::string>();
      return token_;
    }
  } catch (...) {
  }
  return std::nullopt;
}

std::optional<nlohmann::json> DispatcherClient::fetchPlayerConfig() {
  const std::string url = urlJoin("/api/player/config");
  long status = 0;
  std::string body;
  if (!httpRequest("GET", url, "", 8, status, body) || status < 200 || status >= 300) {
    return std::nullopt;
  }
  try {
    return nlohmann::json::parse(body);
  } catch (...) {
    return std::nullopt;
  }
}

HeartbeatResult DispatcherClient::heartbeatOrSync(const std::string& token,
                                                  const std::optional<std::string>& knownPlanVersion) {
  HeartbeatResult r;
  nlohmann::json heartbeat = {
      {"uin", cfg_.uin},
      {"deviceId", cfg_.deviceId},
      {"status", "online"},
      {"platform", PLAYER_LINUX_PLATFORM},
      {"version", PLAYER_LINUX_VERSION_STR},
      {"appVersion", PLAYER_LINUX_VERSION_STR},
      {"currentVersion", PLAYER_LINUX_VERSION_STR},
      {"updateStatus", "up_to_date"},
  };

  const auto nowMs = std::chrono::duration_cast<std::chrono::milliseconds>(
                         std::chrono::system_clock::now().time_since_epoch())
                         .count();
  if (!syncSupported_ && (nowMs - lastSyncProbeMs_) > 6LL * 3600 * 1000) {
    syncSupported_ = true;
  }

  auto parseHb = [&](const nlohmann::json& raw) {
    nlohmann::json j = raw;
    if (raw.contains("heartbeat") && raw["heartbeat"].is_object()) j = raw["heartbeat"];
    else if (raw.contains("data") && raw["data"].is_object()) {
      const auto& d = raw["data"];
      if (d.contains("heartbeat") && d["heartbeat"].is_object()) j = d["heartbeat"];
      else j = d;
    }
    r.ok = true;
    if (j.contains("token")) r.token = j["token"].get<std::string>();
    else if (raw.contains("token")) r.token = raw["token"].get<std::string>();
    else r.token = token;
    const auto& cmds = j.contains("pendingCommands") ? j["pendingCommands"]
                      : j.contains("pending_commands") ? j["pending_commands"]
                                                       : nlohmann::json::array();
    if (cmds.is_array()) {
      for (const auto& c : cmds) {
        PendingCommand pc;
        pc.id = c.value("id", c.value("requestId", ""));
        pc.type = c.value("type", "");
        if (c.contains("data")) pc.data = c["data"];
        r.pendingCommands.push_back(std::move(pc));
      }
    }
    if (j.contains("displaySchedule")) r.displaySchedule = j["displaySchedule"];
    else if (j.contains("display_schedule")) r.displaySchedule = j["display_schedule"];
    if (j.contains("pollAdaptive")) r.pollAdaptive = j["pollAdaptive"];
    if (j.contains("otaUpdate")) r.otaUpdate = j["otaUpdate"];
    if (j.contains("planVersion")) r.planVersion = j["planVersion"].get<std::string>();
    else if (j.contains("plan_version")) r.planVersion = j["plan_version"].get<std::string>();
    if (j.contains("needsDispatch")) r.needsDispatch = j["needsDispatch"].get<bool>();
    else if (j.contains("needs_dispatch")) r.needsDispatch = j["needs_dispatch"].get<bool>();
    else r.needsDispatch = false;
  };

  if (syncSupported_) {
    nlohmann::json syncBody = {
        {"schemaVersion", 1},
        {"syncId", std::to_string(nowMs)},
        {"heartbeat", heartbeat},
    };
    if (knownPlanVersion) syncBody["knownPlanVersion"] = *knownPlanVersion;
    const std::string url =
        urlJoin("/api/player/sync?uin=" + cfg_.uin + "&token=" + token + "&deviceId=" + cfg_.deviceId);
    long status = 0;
    std::string body;
    if (httpRequest("POST", url, syncBody.dump(), 8, status, body)) {
      r.httpStatus = static_cast<int>(status);
      if (status == 404 || status == 405) {
        syncSupported_ = false;
        lastSyncProbeMs_ = nowMs;
        util::Logger::w("HEARTBEAT", "sync indisponível; fallback heartbeat");
      } else if (status >= 200 && status < 300) {
        r.usedSyncEndpoint = true;
        try {
          parseHb(nlohmann::json::parse(body));
          if (!r.token.empty()) token_ = r.token;
          return r;
        } catch (...) {
        }
      }
    }
  }

  const std::string url =
      urlJoin("/api/player/heartbeat?uin=" + cfg_.uin + "&token=" + token + "&deviceId=" + cfg_.deviceId);
  long status = 0;
  std::string body;
  r.usedSyncEndpoint = false;
  if (!httpRequest("POST", url, heartbeat.dump(), 8, status, body)) {
    r.httpStatus = static_cast<int>(status);
    return r;
  }
  r.httpStatus = static_cast<int>(status);
  if (status < 200 || status >= 300) return r;
  try {
    parseHb(nlohmann::json::parse(body));
    if (!r.token.empty()) token_ = r.token;
  } catch (...) {
    r.ok = false;
  }
  return r;
}

DispatchPlan parseDispatchPlan(const nlohmann::json& root) {
  DispatchPlan plan;
  nlohmann::json p = root;
  if (root.contains("plan")) p = root["plan"];
  else if (root.contains("data") && root["data"].contains("plan")) p = root["data"]["plan"];

  plan.playlistId = p.value("playlistId", p.value("playlist_id", ""));
  plan.playlistName = p.value("playlistName", p.value("playlist_name", ""));
  plan.planVersion = p.value("planVersion", p.value("plan_version", ""));

  nlohmann::json items = nlohmann::json::array();
  if (p.contains("mediaItems")) items = p["mediaItems"];
  else if (p.contains("media_items")) items = p["media_items"];

  int idx = 0;
  for (const auto& it : items) {
    MediaItem m;
    if (it.contains("mediaId")) {
      if (it["mediaId"].is_string()) m.mediaId = it["mediaId"].get<std::string>();
      else if (it["mediaId"].is_number_integer()) m.mediaId = std::to_string(it["mediaId"].get<std::int64_t>());
      else m.mediaId = it["mediaId"].dump();
    } else if (it.contains("media_id")) {
      if (it["media_id"].is_string()) m.mediaId = it["media_id"].get<std::string>();
      else m.mediaId = std::to_string(it["media_id"].get<std::int64_t>());
    } else {
      m.mediaId = std::to_string(idx);
    }

    m.url = it.value("url", it.value("file_path", it.value("src", "")));
    m.mediaType = it.value("mediaType", it.value("mimeType", "video"));
    m.durationSeconds = it.value("duration", it.value("display_seconds", 0));
    m.order = it.value("order", idx);
    if (it.contains("tags") && it["tags"].is_array()) {
      for (const auto& t : it["tags"]) m.tags.push_back(t.get<std::string>());
    }
    if (it.contains("metadata") && it["metadata"].is_object()) {
      const auto& md = it["metadata"];
      m.contentVersion = md.value("contentVersion", "");
      if (md.contains("deliveryRotation") && md["deliveryRotation"].is_number_integer())
        m.deliveryRotation = md["deliveryRotation"].get<int>();
      if (md.contains("deliveryBakeVersion") && md["deliveryBakeVersion"].is_number_integer())
        m.deliveryBakeVersion = md["deliveryBakeVersion"].get<int>();
      if (m.durationSeconds <= 0 && md.contains("durationSeconds"))
        m.durationSeconds = md["durationSeconds"].get<int>();
    }
    plan.mediaItems.push_back(std::move(m));
    ++idx;
  }
  return plan;
}

DispatchPlan stripVinhetasFromOnlinePlan(DispatchPlan plan) {
  std::vector<MediaItem> kept;
  for (auto& m : plan.mediaItems) {
    if (!isVinhetaTag(m)) kept.push_back(std::move(m));
  }
  plan.mediaItems = std::move(kept);
  return plan;
}

DispatchResult DispatcherClient::getDispatchPlan(const std::string& token, const std::string& timezone) {
  DispatchResult r;
  const std::string url = urlJoin("/api/player/dispatch?uin=" + cfg_.uin + "&token=" + token +
                                  "&deviceId=" + cfg_.deviceId + "&timezone=" + timezone);
  long status = 0;
  std::string body;
  if (!httpRequest("GET", url, "", 8, status, body)) {
    r.httpStatus = static_cast<int>(status);
    return r;
  }
  r.httpStatus = static_cast<int>(status);
  if (status < 200 || status >= 300) return r;
  try {
    r.plan = stripVinhetasFromOnlinePlan(parseDispatchPlan(nlohmann::json::parse(body)));
    r.ok = true;
  } catch (...) {
    r.ok = false;
  }
  return r;
}

bool DispatcherClient::reportCommandResult(const std::string& token,
                                           const std::string& requestId,
                                           const std::string& status,
                                           const nlohmann::json& result,
                                           const std::string& error) {
  std::string apiStatus = status;
  if (status == "ok" || status == "unsupported") apiStatus = "completed";
  if (status == "error") apiStatus = "failed";
  nlohmann::json body = {
      {"uin", cfg_.uin},
      {"token", token},
      {"requestId", requestId},
      {"status", apiStatus},
  };
  if (!result.is_null()) body["result"] = result;
  if (!error.empty()) body["error"] = error;
  const std::string url = urlJoin("/api/player/command-result");
  long httpStatus = 0;
  std::string resp;
  return httpRequest("POST", url, body.dump(), 60, httpStatus, resp) && httpStatus >= 200 &&
         httpStatus < 300;
}

bool DispatcherClient::reportOtaStatus(const std::string& token,
                                       const std::string& currentVersion,
                                       const std::string& updateStatus,
                                       const std::string& availableVersion,
                                       const std::string& error) {
  nlohmann::json body = {
      {"uin", cfg_.uin},
      {"token", token},
      {"currentVersion", currentVersion},
      {"updateStatus", updateStatus},
  };
  if (!availableVersion.empty()) body["availableVersion"] = availableVersion;
  if (!error.empty()) body["error"] = error;
  const std::string url = urlJoin("/api/player/ota-status");
  long httpStatus = 0;
  std::string resp;
  return httpRequest("POST", url, body.dump(), 30, httpStatus, resp) && httpStatus >= 200 &&
         httpStatus < 300;
}

bool DispatcherClient::postEvent(const std::string& token, const nlohmann::json& event) {
  nlohmann::json body = event.is_object() ? event : nlohmann::json::object();
  body["uin"] = cfg_.uin;
  if (!token.empty()) body["token"] = token;
  if (!body.contains("metadata") || !body["metadata"].is_object()) body["metadata"] = nlohmann::json::object();
  body["metadata"]["deviceId"] = cfg_.deviceId;
  body["metadata"]["platform"] = PLAYER_LINUX_PLATFORM;
  const std::string url =
      urlJoin("/api/player/event?uin=" + cfg_.uin + "&token=" + token + "&deviceId=" + cfg_.deviceId);
  long httpStatus = 0;
  std::string resp;
  return httpRequest("POST", url, body.dump(), 8, httpStatus, resp) && httpStatus >= 200 &&
         httpStatus < 300;
}

}  // namespace player::api
