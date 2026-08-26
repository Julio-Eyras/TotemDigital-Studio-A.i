#!/usr/bin/env python3
"""
Lab TDEP 0.1 — seis objectos + decisao do seller (sem HTTP de produto).

Player-AD nao muda. ACE nao entra no JSON. Dinheiro fica fora do Flight.
"""

from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
sys.path.insert(0, str(HERE))

from tdep_policy import proof_ok, proof_required, seller_decide  # noqa: E402

EX = REPO / "docs" / "lab-tdep" / "examples"


def load(name: str) -> dict:
    return json.loads((EX / name).read_text(encoding="utf-8"))


def main() -> int:
    face = load("01-face.json")
    flight = load("02-flight-offered.json")
    availability = load("05-availability.json")
    creative = load("06-creative.json")
    proof = load("07-proof.json")
    landscape = load("reject-creative-landscape-only.json")

    fill = seller_decide(face, creative, flight, availability)
    mismatch = seller_decide(face, landscape, flight, availability)
    killed = seller_decide(face, creative, flight, availability, kill_switch=True)
    guaranteed = dict(flight)
    guaranteed["priority"] = "guaranteed"
    guaranteed["quota"] = {"share_pct": 5}

    checks = {
        "six_objects_on_disk": all(
            (EX / n).is_file()
            for n in (
                "03-partner-seller.json",
                "04-partner-buyer.json",
                "05-availability.json",
                "06-creative.json",
                "07-proof.json",
            )
        ),
        "fill_accepted": fill["accepted"] is True,
        "format_mismatch": mismatch["code"] == "FORMAT_MISMATCH",
        "kill_switch": killed["code"] == "KILL_SWITCH",
        "guaranteed_fits_cap": seller_decide(face, creative, guaranteed, availability)[
            "accepted"
        ]
        is True,
        "proof_fill_optional": proof_required(flight) is False,
        "proof_guaranteed": proof_required(guaranteed) is True and proof_ok(proof, creative, flight),
        "no_ace_on_face": "ace" not in face and "audience" not in face,
        "no_cpm_on_flight": "cpm" not in flight and "invoice" not in flight,
    }
    report = {
        "at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "ok": all(checks.values()),
        "checks": checks,
        "note": "Papel+JSON. Sem /tdep/v1 em produto. Direct default off.",
    }
    out = REPO / "logs" / "lab-tdep-report.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))
    print(f"report {out}")
    return 0 if report["ok"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
