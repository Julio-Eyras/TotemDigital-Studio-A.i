#!/usr/bin/env python3
"""
Gera os logos oficiais TotemDigital a partir de logo-totemdigital-boot.png:

  install-pendrive/bootanimation/totemdigital.bmp                    (bootloader 1280x720, paisagem)
  install-pendrive/bootanimation/totemdigital-portrait.bmp           (bootloader, retrato 270°)
  install-pendrive/bootanimation/totemdigital-portrait-reverse.bmp   (bootloader, retrato 90°)
  install-pendrive/bootanimation/bootlogo.bmp                        (alias paisagem para scripts ADB)
  install-pendrive/bootanimation/bootanimation.zip                   (landscape 1920x1080)
  install-pendrive/bootanimation/bootanimation-portrait.zip          (1080x1920, 270°)
  install-pendrive/bootanimation/bootanimation-portrait-reverse.zip  (1080x1920, 90°)

Uso:
  python build-totemdigital-boot-assets.py
"""
from __future__ import annotations

import hashlib
import importlib.util
import shutil
import zipfile
from pathlib import Path

from PIL import Image

SCRIPT_DIR = Path(__file__).resolve().parent
OUT_DIR = SCRIPT_DIR.parent.parent / "install-pendrive" / "bootanimation"
LOGO_PNG = OUT_DIR / "logo-totemdigital-boot.png"
BMP_SIZE = (1280, 720)

_SPEC = importlib.util.spec_from_file_location(
    "build_bootlogo",
    SCRIPT_DIR / "build-bootlogo.py",
)
_BOOTLOGO = importlib.util.module_from_spec(_SPEC)
assert _SPEC.loader is not None
_SPEC.loader.exec_module(_BOOTLOGO)


def fit_logo(src: Image.Image, width: int, height: int, rotate_deg: int = 0) -> Image.Image:
    img = src.convert("RGBA")
    if rotate_deg:
        img = img.rotate(rotate_deg, expand=True, resample=Image.Resampling.BICUBIC)
    scale = min(width / img.width, height / img.height)
    new_w = max(1, int(round(img.width * scale)))
    new_h = max(1, int(round(img.height * scale)))
    resized = img.resize((new_w, new_h), Image.Resampling.LANCZOS)
    canvas = Image.new("RGB", (width, height), (0, 0, 0))
    x = (width - new_w) // 2
    y = (height - new_h) // 2
    if resized.mode == "RGBA":
        canvas.paste(resized, (x, y), resized)
    else:
        canvas.paste(resized.convert("RGB"), (x, y))
    return canvas


def write_animation_zip(output: Path, width: int, height: int, frame: Image.Image) -> None:
    work = output.parent / ".bootanimation-build" / output.stem
    if work.exists():
        shutil.rmtree(work)
    part0 = work / "part0"
    part0.mkdir(parents=True)
    frame_path = part0 / "00000.png"
    frame.save(frame_path, format="PNG", optimize=True)
    desc = work / "desc.txt"
    desc.write_text(f"{width} {height} 1\np 1 0 part0\n", encoding="ascii")
    output.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(output, "w", compression=zipfile.ZIP_STORED) as zf:
        zf.write(desc, "desc.txt")
        zf.write(frame_path, "part0/00000.png")
    print(f"OK {output} ({width}x{height}, {output.stat().st_size} bytes)")


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def main() -> None:
    if not LOGO_PNG.is_file():
        raise SystemExit(f"Logo oficial em falta: {LOGO_PNG}")

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    bmp = OUT_DIR / "totemdigital.bmp"
    _BOOTLOGO.build(LOGO_PNG, bmp, BMP_SIZE)
    shutil.copyfile(bmp, OUT_DIR / "bootlogo.bmp")
    print(f"OK {OUT_DIR / 'bootlogo.bmp'} (alias)")

    src = Image.open(LOGO_PNG)
    fit_logo(src, *BMP_SIZE, rotate_deg=270).save(OUT_DIR / "totemdigital-portrait.bmp", format="BMP")
    fit_logo(src, *BMP_SIZE, rotate_deg=90).save(OUT_DIR / "totemdigital-portrait-reverse.bmp", format="BMP")
    print(f"OK {OUT_DIR / 'totemdigital-portrait.bmp'} (bootloader retrato 270°)")
    print(f"OK {OUT_DIR / 'totemdigital-portrait-reverse.bmp'} (bootloader retrato 90°)")

    write_animation_zip(OUT_DIR / "bootanimation.zip", 1920, 1080, fit_logo(src, 1920, 1080))
    write_animation_zip(
        OUT_DIR / "bootanimation-portrait.zip",
        1080,
        1920,
        fit_logo(src, 1080, 1920, rotate_deg=270),
    )
    write_animation_zip(
        OUT_DIR / "bootanimation-portrait-reverse.zip",
        1080,
        1920,
        fit_logo(src, 1080, 1920, rotate_deg=90),
    )

    manifest = OUT_DIR / "SHA256.txt"
    files = (
        "totemdigital.bmp",
        "totemdigital-portrait.bmp",
        "totemdigital-portrait-reverse.bmp",
        "bootanimation.zip",
        "bootanimation-portrait.zip",
        "bootanimation-portrait-reverse.zip",
        "logo-totemdigital-boot.png",
    )
    manifest.write_text(
        "\n".join(f"{sha256(OUT_DIR / name)}  {name}" for name in files) + "\n",
        encoding="utf-8",
    )
    print(f"OK {manifest}")


if __name__ == "__main__":
    main()
