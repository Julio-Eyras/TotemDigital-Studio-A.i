#!/usr/bin/env python3
"""UI lab do ciclo de sistema — rota oculta, accordion colapsado, fora do pitch."""

from __future__ import annotations

import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]

PITCH_DIR = REPO / "docs" / "manuais"
PITCH_FILES = sorted(PITCH_DIR.glob("12-ROTEIRO-DEMO-15-MIN.md")) + sorted(
    PITCH_DIR.glob("06-APRESENTACAO-COMERCIAL-SAAS.md")
)
PITCH_FORBIDDEN = re.compile(r"/lab/system|ciclo de sistema lab|TotemNet", re.IGNORECASE)


def fail(msg: str) -> None:
    print(f"FAIL {msg}")
    raise SystemExit(1)


def main() -> int:
    app = (REPO / "frontend" / "src" / "App.tsx").read_text(encoding="utf-8", errors="replace")
    if 'path="/lab/system"' not in app:
        fail("App.tsx sem rota /lab/system")
    if "pages/LabSystem/LabSystem" not in app:
        fail("App.tsx sem página LabSystem")
    print("PASS rota /lab/system em App.tsx")

    page = (REPO / "frontend" / "src" / "pages" / "LabSystem" / "LabSystem.tsx").read_text(
        encoding="utf-8", errors="replace"
    )
    if "Laboratório — ciclo de sistema" not in page:
        fail("LabSystem.tsx sem título")
    if "Opt-in ACE (mock SQL)" not in page:
        fail("LabSystem.tsx sem switch de opt-in ACE")
    payloads = (REPO / "frontend" / "src" / "utils" / "labSystemTick.ts").read_text(
        encoding="utf-8", errors="replace"
    )
    if "stale_context" not in payloads or "format_mismatch" not in payloads:
        fail("labSystemTick.ts sem cenários STALE_CONTEXT / FORMAT_MISMATCH")
    if "low_confidence" not in payloads or "policy_audio" not in payloads:
        fail("labSystemTick.ts sem cenários LOW_CONFIDENCE / POLICY_AUDIO")
    if "category_blocked" not in payloads or "not_cedible" not in payloads:
        fail("labSystemTick.ts sem cenários CATEGORY_BLOCKED / NOT_CEDIBLE")
    if "no_handshake" not in payloads or "handshake_replay" not in payloads:
        fail("labSystemTick.ts sem cenários NO_HANDSHAKE / HANDSHAKE_REPLAY")
    if "sql_ace" not in payloads or "sql_no_database" not in payloads or "sql_no_totem" not in payloads:
        fail("labSystemTick.ts sem cenários SQL ACE / NO_DATABASE / NO_TOTEM")
    print("PASS página LabSystem")

    palette = (
        REPO / "frontend" / "src" / "components" / "Navigation" / "CommandPalette" / "CommandPalette.tsx"
    ).read_text(encoding="utf-8", errors="replace")
    compact = palette.split("compactCommandItems", 1)[-1].split("];", 1)[0]
    if "/lab/system" in compact:
        fail("Command Palette compacto não pode listar /lab/system")
    print("PASS Command Palette compacto sem /lab/system")

    menu = (REPO / "frontend" / "src" / "utils" / "menuHierarchy.tsx").read_text(
        encoding="utf-8", errors="replace"
    )
    if "/lab/system" in menu:
        fail("menuHierarchy não pode listar /lab/system")
    print("PASS menuHierarchy sem /lab/system")

    dialog = (
        REPO / "frontend" / "src" / "components" / "TotemEditDialog" / "TotemEditDialog.tsx"
    ).read_text(encoding="utf-8", errors="replace")
    if "Laboratório — ciclo de sistema" not in dialog:
        fail("TotemEditDialog sem accordion do tick")
    if dialog.count("defaultExpanded={false}") < 2:
        fail("accordions de lab devem nascer colapsados")
    print("PASS accordion Direct colapsado")

    for path in PITCH_FILES:
        if PITCH_FORBIDDEN.search(path.read_text(encoding="utf-8", errors="replace")):
            fail(f"pitch {path.name}")
    print("PASS pitch 15 min nao vende /lab/system")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
