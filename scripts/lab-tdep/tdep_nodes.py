"""Dois nos TDEP 0.1 — prod (seller) <-> DEV/LED (buyer), in-memory.

Sem HTTP de produto, sem UI Direct, sem Player-AD.
Handshake HMAC de lab (nao e chave de producao).
TotemNet default off: sem handshake + opt-in por face, zero plays.
"""

from __future__ import annotations

import copy
import hashlib
import hmac
import json
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from uuid import uuid4

from tdep_policy import matching_variant, proof_ok, seller_decide

# Fixture de lab. Nao copiar para instalador nem para o Studio operacional.
LAB_HMAC_KEY = b"tdep-0.1-lab-not-product"
REPLAY_WINDOW_S = 60
REPO = Path(__file__).resolve().parents[2]
EX = REPO / "docs" / "lab-tdep" / "examples"
HUB_DEVICE_KEYS = ("device_id", "player_uin", "apk", "hdmi", "player_ad")


def _load(name: str) -> dict[str, Any]:
    return json.loads((EX / name).read_text(encoding="utf-8"))


def lab_hmac(parts: list[str]) -> str:
    return hmac.new(LAB_HMAC_KEY, "|".join(parts).encode("utf-8"), hashlib.sha256).hexdigest()


def _has_device_leak(blob: dict[str, Any]) -> bool:
    return any(k in blob for k in HUB_DEVICE_KEYS)


@dataclass
class TdepNode:
    name: str
    partner: dict[str, Any]
    secret_ok: bool = True
    totemnet_faces: set[str] = field(default_factory=set)
    kill_switch: bool = False
    faces: list[dict[str, Any]] = field(default_factory=list)
    availability: dict[str, dict[str, Any]] = field(default_factory=dict)
    creatives: dict[str, dict[str, Any]] = field(default_factory=dict)
    flights: dict[str, dict[str, Any]] = field(default_factory=dict)
    proofs: list[dict[str, Any]] = field(default_factory=list)
    device_touched: bool = False

    @property
    def partner_id(self) -> str:
        return str(self.partner["partner_id"])


def prod_seller() -> TdepNode:
    face = _load("01-face.json")
    other = dict(face)
    other["face_id"] = "88888888-8888-4888-8888-888888888888"
    other["venue_category"] = "parking-outdoor"
    av = _load("05-availability.json")
    return TdepNode(
        name="prod-seller",
        partner=_load("03-partner-seller.json"),
        faces=[face, other],
        availability={face["face_id"]: av},
    )


def dev_buyer() -> TdepNode:
    node = TdepNode(name="dev-buyer", partner=_load("04-partner-buyer.json"))
    creative = _load("06-creative.json")
    node.creatives[creative["creative_id"]] = creative
    return node


def handshake(
    a: TdepNode,
    b: TdepNode,
    *,
    now: datetime | None = None,
    ts: str | None = None,
) -> dict[str, Any]:
    clock = now or datetime(2026, 8, 23, 12, 0, tzinfo=timezone.utc)
    token = ts or clock.strftime("%Y-%m-%dT%H:%M:%S.000Z")
    if a.partner.get("handshake") != "hmac" or b.partner.get("handshake") != "hmac":
        return {"ok": False, "code": "HANDSHAKE_REJECTED", "ts": token}
    if not a.secret_ok or not b.secret_ok:
        return {"ok": False, "code": "HANDSHAKE_REJECTED", "ts": token}
    try:
        sent = datetime.fromisoformat(token.replace("Z", "+00:00"))
    except ValueError:
        return {"ok": False, "code": "HANDSHAKE_REJECTED", "ts": token}
    if abs((clock - sent).total_seconds()) > REPLAY_WINDOW_S:
        return {"ok": False, "code": "HANDSHAKE_REPLAY", "ts": token}
    echo_a = lab_hmac([a.partner_id, token, "hello"])
    echo_b = lab_hmac([b.partner_id, token, "hello"])
    if not echo_a or not echo_b:
        return {"ok": False, "code": "HANDSHAKE_REJECTED", "ts": token}
    return {"ok": True, "code": None, "ts": token}


def enable_totemnet(seller: TdepNode, face_id: str, *, cap_share_pct: int = 10) -> None:
    """Opt-in por face. Nunca liga a instalacao inteira."""
    seller.totemnet_faces.add(face_id)
    av = seller.availability.get(face_id)
    if av is not None:
        av["cap_share_pct"] = cap_share_pct
        av["cedible"] = True


def list_inventory(seller: TdepNode, *, handshake_ok: bool) -> dict[str, Any]:
    if not handshake_ok:
        return {"ok": False, "code": "NO_HANDSHAKE", "faces": []}
    faces = [f for f in seller.faces if f["face_id"] in seller.totemnet_faces]
    return {"ok": True, "code": None, "faces": copy.deepcopy(faces)}


def sign_proof(seller: TdepNode, flight: dict[str, Any], variant: dict[str, Any]) -> dict[str, Any]:
    player_hash = str(variant["sha256"])
    proof = {
        "schema": "tdep/0.1",
        "proof_id": str(uuid4()),
        "face_id": flight["face_ids"][0],
        "creative_id": flight["creative_ids"][0],
        "flight_id": flight["flight_id"],
        "played_at": "2026-08-23T12:00:00.000Z",
        "duration_ms": int(variant.get("duration_ms") or 15000),
        "player_hash": player_hash,
        "seller_sig": lab_hmac([seller.partner_id, flight["flight_id"], player_hash]),
    }
    return proof


def exchange_fill(
    seller: TdepNode,
    buyer: TdepNode,
    *,
    handshake_ok: bool,
    flight: dict[str, Any] | None = None,
    creative: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Buyer oferece fill; seller autoriza e (se tocar) devolve proof. CMS local manda no dispositivo."""
    if seller.device_touched or buyer.device_touched:
        return {"played": False, "code": "HUB_DEVICE_FORBIDDEN", "proof": None, "flight": None}

    offer = copy.deepcopy(flight or _load("02-flight-offered.json"))
    pack = copy.deepcopy(creative or _load("06-creative.json"))
    if _has_device_leak(offer) or _has_device_leak(pack):
        return {"played": False, "code": "HUB_DEVICE_FORBIDDEN", "proof": None, "flight": offer}

    if not handshake_ok:
        return {"played": False, "code": "NO_HANDSHAKE", "proof": None, "flight": offer}

    inventory = list_inventory(seller, handshake_ok=True)
    wanted = offer["face_ids"][0]
    face = next((f for f in inventory["faces"] if f["face_id"] == wanted), None)
    if face is None:
        return {"played": False, "code": "TOTEMNET_OFF", "proof": None, "flight": offer}

    av = seller.availability.get(wanted) or {}
    decision = seller_decide(
        face,
        pack,
        offer,
        av,
        kill_switch=seller.kill_switch,
    )
    buyer.creatives[pack["creative_id"]] = pack
    seller.creatives[pack["creative_id"]] = pack
    if not decision["accepted"]:
        offer["status"] = "rejected"
        offer["refuse_code"] = decision["code"]
        seller.flights[offer["flight_id"]] = offer
        buyer.flights[offer["flight_id"]] = offer
        return {"played": False, "code": decision["code"], "proof": None, "flight": offer}

    offer["status"] = "accepted"
    seller.flights[offer["flight_id"]] = offer
    buyer.flights[offer["flight_id"]] = offer
    variant = matching_variant(face, pack)
    if variant is None:
        offer["status"] = "rejected"
        offer["refuse_code"] = "FORMAT_MISMATCH"
        return {"played": False, "code": "FORMAT_MISMATCH", "proof": None, "flight": offer}

    proof = sign_proof(seller, offer, variant)
    if not proof_ok(proof, pack, offer):
        return {"played": False, "code": "PROOF_INVALID", "proof": proof, "flight": offer}
    if proof["seller_sig"] != lab_hmac([seller.partner_id, offer["flight_id"], proof["player_hash"]]):
        return {"played": False, "code": "PROOF_INVALID", "proof": proof, "flight": offer}

    seller.proofs.append(proof)
    buyer.proofs.append(copy.deepcopy(proof))
    return {"played": True, "code": None, "proof": proof, "flight": offer}


def proofs_for_flight(node: TdepNode, flight_id: str) -> list[dict[str, Any]]:
    return [p for p in node.proofs if p.get("flight_id") == flight_id]
