"""Lane TDEP 0.1 no Dispatcher de lab.

prioridade_local > guaranteed > fill > idle
kill-switch > tudo
default off. Sem UI Direct. Sem Player-AD. Sem media_id.
"""

from __future__ import annotations

from typing import Any

LANE_ORDER = {
    "local": 0,
    "tdep_guaranteed": 1,
    "tdep_fill": 2,
    "idle": 3,
}
TDEP_LANES = frozenset({"tdep_guaranteed", "tdep_fill"})


def is_tdep_fill_enabled(capabilities: Any) -> bool:
    if isinstance(capabilities, str):
        try:
            import json

            capabilities = json.loads(capabilities)
        except json.JSONDecodeError:
            return False
    if not isinstance(capabilities, dict):
        return False
    if capabilities.get("tdep_fill_enabled") is True:
        return True
    nested = capabilities.get("tdep")
    if isinstance(nested, dict) and nested.get("fill_enabled") is True:
        return True
    return False


def infer_lane(row: dict[str, Any]) -> str:
    if row.get("lane") in LANE_ORDER:
        return str(row["lane"])
    if row.get("commercial_tier") == "remnant" or row.get("id") == "idle":
        return "idle"
    return "local"


def apply_tdep_lane(
    candidates: list[dict[str, Any]],
    *,
    enabled: bool = False,
    kill_switch: bool = False,
    revoked: bool = False,
    flight_accepted: bool = False,
    flight_priority: str = "fill",
    cap_share_pct: int = 10,
    share_used_pct: int = 0,
    want_share_pct: int = 1,
) -> dict[str, Any]:
    rows = [dict(c) for c in candidates]
    for row in rows:
        row["lane"] = infer_lane(row)

    code: str | None = None
    playable = rows
    if not enabled:
        playable = [r for r in rows if r["lane"] not in TDEP_LANES]
        code = "TOTEMNET_OFF"
    elif kill_switch:
        playable = [r for r in rows if r["lane"] not in TDEP_LANES]
        code = "KILL_SWITCH"
    elif revoked:
        playable = [r for r in rows if r["lane"] not in TDEP_LANES]
        code = "RIGHTS_REVOKED"
    elif not flight_accepted:
        playable = [r for r in rows if r["lane"] not in TDEP_LANES]
        code = "NO_FLIGHT"
    else:
        cap_hit = share_used_pct + want_share_pct > cap_share_pct
        drop: set[str] = set()
        if cap_hit:
            drop.add("tdep_guaranteed")
            if flight_priority != "fill" or share_used_pct + 1 > cap_share_pct:
                drop.add("tdep_fill")
            code = "NO_CAPACITY"
        if flight_priority == "fill":
            drop.add("tdep_guaranteed")
        elif flight_priority == "guaranteed":
            drop.add("tdep_fill")
        playable = [r for r in rows if r["lane"] not in drop]

    playable.sort(
        key=lambda r: (LANE_ORDER.get(r["lane"], 0), -float(r.get("weight") or r.get("base_weight") or 0))
    )
    winner = playable[0] if playable else None
    if winner and winner["lane"] in TDEP_LANES:
        code = None
    return {
        "ranked": playable,
        "winner_id": None if winner is None else winner.get("id"),
        "winner_lane": None if winner is None else winner["lane"],
        "code": code,
    }
