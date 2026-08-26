"""CMS LED ficticio — segunda implementacao TDEP 0.1.

Nao importa tdep_nodes nem tdep_policy. Fala so JSON tdep/0.1.
Painel LED interno (px) exporta-se como Face. Sending card / Player-AD fora.

HMAC de lab = fixture documentada em TDEP-0.1.md (nao e chave de produto).
Matching mais estrito que o CMS TotemDigital: variante tem de casar pixel_w/h exactos.
"""

from __future__ import annotations

import copy
import hashlib
import hmac
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from uuid import uuid4

# Mesma fixture que a primeira implementacao; o standard e o algoritmo, nao o modulo.
LAB_HMAC_KEY = b"tdep-0.1-lab-not-product"
LEAK = ("audience", "person_id", "ace", "mood")
DEVICE = ("device_id", "player_uin", "apk", "hdmi", "player_ad")
REPO = Path(__file__).resolve().parents[2]
EX = REPO / "docs" / "lab-tdep" / "examples"


def _load(name: str) -> dict[str, Any]:
    return json.loads((EX / name).read_text(encoding="utf-8"))


def _hmac(parts: list[str]) -> str:
    return hmac.new(LAB_HMAC_KEY, "|".join(parts).encode("utf-8"), hashlib.sha256).hexdigest()


def _leaks(blob: dict[str, Any]) -> bool:
    return any(k in blob for k in LEAK) or any(k in blob for k in DEVICE)


class LedCms:
    """Parceiro LED: seller de paineis landscape; buyer de faces portrait alheias."""

    def __init__(self) -> None:
        self.partner = _load("08-partner-led.json")
        self.secret_ok = True
        self.cedible = False
        self.kill_switch = False
        self.panel = {
            "panel_id": "LED-MALL-01",
            "w": 1920,
            "h": 1080,
            "mime": ("video/mp4", "image/jpeg"),
            "audio": False,
        }
        self.face = _load("09-face-led.json")
        self.availability = _load("10-availability-led.json")
        self.seen_faces: list[dict[str, Any]] = []
        self.proofs: list[dict[str, Any]] = []
        self.device_touched = False

    @property
    def partner_id(self) -> str:
        return str(self.partner["partner_id"])

    def handshake_reply(self, peer_partner_id: str, ts: str) -> dict[str, Any]:
        if not self.secret_ok or self.partner.get("handshake") != "hmac":
            return {"ok": False, "code": "HANDSHAKE_REJECTED"}
        echo = _hmac([self.partner_id, ts, "hello"])
        peer = _hmac([peer_partner_id, ts, "hello"])
        if not echo or not peer:
            return {"ok": False, "code": "HANDSHAKE_REJECTED"}
        return {"ok": True, "code": None, "ts": ts}

    def enable_panel(self) -> None:
        self.cedible = True
        self.availability["cedible"] = True

    def export_inventory(self, *, handshake_ok: bool) -> dict[str, Any]:
        if not handshake_ok:
            return {"ok": False, "code": "NO_HANDSHAKE", "faces": []}
        if not self.cedible:
            return {"ok": True, "code": None, "faces": []}
        face = copy.deepcopy(self.face)
        face["pixel_w"] = self.panel["w"]
        face["pixel_h"] = self.panel["h"]
        return {"ok": True, "code": None, "faces": [face]}

    def ingest_remote_faces(self, faces: list[dict[str, Any]]) -> None:
        self.seen_faces = [copy.deepcopy(f) for f in faces if not _leaks(f)]

    def offer_fill_on_seen(self, creative: dict[str, Any]) -> dict[str, Any] | None:
        """Buyer LED: monta Flight JSON contra uma face portrait que viu no fio."""
        if _leaks(creative):
            return None
        face = next((f for f in self.seen_faces if f.get("orientation") == "portrait"), None)
        if face is None:
            return None
        return {
            "schema": "tdep/0.1",
            "flight_id": str(uuid4()),
            "buyer_partner_id": self.partner_id,
            "seller_partner_id": face["owner_partner_id"],
            "face_ids": [face["face_id"]],
            "creative_ids": [creative["creative_id"]],
            "priority": "fill",
            "status": "offered",
            "window": {
                "from": "2026-08-23T08:00:00.000Z",
                "until": "2026-08-23T22:00:00.000Z",
            },
        }

    def _pick_variant(self, face: dict[str, Any], creative: dict[str, Any]) -> dict[str, Any] | None:
        for variant in creative.get("variants") or []:
            if variant.get("orientation") != face.get("orientation"):
                continue
            if variant.get("mime") not in (face.get("supported_mime") or []):
                continue
            if int(variant.get("pixel_w") or 0) != int(face.get("pixel_w") or -1):
                continue
            if int(variant.get("pixel_h") or 0) != int(face.get("pixel_h") or -1):
                continue
            if variant.get("audio") and not face.get("audio"):
                continue
            return variant
        return None

    def decide(self, flight: dict[str, Any], creative: dict[str, Any], *, handshake_ok: bool) -> dict[str, Any]:
        """Seller LED: autoriza ar do painel. Nao toca no player do parceiro."""
        if self.device_touched:
            return {"accepted": False, "code": "HUB_DEVICE_FORBIDDEN", "proof": None, "flight": flight}
        if _leaks(flight) or _leaks(creative):
            return {"accepted": False, "code": "AUDIENCE_FORBIDDEN", "proof": None, "flight": flight}
        if not handshake_ok:
            return {"accepted": False, "code": "NO_HANDSHAKE", "proof": None, "flight": flight}
        if self.kill_switch:
            flight = dict(flight, status="rejected", refuse_code="KILL_SWITCH")
            return {"accepted": False, "code": "KILL_SWITCH", "proof": None, "flight": flight}
        if not self.cedible:
            flight = dict(flight, status="rejected", refuse_code="TOTEMNET_OFF")
            return {"accepted": False, "code": "TOTEMNET_OFF", "proof": None, "flight": flight}
        if flight.get("face_ids") != [self.face["face_id"]]:
            flight = dict(flight, status="rejected", refuse_code="FORMAT_MISMATCH")
            return {"accepted": False, "code": "FORMAT_MISMATCH", "proof": None, "flight": flight}
        variant = self._pick_variant(self.face, creative)
        if variant is None:
            flight = dict(flight, status="rejected", refuse_code="FORMAT_MISMATCH")
            return {"accepted": False, "code": "FORMAT_MISMATCH", "proof": None, "flight": flight}
        accepted = dict(flight, status="accepted")
        proof = {
            "schema": "tdep/0.1",
            "proof_id": str(uuid4()),
            "face_id": self.face["face_id"],
            "creative_id": creative["creative_id"],
            "flight_id": accepted["flight_id"],
            "played_at": datetime(2026, 8, 23, 12, tzinfo=timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z"),
            "duration_ms": int(variant.get("duration_ms") or 15000),
            "player_hash": variant["sha256"],
            "seller_sig": _hmac([self.partner_id, accepted["flight_id"], variant["sha256"]]),
        }
        self.proofs.append(proof)
        return {"accepted": True, "code": None, "proof": proof, "flight": accepted}

    def verify_proof(self, proof: dict[str, Any], creative: dict[str, Any], flight: dict[str, Any], seller_partner_id: str) -> bool:
        """Verificador proprio (nao usa tdep_policy.proof_ok)."""
        if _leaks(proof):
            return False
        hashes = {v.get("sha256") for v in (creative.get("variants") or [])}
        if proof.get("player_hash") not in hashes:
            return False
        if proof.get("flight_id") != flight.get("flight_id"):
            return False
        if proof.get("creative_id") != creative.get("creative_id"):
            return False
        expected = _hmac([seller_partner_id, str(flight.get("flight_id")), str(proof.get("player_hash"))])
        return proof.get("seller_sig") == expected
