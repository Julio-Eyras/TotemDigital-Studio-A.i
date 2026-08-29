#pragma once

#include "config/PlayerConfig.hpp"

#include <cstdint>
#include <optional>
#include <string>
#include <vector>

#include <nlohmann/json.hpp>

namespace player::api {

struct MediaItem {
  std::string mediaId;
  std::string url;
  std::string mediaType;  // video | image | html
  int durationSeconds = 0;
  int order = 0;
  std::string contentVersion;
  std::optional<int> deliveryRotation;
  std::optional<int> deliveryBakeVersion;
  std::vector<std::string> tags;
};

struct DispatchPlan {
  std::string playlistId;
  std::string playlistName;
  std::string planVersion;
  std::vector<MediaItem> mediaItems;
};

struct PendingCommand {
  std::string id;
  std::string type;
  nlohmann::json data = nlohmann::json::object();
};

struct HeartbeatResult {
  bool ok = false;
  int httpStatus = 0;
  std::string token;
  std::vector<PendingCommand> pendingCommands;
  std::optional<nlohmann::json> displaySchedule;
  std::optional<nlohmann::json> pollAdaptive;
  std::optional<nlohmann::json> otaUpdate;
  std::optional<std::string> planVersion;
  bool needsDispatch = false;
  bool usedSyncEndpoint = true;
};

struct DispatchResult {
  bool ok = false;
  int httpStatus = 0;
  DispatchPlan plan;
};

class DispatcherClient {
public:
  explicit DispatcherClient(config::PlayerConfig cfg);

  std::optional<std::string> getToken();
  std::optional<nlohmann::json> fetchPlayerConfig();
  HeartbeatResult heartbeatOrSync(const std::string& token,
                                  const std::optional<std::string>& knownPlanVersion);
  DispatchResult getDispatchPlan(const std::string& token, const std::string& timezone);
  bool reportCommandResult(const std::string& token,
                           const std::string& requestId,
                           const std::string& status,
                           const nlohmann::json& result,
                           const std::string& error);
  bool reportOtaStatus(const std::string& token,
                       const std::string& currentVersion,
                       const std::string& updateStatus,
                       const std::string& availableVersion,
                       const std::string& error);
  bool postEvent(const std::string& token, const nlohmann::json& event);

  const std::string& token() const { return token_; }
  void setToken(std::string t) { token_ = std::move(t); }

private:
  config::PlayerConfig cfg_;
  std::string token_;
  bool syncSupported_ = true;
  std::int64_t lastSyncProbeMs_ = 0;

  std::string urlJoin(const std::string& pathWithQuery) const;
  static size_t writeCallback(char* ptr, size_t size, size_t nmemb, void* userdata);
  bool httpRequest(const std::string& method,
                   const std::string& url,
                   const std::string& body,
                   long timeoutSec,
                   long& outStatus,
                   std::string& outBody);
};

DispatchPlan parseDispatchPlan(const nlohmann::json& root);
/** Remove itens de vinheta do plano online (parity Android). */
DispatchPlan stripVinhetasFromOnlinePlan(DispatchPlan plan);

}  // namespace player::api
