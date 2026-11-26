"""Grade the rendered frames and encode the web files (needs ffmpeg with libx264, libsvtav1, libaom, libwebp).

    python3 design/background/encode.py --quality draft            # frames from $HCM_BG_WORK/draft
    python3 design/background/encode.py --quality draft --step 2   # only every 2nd frame was rendered (12 fps)

Writes to design/background/out/:
    poster.{jpg,webp,avif}, poster-mobile.{jpg,webp,avif}     the LCP image (frame POSTER_FRAME)
    loop-desktop.{webm,mp4}, loop-mobile.{webm,mp4}           AV1 in WebM first, H.264 MP4 fallback; no audio track
    review/contact-sheet.jpg, review/scrim-check.jpg          for review only, not shipped
    manifest.json                                             sizes, budgets, the measured peak pixel

The grade mutes the footage and clamps it a little below config.PEAK (lossy codecs overshoot a clamp). The script
then decodes what it encoded and fails if any pixel is above PEAK: that measured cap is what lets a flat scrim
guarantee text contrast over every frame.
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import config as C  # noqa: E402

CODEC_HEADROOM = 0.10              # the grade clamps this far below PEAK; codecs ring past a clamp (0.074 measured)
FONT = C.REPO / "app/assets/fonts/Archivo-Variable.ttf"


def grade_filter() -> str:
    """Muted and calm: less saturation, a steep curve that keeps the trunks dark and puts the sun glow at the cap
    (so the picture keeps its own contrast and needs a lighter scrim), then a hard clamp so the cap is exact."""
    top = C.PEAK - CODEC_HEADROOM
    cap = round(top * 255)
    return (f"eq=saturation={C.SATURATION},"
            f"curves=all='0/0 0.35/{top * 0.18:.3f} 0.65/{top * 0.5:.3f} 0.9/{top * 0.86:.3f} 1/{top:.3f}',"
            f"lutrgb=r='min(val,{cap})':g='min(val,{cap})':b='min(val,{cap})'")


def run(args: list) -> None:
    subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", *map(str, args)], check=True)


def peak_of(path: Path, vf: str = "null") -> float:
    """Brightest sRGB channel value (0..1) anywhere in a file, measured on the decoded pixels."""
    p = subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-i", str(path), "-vf", vf, "-f", "rawvideo",
                        "-pix_fmt", "rgb24", "-"], check=True, capture_output=True)
    return max(p.stdout) / 255


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--quality", default="draft", choices=list(C.QUALITY))
    ap.add_argument("--step", type=int, default=1, help="frame step used for the render (2 = 12 fps draft)")
    ap.add_argument("--frames", default="", help="frame folder (default $HCM_BG_WORK/<quality>)")
    a = ap.parse_args(argv)
    src = Path(a.frames) if a.frames else C.work_dir() / a.quality
    have = sorted(src.glob("f_*.png"))
    want = [src / f"f_{f:04d}.png" for f in range(0, C.FRAMES, a.step)]
    missing = [p.name for p in want if p not in have]
    if missing:
        sys.exit(f"{len(missing)} frames missing in {src} (first: {missing[0]}). Render them, or pass --step.")
    out = C.OUT
    review = out / "review"                          # for people to look at; never shipped
    review.mkdir(parents=True, exist_ok=True)
    w, h, _ = C.QUALITY[a.quality]
    fps = C.FPS / a.step
    grade = grade_filter()

    # the mobile file is a 9:16 crop of the master where the animals are; the desktop file never upscales
    mw, mh = C.MOBILE_SIZE
    cw = int(h * mw / mh) // 2 * 2
    mobile = f"crop={cw}:{h}:{int(w * C.MOBILE_CROP_LEFT) // 2 * 2}:0,scale={mw}:{mh}:flags=lanczos"
    dw = min(w, C.DESKTOP_SIZE[0]) // 2 * 2
    desktop = f"scale={dw}:-2:flags=lanczos"
    seq = ["-framerate", fps, "-start_number", 0, "-i", src / "f_%04d.png"]
    if a.step > 1:                                     # numbered files skip, so feed the list instead
        lst = out / ".frames.txt"
        lst.write_text("".join(f"file '{p}'\nduration {1 / fps}\n" for p in want))
        seq = ["-f", "concat", "-safe", 0, "-i", lst]

    files = {}
    for name, crop in (("desktop", desktop), ("mobile", mobile)):
        vf = f"{crop},{grade},format=yuv420p"
        common = ["-vf", vf, "-r", fps, "-an", "-g", int(C.LOOP_SECONDS * fps)]
        mp4, webm = out / f"loop-{name}.mp4", out / f"loop-{name}.webm"
        run([*seq, *common, "-c:v", "libx264", "-preset", "slow", "-crf", 20, "-profile:v", "high",
             "-movflags", "+faststart", mp4])
        run([*seq, *common, "-c:v", "libsvtav1", "-preset", 5, "-crf", 28, webm])
        files[name] = [mp4, webm]
    (out / ".frames.txt").unlink(missing_ok=True)

    poster_src = src / f"f_{C.POSTER_FRAME:04d}.png"
    for stem, crop in (("poster", desktop), ("poster-mobile", mobile)):
        vf = f"{crop},{grade}"
        run(["-i", poster_src, "-vf", vf, "-q:v", 5, out / f"{stem}.jpg"])
        run(["-i", poster_src, "-vf", vf, "-c:v", "libwebp", "-quality", 72, out / f"{stem}.webp"])
        run(["-i", poster_src, "-vf", f"{vf},format=yuv420p", "-c:v", "libaom-av1", "-still-picture", 1, "-crf", 34,
             "-cpu-used", 4, out / f"{stem}.avif"])

    # review aids: six frames across the loop, and the poster under the planned scrim with sample text
    picks = [want[i * len(want) // 6] for i in range(6)]
    ins = [x for p in picks for x in ("-i", p)]
    run([*ins, "-filter_complex",
         "".join(f"[{i}]{grade},scale=640:-2[g{i}];" for i in range(6)) + "".join(f"[g{i}]" for i in range(6))
         + "xstack=inputs=6:layout=0_0|w0_0|0_h0|w0_h0|0_h0+h0|w0_h0+h0", "-q:v", 4, review / "contact-sheet.jpg"])
    tok = C.design_tokens()
    scrim = f"drawbox=x=0:y=0:w=iw:h=ih:color={tok['surface'].replace('#', '0x')}@{C.SCRIM_ALPHA}:t=fill"
    text = "".join(
        f",drawtext=fontfile={FONT}:text='{t}':fontcolor={tok[c].replace('#', '0x')}:fontsize={s}:x=64:y={y}"
        for t, c, s, y in (("Hunt together with no cell service.", "text", 56, 190),
                           ("Sample text only. Scrim and text colours are the design tokens.", "textSecondary", 22, 280)))
    run(["-i", poster_src, "-vf", f"{grade},scale=1280:-2:flags=lanczos,{scrim}{text}", "-q:v", 3,
         review / "scrim-check.jpg"])

    peak = max(peak_of(p) for ps in files.values() for p in ps)
    peak = max(peak, *(peak_of(out / f"{s}.{e}") for s in ("poster", "poster-mobile") for e in ("jpg", "webp", "avif")))
    report = {
        "source": {"quality": a.quality, "size": [w, h], "fps": fps, "frames": len(want), "seconds": C.LOOP_SECONDS},
        "poster_frame": C.POSTER_FRAME,
        "peak_srgb": {"cap": C.PEAK, "measured": round(peak, 4)},
        "scrim_alpha_planned": C.SCRIM_ALPHA,
        "budget_bytes": C.BUDGET_BYTES,
        "files": {p.name: p.stat().st_size for p in sorted(out.iterdir()) if p.is_file() and p.name != "manifest.json"},
    }
    (out / "manifest.json").write_text(json.dumps(report, indent=1) + "\n")
    print(json.dumps(report, indent=1))
    problems = [f"{p.name} is {p.stat().st_size} bytes, budget {C.BUDGET_BYTES[n]}"
                for n, ps in files.items() for p in ps if p.stat().st_size > C.BUDGET_BYTES[n]]
    if peak > C.PEAK:
        problems.append(f"peak pixel {peak:.3f} is above the cap {C.PEAK}")
    if problems:
        sys.exit("FAILED: " + "; ".join(problems))


if __name__ == "__main__":
    main()
