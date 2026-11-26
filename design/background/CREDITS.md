# Background loop: credits and licences

Every asset in the loop is either CC0 or made in this repo. Nothing was bought. No AI video service was used.
Machine-readable list with download URLs and SHA-256: `assets.json`.

## Third-party assets in the render

| Asset | Used for | Author | Licence | Source | Retrieved |
|---|---|---|---|---|---|
| Autumn Forest 04 (HDRI, 8k `.hdr`, 116 MB) | The forest backdrop and all of the light | Alexander Scholten, Poly Haven | CC0-1.0 | https://polyhaven.com/a/autumn_forest_04 (licence: https://polyhaven.com/license) | 2026-11-26 |

Note on the place: the HDRI was photographed in a wood near Stuttgart, Germany, in December 2021 (coordinates and
date from the Poly Haven record). It is a bare hardwood forest on leaf litter in low sun, so it reads as an eastern US hardwood forest in deer season, but it
is not one. See "Realism gaps" in `docs/BACKGROUND_LOOP.md`.

## Made in this repo (self-made, no licence needed)

Built from primitives by `scene.py`: white-tailed doe and buck (with antlers), wild turkeys, crows, falling leaves,
ground fog, drifting mist, contact shadows, and all animation.

## Tools (not distributed, no effect on the licence of the output)

| Tool | Version | Licence |
|---|---|---|
| Blender as the `bpy` Python wheel (Cycles renderer, Open Image Denoise) | 5.3.0 | GPL-3.0-or-later (program); rendered images are the user's own |
| FFmpeg with libx264, SVT-AV1, libaom, libwebp | 6.1.1 | GPL/LGPL (program); encoded files are the user's own |

## Code reused from the owner's other repo

`/home/user/overcastly-ai/hunting-appeal` (the owner's own work) was the template for the pipeline. Nothing was
copied as a file. These ideas from `huntkit/viz3d` were re-implemented in `scene.py`:

- headless `bpy` in a scratch venv, Cycles on CPU with adaptive sampling, Open Image Denoise, AgX and persistent data
  (`cycles_render.setup_scene`);
- a Poly Haven HDRI as both backdrop and light, turned with a Mapping node (`wearer._outdoor`);
- an asset manifest with URL, licence and SHA-256, fetched into a cache outside the repo (`wearer.fetch_assets`,
  `assets/human_manifest.json`);
- timings recorded per frame.

Its third-party assets were checked and none are used here: MPFB 2 and the MakeHuman system assets (CC0, human
figures only, no animals), Poly Haven "Drakensberg Solitary Mountain" and "Grass Ground" (CC0, a mountain grass
setting), three.js (MIT, a browser viewer).

## Looked at and not used

| Asset | Licence | Why not |
|---|---|---|
| Quaternius "Ultimate Animated Animals" (rigged, animated Deer and Stag), https://quaternius.com/packs/ultimateanimatedanimals.html | CC0-1.0 (stated on the page) | Low-poly stylised, no turkey. Its Google Drive download was refused from the build container. Could replace the self-made deer if the owner prefers its walk cycles. |
| Poly Haven tree models (pine, fir, jacaranda, island trees) | CC0-1.0 | No eastern US hardwoods; 0.3 to 17 million polygons each. The photographed forest is more real. |
| Kenney, Smithsonian 3D, poly.pizza | CC0 (per their sites) | Blocked from the build container (HTTP 403), so not verified and not used. |
| Sketchfab "CC0" animal models | Varies per upload | Licence claims are made by uploaders and are not verified; treated as unclear, not used. |
