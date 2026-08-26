#!/usr/bin/env python3
"""Valida TDEP 0.1 (6 objectos). Sem HTTP de produto, sem ACE, sem Player-AD."""

from __future__ import annotations

import json
import sys
from pathlib import Path

from jsonschema import Draft202012Validator

REPO = Path(__file__).resolve().parents[2]
LAB = REPO / "docs" / "lab-tdep"
EX = LAB / "examples"


def load_validator(name: str) -> Draft202012Validator:
    schema = json.loads((LAB / name).read_text(encoding="utf-8"))
    Draft202012Validator.check_schema(schema)
    return Draft202012Validator(schema)


def main() -> int:
    failed = False
    validators = {
        "partner": load_validator("partner.schema.json"),
        "face": load_validator("face.schema.json"),
        "availability": load_validator("availability.schema.json"),
        "creative": load_validator("creative.schema.json"),
        "flight": load_validator("flight.schema.json"),
        "proof": load_validator("proof.schema.json"),
    }

    checks: list[tuple[str, str, bool]] = [
        ("01-face.json", "face", True),
        ("02-flight-offered.json", "flight", True),
        ("03-partner-seller.json", "partner", True),
        ("04-partner-buyer.json", "partner", True),
        ("05-availability.json", "availability", True),
        ("06-creative.json", "creative", True),
        ("07-proof.json", "proof", True),
        ("11-creative-dual.json", "creative", True),
        ("12-flight-led-fill.json", "flight", True),
        ("08-partner-led.json", "partner", True),
        ("09-face-led.json", "face", True),
        ("10-availability-led.json", "availability", True),
        ("reject-format-mismatch.json", "flight", True),
        ("reject-category-blocked.json", "flight", True),
        ("reject-creative-landscape-only.json", "creative", True),
    ]
    for name, kind, must_pass_schema in checks:
        payload = json.loads((EX / name).read_text(encoding="utf-8"))
        errors = list(validators[kind].iter_errors(payload))
        ok = len(errors) == 0
        if ok != must_pass_schema:
            print(f"FAIL schema {name}: {[e.message for e in errors][:3]}")
            failed = True
        else:
            print(f"PASS schema {name}")

    leak = json.loads((EX / "01-face.json").read_text(encoding="utf-8"))
    leak["audience"] = {"count": 3}
    if list(validators["face"].iter_errors(leak)):
        print("PASS face recusa audience")
    else:
        print("FAIL face deixou passar audience")
        failed = True

    money = json.loads((EX / "02-flight-offered.json").read_text(encoding="utf-8"))
    money["cpm"] = 12.5
    if list(validators["flight"].iter_errors(money)):
        print("PASS flight recusa cpm")
    else:
        print("FAIL flight deixou passar cpm")
        failed = True

    rejected = json.loads((EX / "reject-format-mismatch.json").read_text(encoding="utf-8"))
    if rejected.get("status") == "rejected" and rejected.get("refuse_code") == "FORMAT_MISMATCH":
        print("PASS FORMAT_MISMATCH")
    else:
        print("FAIL FORMAT_MISMATCH")
        failed = True

    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
