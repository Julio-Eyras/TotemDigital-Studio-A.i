#!/usr/bin/env python3
"""Valida TDEP 0.1 (face + flight). Sem HTTP de produto, sem ACE."""

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
    face_v = load_validator("face.schema.json")
    flight_v = load_validator("flight.schema.json")

    checks = [
        ("01-face.json", face_v, True),
        ("02-flight-offered.json", flight_v, True),
        ("reject-format-mismatch.json", flight_v, True),
    ]
    for name, validator, must_pass_schema in checks:
        payload = json.loads((EX / name).read_text(encoding="utf-8"))
        errors = list(validator.iter_errors(payload))
        ok = len(errors) == 0
        if ok != must_pass_schema:
            print(f"FAIL schema {name}")
            failed = True
        else:
            print(f"PASS schema {name}")

    leak = json.loads((EX / "01-face.json").read_text(encoding="utf-8"))
    leak["audience"] = {"count": 3}
    if list(face_v.iter_errors(leak)):
        print("PASS face recusa audience")
    else:
        print("FAIL face deixou passar audience")
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
