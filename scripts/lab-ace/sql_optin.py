"""Tabela lab totems.capabilities — SELECT / UPDATE com skip NO_DATABASE.

Não entra no instalador. UPDATE ao vivo exige --apply e LAB_ACE_SQL_APPLY=1.
HTTP do tick não escreve Postgres.
"""

from __future__ import annotations

import os
from typing import Any

from ace_rules import is_ace_enabled_in_capabilities
from verify_optin import sql_disable, sql_enable

NO_DATABASE = "NO_DATABASE"
NO_TOTEM = "NO_TOTEM"
OK = "OK"


class LabAceSql:
    def __init__(self, *, connected: bool = False, rows: dict[int, dict[str, Any]] | None = None) -> None:
        self.connected = connected
        self.rows: dict[int, dict[str, Any]] = {int(k): dict(v) for k, v in (rows or {}).items()}

    def select(self, totem_id: int) -> dict[str, Any]:
        if not self.connected:
            return {"code": NO_DATABASE, "capabilities": {}, "ace_enabled": False}
        row = self.rows.get(int(totem_id))
        if row is None:
            return {"code": NO_TOTEM, "capabilities": {}, "ace_enabled": False}
        caps = dict(row)
        return {
            "code": OK,
            "capabilities": caps,
            "ace_enabled": is_ace_enabled_in_capabilities(caps),
        }

    def apply(self, totem_id: int, enabled: bool, *, apply: bool = False) -> dict[str, Any]:
        selected = self.select(totem_id)
        if selected["code"] != OK:
            return {**selected, "applied": False}
        caps = sql_enable(selected["capabilities"]) if enabled else sql_disable(selected["capabilities"])
        if not apply:
            return {
                "code": OK,
                "applied": False,
                "capabilities": caps,
                "ace_enabled": is_ace_enabled_in_capabilities(caps),
            }
        self.rows[int(totem_id)] = dict(caps)
        return {
            "code": OK,
            "applied": True,
            "capabilities": dict(caps),
            "ace_enabled": is_ace_enabled_in_capabilities(caps),
        }


def live_select(totem_id: int = 41) -> dict[str, Any]:
    """SELECT real se existir URL. Falha ou ausência → NO_DATABASE. Nunca UPDATE."""
    url = os.environ.get("LAB_ACE_DATABASE_URL") or os.environ.get("DATABASE_URL")
    if not url:
        return {"code": NO_DATABASE, "capabilities": {}, "ace_enabled": False, "live": True}
    try:
        import psycopg2  # type: ignore
    except ImportError:
        return {"code": NO_DATABASE, "capabilities": {}, "ace_enabled": False, "live": True}
    try:
        conn = psycopg2.connect(url)
        try:
            with conn.cursor() as cur:
                cur.execute("SELECT capabilities FROM totems WHERE totem_id = %s", (int(totem_id),))
                row = cur.fetchone()
        finally:
            conn.close()
    except Exception:
        return {"code": NO_DATABASE, "capabilities": {}, "ace_enabled": False, "live": True}
    if not row:
        return {"code": NO_TOTEM, "capabilities": {}, "ace_enabled": False, "live": True}
    caps = row[0] if isinstance(row[0], dict) else {}
    return {
        "code": OK,
        "capabilities": caps,
        "ace_enabled": is_ace_enabled_in_capabilities(caps),
        "live": True,
    }


def live_apply_allowed() -> bool:
    return os.environ.get("LAB_ACE_SQL_APPLY") == "1"
