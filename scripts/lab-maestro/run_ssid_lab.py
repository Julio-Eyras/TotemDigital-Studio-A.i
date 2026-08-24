#!/usr/bin/env python3
"""
Lab SSID Maestro 0.1 — duas boxes virtuais (sem AP fisico).

Pre-voo: so no SSID de players 5/6 GHz, sem clientes da loja.
Player-AD nao e alterado. SKU B / CEC continuam fora.
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

from ssid_measure import measure_ssid_pair, players_box, store_box  # noqa: E402
from mocks import mock_maestro_player_accepts  # noqa: E402


def main() -> int:
    aligned = measure_ssid_pair(players_box(), players_box())
    store = measure_ssid_pair(players_box(), store_box())
    cue = json.loads((REPO / "docs" / "lab-maestro" / "examples" / "01-play-t0.json").read_text(encoding="utf-8"))
    play_ok = mock_maestro_player_accepts(cue, ssid=aligned.as_dict())
    play_store = mock_maestro_player_accepts(cue, ssid=store.as_dict())

    checks = {
        "players_5ghz": aligned.ok and play_ok["accepted"] is True,
        "store_wifi_blocked": store.code == "SSID_STORE" and play_store["code"] == "SSID_STORE",
        "ntp_does_not_override_ssid": play_store["accepted"] is False,
        "no_sku_b": "pixels" not in cue,
    }
    report = {
        "at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "ok": all(checks.values()),
        "checks": checks,
        "aligned": aligned.as_dict(),
        "store": store.as_dict(),
        "note": "Boxes virtuais. Campo: repetir measure_ssid_pair com o SSID/banda lidos das 2 TV boxes.",
    }
    out = REPO / "logs" / "lab-ssid-report.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"ok": report["ok"], "checks": checks}, ensure_ascii=False, indent=2))
    print(f"report {out}")
    return 0 if report["ok"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
