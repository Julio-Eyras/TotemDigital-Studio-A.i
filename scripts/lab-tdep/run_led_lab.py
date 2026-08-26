#!/usr/bin/env python3
"""Lab TDEP 0.1 — CMS LED (2.a implementacao) <-> TotemDigital (1.a)."""

from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
sys.path.insert(0, str(HERE))

from led_cms import LedCms  # noqa: E402
from tdep_nodes import enable_totemnet, exchange_fill, lab_hmac, list_inventory, prod_seller  # noqa: E402
from tdep_nodes import dev_buyer  # noqa: E402
from tdep_policy import proof_ok  # noqa: E402

EX = REPO / "docs" / "lab-tdep" / "examples"
FACE_TOTEM = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"


def load(name: str) -> dict:
    return json.loads((EX / name).read_text(encoding="utf-8"))


def main() -> int:
    seller = prod_seller()
    led_buyer = LedCms()
    enable_totemnet(seller, FACE_TOTEM)
    led_buyer.ingest_remote_faces(list_inventory(seller, handshake_ok=True)["faces"])
    portrait = load("06-creative.json")
    offered = led_buyer.offer_fill_on_seen(portrait)
    a = exchange_fill(seller, dev_buyer(), handshake_ok=True, flight=offered, creative=portrait)

    led_seller = LedCms()
    led_seller.enable_panel()
    dual = load("11-creative-dual.json")
    flight = load("12-flight-led-fill.json")
    b = led_seller.decide(flight, dual, handshake_ok=True)
    sig_ok = b["proof"] and b["proof"]["seller_sig"] == lab_hmac(
        [led_seller.partner_id, b["flight"]["flight_id"], b["proof"]["player_hash"]]
    )

    src = (HERE / "led_cms.py").read_text(encoding="utf-8")
    independent = "from tdep_policy" not in src and "from tdep_nodes" not in src and "import tdep_policy" not in src
    checks = {
        "independent_module": independent,
        "led_buys_totem": a["played"] is True
        and led_buyer.verify_proof(a["proof"], portrait, a["flight"], seller.partner_id),
        "td_buys_led": b["accepted"] is True and proof_ok(b["proof"], dual, b["flight"]) and sig_ok,
        "no_device": led_buyer.device_touched is False and led_seller.device_touched is False,
    }
    report = {
        "at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "ok": all(checks.values()),
        "checks": checks,
        "note": "Duas implementacoes, um schema. Sem /tdep/v1. Sem Player-AD.",
    }
    out = REPO / "logs" / "lab-tdep-led-report.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))
    print(f"report {out}")
    return 0 if report["ok"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
