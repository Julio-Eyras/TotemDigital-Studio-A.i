#pragma once

#include <optional>
#include <string>

#include <nlohmann/json.hpp>

namespace player::ops {

struct CmdResult {
  int exitCode = -1;
  std::string out;
  std::string err;
};

CmdResult run(const std::string& command, int timeoutSec = 60);
std::string base64Encode(const std::string& binary);
std::string sha256File(const std::string& path);
bool downloadFile(const std::string& url, const std::string& destPath, long timeoutSec = 180);

/** apply_player_config displayRotation 0–3 → xrandr. */
void applyKiosk(const std::string& kioskMode, int displayRotation);
/** Escape de kiosk (SIGUSR1 / scripts/kiosk-escape.sh) — equivalente ao menu 3× OK. */
void releaseKiosk();
void requestKioskEscape();
bool takeKioskEscape();

nlohmann::json configureWifi(const nlohmann::json& data);
nlohmann::json captureScreenshot(const std::string& shotsDir);

struct OtaPackage {
  int id = 0;
  std::string version;
  std::string checksum;
  std::string downloadUrl;
  bool isMandatory = false;
};

std::optional<OtaPackage> parseOta(const nlohmann::json& j);
/** Download + SHA-256 + dpkg. Devolve result JSON para ACK / log. */
nlohmann::json applyOta(const OtaPackage& pkg,
                        const std::string& serverUrl,
                        const std::string& otaDir,
                        const std::string& uin = "",
                        const std::string& token = "");
nlohmann::json rollbackOta(const std::string& otaDir);

struct ChildProc {
  long pid = -1;
};

ChildProc spawnHtmlKiosk(const std::string& fileOrUrl);
void killChild(ChildProc proc);
/** true se o filho HTML ainda existe (reap WNOHANG). */
bool childAlive(ChildProc& proc);

/** Só download + SHA-256 para incoming.deb. Não instala. */
void downloadOtaDeb(const OtaPackage& pkg,
                    const std::string& serverUrl,
                    const std::string& otaDir,
                    const std::string& uin,
                    const std::string& token);
/** dpkg de incoming.deb (já validado). Playback deve estar parado. */
nlohmann::json installIncomingDeb(const std::string& otaDir, const std::string& version);

}  // namespace player::ops
