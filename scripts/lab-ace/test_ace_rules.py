#!/usr/bin/env python3
"""Confere o espelho Python das regras ACE contra os exemplos."""

from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from ace_gateway import EXAMPLES_DIR  # noqa: E402
from ace_rules import ace_context_to_hint, apply_ace_hint_to_weight  # noqa: E402

EXPECT = {
    "01-vazio.json": None,
    "02-aproximacao-um.json": ("STANDARD", 5),
    "03-grupo-atencao-alta.json": ("PREMIUM", 30),
    "04-interacao-nfc.json": ("STANDARD", 20),
    "05-interacao-qr.json": ("STANDARD", 20),
    "06-loja-fechada.json": ("FILL", 2),
}


def main() -> int:
    failed = False
    for name, expected in EXPECT.items():
        ctx = json.loads((EXAMPLES_DIR / name).read_text(encoding="utf-8"))
        hint = ace_context_to_hint(ctx)
        if expected is None:
            if hint is not None:
                print(f"FAIL {name}: esperado None, obtido {hint}")
                failed = True
            else:
                print(f"PASS {name}: sem hint")
            continue
        cat, delta = expected
        if not hint or hint.get("category") != cat or hint.get("priority_delta") != delta:
            print(f"FAIL {name}: esperado {cat}+{delta}, obtido {hint}")
            failed = True
        else:
            print(f"PASS {name}: {cat} +{delta}")

    off = apply_ace_hint_to_weight(10, {"category": "PREMIUM", "priority_delta": 30}, False, "premium")
    if off != 10:
        print("FAIL default off", off)
        failed = True
    else:
        print("PASS weight inalterado com ACE off")

    from ace_rules import is_ace_enabled_in_capabilities, should_use_dispatch_plan_cache  # noqa: E402

    if is_ace_enabled_in_capabilities({}) or is_ace_enabled_in_capabilities({"ace_enabled": "true"}):
        print("FAIL capabilities lixo/string não devem ligar ACE")
        failed = True
    elif not is_ace_enabled_in_capabilities({"ace": {"enabled": True}}):
        print("FAIL nested ace.enabled")
        failed = True
    elif should_use_dispatch_plan_cache(True) is not False:
        print("FAIL cache deve ser ignorado com ACE on")
        failed = True
    else:
        print("PASS opt-in flag + cache skip")

    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
