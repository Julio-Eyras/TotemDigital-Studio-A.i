#!/usr/bin/env python3
"""Testes da visão edge (sem câmara, sem OpenCV)."""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from ace_gateway import gateway_decide  # noqa: E402
from edge_vision import detections_to_context, synthetic_boxes  # noqa: E402


def main() -> int:
    failed = False
    empty = detections_to_context(
        [], frame_w=640, frame_h=480, totem_id=41, site_id="lab", tracks_dwell_ms=[]
    )
    if empty["count"] != 0 or empty["presence"] is not False or empty["attention"] != "none":
        print("FAIL vazio", empty)
        failed = True
    else:
        print("PASS vazio")

    ctx1 = detections_to_context(
        synthetic_boxes(1),
        frame_w=640,
        frame_h=480,
        totem_id=41,
        site_id="lab",
        tracks_dwell_ms=[800],
    )
    if ctx1["count"] != 1 or ctx1["group"] is not False:
        print("FAIL um", ctx1)
        failed = True
    else:
        print("PASS um")

    ctxg = detections_to_context(
        synthetic_boxes(3),
        frame_w=640,
        frame_h=480,
        totem_id=41,
        site_id="lab",
        tracks_dwell_ms=[5000, 4200, 4100],
    )
    if ctxg["count"] != 3 or ctxg["group"] is not True:
        print("FAIL grupo", ctxg)
        failed = True
    else:
        print("PASS grupo")

    for key in ("person_id", "face", "embedding", "image"):
        if key in ctxg:
            print("FAIL identidade", key)
            failed = True

    decision = gateway_decide(ctxg, ace_enabled=True, rewrite_observed_at=True)
    if decision["status"] != "accepted":
        print("FAIL gateway", decision)
        failed = True
    else:
        print("PASS gateway fresco")

    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
