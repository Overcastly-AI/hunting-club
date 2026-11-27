// Checks each direction's colour pairs against WCAG: 4.5:1 for text, 3:1 for control edges.
// Reads the tokens straight from each styles.css (dark from :root, daylight from [data-theme]).
// Run from the repo root:  node docs/redesign/directions/tools/contrast.mjs
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const directions = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TEXT = 4.5;
const UI = 3;

/** [foreground token, background token, minimum]. */
const PAIRS = {
  'first-light': [
    ...['sky', 'ridge', 'ground', 'night', 'scene-far', 'scene-mid', 'scene-tree'].map((bg) => ['frost', bg, TEXT]),
    ...['sky', 'ground', 'night'].map((bg) => ['haze', bg, TEXT]),
    ['blaze-ink', 'sky', TEXT],
    ['blaze-ink', 'ground', TEXT],
    ['on-blaze', 'blaze', TEXT],
    ['lantern', 'lantern-wash', TEXT],
    ['lantern', 'ground', UI],
    ['edge', 'sky', UI],
    ['edge', 'ground', UI],
    ['blaze-edge', 'sky', UI],
    ['blaze-edge', 'ground', UI],
    ['fresh', 'ground', UI],
  ],
  'tag-board': [
    ...['board', 'rail', 'pit'].map((bg) => ['paint', bg, TEXT]),
    ...['board', 'rail', 'pit'].map((bg) => ['chalk', bg, TEXT]),
    ['blaze-ink', 'board', TEXT],
    ['on-blaze', 'blaze', TEXT],
    ['tag-ink', 'tag', TEXT],
    ['tag-ink', 'tag-guest', TEXT],
    ['tag-quiet', 'tag', TEXT],
    ['tag-quiet', 'tag-guest', TEXT],
    ['brass', 'brass-wash', TEXT],
    ['brass', 'board', UI],
    ['edge', 'board', UI],
    ['blaze-edge', 'board', UI],
    ['fresh', 'board', UI],
  ],
  'map-first': [
    ...['pit', 'plate', 'raised'].map((bg) => ['ink', bg, TEXT]),
    ...['pit', 'plate', 'raised'].map((bg) => ['quiet', bg, TEXT]),
    ['plate', 'ink', TEXT], // the selected segment and the on switch are inverted
    ['blaze-ink', 'pit', TEXT],
    ['blaze-ink', 'plate', TEXT],
    ['on-blaze', 'blaze', TEXT],
    ['lantern', 'lantern-wash', TEXT],
    ['ink', 'lantern-wash', TEXT],
    ['lantern', 'plate', UI],
    ['on-alert', 'alert', TEXT],
    ['fresh', 'plate', TEXT], // "Open" beside a stand
    ['stale', 'plate', UI],
    ['wind', 'plate', UI],
    ['alert', 'plate', UI],
    ['edge', 'plate', UI],
    ['edge', 'raised', UI],
    ['edge', 'pit', UI],
    ['blaze-edge', 'plate', UI],
    ['blaze-edge', 'pit', UI],
    ['map-text', 'halo', TEXT],
    ['water-text', 'halo', TEXT],
  ],
};

function tokens(css) {
  const block = (re) => Object.fromEntries([...(re.exec(css)?.[1] ?? '').matchAll(/--([\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
  const dark = block(/:root \{([\s\S]*?)\n\}/);
  const daylight = { ...dark, ...block(/\[data-theme='daylight'\] \{([\s\S]*?)\n\}/) };
  return { dark, daylight };
}
function resolveToken(set, name) {
  let v = set[name];
  for (let i = 0; i < 5 && v?.startsWith('var('); i++) v = set[v.slice(6, -1)];
  if (!/^#[0-9a-f]{6}$/i.test(v ?? '')) throw new Error(`token ${name} is not a colour: ${v}`);
  return v;
}
function luminance(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function ratio(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

let failed = 0;
for (const [name, pairs] of Object.entries(PAIRS)) {
  if (!existsSync(join(directions, name, 'styles.css'))) continue; // that direction is on another branch
  const sets = tokens(readFileSync(join(directions, name, 'styles.css'), 'utf8'));
  for (const [theme, set] of Object.entries(sets)) {
    for (const [fg, bg, min] of pairs) {
      const r = ratio(resolveToken(set, fg), resolveToken(set, bg));
      const ok = r >= min;
      if (!ok) failed++;
      console.log(`${ok ? 'ok  ' : 'FAIL'} ${name} ${theme.padEnd(8)} ${fg} on ${bg}: ${r.toFixed(2)} (needs ${min})`);
    }
  }
}
if (failed) {
  console.error(`${failed} pairs under their threshold`);
  process.exit(1);
}
