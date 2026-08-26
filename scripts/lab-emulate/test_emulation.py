#!/usr/bin/env python3
"""Testes unitários dos mocks de emulação lab (sem I/O de produto)."""

from __future__ import annotations

import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(REPO / "scripts" / "lab-ace"))

from ace_rules import ace_context_to_hint, apply_ace_hint_to_weight  # noqa: E402
from mocks import (  # noqa: E402
    mock_dispatcher_rank,
    mock_fx_bus_publish,
    mock_maestro_player_accepts,
    mock_tdep_partner_accepts,
)


def fail(msg: str) -> None:
    print(f"FAIL {msg}")
    raise SystemExit(1)


def main() -> int:
    hint = {
        "category": "PREMIUM",
        "priority_delta": 30,
        "reason": "test",
    }
    cands = [
        {"id": "a", "base_weight": 100, "commercial_tier": "premium"},
        {"id": "b", "base_weight": 10, "commercial_tier": "remnant"},
    ]
    on = mock_dispatcher_rank(cands, hint, True, apply_ace_hint_to_weight)
    off = mock_dispatcher_rank(cands, hint, False, apply_ace_hint_to_weight)
    if on[0]["weight"] != 135 or off[0]["weight"] != 100:
        fail(f"dispatcher {on[0]['weight']} {off[0]['weight']}")
    print("PASS dispatcher mock ACE on/off")

    wire = mock_fx_bus_publish(41, hint, True)
    if wire is None or wire["msg_type"] != "ace.hint" or "session_id" in json.dumps(wire):
        fail(f"fx {wire}")
    if mock_fx_bus_publish(41, hint, False) is not None:
        fail("fx off")
    print("PASS fx bus mock")

    cue_ok = json.loads((REPO / "docs" / "lab-maestro" / "examples" / "01-play-t0.json").read_text(encoding="utf-8"))
    cue_drift = json.loads((REPO / "docs" / "lab-maestro" / "examples" / "reject-clock-drift.json").read_text(encoding="utf-8"))
    if not mock_maestro_player_accepts(cue_ok)["accepted"]:
        fail("maestro ok")
    if mock_maestro_player_accepts(cue_drift)["code"] != "CLOCK_DRIFT":
        fail("maestro drift")
    print("PASS maestro player mock")

    sys.path.insert(0, str(REPO / "scripts" / "lab-maestro"))
    from ntp_measure import measure_pair  # noqa: E402

    aligned = measure_pair(18, 0)
    drifted = measure_pair(480, 0)
    if not aligned.accepted or drifted.code != "CLOCK_DRIFT":
        fail(f"ntp pair {aligned.as_dict()} {drifted.as_dict()}")
    print("PASS ntp pair virtual 18/480")

    sys.path.insert(0, str(REPO / "scripts" / "lab-maestro"))
    from ssid_measure import measure_ssid_pair, players_box, store_box  # noqa: E402

    ssid_ok = measure_ssid_pair(players_box(), players_box())
    ssid_store = measure_ssid_pair(players_box(), store_box())
    if not ssid_ok.ok or ssid_store.code != "SSID_STORE":
        fail(f"ssid {ssid_ok.as_dict()} {ssid_store.as_dict()}")
    print("PASS ssid pair players vs loja")

    face = json.loads((REPO / "docs" / "lab-tdep" / "examples" / "01-face.json").read_text(encoding="utf-8"))
    if not mock_tdep_partner_accepts(face)["accepted"]:
        fail("tdep face")
    leak = dict(face)
    leak["audience"] = {"count": 1}
    if mock_tdep_partner_accepts(leak)["code"] != "AUDIENCE_FORBIDDEN":
        fail("tdep audience")
    if mock_tdep_partner_accepts({**face, "handshake_ok": False})["code"] != "NO_HANDSHAKE":
        fail("tdep no handshake")
    if mock_tdep_partner_accepts({**face, "handshake_ts": "2020-01-01T00:00:00.000Z"})["code"] != "HANDSHAKE_REPLAY":
        fail("tdep handshake replay")
    print("PASS tdep partner mock")

    sys.path.insert(0, str(REPO / "scripts" / "lab-tdep"))
    from tdep_policy import seller_decide  # noqa: E402

    flight = json.loads((REPO / "docs" / "lab-tdep" / "examples" / "02-flight-offered.json").read_text(encoding="utf-8"))
    availability = json.loads((REPO / "docs" / "lab-tdep" / "examples" / "05-availability.json").read_text(encoding="utf-8"))
    creative = json.loads((REPO / "docs" / "lab-tdep" / "examples" / "06-creative.json").read_text(encoding="utf-8"))
    landscape = json.loads(
        (REPO / "docs" / "lab-tdep" / "examples" / "reject-creative-landscape-only.json").read_text(encoding="utf-8")
    )
    if not seller_decide(face, creative, flight, availability)["accepted"]:
        fail("tdep fill")
    if seller_decide(face, landscape, flight, availability)["code"] != "FORMAT_MISMATCH":
        fail("tdep variant")
    print("PASS tdep seller policy")

    from tdep_lane import apply_tdep_lane  # noqa: E402

    lane = apply_tdep_lane(
        [
            {"id": "direct-local", "weight": 100, "lane": "local"},
            {"id": "tdep-fill", "weight": 900, "lane": "tdep_fill"},
            {"id": "idle", "weight": 1, "lane": "idle"},
        ],
        enabled=True,
        flight_accepted=True,
    )
    if lane["winner_lane"] != "local":
        fail(f"tdep lane {lane}")
    print("PASS tdep dispatcher lane: local > fill")

    closed = {
        "presence": True,
        "count": 1,
        "attention": "low",
        "dwell_ms": 200,
        "interaction": {"touch": False, "qr": False, "nfc": False},
        "motion": {"approaching": 0},
        "clock": {"store_open": False},
    }
    fill = ace_context_to_hint(closed)
    if not fill or fill["category"] != "FILL":
        fail(f"fill {fill}")
    print("PASS FILL rule")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
