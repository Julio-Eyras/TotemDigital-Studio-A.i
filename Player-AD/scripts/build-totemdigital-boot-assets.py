#!/usr/bin/env python3
"""
Gera os logos oficiais TotemDigital a partir de logo-totemdigital-boot.png.

A imagem-mãe já está em 16:9 com a arte rodada para totem em pé (sentido A)
no framebuffer landscape Allwinner (1280x720). Não se volta a aplicar 90°/270°
nesse BMP — isso letterboxava dois “retratos” no mesmo canvas e invertia o sentido.

  Retrato A (topo para cima):     0°   (mãe tal como está)
  Retrato B (topo para baixo):    180°
  Paisagem (texto a direito):     90° CCW, encaixado em 16:9

Uso:
  python build-totemdigital-boot-assets.py
"""
from __future__ import annotations

import hashlib
import shutil
import zipfile
from pathlib import Path

from PIL import Image

SCRIPT_DIR = Path(__file__).resolve().parent
OUT_DIR = SCRIPT_DIR.parent.parent / "install-pendrive" / "bootanimation"
LOGO_PNG = OUT_DIR / "logo-totemdigital-boot.png"
BMP_SIZE = (1280, 720)


def rotate_ccw(img: Image.Image, deg: int) -> Image.Image:
    deg = deg % 360
    if deg == 0:
        return img
    if deg == 90:
        return img.transpose(Image.Transpose.ROTATE_90)
    if deg == 180:
        return img.transpose(Image.Transpose.ROTATE_180)
    if deg == 270:
        return img.transpose(Image.Transpose.ROTATE_270)
    return img.rotate(deg, expand=True, resample=Image.Resampling.BICUBIC)


def fit_logo(src: Image.Image, width: int, height: int, rotate_ccw_deg: int = 0) -> Image.Image:
    img = rotate_ccw(src.convert("RGBA"), rotate_ccw_deg)
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
    src = Image.open(LOGO_PNG)

    # Bootloader 1280x720: retrato A = mãe; retrato B = 180°; paisagem = 90° CCW.
    fit_logo(src, *BMP_SIZE, 0).save(OUT_DIR / "totemdigital-portrait.bmp", format="BMP")
    fit_logo(src, *BMP_SIZE, 180).save(OUT_DIR / "totemdigital-portrait-reverse.bmp", format="BMP")
    fit_logo(src, *BMP_SIZE, 90).save(OUT_DIR / "totemdigital-landscape.bmp", format="BMP")
    shutil.copyfile(OUT_DIR / "totemdigital-portrait.bmp", OUT_DIR / "totemdigital.bmp")
    shutil.copyfile(OUT_DIR / "totemdigital-portrait.bmp", OUT_DIR / "bootlogo.bmp")
    print(f"OK {OUT_DIR / 'totemdigital-portrait.bmp'} (retrato A, 0°)")
    print(f"OK {OUT_DIR / 'totemdigital-portrait-reverse.bmp'} (retrato B, 180°)")
    print(f"OK {OUT_DIR / 'totemdigital-landscape.bmp'} (paisagem, 90° CCW)")
    print(f"OK {OUT_DIR / 'totemdigital.bmp'} / bootlogo.bmp (alias retrato A)")

    # Mesmo canvas do bootloader (1280x720). ZIP 1080x1920 no painel landscape
    # nativo aparece deitado no totem em pé — o splash e a animação têm de coincidir.
    portrait = fit_logo(src, *BMP_SIZE, 0)
    reverse = fit_logo(src, *BMP_SIZE, 180)
    landscape = fit_logo(src, *BMP_SIZE, 90)
    write_animation_zip(OUT_DIR / "bootanimation.zip", *BMP_SIZE, landscape)
    write_animation_zip(OUT_DIR / "bootanimation-portrait.zip", *BMP_SIZE, portrait)
    write_animation_zip(OUT_DIR / "bootanimation-portrait-reverse.zip", *BMP_SIZE, reverse)
    write_animation_zip(OUT_DIR / "bootanimation-landscape.zip", *BMP_SIZE, landscape)

    manifest = OUT_DIR / "SHA256.txt"
    files = (
        "totemdigital.bmp",
        "totemdigital-portrait.bmp",
        "totemdigital-portrait-reverse.bmp",
        "totemdigital-landscape.bmp",
        "bootanimation.zip",
        "bootanimation-portrait.zip",
        "bootanimation-portrait-reverse.zip",
        "bootanimation-landscape.zip",
        "logo-totemdigital-boot.png",
    )
    manifest.write_text(
        "\n".join(f"{sha256(OUT_DIR / name)}  {name}" for name in files) + "\n",
        encoding="utf-8",
    )
    print(f"OK {manifest}")


if __name__ == "__main__":
    main()
