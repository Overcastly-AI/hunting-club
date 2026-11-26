"""Measure the deer rigs against white-tailed deer proportions (numpy only, no Blender).

    python3 design/background/proportions.py          # prints each ratio and flags any outside its range

The rig's solids are rasterised straight from poses.py (a quick stand-in for the Blender mask, same shapes), then
measured as a silhouette: the top of the withers, the chest and the flank in a vertical slice, the body's length
at mid-chest height. Head and ear come from the rig's own numbers.
"""
from __future__ import annotations

import math
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
import poses as P  # noqa: E402

PX_PER_M = 300

# Adult white-tailed deer, as ratios of shoulder height H (field-guide body measurements: shoulder 0.80-1.05 m,
# chest girth depth about equal to leg length, body about 1.1 H long, ear 15-19 cm on a 27-32 cm head).
REFERENCE = {
    "chest depth / H": (0.46, 0.53),
    "leg length / H": (0.47, 0.55),
    "leg length / chest depth": (0.90, 1.12),
    "body length / H": (1.05, 1.25),
    "flank depth / chest depth": (0.70, 0.85),
    "head length / H": (0.27, 0.33),
    "ear length / head length": (0.55, 0.66),
    "rump above withers / H": (-0.02, 0.06),
}


def raster(pose: list, box) -> np.ndarray:
    x0, z0, x1, z1 = box
    w, h = round((x1 - x0) * PX_PER_M), round((z1 - z0) * PX_PER_M)
    X, Z = np.meshgrid(x0 + (np.arange(w) + 0.5) / PX_PER_M, z1 - (np.arange(h) + 0.5) / PX_PER_M)
    m = np.zeros((h, w), bool)
    for prim in pose:
        if prim[0] == "ell":
            _, cx, cz, rx, rz, a = prim
            u = (X - cx) * math.cos(a) + (Z - cz) * math.sin(a)
            v = -(X - cx) * math.sin(a) + (Z - cz) * math.cos(a)
            m |= (u / rx) ** 2 + (v / rz) ** 2 <= 1
        elif prim[0] == "limb":
            _, ax, az, bx, bz, ra, rb = prim
            dx, dz = bx - ax, bz - az
            s = np.clip(((X - ax) * dx + (Z - az) * dz) / (dx * dx + dz * dz or 1e-9), 0, 1)
            m |= np.hypot(X - ax - s * dx, Z - az - s * dz) <= ra + (rb - ra) * s
    return m


def measure(pose: list, box) -> dict:
    m = raster(pose, box)
    x0, _, _, z1 = box

    def column(x):
        rows = np.flatnonzero(m[:, int((x - x0) * PX_PER_M)])
        return z1 - rows[0] / PX_PER_M, z1 - rows[-1] / PX_PER_M

    lm = P.DEER_LANDMARKS
    withers, _ = column(lm["withers_x"])
    chest_top, chest_bottom = column(lm["girth_x"])
    flank_top, flank_bottom = column(lm["waist_x"])
    rump, _ = column(lm["rump_x"])
    row = m[int((z1 - (chest_top + chest_bottom) / 2) * PX_PER_M)].astype(int)
    edges = np.flatnonzero(np.diff(np.r_[0, row, 0]))
    length = max(b - a for a, b in zip(edges[::2], edges[1::2])) / PX_PER_M
    chest, head = chest_top - chest_bottom, P.deer_head_length()
    return {
        "chest depth / H": chest / withers,
        "leg length / H": chest_bottom / withers,
        "leg length / chest depth": chest_bottom / chest,
        "body length / H": length / withers,
        "flank depth / chest depth": (flank_top - flank_bottom) / chest,
        "head length / H": head / withers,
        "ear length / head length": 2 * P.DEER_HEAD["ear"] / head,
        "rump above withers / H": (rump - withers) / withers,
    }


def main() -> int:
    bad = 0
    for name, pose in (("doe", P.doe(5.9)), ("buck", P.buck(0.5))):        # both standing, head up
        print(name)
        for key, value in measure(pose, P.CLIPS[name]["box"]).items():
            lo, hi = REFERENCE[key]
            ok = lo <= value <= hi
            bad += not ok
            print(f"  {key:28s} {value:6.3f}   reference {lo:.2f}-{hi:.2f}{'' if ok else '   OUT OF RANGE'}")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
