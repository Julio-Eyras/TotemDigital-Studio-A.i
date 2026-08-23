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

    face = json.loads((REPO / "docs" / "lab-tdep" / "examples" / "01-face.json").read_text(encoding="utf-8"))
    if not mock_tdep_partner_accepts(face)["accepted"]:
        fail("tdep face")
    leak = dict(face)
    leak["audience"] = {"count": 1}
    if mock_tdep_partner_accepts(leak)["code"] != "AUDIENCE_FORBIDDEN":
        fail("tdep audience")
    print("PASS tdep partner mock")

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
