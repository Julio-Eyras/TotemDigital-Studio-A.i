#!/usr/bin/env python3
"""
Opt-in ACE 0.1 — verificação em lab sem Postgres.

Prova: default off; SQL de enable/disable (merge JSONB); hint só com flag on;
cache de 60s ignorado com ACE on; carga v6 e instalador NÃO ligam ACE.
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
sys.path.insert(0, str(HERE))

from ace_rules import (  # noqa: E402
    ace_context_to_hint,
    apply_ace_hint_to_weight,
    is_ace_enabled_in_capabilities,
    should_use_dispatch_plan_cache,
)

ACE_TRUE_RE = re.compile(r"ace_enabled\s*['\"]?\s*:\s*true", re.IGNORECASE)
ACE_NESTED_TRUE_RE = re.compile(
    r"""["']ace["']\s*:\s*\{[^}]*["']enabled["']\s*:\s*true""",
    re.IGNORECASE | re.DOTALL,
)

INSTALL_SCAN = [
    REPO / "database" / "carga-inicial-v6.sql",
    REPO / "database" / "seeds-default-settings.sql",
    REPO / "database" / "seeds-playlist-mix.sql",
    REPO / "database" / "seeds-publish-templates-vx4.sql",
    REPO / "database" / "check-and-load-v6.js",
    REPO / "database" / "validate-v6.js",
    REPO / "database" / "apply-schema-v2.sh",
    REPO / "database" / "apply-all-schema-v2.sh",
    REPO / "scripts" / "install-smartsignage.sh",
]


def jsonb_merge(left: dict, right: dict) -> dict:
    out = dict(left)
    out.update(right)
    return out


def jsonb_remove(obj: dict, key: str) -> dict:
    return {k: v for k, v in obj.items() if k != key}


def sql_enable(caps: dict) -> dict:
    return jsonb_merge(caps or {}, {"ace_enabled": True})


def sql_disable(caps: dict) -> dict:
    return jsonb_merge(jsonb_remove(caps or {}, "ace_enabled"), {"ace_enabled": False})


def fail(msg: str) -> None:
    print(f"FAIL {msg}")
    raise SystemExit(1)


def check_capabilities() -> None:
    cases_off = [
        None,
        {},
        {"ace_enabled": False},
        {"ace_enabled": "true"},
        {"ace_enabled": 1},
        '{"not json',
        {"ace": {"enabled": False}},
        {"ace": {"enabled": "true"}},
        {"ace": True},
    ]
    for raw in cases_off:
        if is_ace_enabled_in_capabilities(raw):
            fail(f"esperado off: {raw!r}")
    print("PASS capabilities default / lixo -> off")

    cases_on = [
        {"ace_enabled": True},
        '{"ace_enabled": true}',
        {"ace": {"enabled": True}},
        '{"ace":{"enabled":true}}',
        {"ace_enabled": False, "ace": {"enabled": True}},
    ]
    for raw in cases_on:
        if not is_ace_enabled_in_capabilities(raw):
            fail(f"esperado on: {raw!r}")
    print("PASS capabilities ace_enabled / ace.enabled -> on")


def check_sql_merge() -> None:
    empty = sql_enable({})
    if not is_ace_enabled_in_capabilities(empty):
        fail(f"enable em {{}} -> {empty}")
    other = sql_enable({"wifi": True, "ace_enabled": False})
    if other.get("wifi") is not True or not is_ace_enabled_in_capabilities(other):
        fail(f"enable preserva outras keys: {other}")
    nested_keep = sql_enable({"ace": {"enabled": False}, "screen": "4k"})
    if nested_keep.get("screen") != "4k" or not is_ace_enabled_in_capabilities(nested_keep):
        fail(f"enable com ace.enabled false: {nested_keep}")
    off = sql_disable({"ace_enabled": True, "wifi": True})
    if is_ace_enabled_in_capabilities(off) or off.get("wifi") is not True:
        fail(f"disable: {off}")
    print("PASS merge JSONB enable/disable (espelho SQL lab)")


def check_dispatcher_weights() -> None:
    ctx = {
        "presence": True,
        "count": 3,
        "attention": "high",
        "dwell_ms": 4200,
        "interaction": {"touch": False, "qr": False, "nfc": False},
        "motion": {"approaching": 2},
        "clock": {"store_open": True},
    }
    hint = ace_context_to_hint(ctx)
    if not hint or hint.get("category") != "PREMIUM":
        fail(f"hint PREMIUM: {hint}")
    if apply_ace_hint_to_weight(10, hint, False, "premium") != 10:
        fail("peso com ACE off deve ser o de sempre")
    if apply_ace_hint_to_weight(10, hint, True, "premium") != 45:
        fail("peso com ACE on + PREMIUM + premium deve ser +30+5")
    if apply_ace_hint_to_weight(10, None, True, "premium") != 10:
        fail("sem hint o ar é o de sempre mesmo com ACE on")
    print("PASS Dispatcher: delta só com flag on e hint válido")


def check_cache() -> None:
    if should_use_dispatch_plan_cache(False) is not True:
        fail("cache 60s deve servir com ACE off")
    if should_use_dispatch_plan_cache(True) is not False:
        fail("cache 60s deve ser ignorado com ACE on")
    print("PASS cache de plano: off usa 60s; on ignora (hint ~3s)")


def check_seeds_and_installer() -> None:
    for path in INSTALL_SCAN:
        if not path.is_file():
            fail(f"ficheiro de install/seed em falta: {path}")
        text = path.read_text(encoding="utf-8", errors="replace")
        if ACE_TRUE_RE.search(text) or ACE_NESTED_TRUE_RE.search(text):
            fail(f"install/seed liga ACE: {path.relative_to(REPO)}")
        if "optin-totem-lab.sql" in text:
            fail(f"instalador referencia SQL de opt-in lab: {path.relative_to(REPO)}")
    print("PASS v6 / seeds / instalador não ligam ACE")


def check_schema_comment() -> None:
    schema = REPO / "database" / "smartchannel-db-v2-refactored-part3-tables-dependent.sql"
    text = schema.read_text(encoding="utf-8", errors="replace")
    if "ace_enabled" not in text or "default false" not in text.lower():
        fail("COMMENT de totems.capabilities deve documentar ace_enabled default false")
    if ACE_TRUE_RE.search(text):
        fail("schema part3 não pode definir ace_enabled: true")
    print("PASS schema part3 documenta ace_enabled default false")


def check_lab_sql() -> None:
    sql_path = HERE / "optin-totem-lab.sql"
    if not sql_path.is_file():
        fail("falta scripts/lab-ace/optin-totem-lab.sql")
    text = sql_path.read_text(encoding="utf-8")
    if "NÃO CORRER NO INSTALADOR" not in text and "NAO CORRER NO INSTALADOR" not in text:
        fail("SQL lab deve avisar que não entra no instalador")
    if '{"ace_enabled": true}' not in text or '{"ace_enabled": false}' not in text:
        fail("SQL lab deve ter enable e disable")
    if "totem_id = 41" not in text:
        fail("SQL lab deve usar o totem de exemplo 41")
    print("PASS SQL lab (manual) tem enable/disable e aviso de instalador")


def main() -> int:
    check_capabilities()
    check_sql_merge()
    check_dispatcher_weights()
    check_cache()
    check_seeds_and_installer()
    check_schema_comment()
    check_lab_sql()
    print("\n=== opt-in ACE 0.1 OK (lab, sem Postgres) ===")
    print("SQL humano (se existir Postgres de lab): scripts/lab-ace/optin-totem-lab.sql")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
