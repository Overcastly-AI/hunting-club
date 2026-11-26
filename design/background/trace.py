"""Turn the rendered silhouette masks into SVG paths and write them where the scene reads them.

    python3 design/background/trace.py            # $HCM_BG_WORK/masks -> packages/design/src/dawnSprites.generated.ts

Needs only Pillow and numpy (no potrace, no OpenCV). Per mask:
1. close small gaps (grow, then shrink): where two solids of the rig meet, the notch between them fills in, so the
   outline reads as one animal and not as stacked shapes. Thin parts (antlers, legs, beak) keep their width;
2. blur slightly and threshold: a clean edge;
3. walk the edge between inside and outside pixels into closed loops;
4. drop points that add less than `tolerance` (Douglas-Peucker);
5. write each loop as a smooth closed curve through the midpoints of its sides, in whole path units.

Frames that trace to the same path are stored once.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

sys.path.insert(0, str(Path(__file__).resolve().parent))
import config as C  # noqa: E402
import poses as P  # noqa: E402

CLOSE_M = 0.012            # gaps narrower than about twice this are filled
CLOSE_M_CLIP = {"buck": 0.005}   # less for the buck, or the gaps between his tines fill and the rack is a blob
# Douglas-Peucker tolerance in path units. Animals drawn small in the scene get a coarser outline.
TOLERANCE = {"doe": 1.5, "buck": 3.2, "turkeyWalk": 1.5, "turkeyFeed": 1.5, "crow": 2.0}
MIN_LOOP_AREA_PX = 60      # specks and pinholes are dropped


def clean(mask: Image.Image, close_m: float = CLOSE_M) -> np.ndarray:
    k = round(close_m * C.MASK_PX_PER_M) * 2 + 1
    m = mask.convert("L").filter(ImageFilter.MaxFilter(k)).filter(ImageFilter.MinFilter(k))
    m = m.filter(ImageFilter.GaussianBlur(2.0))
    return np.asarray(m) >= 128


def loops(inside: np.ndarray) -> list:
    """Closed outlines of a boolean image, as lists of pixel-corner points, inside on the left."""
    a = np.pad(inside, 1).astype(np.int8)
    nxt = {}

    def add(p, q):
        nxt.setdefault(p, []).append(q)
    dv = a[1:, :] - a[:-1, :]                 # crossing a horizontal pixel edge, going down
    for y, x in zip(*np.nonzero(dv == 1)):    # outside above, inside below: walk left along the top of the shape
        add((x + 1, y + 1), (x, y + 1))
    for y, x in zip(*np.nonzero(dv == -1)):   # inside above: walk right along the bottom
        add((x, y + 1), (x + 1, y + 1))
    dh = a[:, 1:] - a[:, :-1]
    for y, x in zip(*np.nonzero(dh == 1)):    # outside left, inside right: walk down the left side
        add((x + 1, y), (x + 1, y + 1))
    for y, x in zip(*np.nonzero(dh == -1)):   # inside left: walk up the right side
        add((x + 1, y + 1), (x + 1, y))
    out = []
    while nxt:
        start = next(iter(nxt))
        loop, p = [], start
        while True:
            loop.append(p)
            ends = nxt[p]
            q = ends.pop()
            if not ends:
                del nxt[p]
            p = q
            if p == start:
                break
        out.append(np.array(loop, dtype=float) - 1.0)        # undo the padding
    return out


def area(pts: np.ndarray) -> float:
    x, y = pts[:, 0], pts[:, 1]
    return abs(float(np.dot(x, np.roll(y, -1)) - np.dot(y, np.roll(x, -1)))) / 2


def simplify(pts: np.ndarray, tol: float) -> np.ndarray:
    """Douglas-Peucker on a closed loop: split it at its two farthest-apart points, simplify both halves."""
    def dp(seg):
        keep = np.zeros(len(seg), dtype=bool)
        keep[0] = keep[-1] = True
        stack = [(0, len(seg) - 1)]
        while stack:
            i, j = stack.pop()
            if j <= i + 1:
                continue
            a, b = seg[i], seg[j]
            d = b - a
            n = np.hypot(*d) or 1.0
            dist = np.abs(d[0] * (seg[i + 1:j, 1] - a[1]) - d[1] * (seg[i + 1:j, 0] - a[0])) / n
            m = int(np.argmax(dist))
            if dist[m] > tol:
                keep[i + 1 + m] = True
                stack += [(i, i + 1 + m), (i + 1 + m, j)]
        return seg[keep]
    far = int(np.argmax(np.hypot(*(pts - pts[0]).T)))
    first, second = dp(pts[:far + 1]), dp(np.vstack([pts[far:], pts[:1]]))
    return np.vstack([first[:-1], second[:-1]])


def to_path(pts: np.ndarray) -> str:
    """A closed curve that passes through the midpoint of every side and bends at every corner."""
    v = np.rint(pts).astype(int)
    v = v[np.any(v != np.roll(v, 1, axis=0), axis=1)]        # rounding can merge neighbours
    if len(v) < 3:
        return ""
    mid = (v + np.roll(v, -1, axis=0)) / 2.0                 # mid[i] lies between v[i] and v[i+1]

    def n(x):
        return f"{x:g}"
    d, at = [f"M{n(mid[-1][0])} {n(mid[-1][1])}"], mid[-1]
    for i in range(len(v)):                                  # relative commands keep the numbers short
        c, e = v[i] - at, mid[i] - at
        d.append(f"q{n(c[0])} {n(c[1])} {n(e[0])} {n(e[1])}")
        at = mid[i]
    return "".join(d).replace(" -", "-") + "z"


def trace(mask: Image.Image, tol: float, close_m: float = CLOSE_M) -> str:
    scale = C.PATH_UNITS_PER_M / C.MASK_PX_PER_M
    parts = []
    for loop in loops(clean(mask, close_m)):
        if area(loop) < MIN_LOOP_AREA_PX:
            continue
        parts.append(to_path(simplify(loop * scale, tol)))
    return "".join(parts)


def main():
    work = C.work_dir() / "masks"
    out = {}
    for name, clip in P.CLIPS.items():
        idx = json.loads((work / name / "index.json").read_text())
        cells, remap = [], {}
        for i in range(idx["unique"]):
            d = trace(Image.open(work / name / f"{i:04d}.png"), TOLERANCE[name], CLOSE_M_CLIP.get(name, CLOSE_M))
            if d not in cells:
                cells.append(d)
            remap[i] = cells.index(d)
        x0, z0, x1, z1 = clip["box"]
        u = C.PATH_UNITS_PER_M
        out[name] = {
            "width": round((x1 - x0) * u), "height": round((z1 - z0) * u),
            "originX": round(-x0 * u), "groundY": round(z1 * u),     # the animal's reference point, on the ground
            "unitsPerMetre": u, "fps": P.fps(name), "cells": cells, "frames": [remap[i] for i in idx["frames"]],
            **({"stride": round(clip["stride"] * u)} if "stride" in clip else {}),
        }
        size = sum(len(c) for c in cells)
        print(f"{name}: {len(idx['frames'])} frames, {len(cells)} paths, {size} bytes of path data")
    body = json.dumps(out, separators=(",", ":"))
    C.SPRITES_TS.write_text(
        "// GENERATED by design/background/trace.py from the Blender rigs in design/background. Do not edit.\n"
        "// Silhouette frames of the dawn scene's animals as SVG path data (see dawnScene.ts).\n"
        "/* eslint-disable */\n"
        "export interface DawnSprite {\n"
        "  /** Frame size in path units. */\n  width: number;\n  height: number;\n"
        "  /** The animal's reference point on the ground, in path units. */\n  originX: number;\n  groundY: number;\n"
        "  unitsPerMetre: number;\n  fps: number;\n"
        "  /** Distinct frames as path data. */\n  cells: string[];\n"
        "  /** For every frame of the loop, the index of its cell. */\n  frames: number[];\n"
        "  /** Walk cycles only: path units travelled per loop. */\n  stride?: number;\n}\n"
        f"export const dawnSprites: Record<'doe' | 'buck' | 'turkeyWalk' | 'turkeyFeed' | 'crow', DawnSprite> = {body};\n")
    print(f"wrote {C.SPRITES_TS.relative_to(C.REPO)}: {C.SPRITES_TS.stat().st_size} bytes")


if __name__ == "__main__":
    main()
