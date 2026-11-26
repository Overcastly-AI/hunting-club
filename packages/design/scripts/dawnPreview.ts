/**
 * Writes a review page for the dawn scene: the scene behind sample hero text, the way the home
 * page hero uses it (the pause button is the site's and the admin's, from dawnControl.ts). Node only (dev tool):
 * `npm run dawn:preview -w @huntclub/design` writes design/background/out/.
 * design/background/capture.mjs records that page to a still and an mp4.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { join } from 'node:path';
import { colors } from '../src/colors';
import { dawnSceneCss, dawnSceneSvg } from '../src/dawnScene';
import { sizes } from '../src/sizes';

/** design/background/out, from this package's directory (npm runs scripts there). */
const OUT_DIR = join(process.cwd(), '..', '..', 'design', 'background', 'out');

/** Sample copy for the review page only; the real hero copy lives with the site. */
const SAMPLE = {
  heading: 'Hunt together with no cell service.',
  lead: 'Sample text only. Your party on one map, by radio. Free for parties up to 3.',
  action: 'Get the free app',
};

function page(svg: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Dawn scene review</title>
<style>
@font-face { font-family: Archivo; src: url('../../../app/assets/fonts/Archivo-Variable.ttf'); font-weight: 100 900; font-stretch: 62% 125%; }
html, body { margin: 0; background: ${colors.surface}; color: ${colors.text}; font-family: Archivo, sans-serif; }
.hero { position: relative; min-height: 100vh; overflow: hidden; }
${dawnSceneCss()}
.hero-copy { position: relative; max-width: 620px; padding: 12vh 20px 0; margin-left: max(0px, calc((100vw - 1200px) / 2)); }
h1 { font-size: clamp(40px, 4.6vw, 56px); line-height: 1.08; font-weight: 800; font-stretch: 82%; margin: 0 0 20px; }
p { font-size: 20px; line-height: 30px; font-weight: 500; color: ${colors.textSecondary}; margin: 0 0 28px; }
.button { font: inherit; font-weight: 700; font-size: 18px; border-radius: 12px; border: 0; padding: 0 24px; cursor: pointer; }
.primary { min-height: ${sizes.primaryButtonMinHeight}px; background: ${colors.accent}; color: ${colors.surface}; }
.button:focus-visible { outline: 3px solid ${colors.accent}; outline-offset: 2px; }
</style>
</head>
<body>
<div class="hero">
${svg}
<div class="hero-copy">
<h1>${SAMPLE.heading}</h1>
<p>${SAMPLE.lead}</p>
<button class="button primary" type="button">${SAMPLE.action}</button>
</div>
</div>
</body>
</html>
`;
}

const svg = dawnSceneSvg();
mkdirSync(OUT_DIR, { recursive: true });
// The standalone file carries its CSS (a file has no page stylesheet; no CSP applies to it here).
writeFileSync(
  join(OUT_DIR, 'dawn-scene.svg'),
  svg.replace(/^<svg[^>]*>/, (open) => `${open}<style>${dawnSceneCss()}</style>`),
);
writeFileSync(join(OUT_DIR, 'preview.html'), page(svg));
const both = svg + dawnSceneCss();
console.log(
  `dawn scene (SVG and CSS): ${both.length} bytes, ${gzipSync(both, { level: 9 }).length} gzip`,
);
