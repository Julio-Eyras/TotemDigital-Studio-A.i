#!/usr/bin/env python3
"""Lane TDEP no Dispatcher de lab — local ganha; default off; UI Direct colapsada."""

from __future__ import annotations

import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
sys.path.insert(0, str(HERE))

from tdep_lane import apply_tdep_lane, is_tdep_fill_enabled  # noqa: E402

PITCH_DIR = REPO / "docs" / "manuais"
PITCH_FILES = sorted(PITCH_DIR.glob("12-ROTEIRO-DEMO-15-MIN.md")) + sorted(
    PITCH_DIR.glob("06-APRESENTACAO-COMERCIAL-SAAS.md")
)
PITCH_FORBIDDEN = re.compile(r"TotemNet|tdep_fill|TDEP fill", re.IGNORECASE)

SLATE = [
    {"id": "direct-local", "weight": 100, "lane": "local"},
    {"id": "tdep-fill", "weight": 900, "lane": "tdep_fill"},
    {"id": "idle", "weight": 1, "lane": "idle"},
]


def fail(msg: str) -> None:
    print(f"FAIL {msg}")
    raise SystemExit(1)


def main() -> int:
    if is_tdep_fill_enabled(None) or is_tdep_fill_enabled({}) or is_tdep_fill_enabled({"tdep_fill_enabled": "true"}):
        fail("default off")
    if not is_tdep_fill_enabled({"tdep_fill_enabled": True}):
        fail("flag true")
    print("PASS capabilities.tdep_fill_enabled default off")

    off = apply_tdep_lane(SLATE, enabled=False, flight_accepted=True)
    if off["winner_id"] != "direct-local" or off["code"] != "TOTEMNET_OFF":
        fail(f"off {off}")
    print("PASS default off: local ganha; TDEP nem com peso 900")

    on = apply_tdep_lane(SLATE, enabled=True, flight_accepted=True, flight_priority="fill")
    if on["winner_id"] != "direct-local" or on["winner_lane"] != "local":
        fail(f"local vs fill {on}")
    print("PASS lane on: prioridade local > fill (mesmo com fill a 900)")

    idle_only = [c for c in SLATE if c["id"] != "direct-local"]
    fill = apply_tdep_lane(
        idle_only, enabled=True, flight_accepted=True, flight_priority="fill", want_share_pct=1
    )
    if fill["winner_id"] != "tdep-fill" or fill["winner_lane"] != "tdep_fill":
        fail(f"idle {fill}")
    print("PASS sem local: fill ocupa o idle")

    killed = apply_tdep_lane(idle_only, enabled=True, flight_accepted=True, kill_switch=True)
    if killed["winner_id"] != "idle" or killed["code"] != "KILL_SWITCH":
        fail(f"kill {killed}")
    print("PASS kill-switch: idle, nao o parceiro")

    cap = apply_tdep_lane(
        idle_only,
        enabled=True,
        flight_accepted=True,
        flight_priority="guaranteed",
        cap_share_pct=10,
        share_used_pct=0,
        want_share_pct=15,
    )
    if cap["winner_id"] != "idle" or cap["code"] != "NO_CAPACITY":
        fail(f"cap {cap}")
    print("PASS guaranteed acima do cap -> idle")

    for path in PITCH_FILES:
        if PITCH_FORBIDDEN.search(path.read_text(encoding="utf-8", errors="replace")):
            fail(f"pitch {path.name}")
    print("PASS pitch 15 min nao vende lane TDEP")

    dialog = (
        REPO
        / "frontend"
        / "src"
        / "components"
        / "TotemEditDialog"
        / "TotemEditDialog.tsx"
    )
    dialog_src = dialog.read_text(encoding="utf-8", errors="replace")
    if "Laboratório — ceder ar ocioso" not in dialog_src:
        fail("TotemEditDialog sem accordion TDEP")
    if "payload.tdepFill" not in dialog_src:
        fail("TotemEditDialog nao persiste tdepFill")
    if "defaultExpanded={false}" not in dialog_src:
        fail("accordion TDEP deve nascer colapsado")
    print("PASS UI Direct: accordion colapsado no fundo do totem")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
