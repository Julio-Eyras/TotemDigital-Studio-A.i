#!/usr/bin/env python3
"""Valida Maestro cue 0.1. Sem Player-AD, sem MQTT de produção."""

from __future__ import annotations

import json
import sys
from pathlib import Path

from jsonschema import Draft202012Validator

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
SCHEMA = REPO / "docs" / "lab-maestro" / "cue.schema.json"
EXAMPLES = REPO / "docs" / "lab-maestro" / "examples"
CLOCK_DRIFT_MAX_MS = 200


def main() -> int:
    schema = json.loads(SCHEMA.read_text(encoding="utf-8"))
    Draft202012Validator.check_schema(schema)
    validator = Draft202012Validator(schema)
    failed = False

    valid = json.loads((EXAMPLES / "01-play-t0.json").read_text(encoding="utf-8"))
    errors = list(validator.iter_errors(valid))
    if errors:
        print("FAIL schema 01-play-t0.json")
        failed = True
    else:
        print("PASS schema 01-play-t0.json")

    drift = json.loads((EXAMPLES / "reject-clock-drift.json").read_text(encoding="utf-8"))
    schema_ok = not list(validator.iter_errors(drift))
    too_much = abs(int(drift["clock"]["drift_ms"])) > CLOCK_DRIFT_MAX_MS
    if schema_ok and too_much:
        print("PASS CLOCK_DRIFT (schema ok, drift > 200 ms)")
    else:
        print("FAIL CLOCK_DRIFT", schema_ok, too_much)
        failed = True

    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
