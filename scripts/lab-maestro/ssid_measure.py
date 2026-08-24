"""Pre-voo SSID Maestro 0.1 — duas boxes, sem Player-AD e sem AP real.

Cue so segue se as duas boxes estiverem no SSID de players (5/6 GHz),
isolado dos clientes da loja. A medicao ganha ao que o JSON/papel declarar.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

ALLOWED_BANDS_GHZ = (5, 6)
ROLE_PLAYERS = "players"
ROLE_STORE = "store"


@dataclass(frozen=True)
class SsidMeasurement:
    ok: bool
    code: str | None
    ssid: str | None
    band_ghz: float | None
    role: str | None

    def as_dict(self) -> dict[str, Any]:
        return {
            "ok": self.ok,
            "code": self.code,
            "ssid": self.ssid,
            "band_ghz": self.band_ghz,
            "role": self.role,
        }


def _role(box: dict[str, Any]) -> str:
    raw = str(box.get("role") or box.get("ssid_role") or "unknown").strip().lower()
    return raw


def _band(box: dict[str, Any]) -> float:
    try:
        return float(box.get("band_ghz") or 0)
    except (TypeError, ValueError):
        return 0.0


def measure_ssid_pair(
    box_a: dict[str, Any],
    box_b: dict[str, Any],
    declared: dict[str, Any] | None = None,
) -> SsidMeasurement:
    """Medicao ganha a `declared`. JSON a dizer players na Wi-Fi da loja e recusado."""
    _ = declared
    role_a, role_b = _role(box_a), _role(box_b)
    band_a, band_b = _band(box_a), _band(box_b)
    ssid_a = str(box_a.get("ssid") or "")
    ssid_b = str(box_b.get("ssid") or "")
    store_clients = bool(box_a.get("store_clients") or box_b.get("store_clients"))

    if ROLE_STORE in (role_a, role_b):
        return SsidMeasurement(False, "SSID_STORE", ssid_a or ssid_b, band_a or band_b, ROLE_STORE)
    if role_a != ROLE_PLAYERS or role_b != ROLE_PLAYERS:
        return SsidMeasurement(False, "SSID_UNKNOWN", ssid_a or ssid_b, None, role_a)
    if not ssid_a or ssid_a != ssid_b:
        return SsidMeasurement(False, "SSID_MIXED", None, None, ROLE_PLAYERS)
    if band_a not in ALLOWED_BANDS_GHZ or band_b not in ALLOWED_BANDS_GHZ:
        return SsidMeasurement(False, "SSID_BAND", ssid_a, band_a, ROLE_PLAYERS)
    if store_clients:
        return SsidMeasurement(False, "SSID_SHARED", ssid_a, band_a, ROLE_PLAYERS)
    return SsidMeasurement(True, None, ssid_a, band_a, ROLE_PLAYERS)


def players_box(ssid: str = "totem-players", band_ghz: float = 5, store_clients: bool = False) -> dict[str, Any]:
    return {"role": ROLE_PLAYERS, "ssid": ssid, "band_ghz": band_ghz, "store_clients": store_clients}


def store_box(ssid: str = "loja-wifi", band_ghz: float = 2.4) -> dict[str, Any]:
    return {"role": ROLE_STORE, "ssid": ssid, "band_ghz": band_ghz, "store_clients": True}
