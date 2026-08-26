#!/usr/bin/env python3
"""Testes TDEP 0.1 — 6 objectos + politica do seller, sem HTTP nem Player-AD."""

from __future__ import annotations

import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(REPO / "scripts" / "lab-emulate"))

from tdep_policy import (  # noqa: E402
    proof_ok,
    proof_required,
    seller_decide,
)
from mocks import mock_tdep_partner_accepts  # noqa: E402

EX = REPO / "docs" / "lab-tdep" / "examples"


def load(name: str) -> dict:
    return json.loads((EX / name).read_text(encoding="utf-8"))


def fail(msg: str) -> None:
    print(f"FAIL {msg}")
    raise SystemExit(1)


def main() -> int:
    face = load("01-face.json")
    flight = load("02-flight-offered.json")
    availability = load("05-availability.json")
    creative = load("06-creative.json")
    proof = load("07-proof.json")
    landscape = load("reject-creative-landscape-only.json")

    ok = seller_decide(face, creative, flight, availability)
    if not ok["accepted"] or ok["priority"] != "fill":
        fail(f"fill aceite {ok}")
    print("PASS fill com variante portrait muda")

    mismatch = seller_decide(face, landscape, flight, availability)
    if mismatch["code"] != "FORMAT_MISMATCH":
        fail(f"landscape vs portrait {mismatch}")
    print("PASS landscape-only vs face portrait -> FORMAT_MISMATCH")

    blocked = seller_decide(
        face, creative, flight, availability, blocked_categories=["retail"]
    )
    if blocked["code"] != "CATEGORY_BLOCKED":
        fail(f"categoria {blocked}")
    print("PASS CATEGORY_BLOCKED")

    killed = seller_decide(face, creative, flight, availability, kill_switch=True)
    if killed["code"] != "KILL_SWITCH":
        fail(f"kill {killed}")
    print("PASS kill-switch do owner > tudo")

    loud = json.loads(json.dumps(creative))
    loud["variants"][0]["audio"] = True
    audio = seller_decide(face, loud, flight, availability)
    if audio["code"] != "POLICY_AUDIO":
        fail(f"audio {audio}")
    print("PASS POLICY_AUDIO (face sem som)")

    guaranteed = dict(flight)
    guaranteed["priority"] = "guaranteed"
    guaranteed["quota"] = {"share_pct": 15}
    cap = seller_decide(face, creative, guaranteed, availability, local_share_used_pct=0)
    if cap["code"] != "NO_CAPACITY":
        fail(f"cap 10% vs 15% {cap}")
    print("PASS NO_CAPACITY (guaranteed estoura o cap local)")

    leak = dict(face)
    leak["audience"] = {"count": 2}
    if seller_decide(leak, creative, flight, availability)["code"] != "AUDIENCE_FORBIDDEN":
        fail("audience")
    if mock_tdep_partner_accepts(leak)["code"] != "AUDIENCE_FORBIDDEN":
        fail("mock audience")
    print("PASS AUDIENCE_FORBIDDEN")

    expired = json.loads(json.dumps(creative))
    expired["valid_until"] = "2026-01-01T00:00:00.000Z"
    if seller_decide(face, expired, flight, availability)["code"] != "RIGHTS_REVOKED":
        fail("rights")
    print("PASS RIGHTS_REVOKED")

    if not proof_required(guaranteed) or proof_required(flight):
        fail("proof so guaranteed")
    if not proof_ok(proof, creative, flight):
        fail("proof ok")
    bad_hash = dict(proof)
    bad_hash["player_hash"] = "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
    if proof_ok(bad_hash, creative, flight):
        fail("proof hash")
    print("PASS proof obrigatorio no guaranteed; hash tem de bater")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
