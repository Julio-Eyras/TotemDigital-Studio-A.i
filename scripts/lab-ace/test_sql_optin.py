#!/usr/bin/env python3
"""SELECT/UPDATE lab de totems.capabilities. Sem Postgres: skip NO_DATABASE."""

from __future__ import annotations

import os
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
sys.path.insert(0, str(HERE))

from sql_optin import LabAceSql, live_select  # noqa: E402
from verify_optin import INSTALL_SCAN  # noqa: E402


def fail(msg: str) -> None:
    print(f"FAIL {msg}")
    raise SystemExit(1)


def main() -> int:
    db = LabAceSql(connected=False)
    off = db.select(41)
    if off["code"] != "NO_DATABASE" or off["ace_enabled"]:
        fail(f"desligado {off}")
    print("PASS sem ligacao -> NO_DATABASE")

    db.connected = True
    missing = db.select(41)
    if missing["code"] != "NO_TOTEM":
        fail(f"sem linha {missing}")
    print("PASS ligado sem linha -> NO_TOTEM")

    db.rows[41] = {"wifi": True, "ace_enabled": "true"}
    if db.select(41)["ace_enabled"]:
        fail("string true não pode ligar")
    preview = db.apply(41, True, apply=False)
    if preview["applied"] or db.select(41)["ace_enabled"]:
        fail(f"preview escreveu {preview} {db.select(41)}")
    written = db.apply(41, True, apply=True)
    if not written["applied"] or not db.select(41)["ace_enabled"] or db.rows[41].get("wifi") is not True:
        fail(f"apply {written} {db.rows[41]}")
    print("PASS apply=false preview; apply=true preserva keys e liga ACE")

    saved_url = os.environ.pop("DATABASE_URL", None)
    saved_lab = os.environ.pop("LAB_ACE_DATABASE_URL", None)
    try:
        live = live_select(41)
        if live["code"] != "NO_DATABASE":
            fail(f"live sem URL deve ser NO_DATABASE {live}")
        print("PASS SELECT vivo skip NO_DATABASE (sem URL)")
    finally:
        if saved_url is not None:
            os.environ["DATABASE_URL"] = saved_url
        if saved_lab is not None:
            os.environ["LAB_ACE_DATABASE_URL"] = saved_lab

    for path in INSTALL_SCAN:
        text = path.read_text(encoding="utf-8", errors="replace")
        if "sql_optin.py" in text or "LAB_ACE_SQL_APPLY" in text:
            fail(f"instalador referencia SQL ACE lab: {path.relative_to(REPO)}")
    print("PASS instalador/v6 não chamam sql_optin")

    sql = (HERE / "optin-totem-lab.sql").read_text(encoding="utf-8")
    if "NÃO CORRER NO INSTALADOR" not in sql and "NAO CORRER NO INSTALADOR" not in sql:
        fail("SQL humano sem aviso de instalador")
    print("PASS SQL humano continua fora do instalador")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
