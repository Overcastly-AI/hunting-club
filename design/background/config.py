"""Single source for the background loop's numbers. scene.py (Blender) and encode.py (ffmpeg) both import it.

No bpy import here, so the plain system Python can read it too.
"""
from __future__ import annotations

import json
import os
import re
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
MANIFEST = HERE / "assets.json"
OUT = HERE / "out"

# ---------------------------------------------------------------- loop
LOOP_SECONDS = 10          # brief: 8 to 12 s
FPS = 24
FRAMES = LOOP_SECONDS * FPS  # frame FRAMES is identical to frame 0, so it is never rendered
POSTER_FRAME = 120         # t = 5.0 s: doe's head is up, turkeys mid-frame, birds gone

# ---------------------------------------------------------------- render sizes (16:9 master)
QUALITY = {
    #          (width, height, samples)
    "draft": (640, 360, 24),
    "preview": (960, 540, 48),
    "final": (1280, 720, 48),      # the 8k HDRI gives about 1,230 photograph pixels across this lens: 720p is honest
}

# ---------------------------------------------------------------- encodes
# Mobile is a 9:16 crop of the master, taken where the animals are (fraction of master width at the crop's left edge).
MOBILE_CROP_LEFT = 0.50
MOBILE_SIZE = (390, 694)
DESKTOP_SIZE = (1280, 720)
BUDGET_BYTES = {"mobile": 1_500_000, "desktop": 3_000_000}

# ---------------------------------------------------------------- grade and scrim (contrast guarantee)
# The grade mutes the footage and caps its brightest pixel. With the cap known, a flat scrim of colors.surface at
# SCRIM_ALPHA keeps both text tokens above the 4.5:1 floor over ANY frame, not just the ones we looked at.
# The contrast maths lives only in packages/design; docs/BACKGROUND_LOOP.md has the test to add there.
SATURATION = 0.75
PEAK = 0.40                # brightest allowed sRGB channel value (0..1) after the grade
SCRIM_ALPHA = 0.40         # worst case for textSecondary is in docs/BACKGROUND_LOOP.md section 2


def design_tokens() -> dict:
    """Read the colour tokens from packages/design (the single source), never retype them."""
    colors = (REPO / "packages/design/src/colors.ts").read_text()
    return dict(re.findall(r"^\s+(\w+): '(#[0-9A-Fa-f]{6})',", colors, flags=re.M))


def asset_dir() -> Path:
    """Download cache, outside the repo (nothing downloaded is committed)."""
    return Path(os.environ.get("HCM_BG_ASSETS", Path.home() / ".cache/huntclubmesh/background_assets"))


def work_dir() -> Path:
    """Rendered frames (scratch, outside the repo)."""
    return Path(os.environ.get("HCM_BG_WORK", Path.home() / ".cache/huntclubmesh/background_work"))


def manifest() -> list:
    return json.loads(MANIFEST.read_text())["assets"]
