#!/usr/bin/env python3
"""Pre-voo de campo: dumpsys/epoch (fixtures). Sem 2 boxes o lab nao falha."""

from __future__ import annotations

import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(REPO / "scripts" / "lab-maestro"))
sys.path.insert(0, str(REPO / "scripts" / "lab-emulate"))

from field_parse import (  # noqa: E402
    list_adb_serials,
    live_adb_serials,
    measure_epochs,
    parse_epoch_ms,
    wifi_to_box,
)
from ssid_measure import measure_ssid_pair  # noqa: E402

EX = REPO / "docs" / "lab-field" / "examples"
PITCH_DIR = REPO / "docs" / "manuais"
PITCH_FILES = sorted(PITCH_DIR.glob("12-ROTEIRO-DEMO-15-MIN.md")) + sorted(
    PITCH_DIR.glob("06-APRESENTACAO-COMERCIAL-SAAS.md")
)
PITCH_FORBIDDEN = re.compile(r"maestro/0\.1|SSID de players|lab-field", re.IGNORECASE)


def fail(msg: str) -> None:
    print(f"FAIL {msg}")
    raise SystemExit(1)


def load_ex(name: str) -> str:
    return (EX / name).read_text(encoding="utf-8")


def main() -> int:
    players = wifi_to_box(load_ex("dumpsys-wifi-players.txt"))
    if players["role"] != "players" or players["band_ghz"] != 5.0:
        fail(f"players dumpsys {players}")
    ok = measure_ssid_pair(players, dict(players))
    if not ok.ok:
        fail(f"pair players {ok.as_dict()}")
    print("PASS dumpsys players 5 GHz -> cue SSID ok")

    store = wifi_to_box(load_ex("dumpsys-wifi-store.txt"))
    store_m = measure_ssid_pair(players, store)
    if store_m.code != "SSID_STORE":
        fail(f"loja {store_m.as_dict()}")
    print("PASS dumpsys loja -> SSID_STORE")

    band = wifi_to_box(load_ex("dumpsys-wifi-24ghz.txt"))
    band_m = measure_ssid_pair(band, dict(band))
    if band_m.code != "SSID_BAND":
        fail(f"2.4 {band_m.as_dict()}")
    print("PASS dumpsys totem-players em 2.4 GHz -> SSID_BAND")

    if parse_epoch_ms("1710000000") != 1_710_000_000_000:
        fail("epoch segundos deve virar ms")
    aligned = measure_epochs(1_000_018, 1_000_000)
    if not aligned["accepted"] or abs(aligned["drift_ms"]) != 18:
        fail(f"epoch 18ms {aligned}")
    print("PASS epoch |drift|=18 ms -> aceite")

    drifted = measure_epochs(1_000_480, 1_000_000)
    if drifted["accepted"] or drifted["code"] != "CLOCK_DRIFT":
        fail(f"epoch 480 {drifted}")
    print("PASS epoch |drift|=480 ms -> CLOCK_DRIFT")

    missing = measure_epochs(None, 1)
    if missing["ntp_ok"] or missing["code"] != "CLOCK_DRIFT":
        fail(f"epoch em falta {missing}")
    print("PASS epoch em falta -> CLOCK_DRIFT")

    serials = list_adb_serials(
        "List of devices attached\nABC\tdevice\nDEF\tunauthorized\nGHI\tdevice\n"
    )
    if serials != ["ABC", "GHI"]:
        fail(f"adb devices {serials}")
    live = live_adb_serials()
    if (not live.get("skipped") and len(live.get("serials") or []) < 2) or (
        live.get("skipped") and live.get("code") not in {"NO_ADB", "NO_HARDWARE", "ADB_FAIL"}
    ):
        fail(f"live adb inconsistente {live}")
    print(f"PASS adb live: {live.get('code') or 'par presente (nao falha o lab)'}")

    src = (HERE / "field_parse.py").read_text(encoding="utf-8")
    if re.search(r"^\s*(from|import)\s+Player", src, re.IGNORECASE | re.MULTILINE):
        fail("field_parse nao importa Player-AD")
    print("PASS field_parse nao toca no Player-AD")

    if len(PITCH_FILES) < 2:
        fail("pitch files")
    for path in PITCH_FILES:
        if PITCH_FORBIDDEN.search(path.read_text(encoding="utf-8", errors="replace")):
            fail(f"pitch {path.name}")
    print("PASS pitch 15 min nao vende pre-voo de campo")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
