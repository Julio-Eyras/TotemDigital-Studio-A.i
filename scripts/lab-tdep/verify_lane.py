#!/usr/bin/env python3
"""TotemNet fill lane — default off; seeds/instalador nao ligam."""

from __future__ import annotations

import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]

TRUE_RE = re.compile(r"tdep_fill_enabled\s*['\"]?\s*:\s*true", re.IGNORECASE)
NESTED_RE = re.compile(
    r"""["']tdep["']\s*:\s*\{[^}]*["']fill_enabled["']\s*:\s*true""",
    re.IGNORECASE | re.DOTALL,
)

INSTALL_SCAN = [
    REPO / "database" / "carga-inicial-v6.sql",
    REPO / "database" / "seeds-default-settings.sql",
    REPO / "database" / "seeds-playlist-mix.sql",
    REPO / "database" / "seeds-publish-templates-vx4.sql",
    REPO / "database" / "check-and-load-v6.js",
    REPO / "database" / "validate-v6.js",
    REPO / "database" / "apply-schema-v2.sh",
    REPO / "database" / "apply-all-schema-v2.sh",
    REPO / "scripts" / "install-smartsignage.sh",
]


def fail(msg: str) -> None:
    print(f"FAIL {msg}")
    raise SystemExit(1)


def main() -> int:
    for path in INSTALL_SCAN:
        if not path.is_file():
            continue
        text = path.read_text(encoding="utf-8", errors="replace")
        if TRUE_RE.search(text) or NESTED_RE.search(text):
            fail(f"instalador/seed nao pode ligar TDEP: {path.name}")
    print("PASS seeds/instalador nao metem tdep_fill_enabled true")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
