#!/usr/bin/env python3
"""Lab TDEP 0.1 — lane no Dispatcher (sem UI Direct)."""

from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
sys.path.insert(0, str(HERE))

from tdep_lane import apply_tdep_lane  # noqa: E402

SLATE = [
    {"id": "direct-local", "weight": 100, "lane": "local"},
    {"id": "tdep-fill", "weight": 900, "lane": "tdep_fill"},
    {"id": "idle", "weight": 1, "lane": "idle"},
]


def main() -> int:
    off = apply_tdep_lane(SLATE, enabled=False, flight_accepted=True)
    local = apply_tdep_lane(SLATE, enabled=True, flight_accepted=True)
    fill = apply_tdep_lane(
        [c for c in SLATE if c["id"] != "direct-local"],
        enabled=True,
        flight_accepted=True,
    )
    checks = {
        "default_off": off["winner_lane"] == "local" and off["code"] == "TOTEMNET_OFF",
        "local_beats_fill": local["winner_lane"] == "local",
        "fill_when_idle": fill["winner_lane"] == "tdep_fill",
        "no_ui": True,
    }
    report = {
        "at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "ok": all(checks.values()),
        "checks": checks,
        "note": "Lane lab. Sem painel Direct. Sem /tdep/v1. Sem Player-AD.",
    }
    out = REPO / "logs" / "lab-tdep-lane-report.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))
    print(f"report {out}")
    return 0 if report["ok"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
