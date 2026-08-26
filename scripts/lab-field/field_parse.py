"""Pre-voo de campo Maestro/ACE 0.1 — dumpsys/epoch, sem Player-AD.

Sem 2 boxes ADB: skip NO_HARDWARE (o lab continua).
A medicao ganha ao JSON. Nunca faz UPDATE em Postgres.
"""

from __future__ import annotations

import re
import shutil
import subprocess
from typing import Any

PLAYERS_SSIDS = frozenset({"totem-players"})
CLOCK_DRIFT_MAX_MS = 200
SSID_RE = re.compile(r'SSID:\s*"([^"]+)"', re.IGNORECASE)
SSID_BARE_RE = re.compile(r"SSID:\s*([^\s,<>]+)", re.IGNORECASE)
FREQ_RE = re.compile(r"(?:Frequency|freq)\s*[:=]\s*(\d{4,5})", re.IGNORECASE)
UNKNOWN_SSID = re.compile(r"unknown ssid|ssid:\s*<?unknown>?", re.IGNORECASE)


def band_ghz_from_mhz(mhz: int) -> float:
    if 2400 <= mhz <= 2500:
        return 2.4
    if 4900 <= mhz <= 5899:
        return 5.0
    if 5925 <= mhz <= 7125:
        return 6.0
    return 0.0


def parse_ssid(dumpsys: str) -> str:
    if UNKNOWN_SSID.search(dumpsys or ""):
        return ""
    quoted = SSID_RE.search(dumpsys or "")
    if quoted:
        return quoted.group(1).strip()
    bare = SSID_BARE_RE.search(dumpsys or "")
    if bare:
        raw = bare.group(1).strip().strip(",")
        if raw.lower() in {"null", "none", "<unknown>"}:
            return ""
        return raw
    return ""


def parse_freq_mhz(dumpsys: str) -> int:
    match = FREQ_RE.search(dumpsys or "")
    if not match:
        return 0
    try:
        return int(match.group(1))
    except ValueError:
        return 0


def wifi_to_box(dumpsys: str, store_clients: bool = False) -> dict[str, Any]:
    ssid = parse_ssid(dumpsys)
    mhz = parse_freq_mhz(dumpsys)
    band = band_ghz_from_mhz(mhz)
    if ssid in PLAYERS_SSIDS:
        role = "players"
    elif ssid:
        role = "store"
    else:
        role = "unknown"
    return {
        "ssid": ssid,
        "freq_mhz": mhz,
        "band_ghz": band,
        "role": role,
        "store_clients": store_clients,
    }


def parse_epoch_ms(raw: str) -> int | None:
    text = (raw or "").strip().splitlines()[0].strip() if raw else ""
    if not text:
        return None
    try:
        value = int(text)
    except ValueError:
        return None
    if value < 10_000_000_000:
        return value * 1000
    return value


def list_adb_serials(adb_devices_out: str) -> list[str]:
    serials: list[str] = []
    for line in (adb_devices_out or "").splitlines():
        parts = line.strip().split()
        if len(parts) >= 2 and parts[1] == "device" and parts[0] != "List":
            serials.append(parts[0])
    return serials


def adb_bin() -> str | None:
    return shutil.which("adb")


def live_adb_serials(timeout_s: float = 5.0) -> dict[str, Any]:
    binary = adb_bin()
    if not binary:
        return {"serials": [], "code": "NO_ADB", "skipped": True}
    try:
        proc = subprocess.run(
            [binary, "devices"],
            capture_output=True,
            text=True,
            timeout=timeout_s,
            check=False,
        )
    except (OSError, subprocess.TimeoutExpired) as exc:
        return {"serials": [], "code": "ADB_FAIL", "skipped": True, "reason": type(exc).__name__}
    serials = list_adb_serials(proc.stdout or "")
    if len(serials) < 2:
        return {"serials": serials, "code": "NO_HARDWARE", "skipped": True}
    return {"serials": serials[:2], "code": None, "skipped": False}


def adb_shell(serial: str, args: list[str], timeout_s: float = 8.0) -> str:
    binary = adb_bin()
    if not binary:
        return ""
    try:
        proc = subprocess.run(
            [binary, "-s", serial, "shell", *args],
            capture_output=True,
            text=True,
            timeout=timeout_s,
            check=False,
        )
    except (OSError, subprocess.TimeoutExpired):
        return ""
    return proc.stdout or ""


def measure_epochs(epoch_a_ms: int | None, epoch_b_ms: int | None) -> dict[str, Any]:
    if epoch_a_ms is None or epoch_b_ms is None:
        return {
            "ntp_ok": False,
            "drift_ms": None,
            "accepted": False,
            "code": "CLOCK_DRIFT",
        }
    drift = int(epoch_a_ms - epoch_b_ms)
    accepted = abs(drift) <= CLOCK_DRIFT_MAX_MS
    return {
        "ntp_ok": True,
        "drift_ms": drift,
        "accepted": accepted,
        "code": None if accepted else "CLOCK_DRIFT",
        "offset_a_ms": epoch_a_ms,
        "offset_b_ms": epoch_b_ms,
    }
