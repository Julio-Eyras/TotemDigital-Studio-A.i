"""Mocks in-memory do lab 0.1: Dispatcher, bus FX, player Maestro, parceiro TDEP.

Sem Player-AD, MQTT, Postgres, câmara ou face.
"""

from __future__ import annotations

from typing import Any

CLOCK_DRIFT_MAX_MS = 200
TDEP_LEAK_KEYS = ("audience", "person_id", "ace", "mood")
HANDSHAKE_MAX_MS = 60_000


def mock_dispatcher_rank(
    candidates: list[dict[str, Any]],
    hint: dict[str, Any] | None,
    ace_enabled: bool,
    apply_weight,
) -> list[dict[str, Any]]:
    ranked: list[dict[str, Any]] = []
    for c in candidates:
        row = dict(c)
        row["weight"] = apply_weight(
            float(c["base_weight"]),
            hint,
            ace_enabled,
            c.get("commercial_tier"),
        )
        ranked.append(row)
    ranked.sort(key=lambda x: x["weight"], reverse=True)
    return ranked


def mock_fx_bus_publish(totem_id: int, hint: dict[str, Any] | None, ace_enabled: bool) -> dict | None:
    if not ace_enabled or not hint:
        return None
    wire = {
        "msg_type": "ace.hint",
        "schema": "ace/0.1",
        "totem_id": totem_id,
        "category": hint.get("category"),
        "priority_delta": hint.get("priority_delta"),
        "reason": hint.get("reason"),
    }
    blob = str(wire)
    if "tag_id" in blob or "person_id" in blob or "session_id" in blob:
        raise RuntimeError("PII no bus FX")
    return wire


def mock_maestro_player_accepts(
    cue: dict[str, Any],
    ssid: dict[str, Any] | None = None,
) -> dict[str, Any]:
    clock = cue.get("clock") if isinstance(cue.get("clock"), dict) else {}
    ntp_ok = clock.get("ntp_ok") is True
    drift = int(clock.get("drift_ms") or 0)
    if not ntp_ok or abs(drift) > CLOCK_DRIFT_MAX_MS:
        return {"accepted": False, "code": "CLOCK_DRIFT"}
    if ssid is not None and not ssid.get("ok"):
        return {"accepted": False, "code": str(ssid.get("code") or "SSID_FORBIDDEN")}
    if "pixels" in cue or "hdmi" in cue or "audience" in cue:
        return {"accepted": False, "code": "SKU_FORBIDDEN"}
    return {"accepted": True, "code": None, "played_item": cue.get("item_id")}


def _handshake_instant_ms(payload: dict[str, Any]) -> int | None | str:
    raw = payload.get("handshake_ts", payload.get("ts"))
    if raw is None or raw == "":
        return None
    if isinstance(raw, bool):
        return "invalid"
    if isinstance(raw, (int, float)):
        return int(raw)
    if isinstance(raw, str):
        from datetime import datetime

        try:
            dt = datetime.fromisoformat(raw.replace("Z", "+00:00"))
            return int(dt.timestamp() * 1000)
        except ValueError:
            return "invalid"
    return "invalid"


def mock_tdep_partner_accepts(payload: dict[str, Any]) -> dict[str, Any]:
    """Espelho de tdep_nodes.handshake + seller_decide. Sem handshake_ok = fill de lab já ok."""
    if any(k in payload for k in TDEP_LEAK_KEYS):
        return {"accepted": False, "code": "AUDIENCE_FORBIDDEN"}
    handshake_kind = payload.get("handshake")
    instant = _handshake_instant_ms(payload)
    if (
        payload.get("refuse_code") == "HANDSHAKE_REJECTED"
        or payload.get("secret_ok") is False
        or (isinstance(handshake_kind, str) and handshake_kind != "hmac")
        or instant == "invalid"
    ):
        return {"accepted": False, "code": "HANDSHAKE_REJECTED"}
    if payload.get("refuse_code") == "NO_HANDSHAKE" or payload.get("handshake_ok") is False:
        return {"accepted": False, "code": "NO_HANDSHAKE"}
    stale = False
    if isinstance(instant, int):
        from time import time

        stale = abs((time() * 1000) - instant) > HANDSHAKE_MAX_MS
    if payload.get("refuse_code") == "HANDSHAKE_REPLAY" or stale:
        return {"accepted": False, "code": "HANDSHAKE_REPLAY"}
    if payload.get("refuse_code") == "NOT_CEDIBLE" or payload.get("cedible") is False:
        return {"accepted": False, "code": "NOT_CEDIBLE"}
    brands = [str(x) for x in (payload.get("brand_categories") or [])] if isinstance(payload.get("brand_categories"), list) else []
    blocked = [str(x) for x in (payload.get("blocked_categories") or [])] if isinstance(payload.get("blocked_categories"), list) else []
    if payload.get("refuse_code") == "CATEGORY_BLOCKED" or any(c in blocked for c in brands):
        return {"accepted": False, "code": "CATEGORY_BLOCKED"}
    if payload.get("refuse_code") == "POLICY_AUDIO" or (
        payload.get("audio") is True and payload.get("face_audio") is False
    ):
        return {"accepted": False, "code": "POLICY_AUDIO"}
    if payload.get("refuse_code") == "FORMAT_MISMATCH" or payload.get("status") == "rejected":
        return {"accepted": False, "code": "FORMAT_MISMATCH"}
    return {"accepted": True, "code": None}
