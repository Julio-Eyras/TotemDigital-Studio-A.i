#!/usr/bin/env python3
"""ACE 0.1 — Privacy Gateway local (lab). Sem Dispatcher, sem Player-AD."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from jsonschema import Draft202012Validator

IDENTITY_FIELDS = (
    "person_id",
    "face",
    "embedding",
    "image",
    "mood",
    "age",
    "age_bucket",
    "gender",
    "emotion",
    "features",
    "name",
    "tag_id",
    "tagId",
    "uid",
    "nfc_uid",
    "nfc_id",
    "card_id",
    "rfid",
    "rfid_id",
)

STALE_MAX_SECONDS = 3.0
LOW_CONFIDENCE_DEFAULT = 0.50

REPO_ROOT = Path(__file__).resolve().parents[2]
SCHEMA_PATH = REPO_ROOT / "docs" / "lab-ace" / "audience.context.schema.json"
EXAMPLES_DIR = REPO_ROOT / "docs" / "lab-ace" / "examples"


def load_schema() -> dict[str, Any]:
    return json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))


def schema_validator() -> Draft202012Validator:
    schema = load_schema()
    Draft202012Validator.check_schema(schema)
    return Draft202012Validator(schema)


def parse_observed_at(value: str) -> datetime:
    if value.endswith("Z"):
        value = value[:-1] + "+00:00"
    dt = datetime.fromisoformat(value)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def gateway_decide(
    payload: dict[str, Any],
    *,
    now: datetime | None = None,
    ace_enabled: bool = True,
    confidence_min: float = LOW_CONFIDENCE_DEFAULT,
    stale_max_seconds: float = STALE_MAX_SECONDS,
    rewrite_observed_at: bool = False,
) -> dict[str, Any]:
    """Devolve {status, code, errors, payload}. status = accepted | refused."""
    now = now or datetime.now(timezone.utc)

    if not ace_enabled:
        return {
            "status": "refused",
            "code": "ACE_DISABLED",
            "errors": ["ACE opt-in off (default Direct)."],
            "payload": payload,
        }

    leaked = [k for k in IDENTITY_FIELDS if k in payload]
    privacy = payload.get("privacy") if isinstance(payload.get("privacy"), dict) else {}
    identity_dropped = privacy.get("identity_dropped") is True
    image_dropped = privacy.get("image_dropped") is True

    if leaked or not identity_dropped or not image_dropped:
        return {
            "status": "refused",
            "code": "IDENTITY_LEAK",
            "errors": (
                [f"campo de identidade: {', '.join(leaked)}"] if leaked else []
            )
            + ([] if identity_dropped else ["privacy.identity_dropped deve ser true"])
            + ([] if image_dropped else ["privacy.image_dropped deve ser true"]),
            "payload": payload,
        }

    validator = schema_validator()
    schema_errors = [e.message for e in validator.iter_errors(payload)]
    if schema_errors:
        return {
            "status": "refused",
            "code": "IDENTITY_LEAK" if leaked else "SCHEMA_INVALID",
            "errors": schema_errors,
            "payload": payload,
        }

    working = dict(payload)
    if rewrite_observed_at:
        working["observed_at"] = now.strftime("%Y-%m-%dT%H:%M:%S.") + f"{int(now.microsecond / 1000):03d}Z"

    observed = parse_observed_at(str(working["observed_at"]))
    age_s = (now - observed).total_seconds()
    if age_s > stale_max_seconds:
        return {
            "status": "refused",
            "code": "STALE_CONTEXT",
            "errors": [f"observed_at tem {age_s:.1f}s (max {stale_max_seconds}s)"],
            "payload": working,
        }

    confidence = float(working.get("confidence", 0))
    if confidence < confidence_min:
        return {
            "status": "refused",
            "code": "LOW_CONFIDENCE",
            "errors": [f"confidence {confidence} < {confidence_min}"],
            "payload": working,
        }

    return {
        "status": "accepted",
        "code": None,
        "errors": [],
        "payload": working,
    }
