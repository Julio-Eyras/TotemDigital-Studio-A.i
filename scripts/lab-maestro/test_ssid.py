#!/usr/bin/env python3
"""Testes SSID Maestro 0.1 — duas boxes virtuais, sem AP e sem Player-AD."""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(REPO / "scripts" / "lab-emulate"))

from ssid_measure import measure_ssid_pair, players_box, store_box  # noqa: E402
from mocks import mock_maestro_player_accepts  # noqa: E402

PITCH_DIR = REPO / "docs" / "manuais"
PITCH_FILES = sorted(PITCH_DIR.glob("12-ROTEIRO-DEMO-15-MIN.md")) + sorted(
    PITCH_DIR.glob("06-APRESENTACAO-COMERCIAL-SAAS.md")
)
PITCH_FORBIDDEN = re.compile(r"maestro/0\.1|SSID de players|ssid de players", re.IGNORECASE)


def fail(msg: str) -> None:
    print(f"FAIL {msg}")
    raise SystemExit(1)


def main() -> int:
    ok = measure_ssid_pair(players_box(), players_box())
    if not ok.ok or ok.code is not None:
        fail(f"players 5 GHz deve passar {ok.as_dict()}")
    print("PASS duas boxes no SSID de players 5 GHz")

    store = measure_ssid_pair(players_box(), store_box())
    if store.ok or store.code != "SSID_STORE":
        fail(f"Wi-Fi da loja {store.as_dict()}")
    print("PASS uma box na Wi-Fi da loja -> SSID_STORE")

    mixed = measure_ssid_pair(players_box("totem-a"), players_box("totem-b"))
    if mixed.ok or mixed.code != "SSID_MIXED":
        fail(f"SSIDs diferentes {mixed.as_dict()}")
    print("PASS SSIDs diferentes -> SSID_MIXED")

    band = measure_ssid_pair(players_box(band_ghz=2.4), players_box(band_ghz=2.4))
    if band.ok or band.code != "SSID_BAND":
        fail(f"2.4 GHz {band.as_dict()}")
    print("PASS 2.4 GHz -> SSID_BAND")

    shared = measure_ssid_pair(players_box(store_clients=True), players_box(store_clients=True))
    if shared.ok or shared.code != "SSID_SHARED":
        fail(f"clientes da loja no AP {shared.as_dict()}")
    print("PASS clientes da loja no AP -> SSID_SHARED")

    declared_ok = {"role": "players", "ssid": "totem-players"}
    lie = measure_ssid_pair(store_box(), store_box(), declared=declared_ok)
    if lie.ok or lie.code != "SSID_STORE":
        fail("declarado players nao pode ganhar a medicao na loja")
    cue = json.loads(
        (REPO / "docs" / "lab-maestro" / "examples" / "01-play-t0.json").read_text(encoding="utf-8")
    )
    play_ntp = mock_maestro_player_accepts(cue)
    play_ssid = mock_maestro_player_accepts(cue, ssid=lie.as_dict())
    if not play_ntp["accepted"]:
        fail("NTP 18 ms sozinho ainda aceita (SSID nao informado)")
    if play_ssid["code"] != "SSID_STORE":
        fail(f"NTP ok + SSID loja deve recusar {play_ssid}")
    print("PASS medicao SSID ganha ao JSON; NTP ok nao salva Wi-Fi da loja")

    play_ok = mock_maestro_player_accepts(cue, ssid=ok.as_dict())
    if not play_ok["accepted"]:
        fail("SSID players + NTP 18 ms deve tocar")
    print("PASS SSID players + NTP 18 ms -> cue aceite")

    if len(PITCH_FILES) < 2:
        fail("faltam ficheiros de pitch 12-/06- em docs/manuais")
    for path in PITCH_FILES:
        if not path.is_file():
            fail(f"pitch em falta {path}")
        text = path.read_text(encoding="utf-8", errors="replace")
        if PITCH_FORBIDDEN.search(text):
            fail(f"pitch/kit nao pode vender Maestro SSID: {path.name}")
    print("PASS demo 15 min / SaaS pitch nao mencionam SSID de players")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
