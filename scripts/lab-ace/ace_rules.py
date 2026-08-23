"""Regras ACE 0.1 (espelho do aceRuleEngine.ts). Não escolhe media_id."""

from __future__ import annotations

from typing import Any


def ace_context_to_hint(ctx: dict[str, Any]) -> dict[str, Any] | None:
    if not ctx.get("presence") or int(ctx.get("count") or 0) < 1:
        return None

    attention = ctx.get("attention")
    dwell = int(ctx.get("dwell_ms") or 0)
    interaction = ctx.get("interaction") if isinstance(ctx.get("interaction"), dict) else {}
    motion = ctx.get("motion") if isinstance(ctx.get("motion"), dict) else {}
    clock = ctx.get("clock") if isinstance(ctx.get("clock"), dict) else {}

    if attention == "high" and dwell >= 4000:
        return {
            "category": "PREMIUM",
            "priority_delta": 30,
            "reason": "AUDIENCE.ATTENTION=HIGH AND DWELL_MS>=4000",
        }

    if interaction.get("nfc") or interaction.get("qr"):
        return {
            "category": "STANDARD",
            "priority_delta": 20,
            "reason": "AUDIENCE.INTERACTION.NFC_OR_QR",
        }

    if int(ctx.get("count") or 0) >= 2 and attention in ("high", "medium"):
        return {
            "category": "STANDARD",
            "priority_delta": 10,
            "reason": "AUDIENCE.COUNT>=2 AND ATTENTION>=MEDIUM",
        }

    if interaction.get("touch"):
        return {
            "category": "STANDARD",
            "priority_delta": 8,
            "reason": "AUDIENCE.INTERACTION.TOUCH",
        }

    if int(motion.get("approaching") or 0) >= 1:
        return {
            "category": "STANDARD",
            "priority_delta": 5,
            "reason": "AUDIENCE.APPROACHING>=1",
        }

    if clock.get("store_open") is False:
        return {
            "category": "FILL",
            "priority_delta": 2,
            "reason": "AUDIENCE.STORE_CLOSED",
        }

    return None


def apply_ace_hint_to_weight(
    weight: float,
    hint: dict[str, Any] | None,
    ace_enabled: bool,
    commercial_tier: str | None = None,
) -> float:
    if not ace_enabled or not hint:
        return weight
    next_w = weight + int(hint.get("priority_delta") or 0)
    if hint.get("category") == "PREMIUM" and commercial_tier == "premium":
        next_w += 5
    if hint.get("category") == "FILL" and commercial_tier == "remnant":
        next_w += 3
    return max(0, next_w)
