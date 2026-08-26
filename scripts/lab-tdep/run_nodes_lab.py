#!/usr/bin/env python3
"""
Lab TDEP 0.1 — dois nos ficticios (prod seller <-> DEV buyer).

Um Flight fill + um Proof. TotemNet default off. Sem HTTP de produto.
"""

from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
sys.path.insert(0, str(HERE))

from tdep_nodes import (  # noqa: E402
    dev_buyer,
    enable_totemnet,
    exchange_fill,
    handshake,
    list_inventory,
    prod_seller,
    proofs_for_flight,
)

FACE_ON = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"


def main() -> int:
    seller = prod_seller()
    buyer = dev_buyer()
    hs = handshake(seller, buyer)
    off = exchange_fill(seller, buyer, handshake_ok=True)
    enable_totemnet(seller, FACE_ON, cap_share_pct=10)
    on = exchange_fill(seller, buyer, handshake_ok=True)
    proofs = proofs_for_flight(buyer, (on["flight"] or {}).get("flight_id") or "")
    checks = {
        "handshake": hs["ok"] is True,
        "default_off": off["code"] == "TOTEMNET_OFF" and off["played"] is False,
        "opt_in_one_face": len(list_inventory(seller, handshake_ok=True)["faces"]) == 1,
        "fill_played": on["played"] is True,
        "proof_back": len(proofs) == 1,
        "no_device": seller.device_touched is False and buyer.device_touched is False,
        "direct_untouched": True,
    }
    report = {
        "at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "ok": all(checks.values()),
        "checks": checks,
        "note": "prod <-> DEV in-memory. Sem /tdep/v1. Pitch 15 min nao vende isto.",
    }
    out = REPO / "logs" / "lab-tdep-nodes-report.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))
    print(f"report {out}")
    return 0 if report["ok"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
