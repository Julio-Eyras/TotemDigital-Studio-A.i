#!/usr/bin/env python3
import math
import struct
import sys


def iter_boxes(data, start=0, end=None):
    end = end or len(data)
    pos = start
    while pos + 8 <= end:
        size = struct.unpack(">I", data[pos : pos + 4])[0]
        typ = data[pos + 4 : pos + 8].decode("latin1", errors="replace")
        if size < 8:
            break
        box_end = min(pos + size, end)
        yield pos, size, typ, box_end
        pos = box_end


def find_boxes(data, type_name, start=0, end=None):
    for pos, size, typ, box_end in iter_boxes(data, start, end):
        if typ == type_name:
            yield pos, size, box_end
        elif typ in ("moov", "trak", "mdia", "minf", "stbl", "edts"):
            yield from find_boxes(data, type_name, pos + 8, box_end)


def matrix_rotation(a, b):
    return round(math.degrees(math.atan2(b, a)))


def probe(path):
    with open(path, "rb") as f:
        data = f.read()

    coded_w = coded_h = 0
    for codec in ("avc1", "hvc1", "hev1", "mp4v"):
        for pos, size, box_end in find_boxes(data, codec):
            coded_w = struct.unpack(">H", data[pos + 24 : pos + 26])[0]
            coded_h = struct.unpack(">H", data[pos + 26 : pos + 28])[0]
            print(f"coded ({codec}): {coded_w}x{coded_h}")
            break
        if coded_w:
            break

    tkhd_rot = None
    tkhd_w = tkhd_h = 0
    for pos, size, box_end in find_boxes(data, "tkhd"):
        version = data[pos + 8]
        if version == 0:
            off = pos + 8 + 1 + 3 + 4 + 4 + 4 + 4 + 2 + 2 + 2 + 2 + 2 + 2 + 8 + 8
        else:
            off = pos + 8 + 1 + 3 + 8 + 8 + 4 + 4 + 8 + 8 + 2 + 2 + 2 + 2 + 2 + 2 + 8 + 8
        tkhd_w = struct.unpack(">I", data[off : off + 4])[0] / 65536.0
        tkhd_h = struct.unpack(">I", data[off + 4 : off + 8])[0] / 65536.0
        matrix_off = off + 8
        a, b, _, d = struct.unpack(">iiii", data[matrix_off : matrix_off + 16])
        tkhd_rot = matrix_rotation(a, b)
        print(f"tkhd display: {tkhd_w:.0f}x{tkhd_h:.0f} matrix={tkhd_rot}°")
        break

    rotate_tag = None
    idx = data.find(b"rotate")
    while idx != -1:
        snippet = data[idx : idx + 12]
        if b"90" in snippet or b"180" in snippet or b"270" in snippet or b"0" in snippet:
            rotate_tag = snippet.decode("latin1", errors="replace")
        idx = data.find(b"rotate", idx + 1)
    if rotate_tag:
        print(f"rotate tag bytes: {rotate_tag!r}")

    stream_rot = tkhd_rot or 0
    eff_w, eff_h = coded_w, coded_h
    if stream_rot in (90, 270):
        eff_w, eff_h = coded_h, coded_w
    print(f"effective: {eff_w}x{eff_h} rotation={stream_rot}° landscape={eff_w > eff_h}")


if __name__ == "__main__":
    probe(sys.argv[1])
