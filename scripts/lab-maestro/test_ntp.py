#!/usr/bin/env python3
"""Testes NTP Maestro 0.1 — duas boxes virtuais, sem Player-AD."""

from __future__ import annotations

import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(REPO / "scripts" / "lab-emulate"))

from ntp_measure import (  # noqa: E402
    CLOCK_DRIFT_MAX_MS,
    cue_clock_from_measurement,
    measure_pair,
    ntp_offset_ms,
    simulate_exchange,
)
from mocks import mock_maestro_player_accepts as mock_maestro_player_accepts  # noqa: E402


def fail(msg: str) -> None:
    print(f"FAIL {msg}")
    raise SystemExit(1)


def main() -> int:
    t1, t2, t3, t4 = simulate_exchange(18, 0, rtt_ms=4)
    if round(ntp_offset_ms(t1, t2, t3, t4)) != -18:
        fail(f"offset Cristian 18ms -> {ntp_offset_ms(t1, t2, t3, t4)}")
    print("PASS SNTP: box +18 ms vs maestro -> offset -18")

    aligned = measure_pair(18, 0)
    if not aligned.accepted or abs(aligned.drift_ms) != 18:
        fail(f"par alinhado {aligned.as_dict()}")
    print("PASS duas boxes |drift|=18 ms -> cue aceite")

    drifted = measure_pair(480, 0)
    if drifted.accepted or drifted.code != "CLOCK_DRIFT" or abs(drifted.drift_ms) != 480:
        fail(f"par desfasado {drifted.as_dict()}")
    print("PASS duas boxes |drift|=480 ms -> CLOCK_DRIFT")

    unsync = measure_pair(0, 0, ntp_ok_a=False)
    if unsync.accepted or unsync.ntp_ok or unsync.code != "CLOCK_DRIFT":
        fail(f"ntp_ok false {unsync.as_dict()}")
    print("PASS ntp_ok false -> CLOCK_DRIFT mesmo com drift 0")

    examples = REPO / "docs" / "lab-maestro" / "examples"
    declared = json.loads((examples / "01-play-t0.json").read_text(encoding="utf-8"))
    lie = measure_pair(480, 0)
    clock = cue_clock_from_measurement(lie, declared.get("clock"))
    if clock["drift_ms"] == declared["clock"]["drift_ms"]:
        fail("medicao nao pode perder para o JSON declarado")
    cue = dict(declared)
    cue["clock"] = clock
    if mock_maestro_player_accepts(cue)["code"] != "CLOCK_DRIFT":
        fail("JSON diz 18 ms mas relogios 480 ms devem recusar")
    print("PASS medicao ganha ao JSON (cue mentiroso recusado)")

    honest = measure_pair(18, 0)
    cue2 = dict(declared)
    cue2["clock"] = cue_clock_from_measurement(honest, declared.get("clock"))
    if not mock_maestro_player_accepts(cue2)["accepted"]:
        fail("cue honesto 18 ms deve tocar")
    print("PASS cue preenchido pela medicao 18 ms aceite")

    if CLOCK_DRIFT_MAX_MS != 200:
        fail("limite tem de ser 200 ms")
    print("PASS limite CLOCK_DRIFT = 200 ms")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
