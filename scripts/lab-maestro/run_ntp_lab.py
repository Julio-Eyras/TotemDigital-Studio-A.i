#!/usr/bin/env python3
"""
Lab NTP Maestro 0.1 — duas boxes virtuais (sem hardware).

A medicao preenche clock.ntp_ok / clock.drift_ms. Player-AD nao e alterado.
UDP/123 e opcional; se a rede bloquear, o lab continua OK.
"""

from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(REPO / "scripts" / "lab-emulate"))

from ntp_measure import cue_clock_from_measurement, measure_pair, probe_sntp  # noqa: E402
from mocks import mock_maestro_player_accepts as mock_maestro_player_accepts  # noqa: E402


def main() -> int:
    examples = REPO / "docs" / "lab-maestro" / "examples"
    template = json.loads((examples / "01-play-t0.json").read_text(encoding="utf-8"))

    aligned = measure_pair(18, 0)
    drifted = measure_pair(480, 0)
    unsync = measure_pair(12, 8, ntp_ok_a=False)

    cue_ok = dict(template)
    cue_ok["clock"] = cue_clock_from_measurement(aligned, template.get("clock"))
    cue_bad = dict(template)
    cue_bad["clock"] = cue_clock_from_measurement(drifted, template.get("clock"))

    play_ok = mock_maestro_player_accepts(cue_ok)
    play_bad = mock_maestro_player_accepts(cue_bad)
    live = probe_sntp()

    checks = {
        "pair_18ms_accepted": aligned.accepted and play_ok["accepted"] is True,
        "pair_480ms_clock_drift": (not drifted.accepted)
        and play_bad["code"] == "CLOCK_DRIFT"
        and abs(cue_bad["clock"]["drift_ms"]) == 480,
        "ntp_off_refused": unsync.code == "CLOCK_DRIFT",
        "measurement_overrides_json": cue_bad["clock"]["drift_ms"] != template["clock"]["drift_ms"],
        "no_pixels": "pixels" not in cue_ok,
    }
    report = {
        "at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "ok": all(checks.values()),
        "checks": checks,
        "aligned": aligned.as_dict(),
        "drifted": drifted.as_dict(),
        "live_sntp": live,
        "note": "Boxes virtuais. Hardware real: repetir measure_pair com offsets lidos das 2 TV boxes.",
    }
    out = REPO / "logs" / "lab-ntp-report.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")

    print(json.dumps({"ok": report["ok"], "checks": checks, "live_sntp_skipped": live.get("skipped")}, ensure_ascii=False, indent=2))
    print(f"report {out}")
    if live.get("skipped"):
        print("live SNTP skipped (rede/firewall) — lab in-memory continua valido")
    return 0 if report["ok"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
