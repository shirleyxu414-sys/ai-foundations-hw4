"""Make web copies of the product photos with one consistent white background.

Some supplied photos sit on black (or have black bars beside white), which looks patchy on the
light Yale theme. The originals in data/products/ are never touched; the copies go to
data/products_web/ (same file names), and the backend serves those.

Only pure-black pixels connected to the photo's border are turned white, so black or navy parts
of a garment (shadows, pockets) are kept. A soft 2-pixel edge avoids a hard dark outline.

Run once (needs: pip install pillow numpy scipy):
    python backend/scripts/make_web_images.py
"""

from __future__ import annotations

import shutil
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "data" / "products"
DST = ROOT / "data" / "products_web"

BLACK_MAX = 12      # brightest channel still counted as background black (real background is 0, JPEG noise <= 8)
MAX_BG_SHARE = 0.85  # if "background" would cover more than this, the photo is mostly dark: leave it
GAP_MIN_SHARE = 0.0005  # an enclosed black patch at least this share of the photo counts as a real gap
GAP_MAX_SHARE = 0.01    # ...and must be smaller than this (a bigger one is part of the garment)
MAX_REAL_GAPS = 2       # arm-to-body wedges come in one or two; more scattered patches are pure-black shadows


def whiten_background(im: Image.Image) -> tuple[Image.Image, float]:
    rgb = np.asarray(im.convert("RGB")).astype(np.float32)
    dark = rgb.max(axis=2) <= BLACK_MAX
    labels, _ = ndimage.label(dark)
    border = np.unique(np.concatenate([labels[0], labels[-1], labels[:, 0], labels[:, -1]]))
    bg = np.isin(labels, border[border > 0])
    # Enclosed pure-black gaps between sleeve and body are background too. A photo with one or two
    # such gaps is filled; a photo with many scattered black patches (pure-black shadows in a dark
    # hoodie) or a big black area (a black garment) is left alone.
    gap_ids, gap_sizes = np.unique(labels[(labels > 0) & ~bg], return_counts=True)
    frac = gap_sizes / labels.size
    real = (frac >= GAP_MIN_SHARE) & (frac < GAP_MAX_SHARE)
    if 1 <= real.sum() <= MAX_REAL_GAPS and not (frac >= GAP_MAX_SHARE).any():
        bg |= np.isin(labels, gap_ids)
    share = float(bg.mean())
    if share == 0 or share > MAX_BG_SHARE:
        return im.convert("RGB"), 0.0 if share == 0 else share

    # soft edge: blend the two pixels next to the background partway toward white
    grow1 = ndimage.binary_dilation(bg, iterations=1)
    grow2 = ndimage.binary_dilation(bg, iterations=2)
    ring1, ring2 = grow1 & ~bg, grow2 & ~grow1
    out = rgb.copy()
    out[ring1] = rgb[ring1] * 0.4 + 255.0 * 0.6
    out[ring2] = rgb[ring2] * 0.75 + 255.0 * 0.25
    out[bg] = 255.0
    return Image.fromarray(out.round().astype(np.uint8)), share


def main() -> int:
    DST.mkdir(exist_ok=True)
    changed = kept = 0
    skipped: list[str] = []
    for path in sorted(SRC.glob("*.jpg")):
        im = Image.open(path)
        out, share = whiten_background(im)
        if share == 0:
            shutil.copy2(path, DST / path.name)
            kept += 1
        elif share > MAX_BG_SHARE:
            shutil.copy2(path, DST / path.name)
            skipped.append(path.name)
        else:
            out.save(DST / path.name, quality=93, optimize=True)
            changed += 1
    print(f"{changed} photos got a white background, {kept} already had none, {len(skipped)} left as-is")
    for name in skipped:
        print("  left as-is (mostly dark):", name)
    return 0


if __name__ == "__main__":
    sys.exit(main())
