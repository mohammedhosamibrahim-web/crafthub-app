#!/usr/bin/env python3
"""Generate CraftHub Android launcher icons.

Writes the full mipmap density set plus a 512x512 Play Store icon, using the
CraftHub red -> green split-gradient mark. No text rendering is used, so the
output is deterministic on any build host with Pillow installed.
"""
import os
import sys

from PIL import Image, ImageDraw

RED = (0xFF, 0x00, 0x00)
GREEN = (0x10, 0xB9, 0x81)

# Android launcher densities (px) -> mipmap folder suffix
DENSITIES = {
    "mdpi": 48,
    "hdpi": 72,
    "xhdpi": 96,
    "xxhdpi": 144,
    "xxxhdpi": 192,
}


def make_icon(size, round_icon=False):
    """Split-gradient square with a knocked-out 'C' and a subtle ring."""
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    px = img.load()

    # Diagonal red -> green gradient background
    for y in range(size):
        for x in range(size):
            t = (x + y) / max(1, (size - 1) * 2)
            px[x, y] = (
                int(RED[0] + (GREEN[0] - RED[0]) * t),
                int(RED[1] + (GREEN[1] - RED[1]) * t),
                int(RED[2] + (GREEN[2] - RED[2]) * t),
                255,
            )

    draw = ImageDraw.Draw(img)

    # Knock out a 'C' (ring with a right-side opening) in white
    pad = size * 0.28
    box = (pad, pad, size - pad, size - pad)
    width = max(2, int(size * 0.13))
    draw.arc(box, start=55, end=305, fill=(255, 255, 255, 255), width=width)

    # Round mask for adaptive/round icon variants
    if round_icon:
        mask = Image.new("L", (size, size), 0)
        ImageDraw.Draw(mask).ellipse((0, 0, size - 1, size - 1), fill=255)
        img.putalpha(mask)

    return img


def main():
    out_root = sys.argv[1] if len(sys.argv) > 1 else "app/src/main/res"

    for density, size in DENSITIES.items():
        folder = os.path.join(out_root, f"mipmap-{density}")
        os.makedirs(folder, exist_ok=True)
        icon = make_icon(size)
        icon.save(os.path.join(folder, "ic_launcher.png"))
        # Round variant
        make_icon(size, round_icon=True).save(
            os.path.join(folder, "ic_launcher_round.png")
        )
        # Adaptive-icon foreground needs padding around the glyph
        fg = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        inner = make_icon(int(size * 0.62))
        off = (size - inner.width) // 2
        fg.paste(inner, (off, off), inner)
        fg.save(os.path.join(folder, "ic_launcher_foreground.png"))
        print(f"  {density:8s} {size:3d}px")

    os.makedirs("store", exist_ok=True)
    make_icon(512).save(os.path.join("store", "play-store-icon-512.png"))
    print("  play store  512px -> store/play-store-icon-512.png")


if __name__ == "__main__":
    main()
