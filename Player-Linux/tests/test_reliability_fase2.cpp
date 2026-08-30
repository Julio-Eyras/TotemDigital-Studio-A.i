#include "api/DispatcherClient.hpp"
#include "cache/MediaCache.hpp"
#include "config/DisplaySchedule.hpp"
#include "config/PlayerConfig.hpp"
#include "config/PollAdaptive.hpp"
#include "remote/CommandReceipts.hpp"
#include "util/TelemetryRotate.hpp"

#include <chrono>
#include <cstdint>
#include <filesystem>
#include <fstream>
#include <iostream>
#include <string>
#include <vector>

#include <nlohmann/json.hpp>

namespace fs = std::filesystem;

namespace {

int gFails = 0;

#define CHECK(cond)                                                                              \
  do {                                                                                           \
    if (!(cond)) {                                                                               \
      std::cerr << "FAIL " << __FILE__ << ":" << __LINE__ << "  " << #cond << "\n";              \
      ++gFails;                                                                                  \
    }                                                                                            \
  } while (0)

fs::path makeTempDir(const char* tag) {
  const auto stamp = std::chrono::steady_clock::now().time_since_epoch().count();
  fs::path dir = fs::temp_directory_path() / ("pl-f2-" + std::string(tag) + "-" + std::to_string(stamp));
  fs::create_directories(dir);
  return dir;
}

void writeFile(const fs::path& p, const std::string& body) {
  std::ofstream out(p, std::ios::binary);
  out << body;
}

void testParseDispatchJson() {
  const auto nested = nlohmann::json::parse(R"({
    "plan": {
      "playlistId": "pl-1",
      "playlistName": "Manhã",
      "planVersion": "v9",
      "mediaItems": [
        {
          "mediaId": 42,
          "url": "https://ex/a.mp4",
          "mediaType": "video",
          "duration": 15,
          "order": 0,
          "metadata": {"contentVersion": "sha-aaa"}
        },
        {
          "media_id": "vin-1",
          "url": "https://ex/v.mp4",
          "mediaType": "video",
          "tags": ["vinheta"],
          "metadata": {"contentVersion": "sha-v"}
        }
      ]
    }
  })");
  auto plan = player::api::parseDispatchPlan(nested);
  CHECK(plan.playlistId == "pl-1");
  CHECK(plan.playlistName == "Manhã");
  CHECK(plan.planVersion == "v9");
  CHECK(plan.mediaItems.size() == 2);
  CHECK(plan.mediaItems[0].mediaId == "42");
  CHECK(plan.mediaItems[0].contentVersion == "sha-aaa");
  CHECK(plan.mediaItems[0].durationSeconds == 15);

  auto stripped = player::api::stripVinhetasFromOnlinePlan(plan);
  CHECK(stripped.mediaItems.size() == 1);
  CHECK(stripped.mediaItems[0].mediaId == "42");

  const auto snake = nlohmann::json::parse(R"({
    "playlist_id": "p2",
    "plan_version": "pv",
    "media_items": [{"media_id": "m1", "file_path": "/tmp/x.mp4", "mimeType": "image/jpeg"}]
  })");
  auto p2 = player::api::parseDispatchPlan(snake);
  CHECK(p2.playlistId == "p2");
  CHECK(p2.planVersion == "pv");
  CHECK(p2.mediaItems.size() == 1);
  CHECK(p2.mediaItems[0].url == "/tmp/x.mp4");
}

void testPlayerConfigJson() {
  auto c = player::config::PlayerConfig::fromJson(nlohmann::json::parse(R"({
    "serverUrl": "https://lab.example/",
    "uin": "U1",
    "deviceId": "  ab:cd  ",
    "batimentoCardiaco": 8,
    "fallbackPropagandasPerVinheta": 0,
    "maxCacheSizeMb": 10,
    "displayRotation": 9
  })"));
  CHECK(c.serverUrl == "https://lab.example");
  CHECK(c.uin == "U1");
  CHECK(c.deviceId == "AB:CD");
  CHECK(c.batimentoCardiaco == 15);
  CHECK(c.fallbackPropagandasPerVinheta == 1);
  CHECK(c.maxCacheSizeMb == 50);
  CHECK(c.displayRotation == 3);
  CHECK(c.isValid());
}

void testDisplayScheduleJson() {
  player::config::DisplaySchedule local;
  local.forceMode = "off";
  const auto incoming = nlohmann::json::parse(R"({
    "enabled": true,
    "timezone": "America/Sao_Paulo",
    "daysOfWeek": [1, 2, 3, 4, 5],
    "onTime": "09:00",
    "offTime": "18:00"
  })");
  auto merged = player::config::mergeFromServer(local, incoming);
  CHECK(merged.enabled);
  CHECK(merged.onTime == "09:00");
  CHECK(merged.forceMode.has_value() && *merged.forceMode == "off");

  auto forced = player::config::DisplaySchedule::fromJson(
      nlohmann::json::parse(R"({"enabled":true,"forceMode":"on"})"));
  CHECK(forced.isDisplayActiveNow(0));
  auto off = forced.withForceMode(std::string("off"));
  CHECK(!off.isDisplayActiveNow(0));
}

void testCacheContentVersion() {
  using player::cache::MediaCache;
  CHECK(MediaCache::cacheVersionHit(true, "", "anything"));
  CHECK(MediaCache::cacheVersionHit(true, "v1", "v1"));
  CHECK(!MediaCache::cacheVersionHit(true, "v2", "v1"));
  CHECK(!MediaCache::cacheVersionHit(false, "v1", "v1"));
  CHECK(!MediaCache::cacheVersionHit(false, "", ""));

  const auto dir = makeTempDir("cache");
  const std::string mediaDir = (dir / "prop").string();
  fs::create_directories(mediaDir);
  writeFile(dir / "prop" / "m1.mp4", "fake-mp4");
  writeFile(dir / "prop" / "metadata.json", R"({"m1":{"contentVersion":"sha-1","path":"m1.mp4"}})");

  player::config::PlayerConfig cfg;
  MediaCache cache(cfg, mediaDir, (dir / "prop" / "metadata.json").string());
  player::api::MediaItem hit;
  hit.mediaId = "m1";
  hit.mediaType = "video";
  hit.contentVersion = "sha-1";
  hit.url = "http://127.0.0.1:1/must-not-download.mp4";
  const std::string path = cache.ensureLocal(hit);
  CHECK(path.find("m1.mp4") != std::string::npos);
  CHECK(fs::exists(path));

  cache.purgeAll();
  CHECK(!fs::exists(dir / "prop" / "m1.mp4"));
  fs::remove_all(dir);
}

void testCommandDedup() {
  const auto dir = makeTempDir("rcpt");
  const std::string path = (dir / "receipts.json").string();
  {
    player::remote::CommandReceipts a(path);
    CHECK(!a.contains("cmd-1"));
    a.remember("cmd-1");
    CHECK(a.contains("cmd-1"));
    CHECK(a.size() == 1);
  }
  {
    player::remote::CommandReceipts b(path);
    CHECK(b.contains("cmd-1"));
    b.remember("cmd-1");
    CHECK(b.size() == 1);
  }

  const std::string capPath = (dir / "cap.json").string();
  {
    player::remote::CommandReceipts c(capPath);
    for (int i = 0; i < 201; ++i) c.remember("id-" + std::to_string(i));
    CHECK(c.size() == 1);
    CHECK(c.contains("id-200"));
    CHECK(!c.contains("id-0"));
  }
  fs::remove_all(dir);
}

void testJsonlCap() {
  const auto dir = makeTempDir("jsonl");
  const auto path = dir / "events-v2.jsonl";
  writeFile(path, std::string(64, 'x'));
  CHECK(!player::util::rotateJsonlIfNeeded(path.string(), 128));
  CHECK(fs::exists(path));
  CHECK(!fs::exists(path.string() + ".1"));

  writeFile(path, std::string(200, 'y'));
  CHECK(player::util::rotateJsonlIfNeeded(path.string(), 128));
  CHECK(!fs::exists(path));
  CHECK(fs::exists(path.string() + ".1"));
  CHECK(fs::file_size(path.string() + ".1") == 200);
  fs::remove_all(dir);
}

void testPollBackoff() {
  player::config::PlayerConfig cfg;
  cfg.batimentoCardiaco = 30;
  cfg.maxSecondsWithoutServerCheck = 180;
  player::config::PollAdaptive poll(cfg);
  CHECK(poll.heartbeatIntervalMs() == 30000);
  poll.onFailure();
  CHECK(poll.heartbeatIntervalMs() == 60000);
  poll.wake();
  CHECK(poll.heartbeatIntervalMs() == 30000);
}

}  // namespace

int main() {
  testParseDispatchJson();
  testPlayerConfigJson();
  testDisplayScheduleJson();
  testCacheContentVersion();
  testCommandDedup();
  testJsonlCap();
  testPollBackoff();
  if (gFails != 0) {
    std::cerr << gFails << " falha(s)\n";
    return 1;
  }
  std::cout << "player-linux-tests: ok\n";
  return 0;
}
