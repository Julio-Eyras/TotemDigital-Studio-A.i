#!/usr/bin/env python3
"""
Gera bootanimation.zip Android (ZIP stored, sem compressao) com texto TotemDigital.

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
DEFAULT_TEXT = "TotemDigital"

# Amarelo/dourado alinhado ao logo de boot Totem Digital
BG_RGB = (0, 0, 0)
TEXT_RGB = (255, 255, 255)
ACCENT_RGB = (255, 193, 7)
TEXT_ROTATION_DEG = 270  # 90° + 180° adicional
TEXT_SCALE = 0.88  # encolhe um pouco para não encostar na borda


def _png_chunk(tag: bytes, data: bytes) -> bytes:
    crc = zlib.crc32(tag + data) & 0xFFFFFFFF
    return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", crc)


def _font_candidates() -> list[Path]:
    windir = Path(__import__("os").environ.get("WINDIR", r"C:\Windows"))
    fonts = windir / "Fonts"
    return [
        fonts / "arialbd.ttf",
        fonts / "Arial Bold.ttf",
        fonts / "segoeuib.ttf",
        fonts / "calibrib.ttf",
        Path("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"),
        Path("/System/Library/Fonts/Supplemental/Arial Bold.ttf"),
    ]


def _load_font(size: int):
    from PIL import ImageFont

    for path in _font_candidates():
        if path.is_file():
            try:
                return ImageFont.truetype(str(path), size=size)
            except OSError:
                continue
    return ImageFont.load_default()


def write_branded_png(
    path: Path,
    width: int,
    height: int,
    text: str,
    rotation_deg: int | None = None,
) -> None:
    from PIL import Image, ImageDraw

    path.parent.mkdir(parents=True, exist_ok=True)
    portrait = height > width
    font_size = max(48, int(min(width, height) * (0.095 if portrait else 0.085)))
    font = _load_font(font_size)

    # Desenha texto + linha em camada separada, depois gira 90° (texto e linha juntos).
    measure = Image.new("RGBA", (4, 4), (0, 0, 0, 0))
    mdraw = ImageDraw.Draw(measure)
    bbox = mdraw.textbbox((0, 0), text, font=font)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    pad = int(font_size * 0.35)
    line_w = int(tw * 0.85)
    line_h = max(4, font_size // 14)
    layer_w = tw + pad * 2
    layer_h = th + int(font_size * 0.25) + line_h + pad * 2

    layer = Image.new("RGBA", (layer_w, layer_h), (0, 0, 0, 0))
    ldraw = ImageDraw.Draw(layer)
    tx = pad
    ty = pad
    ldraw.text((tx, ty), text, fill=TEXT_RGB + (255,), font=font)
    line_x = tx + (tw - line_w) // 2
    line_y = ty + th + int(font_size * 0.25)
    ldraw.rectangle(
        (line_x, line_y, line_x + line_w, line_y + line_h),
        fill=ACCENT_RGB + (255,),
    )

    rotation = TEXT_ROTATION_DEG if rotation_deg is None else rotation_deg
    rotated = (
        layer.rotate(rotation, expand=True, resample=Image.Resampling.BICUBIC)
        if rotation
        else layer
    )
    if TEXT_SCALE != 1.0:
        nw = max(1, int(rotated.width * TEXT_SCALE))
        nh = max(1, int(rotated.height * TEXT_SCALE))
        rotated = rotated.resize((nw, nh), resample=Image.Resampling.LANCZOS)

    canvas = Image.new("RGB", (width, height), BG_RGB)
    rx = (width - rotated.width) // 2
    ry = (height - rotated.height) // 2
    canvas.paste(rotated, (rx, ry), rotated)

    canvas.save(path, format="PNG", optimize=True)


def write_zip_stored(zip_path: Path, files: dict[str, Path]) -> None:
    zip_path.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_STORED) as zf:
        for arc, src in sorted(files.items()):
            zf.write(src, arc)


def build(width: int, height: int, output: Path, text: str, fps: int = 1) -> None:
    work = output.parent / ".bootanimation-build"
    if work.exists():
        import shutil

        shutil.rmtree(work)
    part0 = work / "part0"
    part0.mkdir(parents=True)
    frame = part0 / "00000.png"
    write_branded_png(frame, width, height, text)

    desc = work / "desc.txt"
    desc.write_text(f"{width} {height} {fps}\np 1 0 part0\n", encoding="utf-8")

    write_zip_stored(
        output,
        {
            "desc.txt": desc,
            "part0/00000.png": frame,
        },
    )
    print(f"OK {output} ({width}x{height}, texto «{text}»)")


def main() -> None:
    parser = argparse.ArgumentParser(description="Gera bootanimation.zip para TV box")
    parser.add_argument("--width", type=int, default=1920)
    parser.add_argument("--height", type=int, default=1080)
    parser.add_argument("--fps", type=int, default=1)
    parser.add_argument("--text", type=str, default=DEFAULT_TEXT)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUT)
    args = parser.parse_args()
    build(args.width, args.height, args.output.resolve(), args.text.strip() or DEFAULT_TEXT, args.fps)


if __name__ == "__main__":
    main()
