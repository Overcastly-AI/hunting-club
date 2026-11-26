# Background scene: credits and licences

Nothing third-party is in the output. Nothing was bought. No AI image or video service was used.

## Made in this repo (self-made, no licence needed)

| Part | Made by |
|---|---|
| Doe, buck, wild turkeys, crows: rigs and animation | `poses.py`, built and rendered as silhouettes in Blender by `rigs.py` |
| The silhouettes as SVG paths | `trace.py` (writes `packages/design/src/dawnSprites.generated.ts`) |
| Sky, sun and light, ridges, bare hardwoods, fog, grass, layout and motion | `packages/design/src/dawnScene.ts` |
| Colours | The design tokens in `packages/design/src/colors.ts` |

## Tools (not distributed, no effect on the licence of the output)

| Tool | Version | Licence |
|---|---|---|
| Blender as the `bpy` Python wheel (Cycles) | 5.3.0 | GPL-3.0-or-later (program); rendered images are the user's own |
| Pillow, numpy (tracing) | as installed | HPND, BSD-3-Clause |
| Playwright with Google Chrome, FFmpeg (review stills and screen capture only) | 1.63.0, 6.1.1 | Apache-2.0, GPL/LGPL |

The review page loads the Archivo font from `app/assets/fonts` (already in the repo, SIL Open Font License).

## Approach taken from the owner's other repo

`/home/user/overcastly-ai/hunting-appeal` (the owner's own work) was the template for running Blender. No file was
copied. Re-implemented from `huntkit/viz3d`: headless `bpy` in a scratch venv, Cycles on CPU with fixed threads and
persistent data (`cycles_render.setup_scene`). Limbs use two-bone inverse kinematics, the same idea as its
`wearer._two_bone`, written separately here.
Its third-party assets (MakeHuman and MPFB 2, Poly Haven HDRI and ground textures, three.js) are not used here.

## Looked at and not used

| Asset | Licence | Why not |
|---|---|---|
| Poly Haven HDRI "Autumn Forest 04" | CC0-1.0 | Used in the first, photoreal version (commit `31d4d07`); the illustrated scene has no photograph. |
| Quaternius "Ultimate Animated Animals" (rigged Deer and Stag) | CC0-1.0 (stated on its page) | Low-poly and stylised, no turkey; its download was refused from the build container. |
| Mixkit deer clips (stock video) | "Stock Video Restricted License" on every deer clip checked; the licence text could not be read from the container | Unclear licence, so not used. The owner then dropped the stock footage option. |
| Pexels, Pixabay, Kenney, Smithsonian 3D, poly.pizza | Not verified | Blocked from the build container (HTTP 403). |
| Paid rigged deer and turkey models | Royalty-free, not CC0 | Not bought. Needs the owner's approval. |
