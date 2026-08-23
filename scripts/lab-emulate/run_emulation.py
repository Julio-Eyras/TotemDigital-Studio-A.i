#!/usr/bin/env python3
"""
Emulação completa do lab 0.1 (ACE + Maestro + TDEP) — in-memory.

Não sobe HTTP, Postgres, MQTT, Player-AD nem câmara.
Escreve logs/lab-emulation-report.json
"""

from __future__ import annotations

import json
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(REPO / "scripts" / "lab-ace"))

from ace_gateway import gateway_decide  # noqa: E402
from ace_rules import ace_context_to_hint, apply_ace_hint_to_weight  # noqa: E402
from mocks import (  # noqa: E402
    mock_dispatcher_rank,
    mock_fx_bus_publish,
    mock_maestro_player_accepts,
    mock_tdep_partner_accepts,
)

sys.path.insert(0, str(REPO / "scripts" / "lab-maestro"))
from ntp_measure import cue_clock_from_measurement, measure_pair  # noqa: E402

CANDIDATES = [
    {"id": "direct-local", "base_weight": 100, "commercial_tier": "premium"},
    {"id": "network-std", "base_weight": 40, "commercial_tier": "standard"},
    {"id": "fill-night", "base_weight": 10, "commercial_tier": "remnant"},
]


def load(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def freshen(ctx: dict) -> dict:
    out = dict(ctx)
    out["observed_at"] = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z")
    return out


def run_ace_scenario() -> dict:
    examples = REPO / "docs" / "lab-ace" / "examples"
    premium_src = freshen(load(examples / "03-grupo-atencao-alta.json"))
    leak_src = load(examples / "reject-identity-leak.json")
    nfc_src = freshen(load(examples / "04-interacao-nfc.json"))
    closed_src = freshen(load(examples / "06-loja-fechada.json"))

    g_on = gateway_decide(premium_src, ace_enabled=True, rewrite_observed_at=True)
    hint_on = ace_context_to_hint(g_on["payload"]) if g_on["status"] == "accepted" else None
    ranked_on = mock_dispatcher_rank(CANDIDATES, hint_on, True, apply_ace_hint_to_weight)
    fx_on = mock_fx_bus_publish(41, hint_on, True)

    g_off = gateway_decide(premium_src, ace_enabled=True, rewrite_observed_at=True)
    hint_off = ace_context_to_hint(g_off["payload"]) if g_off["status"] == "accepted" else None
    ranked_off = mock_dispatcher_rank(CANDIDATES, hint_off, False, apply_ace_hint_to_weight)
    fx_off = mock_fx_bus_publish(41, hint_off, False)

    g_leak = gateway_decide(leak_src, ace_enabled=True, rewrite_observed_at=True)
    ranked_leak = mock_dispatcher_rank(CANDIDATES, None, True, apply_ace_hint_to_weight)

    hint_nfc = ace_context_to_hint(gateway_decide(nfc_src, rewrite_observed_at=True)["payload"])
    hint_fill = ace_context_to_hint(gateway_decide(closed_src, rewrite_observed_at=True)["payload"])

    checks = {
        "premium_hint": hint_on and hint_on.get("category") == "PREMIUM",
        "direct_wins_with_ace": ranked_on[0]["id"] == "direct-local" and ranked_on[0]["weight"] == 135,
        "fx_wire_no_pii": fx_on is not None and "session_id" not in json.dumps(fx_on),
        "ace_off_unchanged": ranked_off[0]["weight"] == 100 and fx_off is None,
        "leak_refused": g_leak["code"] == "IDENTITY_LEAK" and ranked_leak[0]["weight"] == 100,
        "nfc_standard": hint_nfc and hint_nfc.get("category") == "STANDARD",
        "fill_closed": hint_fill and hint_fill.get("category") == "FILL",
    }
    return {
        "checks": checks,
        "ok": all(checks.values()),
        "hint_premium": hint_on,
        "ranked_on": ranked_on,
        "fx_wire": fx_on,
    }


def run_maestro_scenario() -> dict:
    examples = REPO / "docs" / "lab-maestro" / "examples"
    ok_cue = load(examples / "01-play-t0.json")
    drift_cue = load(examples / "reject-clock-drift.json")
    play_ok = mock_maestro_player_accepts(ok_cue)
    play_drift = mock_maestro_player_accepts(drift_cue)
    aligned = measure_pair(18, 0)
    drifted = measure_pair(480, 0)
    cue_from_clocks = dict(ok_cue)
    cue_from_clocks["clock"] = cue_clock_from_measurement(drifted, ok_cue.get("clock"))
    play_measured_lie = mock_maestro_player_accepts(cue_from_clocks)
    checks = {
        "play_ok": play_ok["accepted"] is True,
        "clock_drift_refused": play_drift["code"] == "CLOCK_DRIFT",
        "no_pixels_in_cue": "pixels" not in ok_cue,
        "ntp_pair_18ms": aligned.accepted is True,
        "ntp_pair_480ms": drifted.code == "CLOCK_DRIFT",
        "ntp_overrides_json": play_measured_lie["code"] == "CLOCK_DRIFT",
    }
    return {
        "checks": checks,
        "ok": all(checks.values()),
        "play_ok": play_ok,
        "play_drift": play_drift,
        "ntp": {"aligned": aligned.as_dict(), "drifted": drifted.as_dict()},
    }


def run_tdep_scenario() -> dict:
    examples = REPO / "docs" / "lab-tdep" / "examples"
    face = load(examples / "01-face.json")
    flight = load(examples / "02-flight-offered.json")
    mismatch = load(examples / "reject-format-mismatch.json")
    leak = dict(face)
    leak["audience"] = {"count": 3}
    checks = {
        "face_ok": mock_tdep_partner_accepts(face)["accepted"] is True,
        "flight_ok": mock_tdep_partner_accepts(flight)["accepted"] is True,
        "mismatch": mock_tdep_partner_accepts(mismatch)["code"] == "FORMAT_MISMATCH",
        "audience_blocked": mock_tdep_partner_accepts(leak)["code"] == "AUDIENCE_FORBIDDEN",
        "no_ace_on_face": "ace" not in face and "audience" not in face,
    }
    return {"checks": checks, "ok": all(checks.values())}


def run_validators() -> dict:
    cmds = [
        [sys.executable, str(REPO / "scripts" / "lab-ace" / "run_lab.py")],
        [sys.executable, str(REPO / "scripts" / "lab-maestro" / "validate_maestro.py")],
        [sys.executable, str(REPO / "scripts" / "lab-maestro" / "test_ntp.py")],
        [sys.executable, str(REPO / "scripts" / "lab-maestro" / "run_ntp_lab.py")],
        [sys.executable, str(REPO / "scripts" / "lab-tdep" / "validate_tdep.py")],
    ]
    results = []
    ok = True
    for cmd in cmds:
        proc = subprocess.run(cmd, cwd=str(REPO), capture_output=True, text=True)
        results.append({"cmd": cmd[-1], "exit": proc.returncode})
        if proc.returncode != 0:
            ok = False
            results[-1]["stderr"] = (proc.stderr or proc.stdout)[-800:]
    return {"ok": ok, "results": results}


def main() -> int:
    report = {
        "at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "ace": run_ace_scenario(),
        "maestro": run_maestro_scenario(),
        "tdep": run_tdep_scenario(),
        "validators": run_validators(),
    }
    report["ok"] = (
        report["ace"]["ok"]
        and report["maestro"]["ok"]
        and report["tdep"]["ok"]
        and report["validators"]["ok"]
    )
    out = REPO / "logs" / "lab-emulation-report.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({k: report[k] if k == "ok" else {"ok": report[k]["ok"]} for k in ("ok", "ace", "maestro", "tdep", "validators")}, ensure_ascii=False, indent=2))
    print(f"report {out}")
    return 0 if report["ok"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
