#!/usr/bin/env python3
"""
Pipeline local ACE 0.1 — sem HTTP, sem Player-AD, sem Postgres.

Corre validador, emissor, visão sintética e regras (espelho TS).
"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]

SCRIPTS = [
    HERE / "validate_ace_schema.py",
    HERE / "emit_ace_synthetic.py",
    HERE / "test_edge_vision.py",
    HERE / "test_ace_rules.py",
    HERE / "verify_optin.py",
]


def run(script: Path) -> int:
    print(f"\n=== {script.name} ===", flush=True)
    proc = subprocess.run([sys.executable, str(script)], cwd=str(REPO))
    return proc.returncode


def main() -> int:
    for script in SCRIPTS:
        code = run(script)
        if code != 0:
            print(f"FAIL pipeline em {script.name} (exit {code})")
            return code

    edge = subprocess.run(
        [sys.executable, str(HERE / "edge_vision.py"), "--synthetic", "--frames", "4"],
        cwd=str(REPO),
    )
    if edge.returncode != 0:
        print("FAIL edge_vision sintético")
        return edge.returncode

    print("\n=== pipeline ACE 0.1 OK ===", flush=True)
    print("Opt-in verificado (sem Postgres): scripts/lab-ace/verify_optin.py", flush=True)
    print("SQL humano (se existir Postgres de lab): scripts/lab-ace/optin-totem-lab.sql", flush=True)
    print("Hint só aplica se totems.capabilities.ace_enabled = true", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
