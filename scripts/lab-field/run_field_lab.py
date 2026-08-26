#!/usr/bin/env python3
"""
Pre-voo de campo 0.1 — NTP+SSID via ADB (opcional) e SQL ACE so SELECT humano.

Sem 2 boxes: skip NO_HARDWARE. Nunca UPDATE. Player-AD intocado.
"""

from __future__ import annotations

import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(REPO / "scripts" / "lab-maestro"))
sys.path.insert(0, str(REPO / "scripts" / "lab-emulate"))

from field_parse import (  # noqa: E402
    adb_shell,
    live_adb_serials,
    measure_epochs,
    parse_epoch_ms,
    wifi_to_box,
)
from ssid_measure import measure_ssid_pair  # noqa: E402

EX = REPO / "docs" / "lab-field" / "examples"


def fixture_pair() -> dict:
    players = wifi_to_box((EX / "dumpsys-wifi-players.txt").read_text(encoding="utf-8"))
    store = wifi_to_box((EX / "dumpsys-wifi-store.txt").read_text(encoding="utf-8"))
    ssid_ok = measure_ssid_pair(players, dict(players))
    ssid_store = measure_ssid_pair(players, store)
    ntp_ok = measure_epochs(1_000_018, 1_000_000)
    ntp_bad = measure_epochs(1_000_480, 1_000_000)
    return {
        "ssid_players_ok": ssid_ok.ok,
        "ssid_store_code": ssid_store.code,
        "ntp_18_accepted": ntp_ok["accepted"],
        "ntp_480_code": ntp_bad["code"],
    }


def probe_postgres() -> dict:
    url = os.environ.get("LAB_ACE_DATABASE_URL") or os.environ.get("DATABASE_URL")
    sql = REPO / "scripts" / "lab-ace" / "optin-totem-lab.sql"
    return {
        "skipped": True,
        "code": "NO_POSTGRES" if not url else "SQL_HUMAN_ONLY",
        "wrote": False,
        "sql": str(sql.relative_to(REPO)),
        "note": "Nunca UPDATE daqui. Se existir Postgres de lab: correr optin-totem-lab.sql a mao.",
    }


def probe_adb() -> dict:
    live = live_adb_serials()
    if live.get("skipped"):
        return {"skipped": True, "code": live.get("code"), "serials": live.get("serials") or []}
    serials = live["serials"]
    wifi_a = adb_shell(serials[0], ["dumpsys", "wifi"])
    wifi_b = adb_shell(serials[1], ["dumpsys", "wifi"])
    epoch_a = parse_epoch_ms(adb_shell(serials[0], ["date", "+%s%3N"]) or adb_shell(serials[0], ["date", "+%s"]))
    epoch_b = parse_epoch_ms(adb_shell(serials[1], ["date", "+%s%3N"]) or adb_shell(serials[1], ["date", "+%s"]))
    box_a = wifi_to_box(wifi_a)
    box_b = wifi_to_box(wifi_b)
    ssid = measure_ssid_pair(box_a, box_b)
    ntp = measure_epochs(epoch_a, epoch_b)
    return {
        "skipped": False,
        "serials": serials,
        "ssid": ssid.as_dict(),
        "ntp": ntp,
        "boxes": [box_a, box_b],
    }


def main() -> int:
    fixtures = fixture_pair()
    adb = probe_adb()
    pg = probe_postgres()
    checks = {
        "fixture_ssid_ntp": all(
            [
                fixtures["ssid_players_ok"],
                fixtures["ssid_store_code"] == "SSID_STORE",
                fixtures["ntp_18_accepted"],
                fixtures["ntp_480_code"] == "CLOCK_DRIFT",
            ]
        ),
        "postgres_nao_escreve": pg.get("wrote") is False,
        "adb_skip_or_measured": adb.get("skipped") is True or "ssid" in adb,
    }
    report = {
        "at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "ok": all(checks.values()),
        "checks": checks,
        "fixtures": fixtures,
        "adb": {k: adb[k] for k in adb if k != "boxes"} if isinstance(adb, dict) else adb,
        "postgres": pg,
        "note": "Sem 2 TV boxes ADB o lab faz skip. Player-AD nao muda. SQL ACE e humano.",
    }
    out = REPO / "logs" / "lab-field-report.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(
        json.dumps(
            {
                "ok": report["ok"],
                "adb_skipped": adb.get("skipped"),
                "adb_code": adb.get("code"),
                "postgres_code": pg.get("code"),
            },
            ensure_ascii=False,
            indent=2,
        )
    )
    print(f"report {out}")
    return 0 if report["ok"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
