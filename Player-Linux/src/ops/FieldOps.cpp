#include "ops/FieldOps.hpp"

#include "util/Logger.hpp"

#include <algorithm>
#include <array>
#include <atomic>
#include <cctype>
#include <cstdio>
#include <cstdlib>
#include <fstream>
#include <iterator>
#include <sstream>
#include <stdexcept>
#include <vector>
#include <filesystem>

#include <curl/curl.h>

#ifdef _WIN32
#define PLAYER_LINUX_NO_FIELD 1
#else
#include <csignal>
#include <sys/types.h>
#include <sys/wait.h>
#include <unistd.h>
#endif

namespace fs = std::filesystem;

namespace player::ops {

namespace {

std::atomic<bool> gKioskEscape{false};

size_t fileWrite(char* ptr, size_t size, size_t nmemb, void* stream) {
  auto* out = static_cast<std::ofstream*>(stream);
  out->write(ptr, static_cast<std::streamsize>(size * nmemb));
  return size * nmemb;
}

std::string shellQuote(const std::string& s) {
  std::string o = "'";
  for (char c : s) {
    if (c == '\'') o += "'\\''";
    else o += c;
  }
  o += "'";
  return o;
}

std::string lower(std::string s) {
  for (char& c : s) c = static_cast<char>(std::tolower(static_cast<unsigned char>(c)));
  return s;
}

}  // namespace

CmdResult run(const std::string& command, int timeoutSec) {
  CmdResult r;
#ifdef PLAYER_LINUX_NO_FIELD
  r.err = "não suportado neste SO de build";
  return r;
#else
  std::string wrapped = "timeout " + std::to_string(std::max(1, timeoutSec)) + "s bash -lc " +
                        shellQuote(command) + " 2>&1";
  FILE* pipe = popen(wrapped.c_str(), "r");
  if (!pipe) {
    r.err = "popen falhou";
    return r;
  }
  std::array<char, 4096> buf{};
  std::string out;
  while (fgets(buf.data(), static_cast<int>(buf.size()), pipe) != nullptr) out += buf.data();
  const int st = pclose(pipe);
#ifdef WIFEXITED
  if (st != -1 && WIFEXITED(st)) r.exitCode = WEXITSTATUS(st);
  else r.exitCode = st;
#else
  r.exitCode = st;
#endif
  r.out = out;
  return r;
#endif
}

std::string base64Encode(const std::string& binary) {
  static const char* tbl =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  std::string out;
  const auto* data = reinterpret_cast<const unsigned char*>(binary.data());
  const size_t len = binary.size();
  out.reserve(((len + 2) / 3) * 4);
  for (size_t i = 0; i < len; i += 3) {
    unsigned int n = data[i] << 16;
    if (i + 1 < len) n |= data[i + 1] << 8;
    if (i + 2 < len) n |= data[i + 2];
    out.push_back(tbl[(n >> 18) & 63]);
    out.push_back(tbl[(n >> 12) & 63]);
    out.push_back(i + 1 < len ? tbl[(n >> 6) & 63] : '=');
    out.push_back(i + 2 < len ? tbl[n & 63] : '=');
  }
  return out;
}

std::string sha256File(const std::string& path) {
#ifdef PLAYER_LINUX_NO_FIELD
  return "";
#else
  auto r = run("sha256sum -b " + shellQuote(path), 30);
  if (r.exitCode != 0 || r.out.size() < 64) return "";
  std::string hex = r.out.substr(0, 64);
  return lower(hex);
#endif
}

bool downloadFile(const std::string& url, const std::string& destPath, long timeoutSec) {
  CURL* curl = curl_easy_init();
  if (!curl) return false;
  std::error_code ec;
  fs::create_directories(fs::path(destPath).parent_path(), ec);
  std::ofstream out(destPath, std::ios::binary);
  if (!out) {
    curl_easy_cleanup(curl);
    return false;
  }
  curl_easy_setopt(curl, CURLOPT_URL, url.c_str());
  curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, fileWrite);
  curl_easy_setopt(curl, CURLOPT_WRITEDATA, &out);
  curl_easy_setopt(curl, CURLOPT_FOLLOWLOCATION, 1L);
  curl_easy_setopt(curl, CURLOPT_NOSIGNAL, 1L);
  curl_easy_setopt(curl, CURLOPT_CONNECTTIMEOUT, 20L);
  curl_easy_setopt(curl, CURLOPT_TIMEOUT, timeoutSec);
  curl_easy_setopt(curl, CURLOPT_LOW_SPEED_LIMIT, 64L);
  curl_easy_setopt(curl, CURLOPT_LOW_SPEED_TIME, 30L);
  const CURLcode res = curl_easy_perform(curl);
  long status = 0;
  curl_easy_getinfo(curl, CURLINFO_RESPONSE_CODE, &status);
  curl_easy_cleanup(curl);
  out.close();
  if (res != CURLE_OK || status < 200 || status >= 300) {
    fs::remove(destPath, ec);
    return false;
  }
  return true;
}

void applyKiosk(const std::string& kioskMode, int displayRotation) {
#ifdef PLAYER_LINUX_NO_FIELD
  (void)kioskMode;
  (void)displayRotation;
  return;
#else
  if (kioskMode == "off" || kioskMode == "immersive") {
    util::Logger::i("KIOSK", "Modo " + kioskMode + " — sem lock extra");
  } else {
    util::Logger::i("KIOSK", "Modo forte — xset/dpms off + unclutter");
    run("xset s off -dpms 2>/dev/null || true", 5);
    run("xset s noblank 2>/dev/null || true", 5);
    run("unclutter -idle 0.1 -root >/dev/null 2>&1 &", 5);
  }
  const char* rot[] = {"normal", "right", "inverted", "left"};
  const int idx = std::max(0, std::min(3, displayRotation));
  run(std::string("out=$(xrandr 2>/dev/null | awk '/ connected/{print $1; exit}'); "
                  "[ -n \"$out\" ] && xrandr --output \"$out\" --rotate ") +
          rot[idx] + " 2>/dev/null || true",
      8);
#endif
}

void releaseKiosk() {
#ifdef PLAYER_LINUX_NO_FIELD
  return;
#else
  util::Logger::i("KIOSK", "Escape de kiosk (SIGUSR1) — cursor e DPMS restaurados");
  run("pkill -x unclutter 2>/dev/null || true", 5);
  run("xset s on 2>/dev/null || true", 5);
  run("xset +dpms 2>/dev/null || true", 5);
#endif
}

void requestKioskEscape() { gKioskEscape.store(true); }

bool takeKioskEscape() { return gKioskEscape.exchange(false); }

nlohmann::json configureWifi(const nlohmann::json& data) {
  nlohmann::json result;
#ifdef PLAYER_LINUX_NO_FIELD
  throw std::runtime_error("configure_wifi não suportado neste SO de build");
#else
  const std::string ssid = data.value("ssid", data.value("SSID", ""));
  std::string password = data.value("password", data.value("psk", data.value("pass", "")));
  if (ssid.empty()) throw std::runtime_error("ssid obrigatório");
  std::string cmd = "nmcli -w 30 device wifi connect " + shellQuote(ssid);
  if (!password.empty()) cmd += " password " + shellQuote(password);
  auto r = run(cmd, 45);
  result["ssid"] = ssid;
  result["exitCode"] = r.exitCode;
  result["output"] = r.out.substr(0, 500);
  if (r.exitCode != 0) throw std::runtime_error("nmcli falhou: " + r.out);
  util::Logger::i("WIFI", "configure_wifi ssid=" + ssid);
#endif
  return result;
}

nlohmann::json captureScreenshot(const std::string& shotsDir) {
#ifdef PLAYER_LINUX_NO_FIELD
  throw std::runtime_error("screenshot não suportado neste SO de build");
#else
  fs::create_directories(shotsDir);
  const std::string path = shotsDir + "/screen.jpg";
  auto r = run("grim -t jpeg -q 72 " + shellQuote(path) +
                   " 2>/dev/null || import -window root -quality 72 " + shellQuote(path) +
                   " 2>/dev/null || scrot -o " + shellQuote(path) + " 2>/dev/null",
               20);
  run("command -v magick >/dev/null && magick " + shellQuote(path) + " -resize '1280x1280>' " +
          shellQuote(path) + " || command -v convert >/dev/null && convert " + shellQuote(path) +
          " -resize '1280x1280>' " + shellQuote(path) + " || true",
      15);
  if (!fs::exists(path)) throw std::runtime_error("falha a capturar ecrã (grim/import/scrot)");
  std::ifstream in(path, std::ios::binary);
  std::string bytes((std::istreambuf_iterator<char>(in)), std::istreambuf_iterator<char>());
  nlohmann::json result;
  result["filePath"] = path;
  result["fileSize"] = static_cast<int>(bytes.size());
  result["format"] = "jpg";
  result["width"] = 0;
  result["height"] = 0;
  result["imageBase64"] = base64Encode(bytes);
  (void)r;
  return result;
#endif
}

std::optional<OtaPackage> parseOta(const nlohmann::json& j) {
  if (!j.is_object()) return std::nullopt;
  OtaPackage p;
  p.id = j.value("id", 0);
  p.version = j.value("version", "");
  p.checksum = lower(j.value("checksum", ""));
  p.downloadUrl = j.value("downloadUrl", j.value("download_url", ""));
  p.isMandatory = j.value("isMandatory", j.value("is_mandatory", false));
  if (p.version.empty() || p.downloadUrl.empty()) return std::nullopt;
  return p;
}

void downloadOtaDeb(const OtaPackage& pkg, const std::string& serverUrl, const std::string& otaDir,
                    const std::string& uin, const std::string& token) {
#ifdef PLAYER_LINUX_NO_FIELD
  (void)pkg;
  (void)serverUrl;
  (void)otaDir;
  (void)uin;
  (void)token;
  throw std::runtime_error("OTA Linux não suportado neste SO de build");
#else
  fs::create_directories(otaDir);
  std::string url = pkg.downloadUrl;
  if (!url.empty() && url[0] == '/') url = serverUrl + url;
  if (!uin.empty() && url.find("uin=") == std::string::npos) {
    url += (url.find('?') == std::string::npos ? "?" : "&");
    url += "uin=" + uin + "&token=" + token;
  }
  const std::string dest = otaDir + "/incoming.deb";
  util::Logger::i("OTA", "download " + url);
  if (!downloadFile(url, dest, 300)) throw std::runtime_error("download OTA falhou");
  if (!pkg.checksum.empty()) {
    const std::string got = sha256File(dest);
    if (got != pkg.checksum && got != lower(pkg.checksum)) {
      throw std::runtime_error("checksum OTA inválido");
    }
  }
#endif
}

nlohmann::json installIncomingDeb(const std::string& otaDir, const std::string& version) {
#ifdef PLAYER_LINUX_NO_FIELD
  (void)otaDir;
  (void)version;
  throw std::runtime_error("OTA Linux não suportado neste SO de build");
#else
  const std::string dest = otaDir + "/incoming.deb";
  const std::string last = otaDir + "/last.deb";
  if (!fs::exists(dest)) throw std::runtime_error("incoming.deb ausente");
  if (fs::exists(last)) {
    std::error_code ec;
    fs::copy_file(last, otaDir + "/prev.deb", fs::copy_options::overwrite_existing, ec);
  }
  {
    std::error_code ec;
    fs::copy_file(dest, last, fs::copy_options::overwrite_existing, ec);
  }
  auto inst = run("DEBIAN_FRONTEND=noninteractive dpkg -i " + shellQuote(dest) +
                      " || apt-get install -f -y",
                  180);
  nlohmann::json result;
  result["version"] = version;
  result["exitCode"] = inst.exitCode;
  result["output"] = inst.out.substr(0, 800);
  if (inst.exitCode != 0) throw std::runtime_error("dpkg falhou: " + inst.out);
  util::Logger::i("OTA", "instalado " + version);
  return result;
#endif
}

nlohmann::json applyOta(const OtaPackage& pkg, const std::string& serverUrl, const std::string& otaDir,
                        const std::string& uin, const std::string& token) {
  downloadOtaDeb(pkg, serverUrl, otaDir, uin, token);
  return installIncomingDeb(otaDir, pkg.version);
}

ChildProc spawnHtmlKiosk(const std::string& fileOrUrl) {
  ChildProc p;
#ifdef PLAYER_LINUX_NO_FIELD
  (void)fileOrUrl;
  return p;
#else
  std::string uri = fileOrUrl;
  if (uri.find("://") == std::string::npos) uri = "file://" + fileOrUrl;
  const pid_t pid = fork();
  if (pid < 0) throw std::runtime_error("fork HTML kiosk falhou");
  if (pid == 0) {
    (void)setpgid(0, 0);
    const std::string appArg = "--app=" + uri;
    const char* browsers[] = {"chromium", "chromium-browser", "google-chrome-stable",
                              "google-chrome", nullptr};
    for (int i = 0; browsers[i]; ++i) {
      execlp(browsers[i], browsers[i], "--kiosk", "--noerrdialogs", "--disable-infobars",
             "--disable-session-crashed-bubble", "--check-for-update-interval=31536000",
             appArg.c_str(), static_cast<char*>(nullptr));
    }
    execlp("firefox", "firefox", "--kiosk", uri.c_str(), static_cast<char*>(nullptr));
    _exit(127);
  }
  p.pid = static_cast<long>(pid);
  (void)setpgid(pid, pid);
  util::Logger::i("PLAYBACK", "HTML kiosk pid=" + std::to_string(p.pid) + " uri=" + uri);
  return p;
#endif
}

void killChild(ChildProc proc) {
#ifdef PLAYER_LINUX_NO_FIELD
  (void)proc;
#else
  if (proc.pid <= 0) return;
  const pid_t pid = static_cast<pid_t>(proc.pid);
  (void)kill(-pid, SIGTERM);
  (void)kill(pid, SIGTERM);
  usleep(400000);
  (void)kill(-pid, SIGKILL);
  (void)kill(pid, SIGKILL);
  int st = 0;
  (void)waitpid(pid, &st, 0);
#endif
}

bool childAlive(ChildProc& proc) {
#ifdef PLAYER_LINUX_NO_FIELD
  (void)proc;
  return false;
#else
  if (proc.pid <= 0) return false;
  int st = 0;
  const pid_t r = waitpid(static_cast<pid_t>(proc.pid), &st, WNOHANG);
  if (r == 0) return true;
  proc.pid = -1;
  return false;
#endif
}

nlohmann::json rollbackOta(const std::string& otaDir) {
#ifdef PLAYER_LINUX_NO_FIELD
  throw std::runtime_error("OTA rollback não suportado neste SO de build");
#else
  const std::string prev = otaDir + "/prev.deb";
  if (!fs::exists(prev)) throw std::runtime_error("sem pacote anterior para rollback");
  auto inst = run("DEBIAN_FRONTEND=noninteractive dpkg -i " + shellQuote(prev) +
                      " || apt-get install -f -y",
                  180);
  nlohmann::json result;
  result["rolledBack"] = true;
  result["exitCode"] = inst.exitCode;
  if (inst.exitCode != 0) throw std::runtime_error("rollback dpkg falhou");
  return result;
#endif
}

}  // namespace player::ops
