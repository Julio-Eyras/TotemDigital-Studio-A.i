#pragma once

namespace player::util {

/** sd_notify via NOTIFY_SOCKET (sem libsystemd). No-op se systemd não estiver a gerir o processo. */
void systemdNotifyReady();
void systemdNotifyWatchdog();

}  // namespace player::util
