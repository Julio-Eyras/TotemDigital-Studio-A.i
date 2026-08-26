#!/usr/bin/env python3
"""Segunda implementacao TDEP (CMS LED) fala JSON com a primeira. Sem HTTP nem Player-AD."""

from __future__ import annotations

import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(REPO / "scripts" / "lab-emulate"))

from led_cms import LedCms  # noqa: E402
from tdep_nodes import (  # noqa: E402
    dev_buyer,
    enable_totemnet,
    exchange_fill,
    lab_hmac,
    list_inventory,
    prod_seller,
)
from tdep_policy import proof_ok  # noqa: E402

EX = REPO / "docs" / "lab-tdep" / "examples"
FACE_TOTEM = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
FORBIDDEN_IMPORTS = ("tdep_policy", "tdep_nodes", "seller_decide", "TdepNode")


def load(name: str) -> dict:
    return json.loads((EX / name).read_text(encoding="utf-8"))


def fail(msg: str) -> None:
    print(f"FAIL {msg}")
    raise SystemExit(1)


def main() -> int:
    src = (HERE / "led_cms.py").read_text(encoding="utf-8")
    for token in FORBIDDEN_IMPORTS:
        if f"import {token}" in src or f"from {token}" in src:
            fail(f"CMS LED importou a 1.a implementacao: {token}")
    print("PASS CMS LED nao importa tdep_nodes/tdep_policy")

    seller = prod_seller()
    led = LedCms()
    ts = "2026-08-23T12:00:00.000Z"
    led_hs = led.handshake_reply(seller.partner_id, ts)
    if not led_hs["ok"]:
        fail(f"handshake LED {led_hs}")
    rogue = LedCms()
    rogue.secret_ok = False
    if rogue.handshake_reply(seller.partner_id, ts)["ok"]:
        fail("LED HMAC errado")
    print("PASS handshake HMAC cruzado (algoritmo do standard, dois motores)")

    enable_totemnet(seller, FACE_TOTEM)
    inv = list_inventory(seller, handshake_ok=True)
    led.ingest_remote_faces(inv["faces"])
    portrait = load("06-creative.json")
    offered = led.offer_fill_on_seen(portrait)
    if not offered:
        fail("LED buyer nao montou flight")
    played = exchange_fill(seller, dev_buyer(), handshake_ok=True, flight=offered, creative=portrait)
    if not played["played"] or not played["proof"]:
        fail(f"TD seller recusou LED buyer {played}")
    if not led.verify_proof(played["proof"], portrait, played["flight"], seller.partner_id):
        fail("LED nao verificou proof da 1.a implementacao")
    print("PASS LED buyer -> totens seller: fill + proof verificado no CMS LED")

    led_seller = LedCms()
    dual = load("11-creative-dual.json")
    flight_led = load("12-flight-led-fill.json")
    cold = led_seller.decide(flight_led, dual, handshake_ok=True)
    if cold["code"] != "TOTEMNET_OFF":
        fail(f"LED default off {cold}")
    print("PASS painel LED default off")

    led_seller.enable_panel()
    ok = led_seller.decide(flight_led, dual, handshake_ok=True)
    if not ok["accepted"] or not ok["proof"]:
        fail(f"LED seller {ok}")
    if not proof_ok(ok["proof"], dual, ok["flight"]):
        fail("1.a implementacao recusou proof LED")
    sig = lab_hmac([led_seller.partner_id, ok["flight"]["flight_id"], ok["proof"]["player_hash"]])
    if ok["proof"]["seller_sig"] != sig:
        fail("HMAC proof nao bate entre implementacoes")
    print("PASS TotemDigital buyer -> LED seller: variante 1920x1080 + proof cruzado")

    portrait_only = led_seller.decide(flight_led, portrait, handshake_ok=True)
    if portrait_only["code"] != "FORMAT_MISMATCH":
        fail(f"LED tem de recusar portrait-only {portrait_only}")
    print("PASS LED (px exactos) recusa criativo so portrait -> FORMAT_MISMATCH")

    if led.device_touched or led_seller.device_touched or seller.device_touched:
        fail("algum CMS falou com a box")
    print("PASS nenhum CMS fala com sending card / Player-AD")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
