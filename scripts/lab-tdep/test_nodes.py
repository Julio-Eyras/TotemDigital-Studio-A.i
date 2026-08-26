#!/usr/bin/env python3
"""Dois nos TDEP 0.1 — prod seller <-> DEV buyer, sem HTTP nem Player-AD."""

from __future__ import annotations

import copy
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
sys.path.insert(0, str(HERE))

from tdep_nodes import (  # noqa: E402
    dev_buyer,
    enable_totemnet,
    exchange_fill,
    handshake,
    list_inventory,
    prod_seller,
    proofs_for_flight,
)

PITCH_DIR = REPO / "docs" / "manuais"
PITCH_FILES = sorted(PITCH_DIR.glob("12-ROTEIRO-DEMO-15-MIN.md")) + sorted(
    PITCH_DIR.glob("06-APRESENTACAO-COMERCIAL-SAAS.md")
)
PITCH_FORBIDDEN = re.compile(r"TotemNet|TDEP|tdep/0\.1", re.IGNORECASE)
FACE_ON = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
FACE_OFF = "88888888-8888-4888-8888-888888888888"


def fail(msg: str) -> None:
    print(f"FAIL {msg}")
    raise SystemExit(1)


def main() -> int:
    seller = prod_seller()
    buyer = dev_buyer()
    hs = handshake(seller, buyer)
    if not hs["ok"]:
        fail(f"handshake {hs}")
    print("PASS handshake HMAC lab")

    inv_off = list_inventory(seller, handshake_ok=True)
    if inv_off["faces"]:
        fail("default off nao pode listar faces")
    silent = exchange_fill(seller, buyer, handshake_ok=True)
    if silent["played"] or silent["code"] != "TOTEMNET_OFF":
        fail(f"sem opt-in {silent}")
    print("PASS TotemNet default off -> zero plays")

    no_hs = exchange_fill(seller, buyer, handshake_ok=False)
    if no_hs["played"] or no_hs["code"] != "NO_HANDSHAKE":
        fail(f"sem handshake {no_hs}")
    print("PASS sem handshake -> zero plays")

    enable_totemnet(seller, FACE_ON, cap_share_pct=10)
    inv = list_inventory(seller, handshake_ok=True)
    ids = {f["face_id"] for f in inv["faces"]}
    if FACE_ON not in ids or FACE_OFF in ids:
        fail(f"opt-in e por face {ids}")
    print("PASS opt-in por face (a outra continua off)")

    play = exchange_fill(seller, buyer, handshake_ok=True)
    if not play["played"] or play["flight"]["status"] != "accepted":
        fail(f"fill {play}")
    proofs = proofs_for_flight(buyer, play["flight"]["flight_id"])
    if len(proofs) != 1 or proofs[0]["seller_sig"] != play["proof"]["seller_sig"]:
        fail(f"proof {proofs}")
    if seller.device_touched or buyer.device_touched:
        fail("hub falou com a box")
    print("PASS fill aceite + proof no buyer; CMS local manda no dispositivo")

    bad = handshake(seller, buyer, ts="2020-01-01T00:00:00.000Z", now=datetime(2026, 8, 23, 12, tzinfo=timezone.utc))
    if bad["code"] != "HANDSHAKE_REPLAY":
        fail(f"replay {bad}")
    print("PASS handshake fora da janela -> HANDSHAKE_REPLAY")

    rogue = copy.deepcopy(seller)
    rogue.secret_ok = False
    if handshake(rogue, buyer)["ok"]:
        fail("segredo errado")
    print("PASS HMAC errado recusa handshake")

    killed = prod_seller()
    enable_totemnet(killed, FACE_ON)
    killed.kill_switch = True
    stop = exchange_fill(killed, dev_buyer(), handshake_ok=True)
    if stop["code"] != "KILL_SWITCH" or stop["played"]:
        fail(f"kill {stop}")
    print("PASS kill-switch a meio do exchange")

    leak = copy.deepcopy(play["flight"] or {})
    leak["player_uin"] = "TV_BOX_3"
    leak_run = exchange_fill(prod_seller(), dev_buyer(), handshake_ok=True, flight=leak)
    if leak_run["code"] != "HUB_DEVICE_FORBIDDEN":
        fail(f"device leak {leak_run}")
    print("PASS buyer nao fala com a TV box")

    if len(PITCH_FILES) < 2:
        fail("faltam pitch 12-/06-")
    for path in PITCH_FILES:
        text = path.read_text(encoding="utf-8", errors="replace")
        if PITCH_FORBIDDEN.search(text):
            fail(f"pitch nao pode vender TotemNet: {path.name}")
    print("PASS demo 15 min / SaaS pitch nao mencionam TDEP")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
