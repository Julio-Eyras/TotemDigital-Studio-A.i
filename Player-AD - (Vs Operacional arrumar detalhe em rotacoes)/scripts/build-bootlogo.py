#!/usr/bin/env python3
"""
Converte PNG/JPG para bootlogo.bmp (1280x720 RGB 24-bit) — Allwinner bootloader.

Uso:
  python build-bootlogo.py --input logo.png
  python build-bootlogo.py --input logo.png --width 1280 --height 720
"""
from __future__ import annotations

import argparse
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
DEFAULT_OUT = SCRIPT_DIR.parent.parent / "install-pendrive" / "bootanimation" / "bootlogo.bmp"
DEFAULT_SIZE = (1280, 720)


def build(input_path: Path, output_path: Path, size: tuple[int, int]) -> None:
    from PIL import Image

    target_w, target_h = size
    img = Image.open(input_path).convert("RGB")
    src_w, src_h = img.size

    scale = min(target_w / src_w, target_h / src_h)
    new_w = max(1, int(round(src_w * scale)))
    new_h = max(1, int(round(src_h * scale)))
    resized = img.resize((new_w, new_h), Image.Resampling.LANCZOS)

    canvas = Image.new("RGB", (target_w, target_h), (0, 0, 0))
    x = (target_w - new_w) // 2
    y = (target_h - new_h) // 2
    canvas.paste(resized, (x, y))

    output_path.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(output_path, format="BMP")
    print(f"OK {output_path} ({target_w}x{target_h}, origem {src_w}x{src_h})")


def main() -> None:
    parser = argparse.ArgumentParser(description="Gera bootlogo.bmp para Allwinner bootloader")
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUT)
    parser.add_argument("--width", type=int, default=DEFAULT_SIZE[0])
    parser.add_argument("--height", type=int, default=DEFAULT_SIZE[1])
    args = parser.parse_args()
    if not args.input.is_file():
        raise SystemExit(f"Arquivo nao encontrado: {args.input}")
    build(args.input.resolve(), args.output.resolve(), (args.width, args.height))


if __name__ == "__main__":
    main()
