#!/usr/bin/env python3
"""
Visão no edge ACE 0.1 — lab.

Conta corpos (HOG) ou gera ocupação sintética. Nunca grava frame,
nunca extrai face, nunca emite person_id.

  python scripts/lab-ace/edge_vision.py --synthetic --frames 5
  python scripts/lab-ace/edge_vision.py --camera 0   # opencv-python-headless
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

sys.path.insert(0, str(Path(__file__).resolve().parent))
from ace_gateway import REPO_ROOT, gateway_decide  # noqa: E402

IDENTITY_FORBIDDEN = (
    "person_id",
    "face",
    "embedding",
    "image",
    "mood",
    "age",
    "age_bucket",
    "gender",
    "emotion",
    "features",
    "name",
)


def utc_now_iso() -> str:
    now = datetime.now(timezone.utc)
    return now.strftime("%Y-%m-%dT%H:%M:%S.") + f"{int(now.microsecond / 1000):03d}Z"


def detections_to_context(
    boxes: list[tuple[int, int, int, int]],
    *,
    frame_w: int,
    frame_h: int,
    totem_id: int,
    site_id: str,
    tracks_dwell_ms: list[int],
) -> dict:
    count = len(boxes)
    area = max(frame_w * frame_h, 1)
    approaching = 0
    stopped = 0
    for _x, y, w, h in boxes:
        frac = (w * h) / area
        cy = y + h / 2
        if frac >= 0.12 or cy > frame_h * 0.62:
            approaching += 1
        else:
            stopped += 1
    dwell = max(tracks_dwell_ms) if tracks_dwell_ms else 0
    if count == 0:
        attention = "none"
        density = "low"
        dwell = 0
    elif dwell >= 4000 and approaching >= 1:
        attention = "high"
        density = "high" if count >= 4 else "medium"
    elif count >= 2:
        attention = "medium"
        density = "medium"
    else:
        attention = "low"
        density = "low"

    hour = datetime.now().hour
    day_js = (datetime.now().weekday() + 1) % 7

    ctx = {
        "schema": "ace/0.1",
        "context_id": str(uuid4()),
        "observed_at": utc_now_iso(),
        "totem_id": totem_id,
        "site_id": site_id,
        "privacy": {
            "gateway": "ace/0.1",
            "identity_dropped": True,
            "image_dropped": True,
        },
        "presence": count > 0,
        "count": count,
        "group": count >= 2,
        "density": density,
        "motion": {
            "approaching": approaching,
            "passing": 0,
            "stopped": stopped,
            "leaving": 0,
        },
        "attention": attention,
        "dwell_ms": int(dwell),
        "interaction": {"touch": False, "qr": False, "nfc": False},
        "clock": {
            "hour_local": hour,
            "day_of_week": day_js,
            "store_open": 7 <= hour < 22,
        },
        "confidence": 0.72 if boxes else 0.99,
        "session_id": f"ephemeral-edge-{uuid4().hex[:8]}",
    }
    for key in IDENTITY_FORBIDDEN:
        ctx.pop(key, None)
    return ctx


def synthetic_boxes(frame: int) -> list[tuple[int, int, int, int]]:
    phase = frame % 6
    if phase == 0:
        return []
    if phase in (1, 2):
        return [(220, 180, 200, 360)]
    return [(80, 160, 180, 340), (300, 150, 190, 350), (480, 200, 160, 300)]


class AnonymousTracker:
    """IDs só em RAM, só para dwell. Nunca entram no JSON."""

    def __init__(self) -> None:
        self._tracks: dict[int, dict] = {}
        self._next = 1

    def update(self, boxes: list[tuple[int, int, int, int]], now_ms: int) -> list[int]:
        used: set[int] = set()
        dwells: list[int] = []
        for box in boxes:
            cx = box[0] + box[2] / 2
            cy = box[1] + box[3] / 2
            match = None
            best = 1e9
            for tid, tr in self._tracks.items():
                dist = abs(tr["cx"] - cx) + abs(tr["cy"] - cy)
                if dist < 120 and dist < best and tid not in used:
                    best = dist
                    match = tid
            if match is None:
                match = self._next
                self._next += 1
                self._tracks[match] = {"cx": cx, "cy": cy, "t0": now_ms}
            else:
                self._tracks[match]["cx"] = cx
                self._tracks[match]["cy"] = cy
            used.add(match)
            dwells.append(now_ms - self._tracks[match]["t0"])
        for tid in list(self._tracks):
            if tid not in used:
                del self._tracks[tid]
        return dwells


def hog_people(frame) -> list[tuple[int, int, int, int]]:
    import cv2  # type: ignore

    hog = cv2.HOGDescriptor()
    hog.setSVMDetector(cv2.HOGDescriptor_getDefaultPeopleDetector())
    found, _ = hog.detectMultiScale(frame, winStride=(8, 8), padding=(8, 8), scale=1.05)
    return [(int(x), int(y), int(w), int(h)) for (x, y, w, h) in found]


def run_camera(index: int, frames: int, interval: float, totem_id: int, site_id: str) -> list[dict]:
    try:
        import cv2  # type: ignore
    except ImportError as exc:
        raise SystemExit(
            "opencv-python não instalado. Use --synthetic ou: pip install opencv-python-headless"
        ) from exc

    cap = cv2.VideoCapture(index)
    if not cap.isOpened():
        raise SystemExit(f"não abriu a câmara {index}")
    tracker = AnonymousTracker()
    out: list[dict] = []
    t0 = time.time()
    n = 0
    try:
        while n < frames:
            ok, frame = cap.read()
            if not ok:
                break
            h, w = frame.shape[:2]
            boxes = hog_people(frame)
            del frame
            dwells = tracker.update(boxes, int((time.time() - t0) * 1000))
            out.append(
                detections_to_context(
                    boxes,
                    frame_w=w,
                    frame_h=h,
                    totem_id=totem_id,
                    site_id=site_id,
                    tracks_dwell_ms=dwells,
                )
            )
            n += 1
            if interval > 0:
                time.sleep(interval)
    finally:
        cap.release()
    return out


def run_synthetic(frames: int, interval: float, totem_id: int, site_id: str) -> list[dict]:
    tracker = AnonymousTracker()
    out: list[dict] = []
    t0 = time.time()
    for i in range(frames):
        boxes = synthetic_boxes(i)
        dwells = tracker.update(boxes, int((time.time() - t0) * 1000))
        out.append(
            detections_to_context(
                boxes,
                frame_w=640,
                frame_h=480,
                totem_id=totem_id,
                site_id=site_id,
                tracks_dwell_ms=dwells,
            )
        )
        if interval > 0:
            time.sleep(interval)
    return out


def main() -> int:
    parser = argparse.ArgumentParser(description="ACE edge vision 0.1 (sem face).")
    parser.add_argument("--synthetic", action="store_true")
    parser.add_argument("--camera", type=int, default=None)
    parser.add_argument("--frames", type=int, default=6)
    parser.add_argument("--interval", type=float, default=0.0)
    parser.add_argument("--totem-id", type=int, default=41)
    parser.add_argument("--site-id", default="lab-edge")
    parser.add_argument("--out", type=Path, default=REPO_ROOT / "logs" / "ace-edge.jsonl")
    args = parser.parse_args()

    if args.camera is not None:
        snapshots = run_camera(args.camera, args.frames, args.interval, args.totem_id, args.site_id)
    else:
        snapshots = run_synthetic(args.frames, args.interval, args.totem_id, args.site_id)

    args.out.parent.mkdir(parents=True, exist_ok=True)
    accepted = refused = 0
    with args.out.open("w", encoding="utf-8") as fh:
        for ctx in snapshots:
            decision = gateway_decide(ctx, ace_enabled=True, rewrite_observed_at=True)
            fh.write(
                json.dumps(
                    {
                        "source": "edge_vision",
                        "status": decision["status"],
                        "code": decision["code"],
                        "errors": decision["errors"],
                        "audience.context": decision["payload"]
                        if decision["status"] == "accepted"
                        else None,
                    },
                    ensure_ascii=False,
                )
                + "\n"
            )
            if decision["status"] == "accepted":
                accepted += 1
            else:
                refused += 1
            extra = f" {decision['code']}" if decision["code"] else ""
            print(
                f"count={ctx['count']} attention={ctx['attention']} "
                f"dwell={ctx['dwell_ms']} -> {decision['status']}{extra}"
            )

    print(f"JSONL {args.out} accepted={accepted} refused={refused}")
    return 0 if refused == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
