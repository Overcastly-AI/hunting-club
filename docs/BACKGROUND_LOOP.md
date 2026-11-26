# Background loop: wildlife at dawn (design and pipeline)

Status: first draft rendered 2026-11-26. Not integrated into `site/` or `web/` yet. Outputs: `design/background/out/`.

The owner asked for a Blender rendering of wildlife (wild turkeys, white-tailed deer, birds, trees) looping silently
behind the sign-in card and the public home page hero.

## 1. Short version

- It can be built here: Blender runs headless in the container (the `bpy` 5.3.0 wheel, Cycles on 4 CPU cores).
- The forest, light and fog are photoreal, because the forest is a CC0 360 degree photograph used as backdrop and
  light. The animals are self-made 3D figures seen as backlit shapes in fog at 15 to 30 m. They are **not** photoreal
  close up. No realistic rigged CC0 deer or turkey exists that we could verify. Section 9 lists what money would buy.
- The draft is the full 10 s loop at 640 x 360, 24 fps (51 minutes of rendering). The same script renders the
  final 1280 x 720 in about 6.7 hours on this container.
- This changes two lines of `docs/SITE_BRIEF.md` (section 6 "No autoplay video" and section 9 "no autoplay"), and
  the home page 600 KB transfer budget needs a stated exception for the deferred video. The owner asked for the
  loop, so the brief should be amended in the PR that integrates it. Everything else in the brief is kept.

## 2. The shot

| | |
|---|---|
| Camera | Locked off, 1.5 m high (a hunter sitting against a tree), 35 mm lens (54 degrees wide), tilted up 5 degrees. It never moves. |
| Place | Bare hardwood forest on leaf litter. No leaves on the trees, so it is deer season. |
| Time | A few minutes after sunrise. The sun is low through the trunks at the right edge of the frame. Ground fog glows towards it. Sunrise only: nothing in the frame or the copy refers to shooting hours. |
| Framing | The horizon sits 35% up the frame. Animals stay in the lower 45%. The upper 55% is trunks and sky and is where text goes. A wide trunk stands at the left third behind the desktop headline. |
| Desktop text | Left half. The animals are centre and right. |
| Mobile | A 9:16 crop of the same frames (`MOBILE_CROP_LEFT` in `config.py`) that holds the doe and the turkey path in its lower half. Text sits in the upper half. |
| Sign-in | The card is opaque (`surfaceRaised`) and centred, so the loop only shows round it. |

### Palette, mapped to the tokens

The footage is graded so it sits under the dark theme instead of fighting it:

- saturation 75%, a steep curve that keeps trunks and ground dark and puts the sun glow at the top, then a hard cap:
  no pixel brighter than 40% (`PEAK` in `config.py`). The result is a blue-grey first-light look with a faint warm
  glow, close to `surface` in the shadows;
- over it, a flat scrim of `colors.surface` (#121416) at 40% (`SCRIM_ALPHA`). Flat, because the brief bans gradients;
- text is `colors.text` and `colors.textSecondary`. The primary button stays `accent` with the dark label. No new
  colours are introduced.

### Contrast is guaranteed, not eyeballed

Because the encode caps the brightest pixel, the worst background the text can ever sit on is known: the cap grey
under the scrim. `encode.py` clamps the grade 5% below the cap (lossy codecs ring past a clamp), then decodes every
file it wrote and fails if any pixel is above the cap. Draft measured: 0.392 against the cap of 0.40.

| Scrim alpha | Worst background | `text` #FFFFFF | `textSecondary` #B8BDC2 |
|---|---|---|---|
| 0.40 (planned), pixel at the cap | #444546 | 9.61:1 | 5.08:1 |
| 0.35 | #49494A | 8.99:1 | 4.75:1 |
| 0.30 | #4D4D4E | 8.44:1 | 4.46:1 (fails) |
| no scrim | #666666 | 5.74:1 | 3.03:1 (fails) |
| 0.40 with no cap (a white pixel) | #A0A1A2 | 2.59:1 | 1.37:1 (why the cap exists) |

Typical frames are far darker than the cap, so real contrast is higher. `out/review/scrim-check.jpg` shows the poster under
the scrim with sample text.

A darker cap with a lighter scrim was chosen over the reverse (cap 55%, scrim 60% was tried first): the worst case
is the same, but the picture keeps more of its own contrast instead of being washed towards grey.

The cost, stated plainly: under the scrim the scene is dim. It is atmosphere, not a showpiece. If the owner wants
the animals brighter, the option that keeps the rule is to scrim only the block behind the text (a flat panel) and
leave the rest of the frame at the graded brightness.

## 3. Motion

One loop is 10 s at 24 fps (240 frames). Everything is calm; nothing moves behind the text except small, slow
shapes.

| Subject | Where | What it does |
|---|---|---|
| Doe | 21 m, right of centre, quartering towards the camera | Grazes with small nibbling movements. At 3 s she lifts her head, looks at the camera, flicks an ear, flicks her tail (the white flag shows), and at 6.6 s lowers her head again. |
| Buck | 31 m, left of centre, in the fog | Stands. Slow head turn across the loop, an ear flick at 2 s, a tail flick at 8 s. Eight-point antlers. |
| Turkeys | A file of hens crossing left to right at about 15 m | Walk at 0.6 m/s with head bob, stop and peck three times along the way. Three or four are in frame at a time. |
| Crows | Three, high on the right | Cross from the right edge to the top edge between 1 s and 6.5 s. They stay in the right half, away from desktop text. |
| Leaves | 70 falling leaves, 2.5 to 17 m | Drift down and tumble. Near ones are out of focus. |
| Fog and mist | Everywhere near the ground | An even fog layer lit by the sun, with slow wisps drifting through it. |
| Trees | The photograph | Do not move. See section 9. |

Stands are not shown and no hunter is in frame, so the scene fits hunters at a stand, at a spot or on the move.

## 4. How the loop seams

Frame 240 would be identical to frame 0, so it is never rendered and the video simply repeats.

- **Periodic motion.** Doe, buck, mist and leaves are functions of time with a whole number of cycles in 10 s. One-off
  gestures (ear and tail flicks, the head lift) start and end inside the loop.
- **Leaves.** Each leaf falls exactly 9 m per loop and wraps from the ground to 9 m up, which is above the frame at
  every distance used.
- **Crows.** Enter and leave out of frame inside the loop.
- **Turkeys: a conveyor.** A turkey takes about 35 s to cross, longer than the loop. So the script animates one long
  walk of 4 loops (40 s) and shows 4 copies of it, each one loop ahead of the next. At the last frame every bird
  stands exactly where the bird in front stood at frame 0, mid-step and mid-peck included. The first bird starts out
  of frame and the last one ends out of frame.
- **Mist.** The noise that shapes the wisps is sampled along a circle, so it returns to its start.
- **Check.** The draft's frames 0 and 239 were compared: the difference is one frame of motion and render noise.

## 5. Assets and licences

Full table with sources: `design/background/CREDITS.md`. Machine-readable: `design/background/assets.json`.

| Asset | Licence |
|---|---|
| Poly Haven HDRI "Autumn Forest 04" (Alexander Scholten), 8k | CC0-1.0 |
| Deer, turkeys, crows, leaves, fog, mist, shadows, animation | Self-made in `scene.py` |

Nothing downloaded is stored in the repo. `scene.py fetch` downloads the HDRI (116 MB) into a cache and checks its
SHA-256.

## 6. Render and encode pipeline

```
python3.13 -m venv $SCRATCH/bpyenv && $SCRATCH/bpyenv/bin/pip install bpy     # about 1 GB, keep it out of the repo
export HCM_BG_ASSETS=$SCRATCH/assets HCM_BG_WORK=$SCRATCH/work                # optional; default ~/.cache/huntclubmesh
$SCRATCH/bpyenv/bin/python design/background/scene.py fetch
$SCRATCH/bpyenv/bin/python design/background/scene.py render --quality draft  # or preview, final; resumable
python3 design/background/encode.py --quality draft
```

| File | Role |
|---|---|
| `design/background/config.py` | The one place for loop length, fps, sizes, poster frame, crop, grade, cap, scrim and budgets. Both scripts import it. Colour tokens are read from `packages/design/src/colors.ts`, never retyped. |
| `design/background/scene.py` | Builds the scene and renders PNG frames. Cycles, CPU, adaptive sampling, Open Image Denoise, AgX. |
| `design/background/encode.py` | Grades, crops, encodes, measures the peak pixel, checks the budgets, writes `out/manifest.json`. |
| `design/background/assets.json`, `CREDITS.md` | Asset manifest and credits. |

The pipeline follows the owner's `hunting-appeal` renderer (`huntkit/viz3d`): headless `bpy` in a scratch venv, the
same Cycles settings, a Poly Haven HDRI as backdrop and light, and an asset manifest with SHA-256. Its hunter figure
(MakeHuman through MPFB 2, CC0) has no animal equivalent, so the animals are built from primitives. That same
figure could put a hunter in a later version of the shot.

EEVEE is not available: it needs a GPU or EGL, and the container has neither. Cycles on CPU is the only renderer.

### Measured render times (4 CPU cores, no GPU)

| Quality | Size | Samples | Per frame | 240 frames |
|---|---|---|---|---|
| draft | 640 x 360 | 24 | 12.7 s (mean of 239) | 51 min (measured) |
| preview | 960 x 540 | 48 | 58 s (one frame measured) | about 3.9 h |
| final | 1280 x 720 | 48 | 100 s (one frame measured) | about 6.7 h |

Why the final is 1280 x 720 and not 1920 x 1080: the 8k HDRI gives about 1,230 photograph pixels across this lens,
so 720p is all the real detail there is, and the frame sits under a scrim. The browser scales it to the hero. A
true 1080p master needs the 16k HDRI (430 MB, same CC0 asset) and roughly 15 hours here; a machine with a GPU would
cut that to well under an hour. `QUALITY` and `DESKTOP_SIZE` in `config.py` are the only lines to change.

### Encodes

| Output | Codec | Settings |
|---|---|---|
| `loop-desktop.webm`, `loop-mobile.webm` | AV1 (SVT-AV1) in WebM | CRF 28, preset 5, one keyframe per loop, no audio track |
| `loop-desktop.mp4`, `loop-mobile.mp4` | H.264 High (x264), yuv420p | CRF 20, preset slow, `+faststart`, no audio track |
| `poster*.avif / .webp / .jpg` | libaom still / libwebp / MJPEG | Frame 120 (5.0 s): doe's head up |

## 7. File sizes

Draft, measured (`design/background/out/manifest.json`):

| File | Size | Bytes |
|---|---|---|
| `loop-desktop.webm` (AV1) | 640 x 360, 24 fps, 10 s | 70,848 |
| `loop-desktop.mp4` (H.264) | 640 x 360, 24 fps, 10 s | 201,180 |
| `loop-mobile.webm` (AV1) | 390 x 694, 24 fps, 10 s | 54,627 |
| `loop-mobile.mp4` (H.264) | 390 x 694, 24 fps, 10 s | 273,137 |
| `poster.avif` / `.webp` / `.jpg` | 640 x 360 | 3,232 / 7,512 / 13,262 |
| `poster-mobile.avif` / `.webp` / `.jpg` | 390 x 694 | 2,732 / 6,110 / 12,221 |
| `review/` (4 JPEGs for people, not shipped) | | 338,322 |
| Whole `out/` folder | | about 1.0 MB |

The mobile draft is cropped from a 202 pixel wide strip of the draft and scaled up, so it is soft. The final mobile
file is cropped from the 720p master (406 pixels wide), which is the right size for it.

Final sizes are an estimate until the final render exists. The footage is a locked camera with fog, which compresses
well: expect about 0.3 to 0.5 MB (AV1) and 1 to 1.5 MB (H.264) for desktop 720p, and about 0.15 to 0.25 MB (AV1) and
0.6 to 0.9 MB (H.264) for mobile. `encode.py` fails the build if a file is over its budget (1.5 MB mobile, 3 MB desktop), so
the answer to a miss is a higher CRF, not a silent overrun.

The brief's poster budget (150 KB at 390 wide) is met with a wide margin.

## 8. Integration plan

Not done in this branch. Small PRs in this order.

### 8.1 Tokens and copy (packages, one source each)

- `packages/design`: add `backgroundLoop = { scrimAlpha: 0.4, peak: 0.4 }` and make `design/background/config.py`
  read both from there, the way it already reads the colours. Add a contrast test with the existing helpers:
  `contrastRatio(colors.text, blendOver(colors.surface, capGrey, scrimAlpha)) >= MIN_TEXT_CONTRAST`, the same for
  `textSecondary`, where `capGrey` is the cap as a grey. Add a test that reads the shipped
  `manifest.json` and fails if `peak_srgb.measured` is above the cap.
- `packages/shared`: the two button labels, "Pause background" and "Play background", next to `signInCopy`.
- One framework-free module (suggest `packages/design/src/backgroundLoop.ts`) exports the markup builder and the
  small controller below. `site/` inlines it; `web/` calls it from a React effect. No second copy.

### 8.2 Markup

```html
<div class="bg-loop" aria-hidden="true">
  <picture>
    <source media="(max-width: 599px)" type="image/avif" srcset="/media/poster-mobile.<hash>.avif">
    <source media="(max-width: 599px)" type="image/webp" srcset="/media/poster-mobile.<hash>.webp">
    <source type="image/avif" srcset="/media/poster.<hash>.avif">
    <source type="image/webp" srcset="/media/poster.<hash>.webp">
    <img src="/media/poster.<hash>.jpg" alt="" width="1280" height="720" fetchpriority="high" decoding="async">
  </picture>
  <video muted loop playsinline preload="none" tabindex="-1" disablepictureinpicture disableremoteplayback hidden></video>
</div>
<div class="bg-scrim"></div>
<!-- page content -->
<button class="button bg-pause" type="button" hidden>Pause background</button>
```

- The poster `<img>` is the LCP element: in the HTML, not lazy, `fetchpriority="high"`, with width and height so
  CLS stays 0. Preload it with `<link rel="preload" as="image" imagesrcset=...>` on the home page.
- The `<video>` has no `src`, no `<source>` and no `autoplay` attribute in the HTML, so a browser with JavaScript
  off, a crawler, or Lighthouse's LCP pass never requests it.
- `.bg-loop` is `position: absolute; inset: 0; overflow: hidden`; image and video are `object-fit: cover` with
  `object-position` set so the doe stays in view. `.bg-scrim` is the same box filled with
  `rgb(from var(--color-surface) r g b / <scrimAlpha>)` from the token (or the equivalent generated value).
- The video sits on top of the poster and is shown only once it can play, so there is no flash.

### 8.3 Controller (about 0.6 KB, inline, runs after `load`)

```
if prefers-reduced-motion: reduce            -> stop (poster only)
if navigator.connection?.saveData            -> stop
if navigator.connection?.effectiveType is slow-2g or 2g -> stop
wait for window load, then requestIdleCallback (fallback: 1.5 s timer)
add <source type='video/webm; codecs="av01.0.05M.08"'> then <source type="video/mp4">,
    choosing mobile or desktop files with matchMedia("(max-width: 599px)")
video.load(); on canplaythrough: unhide video, play()
    if play() rejects (iOS Low Power Mode, autoplay blocked) -> hide video again, keep poster, no button
when playing: unhide the pause button
button: toggles pause()/play(); label switches between "Pause background" and "Play background"
pause when the tab is hidden or the hero is scrolled out of view (IntersectionObserver); resume if not user-paused
if prefers-reduced-motion changes to reduce while playing -> pause and hide the video
remember a user pause in sessionStorage so it stays paused on the next page
```

Save-Data limits, stated plainly: only Chromium browsers expose `saveData` to scripts. Safari and Firefox do not,
and a static CloudFront site does not see the `Save-Data` request header without an edge function. On those
browsers the protection is the deferred load (the page is complete and interactive before the first video byte),
the 1.5 MB mobile cap, and iOS Low Power Mode refusing autoplay.

### 8.4 Where it goes

- `site/` home page hero only. Not on `/clubs`, `/pricing`, `/download`, `/privacy` in Phase 1.
- `web/` sign-in and sign-up (`web/src/pages/SignIn.tsx`, behind `.auth`). The `.auth-card` stays opaque. The
  `.auth-footer` text sits on the scrim, so it is covered by the contrast test.
- **Never on `/join`.** `web/src/pages/Join.tsx` must not import the module. Add a test that renders Join and
  asserts no `video`, no `picture` and no `/media/` URL in the output, and keep `/media/` out of anything `/join`
  preloads.
- Both platforms: this is web only (site and club admin). The iOS and Android apps do not get it, and neither
  loses a feature. Free users still never call the backend: the files are static, on the same CloudFront origin.
- Files are served once, from `/media/` with content-hashed names and `Cache-Control: immutable`, and used by both
  `site/` and `/app/`.

### 8.5 Accessibility

- Decorative: the wrapper is `aria-hidden="true"`, the image has `alt=""`, the video is not focusable and has no
  controls. No captions or transcript are needed because it carries no information and has no audio track.
- WCAG 2.2.2 (Pause, Stop, Hide): the loop runs longer than 5 s, so a visible pause control is required. It is a
  real `<button>` with the word label "Pause background" (no icon-only control), at least 48 px high, placed at the
  bottom corner of the hero, in the tab order after the main actions, with the standard 3 px focus ring.
- `prefers-reduced-motion: reduce`: poster only, and no button.
- WCAG 2.3.1: nothing flashes. Motion is slow and small.
- Lighthouse and axe: the video adds no violation as long as it stays `aria-hidden` and unfocusable.

### 8.6 Performance checks to add

- Lighthouse CI on `/` keeps LCP < 2.5 s and CLS < 0.1 with the loop in place (the LCP element must be the poster).
- A test that the HTML of `/` contains no `<source>` inside the video and no `autoplay` attribute.
- The 600 KB home page budget is measured before the deferred video. State that exception in the brief.

### 8.7 Binaries and git

Final files should total about 2 to 3 MB per revision (estimate, section 7). Suggest: commit posters (small) and upload videos to S3 under hashed
names from the deploy step, with `out/manifest.json` committed as the record. If the coordinator prefers them in
git, the sizes are in section 7.

## 9. Realism gaps, stated plainly

| Part | State now | What would make it real | Cost |
|---|---|---|---|
| Forest, light, sky | Photoreal (a photograph). It is a wood near Stuttgart, Germany, not the eastern US. It reads right, but a botanist would notice. | A CC0 HDRI shot in an eastern US hardwood stand at sunrise. None found on Poly Haven. The owner could shoot one (a 360 camera on a tripod at dawn). | $0 with the owner's camera |
| Fog | Physically lit, convincing. | Nothing needed. | |
| Trees moving | They do not: the backdrop is a still. Leaves, mist and animals carry the motion. | 3D hardwood trees with wind in the mid-ground. No suitable CC0 hardwoods found; paid tree libraries exist. | About $0 to $150, plus much longer renders |
| Deer | Self-made figures from ellipsoids and tapered limbs. Right proportions and behaviour, read well as fogged, backlit shapes at 21 m and 31 m. No fur, no muscle, no skin deformation; legs and neck look thin and stiff in the 720p still (`out/review/still-720p-ungraded.jpg`). Not convincing closer than this or in front light. | A rigged, animated white-tailed deer with fur. | Search results, not verified on the product pages: about $39 to $59 for non-whitetail rigged deer in Blender format, about $299 to $399 for white-tailed deer with fur and animation (TurboSquid). Licence must allow rendered web video, which standard royalty-free licences do, but they are not CC0. |
| Turkeys | Self-made figures. Read as turkeys in silhouette. No feathers, no fanned tail, no strut. | A rigged, animated wild turkey. | Search results, not verified: about $15 to $49 (CGTrader). Same licence note. |
| Crows | Simple flapping shapes, a few pixels wide. Fine at that size. | Nothing needed. | |
| Free alternative for deer | Quaternius "Ultimate Animated Animals" (CC0) has a rigged Deer and Stag with walk and eat cycles, low-poly and stylised. In fog they would read about like the self-made ones, with better walk cycles. Its download was refused from this container. | Someone downloads it by hand. | $0 |

The honest summary: at the size, distance and fog used here, with the scrim on top, the loop reads as a real dawn
forest with animals in it. It is not a nature documentary close-up, and with free assets it cannot be.

Buying models, or any spend, needs the owner's approval. Nothing was bought.

## 10. Rule check

| Rule | How the loop keeps it |
|---|---|
| Theme tokens only | Scrim and text use existing tokens. No new colour. |
| No legal shooting hours | Sunrise scene, no time shown, no copy about hours. |
| iOS and Android parity | Web only. No app feature added or removed. |
| Offline-first | Not a field feature. The page works with the poster alone, or with nothing. |
| Free users never call our backend | Static files only. |
| `/join` privacy | No loop, no extra requests, with a test. |
| DRY | One config, one manifest, tokens read from `packages/design`, one shared module planned for site and web. |
| No always-on compute, no spend | Rendered offline. Served from S3 and CloudFront. $0 spent. |
