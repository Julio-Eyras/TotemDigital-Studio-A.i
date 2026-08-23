#!/usr/bin/env python3
"""Valida exemplos ACE 0.1 (schema + Privacy Gateway local). Exit 1 se falhar."""

from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from ace_gateway import EXAMPLES_DIR, gateway_decide, schema_validator  # noqa: E402

VALID_NAMES = (
    "01-vazio.json",
    "02-aproximacao-um.json",
    "03-grupo-atencao-alta.json",
    "04-interacao-nfc.json",
    "05-interacao-qr.json",
)
MUST_FAIL_SCHEMA = ("reject-identity-leak.json", "reject-tag-id.json")
GATEWAY_EXPECT = {
    "reject-identity-leak.json": "IDENTITY_LEAK",
    "reject-tag-id.json": "IDENTITY_LEAK",
    "reject-stale.json": "STALE_CONTEXT",
    "reject-low-confidence.json": "LOW_CONFIDENCE",
}


def main() -> int:
    validator = schema_validator()
    failed = False

    for name in VALID_NAMES:
        path = EXAMPLES_DIR / name
        payload = json.loads(path.read_text(encoding="utf-8"))
        errors = sorted(validator.iter_errors(payload), key=lambda e: list(e.path))
        if errors:
            failed = True
            print(f"FAIL schema {name}")
            for err in errors[:8]:
                print(f"  {list(err.path)}: {err.message}")
        else:
            print(f"PASS schema {name}")

        fresh = gateway_decide(payload, ace_enabled=True, rewrite_observed_at=True)
        if fresh["status"] != "accepted":
            failed = True
            print(f"FAIL gateway válido {name}: {fresh['code']} {fresh['errors']}")
        else:
            print(f"PASS gateway fresco {name}")

    for name in MUST_FAIL_SCHEMA:
        path = EXAMPLES_DIR / name
        payload = json.loads(path.read_text(encoding="utf-8"))
        errors = list(validator.iter_errors(payload))
        if not errors:
            failed = True
            print(f"FAIL {name} (devia ser rejeitado pelo schema)")
        else:
            print(f"PASS schema reject {name} ({len(errors)} erros)")

    disabled = gateway_decide(
        json.loads((EXAMPLES_DIR / "01-vazio.json").read_text(encoding="utf-8")),
        ace_enabled=False,
        rewrite_observed_at=True,
    )
    if disabled["code"] != "ACE_DISABLED":
        failed = True
        print(f"FAIL ACE_DISABLED: {disabled}")
    else:
        print("PASS gateway ACE_DISABLED")

    for name, expected in GATEWAY_EXPECT.items():
        payload = json.loads((EXAMPLES_DIR / name).read_text(encoding="utf-8"))
        # confidence precisa de relógio fresco; senão cai em STALE primeiro
        rewrite = name == "reject-low-confidence.json"
        decision = gateway_decide(payload, ace_enabled=True, rewrite_observed_at=rewrite)
        if decision["code"] != expected:
            failed = True
            print(f"FAIL gateway {name}: esperado {expected}, obtido {decision['code']} {decision['errors']}")
        else:
            print(f"PASS gateway {name} -> {expected}")

    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
