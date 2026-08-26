"""Politica do seller TDEP 0.1 — lab, sem HTTP de produto.

Kill-switch e prioridade local ficam no CMS vendedor, nao num 7.o objecto.
Sem factura. Sem audience.context. Sem Player-AD.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

TDEP_LEAK_KEYS = ("audience", "person_id", "ace", "mood")
PRIORITY = ("local", "guaranteed", "fill", "idle")


def _parse_dt(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def matching_variant(face: dict[str, Any], creative: dict[str, Any]) -> dict[str, Any] | None:
    mimes = set(face.get("supported_mime") or [])
    orientation = face.get("orientation")
    for variant in creative.get("variants") or []:
        if variant.get("orientation") != orientation:
            continue
        if variant.get("mime") not in mimes:
            continue
        if variant.get("audio") and not face.get("audio"):
            continue
        return variant
    return None


def audio_blocked(face: dict[str, Any], creative: dict[str, Any]) -> bool:
    mimes = set(face.get("supported_mime") or [])
    orientation = face.get("orientation")
    oriented = [
        v
        for v in (creative.get("variants") or [])
        if v.get("orientation") == orientation and v.get("mime") in mimes
    ]
    if not oriented:
        return False
    return all(bool(v.get("audio")) and not face.get("audio") for v in oriented)


def seller_decide(
    face: dict[str, Any],
    creative: dict[str, Any],
    flight: dict[str, Any],
    availability: dict[str, Any],
    *,
    kill_switch: bool = False,
    blocked_categories: list[str] | None = None,
    local_share_used_pct: int = 0,
    now: datetime | None = None,
) -> dict[str, Any]:
    for blob in (face, creative, flight, availability):
        if any(k in blob for k in TDEP_LEAK_KEYS):
            return {"accepted": False, "code": "AUDIENCE_FORBIDDEN", "priority": None}

    if kill_switch:
        return {"accepted": False, "code": "KILL_SWITCH", "priority": "local"}

    if not availability.get("cedible"):
        return {"accepted": False, "code": "NOT_CEDIBLE", "priority": "local"}

    clock = now or datetime(2026, 8, 23, 12, 0, tzinfo=timezone.utc)
    try:
        valid_until = _parse_dt(str(creative.get("valid_until")))
    except (TypeError, ValueError):
        valid_until = clock
    if clock > valid_until:
        return {"accepted": False, "code": "RIGHTS_REVOKED", "priority": "local"}

    blocked = set(blocked_categories or [])
    if blocked.intersection(creative.get("brand_categories") or []):
        return {"accepted": False, "code": "CATEGORY_BLOCKED", "priority": "local"}

    if audio_blocked(face, creative):
        return {"accepted": False, "code": "POLICY_AUDIO", "priority": "local"}

    if matching_variant(face, creative) is None:
        return {"accepted": False, "code": "FORMAT_MISMATCH", "priority": "local"}

    cap = int(availability.get("cap_share_pct") or 0)
    quota = flight.get("quota") if isinstance(flight.get("quota"), dict) else {}
    want = int(quota.get("share_pct") or (10 if flight.get("priority") == "guaranteed" else 1))
    if local_share_used_pct + want > cap:
        return {"accepted": False, "code": "NO_CAPACITY", "priority": "local"}

    rank = str(flight.get("priority") or "fill")
    return {"accepted": True, "code": None, "priority": rank}


def proof_required(flight: dict[str, Any]) -> bool:
    return flight.get("priority") == "guaranteed"


def proof_ok(proof: dict[str, Any], creative: dict[str, Any], flight: dict[str, Any]) -> bool:
    if any(k in proof for k in TDEP_LEAK_KEYS):
        return False
    hashes = {v.get("sha256") for v in (creative.get("variants") or [])}
    if proof.get("player_hash") not in hashes:
        return False
    if not proof.get("seller_sig"):
        return False
    if proof.get("flight_id") != flight.get("flight_id"):
        return False
    if proof.get("creative_id") != creative.get("creative_id"):
        return False
    return True
