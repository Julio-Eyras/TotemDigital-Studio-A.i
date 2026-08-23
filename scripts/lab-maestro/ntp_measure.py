"""Medicao NTP Maestro 0.1 — duas boxes, sem Player-AD.

Algoritmo SNTP/Cristian (offset = ((T2-T1)+(T3-T4))/2).
Default: dois relogios virtuais. UDP/123 e opcional e nunca falha o lab se a rede bloquear.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

CLOCK_DRIFT_MAX_MS = 200
REF_MS = 1_000_000


def ntp_offset_ms(t1: int, t2: int, t3: int, t4: int) -> float:
    return ((t2 - t1) + (t3 - t4)) / 2.0


def ntp_delay_ms(t1: int, t2: int, t3: int, t4: int) -> int:
    return (t4 - t1) - (t3 - t2)


def simulate_exchange(
    client_offset_ms: int,
    server_offset_ms: int = 0,
    rtt_ms: int = 4,
    proc_ms: int = 0,
    ref_ms: int = REF_MS,
) -> tuple[int, int, int, int]:
    t1 = ref_ms + client_offset_ms
    t2 = ref_ms + rtt_ms // 2 + server_offset_ms
    t3 = ref_ms + rtt_ms // 2 + proc_ms + server_offset_ms
    t4 = ref_ms + rtt_ms + proc_ms + client_offset_ms
    return t1, t2, t3, t4


def measure_box_vs_maestro(box_offset_ms: int, maestro_offset_ms: int = 0, rtt_ms: int = 4) -> dict[str, Any]:
    t1, t2, t3, t4 = simulate_exchange(box_offset_ms, maestro_offset_ms, rtt_ms)
    return {
        "offset_ms": round(ntp_offset_ms(t1, t2, t3, t4)),
        "delay_ms": ntp_delay_ms(t1, t2, t3, t4),
        "t1": t1,
        "t2": t2,
        "t3": t3,
        "t4": t4,
    }


@dataclass(frozen=True)
class PairMeasurement:
    offset_a_ms: int
    offset_b_ms: int
    drift_ms: int
    ntp_ok: bool
    accepted: bool
    code: str | None

    def as_clock(self) -> dict[str, Any]:
        return {"ntp_ok": self.ntp_ok, "drift_ms": self.drift_ms}

    def as_dict(self) -> dict[str, Any]:
        return {
            "offset_a_ms": self.offset_a_ms,
            "offset_b_ms": self.offset_b_ms,
            "drift_ms": self.drift_ms,
            "ntp_ok": self.ntp_ok,
            "accepted": self.accepted,
            "code": self.code,
            "clock": self.as_clock(),
        }


def measure_pair(
    offset_a_ms: int,
    offset_b_ms: int,
    maestro_offset_ms: int = 0,
    rtt_ms: int = 4,
    ntp_ok_a: bool = True,
    ntp_ok_b: bool = True,
) -> PairMeasurement:
    a = measure_box_vs_maestro(offset_a_ms, maestro_offset_ms, rtt_ms)
    b = measure_box_vs_maestro(offset_b_ms, maestro_offset_ms, rtt_ms)
    drift = int(a["offset_ms"] - b["offset_ms"])
    ntp_ok = bool(ntp_ok_a and ntp_ok_b)
    accepted = ntp_ok and abs(drift) <= CLOCK_DRIFT_MAX_MS
    return PairMeasurement(
        offset_a_ms=int(a["offset_ms"]),
        offset_b_ms=int(b["offset_ms"]),
        drift_ms=drift,
        ntp_ok=ntp_ok,
        accepted=accepted,
        code=None if accepted else "CLOCK_DRIFT",
    )


def cue_clock_from_measurement(measured: PairMeasurement, declared: dict[str, Any] | None = None) -> dict[str, Any]:
    """A medicao ganha ao JSON. Cue mentiroso (18 no papel, 480 no relogio) e recusado."""
    _ = declared
    return measured.as_clock()


def probe_sntp(host: str = "pool.ntp.org", timeout_s: float = 1.5) -> dict[str, Any]:
    """UDP/123 opcional. Falha de rede = skipped, nao falha o lab."""
    import socket
    import struct
    import time

    packet = b"\x1b" + 47 * b"\x00"
    try:
        addr = socket.getaddrinfo(host, 123, socket.AF_INET, socket.SOCK_DGRAM)[0][4]
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        sock.settimeout(timeout_s)
        t1 = time.time()
        sock.sendto(packet, addr)
        data, _ = sock.recvfrom(64)
        t4 = time.time()
        sock.close()
        if len(data) < 48:
            return {"ok": False, "skipped": True, "reason": "short_packet"}
        unpacked = struct.unpack("!12I", data[0:48])
        tx_sec = unpacked[10]
        tx_frac = unpacked[11]
        unix = tx_sec - 2208988800 + tx_frac / 2**32
        rtt_ms = int(round((t4 - t1) * 1000))
        local_mid = (t1 + t4) / 2
        offset_ms = int(round((unix - local_mid) * 1000))
        return {
            "ok": True,
            "skipped": False,
            "host": host,
            "offset_ms": offset_ms,
            "rtt_ms": rtt_ms,
        }
    except (OSError, socket.timeout, socket.gaierror, IndexError) as exc:
        return {"ok": False, "skipped": True, "reason": type(exc).__name__}
