# Background scene: wildlife at dawn (design and pipeline)

Status: second version, 2026-11-26. Not integrated into `site/` or `web/` yet.
Review files: `design/background/out/review/` (three stills and a 30 s screen capture).

## 1. What changed and why

The first version was a photoreal Blender render encoded as video. The owner's verdict: "this does not look
good"; the weak part was the self-made animals pretending to be real. The owner then chose a deliberate
illustrated style instead, with the animals still coming from the Blender rigs.

So the background is now **one inline SVG with CSS animation**. No video, no poster image, no script needed to
play it, no network request.

- Trees, ridges, fog and light are drawn by code as flat paper-cut layers.
- The doe, buck, turkeys and crows are posed and animated on rigs in Blender, rendered as flat silhouettes
  (white emission on black, no shading), traced to SVG paths and played frame by frame.
- Every colour is a design token. No gradients.

The first version's scripts and video files are removed in this commit (they stay in git history at `31d4d07`).

## 2. The picture

Viewbox 1600 x 900, scaled to cover the hero and anchored at the bottom (`preserveAspectRatio="xMidYMax slice"`).

| Layer, back to front | Paint (token at opacity) | Moves |
|---|---|---|
| Sky | `surface`, washed with `controlBorder` at 30% | no |
| Light: three flat rings round the sun | `accent` at 6% each (they stack) | breathes slowly |
| Sun, half behind the far ridge | `accent` at 85% | no |
| Crows | `mapHalo` | cross the sky, wings beating |
| Far ridge | `surface` at 45% | drifts 5 units |
| Fog bank | `textSecondary` at 9% | drifts left |
| Middle ridge, ten bare hardwoods, the buck | `surface` at 80% | drifts 10 units |
| Fog bank | `textSecondary` at 9% | drifts right |
| Near ground, four big trees, doe, turkeys | `surface`; animals `mapHalo` | drifts 18 units |
| Fog bank | `textSecondary` at 9% | drifts left |
| Foreground: two framing trunks, grass | `mapHalo` | drifts 30 units |

The different drift per layer is the parallax: it reads as a camera breathing, 46 s each way.

Where things sit:
- The doe and the sun are in the middle of the picture, low. A phone shows only the middle strip, so they stay in
  view at every width (`review/dawn-phone.jpg`).
- Text goes in the upper left on desktop and the upper half on a phone. The left half has fewer trees for that
  reason. Text must stay out of the innermost light ring and off the sun; both are in the bottom third, behind the
  doe, where no layout puts text.
- The bottom of the picture ends in `mapHalo`, next to the page's `surface`.

No stand, blind or hunter is shown, so the scene fits hunters at a stand, at a spot or on the move. It is sunrise;
nothing in it refers to shooting hours.

### Accent: a rule to confirm

`packages/design/src/colors.ts` reserves orange for three things: you, the main action and the selected tab. The
sun and its light are a fourth use, requested by the owner ("dawn light from the accent token used sparingly").
It is kept small: one disc and three faint rings, and a test fails if the accent appears anywhere else in the
scene. The comment in `colors.ts` should be updated in the integration PR if the owner confirms this use. If not,
the sun can be painted with `text` at low opacity instead: one line in `DAWN_PAINTS`.

### Contrast

`DAWN_TEXT_BACKDROPS` lists the lightest things text can sit on. `dawnScene.test.ts` blends them with the
existing `blendOver` and holds both text tokens to `MIN_TEXT_CONTRAST` (4.5:1) with `contrastRatio`.

| Backdrop | Colour | `text` | `textSecondary` |
|---|---|---|---|
| Sky | #313539 | 12.36:1 | 6.53:1 |
| Sky under two light rings | #493D36 | 10.48:1 | 5.54:1 |

No scrim is needed: the picture is dark by construction, not darkened afterwards.

## 3. The animals

### From Blender to the page

```
design/background/poses.py    the rigs' solids and their motion, as plain maths (no bpy)
design/background/rigs.py     builds them in Blender, renders each distinct pose as a mask (Cycles, CPU, 47 s total)
design/background/trace.py    masks -> SVG paths -> packages/design/src/dawnSprites.generated.ts
packages/design/src/dawnScene.ts   draws the scene and plays the frames
```

Each animal is a rig of ellipsoids and tapered limbs with joints at the real places (elbow, knee, stifle, hock,
fetlock; two neck segments; ears; tail). Legs are placed by inverse kinematics from planted feet. The masks are
cleaned by a small grow-then-shrink before tracing, which fills the notches where two solids meet, so each outline
reads as one animal.

### Format chosen: a vector frame strip

All distinct frames of an animal sit side by side as SVG paths behind a one-frame window. A stepped CSS animation
slides the right frame into the window. Why this and not the others:

| Option | Verdict |
|---|---|
| **Traced SVG path frames in a strip (chosen)** | Crisp at any size and any pixel density. Painted with a token, so a token change recolours it. Pauses and stops with plain CSS (`animation-play-state`, `prefers-reduced-motion`). Held poses and repeated cycles are stored once. No request, no decode. |
| Raster sprite strip (PNG or WebP mask) | About the same bytes, but soft on high-density screens unless shipped at 2x or 3x, and it is an extra request. |
| Animated WebP or AVIF | Cannot be paused by CSS (WCAG 2.2.2 would need an image swap), cannot be kept in step with the walk across the screen, colour is baked in. |

Tracing uses only Pillow and numpy, which were already in the container. Nothing was installed for it (no
potrace, no OpenCV). Blender is the `bpy` 5.3.0 wheel in a scratch venv, as before, and is only needed to change
the animals: the generated path file is committed, so a normal build needs neither Blender nor Python.

### Sizes

| Clip | Loop | Frames at 12 fps | Distinct paths stored | Path data |
|---|---|---|---|---|
| Doe | 16 s | 192 | 83 | 89,066 bytes |
| Buck | 18 s | 216 | 103 | 115,345 bytes |
| Walking turkey | 1 s | 12 | 12 | 8,738 bytes |
| Feeding turkey | 8 s | 96 | 72 | 43,581 bytes |
| Crow | 0.5 s | 6 | 6 | 1,916 bytes |

Whole scene, as inlined in the page: **373,251 bytes, 73,179 bytes gzipped** (test budget: 90,000 gzipped). It
replaces the first version's 1.5 MB mobile video, 3 MB desktop video and poster images.

The committed generator input `dawnSprites.generated.ts` is 262,145 bytes.

If it must be smaller: the buck is 45% of the path data and is the smallest animal on screen. Halving his
frame rate or coarsening his outline (`TOLERANCE` in `trace.py`) would take roughly 10 KB gzipped off.

### Motion

Drawn on twos (12 frames a second), the usual cadence for hand-drawn animal animation. What was done so it does not
read stiff:

- **Easing with anticipation and settle.** A head lift starts with a small dip, travels on a smooth curve and
  rings out for three quarters of a second after it arrives. Flicks go out fast and come back slower.
- **Weight shifts.** Feet are planted by inverse kinematics. The doe's body moves back about 2 cm over her feet as
  her head comes up and forward again as it goes down; a stamp drops the body a little.
- **Holds.** Animals stand still between moves, as real ones do.
- **Bird head stabilisation.** A walking turkey's head stays fixed in the world while the body walks under it, then
  darts forward to the next hold, twice per cycle. This is what makes a walking bird read as a bird.
- **No foot slide.** The page moves each walking turkey exactly one stride per walk cycle, at that bird's own
  scale. A test checks it (and caught a 6% slide in the first build).
- **Offset timing.** Loop lengths are 16 s (doe), 18 s (buck), 8 s (feeding turkeys, the second one 3.4 s out of
  step), 1 s (walk) and 0.5 s (wingbeat), so the animals never move in unison and the whole picture repeats only
  after minutes.

| Animal | What it does |
|---|---|
| Doe | Browses with small nibbles; lifts her head; ear flicks; two tail flicks; lowers her head; one foreleg stamp. |
| Buck | Stands alert; drops his head to scent the ground; raises it; ear flick; stamp; tail flick; tests the air. |
| Two feeding turkeys | Three pecks of different depth; head up to look round; a shuffle of one foot; another peck. |
| Two walking turkeys | Cross left to right in 84 s, one behind the other, with head darts and body bob. |
| Three crows | Cross the sky right to left in 52 s, two together and one later. |

## 4. Accessibility

- Decorative: `aria-hidden="true"`, `focusable="false"`, no text, no information.
- `prefers-reduced-motion: reduce` turns every animation off inside the SVG's own stylesheet. The still that
  remains is a chosen frame (doe with her head up, turkeys mid-stride): `review/dawn-reduced-motion.jpg`.
- WCAG 2.2.2 (Pause, Stop, Hide): the motion runs longer than 5 s, so the page shows a real `<button>` with the
  word label "Pause background" (then "Play background"), at least 48 px high, with the standard focus ring. It
  toggles `DAWN_PAUSED_CLASS` on the `<svg>`. It is hidden under reduced motion, where nothing moves.
- WCAG 2.3.1: nothing flashes.

## 5. Integration plan

Small PRs, in this order.

### 5.1 Shared pieces (one source each)

| Piece | Where | State |
|---|---|---|
| The scene | `@huntclub/design/dawnScene`: `dawnSceneSvg()`, `DAWN_PAUSED_CLASS`, `DAWN_VIEW`, `DAWN_PAINTS` | Done. A subpath export on purpose: the main entry of `@huntclub/design` does not re-export it, so the mobile app's bundle does not carry 260 KB of paths. |
| Button labels "Pause background" / "Play background" | `packages/shared`, next to `signInCopy` | To do. The review page has them as sample strings only. |
| The pause behaviour | One small framework-free function in `packages/design` (suggest `dawnControl.ts`): given the `<svg>` and the `<button>`, toggle the class, swap the label, set `aria-pressed`, remember the choice in `sessionStorage`. `site/` inlines it, `web/` calls it from an effect. | To do, about 15 lines. |
| CSS for placement | `.dawn { position: absolute; inset: 0; width: 100%; height: 100% }` inside a `position: relative; overflow: hidden` hero. | In the review page; move to the shared stylesheet. |

### 5.2 Site home page hero (`site/`, prerendered)

```html
<section class="hero">
  <!-- output of dawnSceneSvg(), inlined at build time -->
  <div class="hero-copy"> h1, lead, primary action </div>
  <button class="button dawn-pause" type="button" aria-pressed="false">Pause background</button>
</section>
```

- The scene is in the HTML, so it paints with the first render. There is no LCP image any more: the LCP element
  is the headline text. CLS stays 0 because the hero has a fixed minimum height and the SVG is absolutely placed.
- With JavaScript off the scene still animates and still honours reduced motion; only the pause button needs the
  script, so render the button from the script (or with `hidden` until the script runs).
- Budget: 73 KB gzipped of the home page's 600 KB, in the HTML document. No exception to the brief's budget is
  needed now. JS added: the pause function only.
- The brief's "No autoplay video" (section 6) and "no autoplay" (section 9) stand: this is not video. Section 6
  says "Motion: none required; if used, respect prefers-reduced-motion", which this does. Section 6 also says "no
  gradients" (kept) and puts photography in the hero: the brief's hero image line should be updated to say the
  hero is this scene.
- Home page only. Not `/clubs`, `/pricing`, `/download`, `/privacy` in Phase 1.

### 5.3 Web sign-in (`web/src/pages/SignIn.tsx`)

- Render the scene as the first child of `.auth` with `dangerouslySetInnerHTML={{ __html: dawnSceneSvg() }}` in a
  memoised wrapper (the string is static and comes from our own package, no user input), and the pause button
  after the card. `.auth` gets `position: relative; overflow: hidden`.
- `.auth-card` stays opaque `surfaceRaised`. `.auth-footer` text sits on the dark foreground band; add that pair
  to the contrast test (`textSecondary` on `mapHalo`).
- Import from `@huntclub/design/dawnScene` inside the lazily loaded sign-in chunk only, so signed-in pages do not
  download it.
- **Never on `/join`.** `web/src/pages/Join.tsx` must not import it. Add a test that renders Join and finds no
  element with class `dawn`, and a bundle check that the Join chunk does not contain `dawnSprites`.

### 5.4 Checks to add with the integration

- Lighthouse CI on `/`: Performance >= 90, LCP < 2.5 s, CLS < 0.1 with the scene in place.
- axe on `/` and the sign-in page.
- A low-end phone check of scroll smoothness while the scene runs (about 20 animated groups, 12 fps frame swaps).
  If it janks, the first lever is to pause the scene when the hero is scrolled out of view.

## 6. Rebuilding

```
# only when the animals change (needs Blender):
python3.13 -m venv $SCRATCH/bpyenv && $SCRATCH/bpyenv/bin/pip install bpy       # about 1 GB, outside the repo
$SCRATCH/bpyenv/bin/python design/background/rigs.py                           # masks, 47 s on 4 CPU cores
python3 design/background/trace.py                                             # rewrites dawnSprites.generated.ts

# review page, stills and screen capture:
npm run dawn:preview -w @huntclub/design
NODE_PATH=$(npm root -g) node design/background/capture.mjs 30
npm test -w @huntclub/design
```

EEVEE still cannot run here (no GPU or EGL); the masks are rendered with Cycles at 8 samples, which is only edge
anti-aliasing because there is no light to resolve.

## 7. Honest assessment

- It looks deliberate now: a title card, not a failed photograph. The composition, light and trees hold up.
- The animals are clearly a deer, a buck, turkeys and crows, and they move believably. They are still built from
  simple solids, so up close the hind legs and hooves are simplified and a hunter will see that the doe's shape is
  a sketch of a whitetail, not a portrait. At the size they are drawn this reads as style.
- Silhouettes are dark on a dark sky by design (tokens only). On a phone in full sun the animals away from the
  sun's light will be faint. The doe is placed against the light for that reason.
- Trees do not sway. Fog, parallax and animals carry the motion.

## 8. Rule check

| Rule | How the scene keeps it |
|---|---|
| Theme tokens only | Tested: every colour in the SVG is a token. Accent use is flagged in section 2. |
| No gradients (site brief) | Tested. |
| No legal shooting hours | Sunrise picture, no time, no copy. |
| iOS and Android parity | Web only (site and club admin). The app's bundle is untouched. |
| Offline-first, free users never call the backend | Inline in the page: no request at all. |
| `/join` privacy | Not used there; tests listed in 5.3. |
| DRY | One scene module for site and web; sprites generated, never retyped; contrast maths reused from `contrast.ts`. |
| Assets | Nothing third-party is in the output. `design/background/CREDITS.md`. $0 spent. |
