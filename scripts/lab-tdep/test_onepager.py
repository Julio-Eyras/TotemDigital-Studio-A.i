#!/usr/bin/env python3
"""One-pager comercial TDEP — promessas ao parceiro; pitch 15 min nao vende."""

from __future__ import annotations

import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]

ONE_PAGER = REPO / "docs" / "lab-tdep" / "ONE-PAGER-PARCEIRO-0.1.md"
PITCH_DIR = REPO / "docs" / "manuais"
PITCH_FILES = sorted(PITCH_DIR.glob("12-ROTEIRO-DEMO-15-MIN.md")) + sorted(
    PITCH_DIR.glob("06-APRESENTACAO-COMERCIAL-SAAS.md")
)
PITCH_FORBIDDEN = re.compile(r"TotemNet|TDEP|tdep/0\.1", re.IGNORECASE)


def fail(msg: str) -> None:
    print(f"FAIL {msg}")
    raise SystemExit(1)


def main() -> int:
    if not ONE_PAGER.is_file():
        fail("falta ONE-PAGER-PARCEIRO-0.1.md")
    text = ONE_PAGER.read_text(encoding="utf-8")
    needles = (
        "as telas continuam tuas",
        "default off",
        "kill-switch",
        "10%",
        "factura",
        "hub **não** fala com a TV box",
        "AUDIENCE_FORBIDDEN",
        "Não entra** no pitch de 15 min",
    )
    low = text.lower()
    for needle in needles:
        if needle.lower() not in low and needle not in text:
            fail(f"one-pager sem: {needle}")
    if "tdep-0.1-lab-not-product" in text:
        fail("one-pager nao leva a chave HMAC de lab")
    if "/tdep/v1" in text and "Não** há `/tdep/v1` em produto" not in text:
        fail("one-pager nao pode vender /tdep/v1 de produto")
    print("PASS one-pager parceiro: promessas e estatuto lab")

    if len(PITCH_FILES) < 2:
        fail("pitch files")
    for path in PITCH_FILES:
        if PITCH_FORBIDDEN.search(path.read_text(encoding="utf-8", errors="replace")):
            fail(f"pitch nao pode vender TotemNet: {path.name}")
    print("PASS pitch 15 min nao cita TotemNet")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
