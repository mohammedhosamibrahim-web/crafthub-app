#!/usr/bin/env python3
"""Generate crafthub.ico (32x32) with the CraftHub red->green split gradient.

Writes a valid single-image 32bpp ICO by hand so build hosts don't need Pillow.
Pixel order in a BMP payload is bottom-up BGRA, followed by an AND mask.
"""
import struct
import sys

W = H = 32
RADIUS = 6


def in_rounded(x, y, w, h, r):
    if x < 0 or y < 0 or x >= w or y >= h:
        return False
    cx = min(max(x, r), w - 1 - r)
    cy = min(max(y, r), h - 1 - r)
    if x == cx or y == cy:
        return True
    return (x - cx) ** 2 + (y - cy) ** 2 <= r * r


def pixel(x, y):
    """Return (B, G, R, A). Left half red -> right half green, diagonal blend."""
    t = (x + y) / (W + H - 2)          # 0..1 along the diagonal
    red = (0xFF, 0x00, 0x00)
    grn = (0x10, 0xB9, 0x81)
    r = int(red[0] + (grn[0] - red[0]) * t)
    g = int(red[1] + (grn[1] - red[1]) * t)
    b = int(red[2] + (grn[2] - red[2]) * t)

    # Knock out a "C" glyph so the mark reads as CraftHub.
    cx, cy, ro, ri = 15.5, 15.5, 10.0, 6.2
    d = ((x - cx) ** 2 + (y - cy) ** 2) ** 0.5
    ang = __import__("math").degrees(__import__("math").atan2(y - cy, x - cx)) % 360
    # opening on the right side
    gap = 300 <= ang <= 360 or 0 <= ang <= 60
    if ro >= d >= ri and not gap:
        return (255, 255, 255, 255)

    if not in_rounded(x, y, W, H, RADIUS):
        return (0, 0, 0, 0)
    return (b, g, r, 255)


def build():
    rows = []
    for y in range(H - 1, -1, -1):          # bottom-up
        row = b""
        for x in range(W):
            b, g, r, a = pixel(x, y)
            row += bytes((b, g, r, a))
        rows.append(row)
    xor = b"".join(rows)

    # AND mask: 1bpp, rows padded to 4 bytes. All zero = "use alpha".
    mask_row = ((W + 31) // 32) * 4
    and_mask = b"\x00" * (mask_row * H)

    bmp_header = struct.pack(
        "<IiiHHIIiiII",
        40,          # biSize
        W,           # biWidth
        H * 2,       # biHeight (XOR + AND)
        1,           # biPlanes
        32,          # biBitCount
        0,           # biCompression = BI_RGB
        len(xor) + len(and_mask),
        0, 0, 0, 0,
    )
    image = bmp_header + xor + and_mask

    icondir = struct.pack("<HHH", 0, 1, 1)
    entry = struct.pack("<BBBBHHII", W, H, 0, 0, 1, 32, len(image), 6 + 16)
    return icondir + entry + image


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else "crafthub.ico"
    with open(out, "wb") as fh:
        fh.write(build())
    print(f"wrote {out}")
