#include "util/SystemdWatchdog.hpp"

#include <cstddef>
#include <cstring>

#ifndef _WIN32
#include <sys/socket.h>
#include <sys/un.h>
#include <unistd.h>
#include <cstdlib>
#endif

namespace player::util {

#ifndef _WIN32

namespace {

void sendNotify(const char* state) {
  const char* path = std::getenv("NOTIFY_SOCKET");
  if (!path || !path[0] || !state) return;

  sockaddr_un addr{};
  addr.sun_family = AF_UNIX;
  size_t pathLen = 0;
  if (path[0] == '@') {
    addr.sun_path[0] = '\0';
    const size_t n = std::strlen(path + 1);
    if (n >= sizeof(addr.sun_path) - 1) return;
    std::memcpy(addr.sun_path + 1, path + 1, n);
    pathLen = 1 + n;
  } else {
    const size_t n = std::strlen(path);
    if (n >= sizeof(addr.sun_path)) return;
    std::memcpy(addr.sun_path, path, n + 1);
    pathLen = n;
  }

  const int fd = socket(AF_UNIX, SOCK_DGRAM | SOCK_CLOEXEC, 0);
  if (fd < 0) return;
  const socklen_t alen = static_cast<socklen_t>(offsetof(sockaddr_un, sun_path) + pathLen);
  (void)sendto(fd, state, std::strlen(state), 0, reinterpret_cast<sockaddr*>(&addr), alen);
  close(fd);
}

}  // namespace

void systemdNotifyReady() { sendNotify("READY=1"); }
void systemdNotifyWatchdog() { sendNotify("WATCHDOG=1"); }

#else

void systemdNotifyReady() {}
void systemdNotifyWatchdog() {}

#endif

}  // namespace player::util
