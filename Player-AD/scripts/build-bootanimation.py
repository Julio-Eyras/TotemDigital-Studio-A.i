#!/usr/bin/env python3
"""
Gera bootanimation.zip Android (ZIP stored, sem compressao).

Uso:
  python build-bootanimation.py
  python build-bootanimation.py --width 1080 --height 1920 --output ../../install-pendrive/bootanimation/bootanimation-portrait.zip
"""
from __future__ import annotations

import argparse
import struct
import zlib
import zipfile
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
DEFAULT_OUT = SCRIPT_DIR.parent.parent / "install-pendrive" / "bootanimation" / "bootanimation.zip"


def _png_chunk(tag: bytes, data: bytes) -> bytes:
    crc = zlib.crc32(tag + data) & 0xFFFFFFFF
    return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", crc)


def write_black_png(path: Path, width: int, height: int) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    raw = b"".join(b"\x00" + (b"\x00" * (width * 3)) for _ in range(height))
    compressed = zlib.compress(raw, 9)
    ihdr = struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)
    png = b"\x89PNG\r\n\x1a\n"
    png += _png_chunk(b"IHDR", ihdr)
    png += _png_chunk(b"IDAT", compressed)
    png += _png_chunk(b"IEND", b"")
    path.write_bytes(png)


def write_zip_stored(zip_path: Path, files: dict[str, Path]) -> None:
    zip_path.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_STORED) as zf:
        for arc, src in sorted(files.items()):
            zf.write(src, arc)


def build(width: int, height: int, output: Path, fps: int = 1) -> None:
    work = output.parent / ".bootanimation-build"
    if work.exists():
        import shutil
        shutil.rmtree(work)
    part0 = work / "part0"
    part0.mkdir(parents=True)
    frame = part0 / "00000.png"
    write_black_png(frame, width, height)

    desc = work / "desc.txt"
    desc.write_text(f"{width} {height} {fps}\np 1 0 part0\n", encoding="utf-8")

    write_zip_stored(
        output,
        {
            "desc.txt": desc,
            "part0/00000.png": frame,
        },
    )
    print(f"OK {output} ({width}x{height}, tela preta, sem logo Android)")


def main() -> None:
    parser = argparse.ArgumentParser(description="Gera bootanimation.zip para TV box")
    parser.add_argument("--width", type=int, default=1920)
    parser.add_argument("--height", type=int, default=1080)
    parser.add_argument("--fps", type=int, default=1)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUT)
    args = parser.parse_args()
    build(args.width, args.height, args.output.resolve(), args.fps)


if __name__ == "__main__":
    main()
