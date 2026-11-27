// Fills the generated parts of the direction mockups, in place.
//
// A mockup marks a generated part with a comment pair:
//   <!-- inject:dawn --> ... <!-- /inject:dawn -->
// and this script replaces what is between them. The parts are:
//   dawn   the dawn scene from packages/design (dawnScene.ts), as a still picture with its
//          paints renamed to data-p / data-s roles so each direction colours it with its own tokens
//   map    a stand-in aerial basemap for the phone Map screen
//   icons  the icon sprite
//   ridge  a ridge-line edge (First Light)
//   world  the map-first direction's map: an aerial stand-in 2000 by 1400 px with the club's
//          line, areas, stands and hunters placed on it; each mockup frames the part it shows
//   mark   the logo mark from packages/design (logo.ts), its paints renamed to roles
//
// Run from the repo root:  node docs/redesign/directions/tools/build.mjs
// Needs esbuild (already in the workspace) to bundle the TypeScript scene; adds no dependency.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../../..');
const directions = resolve(here, '..');
const require = createRequire(import.meta.url);

/** Deterministic random numbers, so the drawings are the same on every run. */
function random(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const n = (v) => String(Math.round(v * 10) / 10);

// ------------------------------------------------------------------ dawn scene (still)
/** Bundles a TypeScript module from the repo with the workspace's esbuild and loads it. */
function bundle(entry) {
  const out = join(mkdtempSync(join(tmpdir(), 'hcm-build-')), 'out.cjs');
  const esbuild = [root, resolve(root, '../../..')]
    .map((r) => join(r, 'node_modules/.bin/esbuild'))
    .find((p) => {
      try {
        readFileSync(p);
        return true;
      } catch {
        return false;
      }
    });
  if (!esbuild) throw new Error('esbuild not found: run the workspace install first');
  execFileSync(esbuild, [join(root, entry), '--bundle', '--format=cjs', '--platform=node', '--log-level=error', `--outfile=${out}`]);
  return require(out);
}

function dawnStill() {
  const scene = bundle('packages/design/src/dawnScene.ts');
  let svg = scene.dawnSceneSvg();
  const css = scene.dawnSceneCss();

  // one frame per animal: the pose the scene shows when motion is off
  const widths = Object.fromEntries(
    [...svg.matchAll(/<clipPath id="dawn-window-([\w-]+)"><rect width="(\d+)"/g)].map((m) => [
      m[1],
      Number(m[2]),
    ]),
  );
  svg = svg.replace(
    /<g clip-path="url\(#dawn-window-([\w-]+)\)"><g class="dawn-strip dawn-[\w-]+">(.*?)<\/g><\/g>/g,
    (_, id, paths) => {
      const shift = Number(new RegExp(`\\.dawn-${id}\\{transform:translateX\\((-?[\\d.]+)px\\)`).exec(css)[1]);
      const cells = paths.match(/<path[^>]*\/>/g);
      const cell = cells[Math.round(-shift / widths[id])];
      return cell.replace(/ transform="[^"]*"/, '');
    },
  );
  svg = svg.replace(/<clipPath id="dawn-window-[\w-]+">.*?<\/clipPath>/g, '');
  // walkers and crows rest where the still picture puts them
  svg = svg.replace(/<g class="dawn-go-([\w-]+)">/g, (_, id) => {
    const t = new RegExp(`\\.dawn-go-${id}\\{transform:(translateX|translate)\\(([^)]*)\\)`).exec(css);
    const [x, y = '0'] = t[2].replace(/px/g, '').split(',');
    return `<g transform="translate(${x} ${y})">`;
  });

  // paints become roles; each direction's stylesheet gives them colours
  const role = (segment, name) =>
    segment
      .replace(/fill="#0B0D0E" fill-rule="evenodd"/g, 'data-p="animal" fill-rule="evenodd"')
      .replace(/fill="#121416" fill-rule="evenodd"/g, 'data-p="animal-far" fill-rule="evenodd"')
      .replace(/fill="#7A828A" fill-opacity="0.3"/g, 'data-p="skylight"')
      .replace(/fill="#FF7A1F" fill-opacity="0.06"/g, 'data-p="glow"')
      .replace(/fill="#FF7A1F" fill-opacity="0.85"/g, 'data-p="sun"')
      .replace(/fill="#121416" fill-opacity="0.45"/g, 'data-p="far"')
      .replace(/fill="#B8BDC2" fill-opacity="0.09"/g, 'data-p="fog"')
      .replace(/fill="(#121416|#0B0D0E)"/g, `data-p="${name}"`)
      .replace(/stroke="(#121416|#0B0D0E)"/g, `data-s="${name}"`);
  const cuts = ['<g class="dawn-layer-mid"', '<g class="dawn-layer-near"', '<g class="dawn-layer-front"'];
  const names = ['sky', 'mid', 'near', 'front'];
  let rest = svg;
  let done = '';
  cuts.forEach((cut, i) => {
    const at = rest.indexOf(cut);
    done += role(rest.slice(0, at), names[i]);
    rest = rest.slice(at);
  });
  svg = done + role(rest, names[3]);
  svg = svg.replace('<g class="dawn-layer-mid" opacity="0.8">', '<g class="dawn-layer-mid">');
  if (/#[0-9A-Fa-f]{6}/.test(svg)) throw new Error('dawn scene: a paint was not given a role');
  return svg;
}

// ------------------------------------------------------------------ ridge edge
/** A rolling skyline `width` wide and `height` tall, closed along the bottom. */
function ridgeEdge(seed = 41, width = 1600, height = 48) {
  const rnd = random(seed);
  let level = height * 0.5;
  let d = `M0 ${height}V${n(level)}`;
  for (let x = 80; x <= width; x += 80) {
    const mid = level + (rnd() - 0.5) * height * 0.7;
    level += (height * 0.5 - level) * 0.4 + (rnd() - 0.5) * height * 0.5;
    level = Math.min(height - 6, Math.max(4, level));
    d += `Q${x - 40} ${n(Math.min(height - 4, Math.max(2, mid)))} ${x} ${n(level)}`;
  }
  return `<svg class="ridge-edge" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-hidden="true" focusable="false"><path d="${d}V${height}Z"/></svg>`;
}

// ------------------------------------------------------------------ stand-in aerial map
/**
 * A leaf-off November aerial: grey-brown hardwoods, dark pines, two cut fields, a creek and a
 * pond, faint contours, a two-track, one club area and the property line. Markers and labels
 * are HTML in each mockup, so each direction styles them. Colours are the map's own tokens.
 */
function mapSvg() {
  const W = 390;
  const H = 844;
  const rnd = random(7);
  const blob = (cx, cy, r, wobble, seed) => {
    const p = random(seed);
    const k = [p() * 6, p() * 6, p() * 6];
    const pts = [];
    for (let i = 0; i < 28; i++) {
      const a = (i / 28) * Math.PI * 2;
      const rr = r * (1 + wobble * (Math.sin(a * 2 + k[0]) * 0.5 + Math.sin(a * 3 + k[1]) * 0.3 + Math.sin(a * 5 + k[2]) * 0.2));
      pts.push(`${n(cx + Math.cos(a) * rr * 1.25)} ${n(cy + Math.sin(a) * rr)}`);
    }
    return `M${pts.join('L')}Z`;
  };
  const fields = [
    { cx: 300, cy: 150, r: 62, seed: 3 },
    { cx: 70, cy: 520, r: 70, seed: 5 },
  ];
  const inField = (x, y) => fields.some((f) => ((x - f.cx) / (f.r * 1.2)) ** 2 + ((y - f.cy) / f.r) ** 2 < 0.8);
  const crowns = { a: '', b: '', pine: '' };
  for (let i = 0; i < 1500; i++) {
    const x = rnd() * W;
    const y = rnd() * H;
    const r = 3 + rnd() * 6;
    const pick = rnd();
    if (inField(x, y)) continue;
    const pines = (x - 250) ** 2 + (y - 620) ** 2 < 120 ** 2 || (x - 40) ** 2 + (y - 120) ** 2 < 80 ** 2;
    const key = pines && pick < 0.7 ? 'pine' : pick < 0.5 ? 'a' : 'b';
    crowns[key] += `M${n(x - r)} ${n(y)}a${n(r)} ${n(r)} 0 1 0 ${n(2 * r)} 0a${n(r)} ${n(r)} 0 1 0 ${n(-2 * r)} 0`;
  }
  let contours = '';
  [
    [130, 330, 9],
    [330, 470, 13],
    [210, 90, 17],
  ].forEach(([cx, cy, seed]) => {
    for (let k = 1; k <= 6; k++) contours += blob(cx, cy, k * 24, 0.16, seed);
  });
  const creek = 'M-10 190C40 210 60 260 110 280S170 330 180 390S240 470 250 540S300 640 400 670';
  const road = 'M400 250C330 260 300 300 270 360S220 480 150 560S60 700 30 860';
  const boundary = 'M38 152L352 118L366 566L212 628L24 590Z';
  const area = 'M52 166L200 150L196 300L60 318Z';
  return (
    `<svg class="hcm-map" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">` +
    `<style>.hcm-map{--map-ground:#3B3A2D;--map-crown-a:#4A4733;--map-crown-b:#2F3126;--map-pine:#1F3020;--map-field:#857A4E;--map-field-row:#74693F;--map-water:#1D3B47;--map-contour:#D8C9A0;--map-road:#B9AE92;--map-line:#FFFFFF;--map-line-inner:#FF7A1F;display:block;width:100%;height:100%;background:var(--map-ground)}` +
    `.hcm-map .crown-a{fill:var(--map-crown-a)}.hcm-map .crown-b{fill:var(--map-crown-b)}.hcm-map .pine{fill:var(--map-pine)}.hcm-map .field{fill:var(--map-field)}.hcm-map .rows{stroke:var(--map-field-row);stroke-width:1.5;fill:none}.hcm-map .water{stroke:var(--map-water);fill:none;stroke-linecap:round}.hcm-map .pond{fill:var(--map-water)}.hcm-map .contour{stroke:var(--map-contour);stroke-opacity:.16;fill:none}.hcm-map .road{stroke:var(--map-road);stroke-width:2.5;stroke-dasharray:7 5;fill:none;stroke-opacity:.8}.hcm-map .area{fill:var(--map-line);fill-opacity:.08;stroke:var(--map-line);stroke-opacity:.7;stroke-width:1.5;stroke-dasharray:3 5}.hcm-map .line{stroke:var(--map-line);stroke-opacity:.85;stroke-width:4;fill:none;stroke-linejoin:round}.hcm-map .line-inner{stroke:var(--map-line-inner);stroke-width:1;fill:none;stroke-linejoin:round}</style>` +
    `<path class="crown-a" d="${crowns.a}"/><path class="crown-b" d="${crowns.b}"/><path class="pine" d="${crowns.pine}"/>` +
    fields
      .map((f, i) => {
        const id = `hcm-field-${i}`;
        let rows = '';
        for (let y = f.cy - f.r - 20; y < f.cy + f.r + 20; y += 6) rows += `M${f.cx - f.r * 1.6} ${n(y)}l${f.r * 3.2} ${i ? 14 : -10}`;
        return `<clipPath id="${id}"><path d="${blob(f.cx, f.cy, f.r, 0.22, f.seed)}"/></clipPath><g clip-path="url(#${id})"><rect class="field" width="${W}" height="${H}"/><path class="rows" d="${rows}"/></g>`;
      })
      .join('') +
    `<path class="contour" d="${contours}"/>` +
    `<path class="water" stroke-width="6" d="${creek}"/><path class="pond" d="${blob(318, 705, 26, 0.2, 21)}"/>` +
    `<path class="road" d="${road}"/><path class="area" d="${area}"/>` +
    `<path class="line" d="${boundary}"/><path class="line-inner" d="${boundary}"/></svg>`
  );
}

// ------------------------------------------------------------------ map-first: the world
/**
 * The sample club every map-first mockup shows. One list, so the phone, the site and the admin
 * agree on who is where. Positions are world pixels (2000 by 1400, 1 px is about 6 ft).
 */
const WORLD = { w: 2000, h: 1400 };
const CLUB = {
  name: 'Pine Ridge Hunt Club',
  acres: 412,
  line: [[800, 402], [1178, 384], [1404, 428], [1412, 762], [1292, 770], [1284, 1012], [962, 1030], [806, 962], [792, 640]],
  areas: [
    { name: 'Creek Bottom', at: [905, 800], line: [[815, 585], [960, 640], [1090, 800], [1060, 905], [900, 880], [812, 800]] },
    { name: 'North 40', at: [1215, 415], line: [[1140, 395], [1400, 432], [1405, 580], [1150, 570]] },
  ],
  stands: [
    { name: 'Creek Stand', type: 'ladder', at: [872, 612] },
    { name: 'Oak Ridge', type: 'ladder', at: [975, 520], open: true },
    { name: 'Hickory Flat', type: 'treestand', at: [905, 850] },
    { name: 'Powerline', type: 'blind', at: [1236, 733] },
    { name: 'Pond Box', type: 'blind', at: [1232, 640], open: true, side: 'left' },
    { name: 'South Plot', type: 'treestand', at: [1125, 930], open: true },
    { name: 'Corn Corner', type: 'ladder', at: [1335, 462], open: true, side: 'left' },
  ],
  out: [
    { initials: 'DB', name: 'Dale B.', where: 'Creek Stand', ago: '2 min', at: [872, 612] },
    { initials: 'RT', name: 'Ray T.', where: 'On the move', ago: '9 min', stale: true, at: [1035, 690], side: 'left' },
    { initials: 'JH', name: 'June H.', where: 'Hickory Flat', ago: '3 min', at: [905, 850] },
    { initials: 'MW', name: 'Marcus W.', where: 'Powerline', ago: '4 min', at: [1236, 733] },
    { initials: 'TA', name: 'Tom A.', where: 'My spot', ago: '1 min', at: [1338, 560], side: 'left' },
  ],
  you: [985, 745],
};

function worldHtml() {
  const { w: W, h: H } = WORLD;
  const pts = (list) => `M${list.map(([x, y]) => `${x} ${y}`).join('L')}Z`;
  const blob = (cx, cy, r, wobble, seed, squash = 1) => {
    const p = random(seed);
    const k = [p() * 6, p() * 6, p() * 6];
    const out = [];
    for (let i = 0; i < 36; i++) {
      const a = (i / 36) * Math.PI * 2;
      const rr = r * (1 + wobble * (Math.sin(a * 2 + k[0]) * 0.5 + Math.sin(a * 3 + k[1]) * 0.3 + Math.sin(a * 5 + k[2]) * 0.2));
      out.push(`${n(cx + Math.cos(a) * rr)} ${n(cy + Math.sin(a) * rr * squash)}`);
    }
    return `M${out.join('L')}Z`;
  };
  // a farmed field: a four-sided shape with slightly-off corners, rows along its long side
  const field = ([cx, cy], [fw, fh], rot, kind, seed) => {
    const p = random(seed);
    const j = () => (p() - 0.5) * 22;
    const c = [[-fw / 2 + j(), -fh / 2 + j()], [fw / 2 + j(), -fh / 2 + j()], [fw / 2 + j(), fh / 2 + j()], [-fw / 2 + j(), fh / 2 + j()]];
    return `<g transform="translate(${cx} ${cy}) rotate(${rot})"><path class="f-${kind}" filter="url(#hcm-rows)" d="M${c.map(([x, y]) => `${n(x)} ${n(y)}`).join('L')}Z"/></g>`;
  };
  const grey = '<feColorMatrix type="matrix" values="1 0 0 0 0 1 0 0 0 0 1 0 0 0 0 0 0 0 0 1"/>';
  const ramp = (r, g, b) => `<feComponentTransfer><feFuncR type="table" tableValues="${r}"/><feFuncG type="table" tableValues="${g}"/><feFuncB type="table" tableValues="${b}"/></feComponentTransfer>`;
  // tree crowns: small bumps lit from the north-west, over a slow tone for stands of timber
  const lin = (slope, intercept, result) =>
    `<feComponentTransfer result="${result}">${['R', 'G', 'B'].map((c) => `<feFunc${c} type="linear" slope="${slope}" intercept="${intercept}"/>`).join('')}</feComponentTransfer>`;
  const canopy = (id, seed, crown, r, g, b) =>
    `<filter id="${id}" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">` +
    `<feTurbulence type="fractalNoise" baseFrequency="${crown}" numOctaves="3" seed="${seed}" result="n"/>` +
    `<feDiffuseLighting in="n" surfaceScale="6" diffuseConstant="1.2" lighting-color="#fff"><feDistantLight azimuth="315" elevation="38"/></feDiffuseLighting>${grey}${lin(1.2, -0.25, 'fine')}` +
    `<feTurbulence type="fractalNoise" baseFrequency="0.011" numOctaves="3" seed="${seed + 5}"/>${grey}${lin(2, -0.5, 'slow')}` +
    `<feComposite in="fine" in2="slow" operator="arithmetic" k1="0" k2="0.62" k3="0.38" k4="0"/>${ramp(r, g, b)}</filter>`;

  const road = 'M-20 286C380 322 760 372 1180 344S1700 300 2020 330';
  const track = 'M1020 352C1030 400 1040 440 1050 470S1060 530 1075 560S1120 620 1130 660S1160 740 1150 780S1120 870 1100 900S1070 970 1060 1000';
  const creek = 'M520 380C640 470 760 540 850 640S960 800 1060 850S1260 930 1340 1010S1500 1120 1620 1240';
  const cut = 'M540 1260L1780 330';
  const pond = blob(1290, 606, 30, 0.22, 21, 0.8);
  const pines = [blob(430, 560, 190, 0.2, 31, 0.8), pts([[866, 934], [1046, 926], [1052, 1026], [962, 1030], [872, 992]]), blob(1650, 560, 170, 0.18, 33, 0.75), blob(1500, 1200, 200, 0.2, 35, 0.7), blob(240, 1150, 210, 0.2, 36, 0.8)];
  let contours = '';
  [[930, 520, 9], [1330, 900, 13], [600, 1000, 17], [1560, 420, 19], [300, 300, 23]].forEach(([cx, cy, seed]) => {
    for (let k = 1; k <= 7; k++) contours += blob(cx, cy, k * 34, 0.18, seed, 0.85);
  });

  const svg =
    `<svg class="hcm-world-map" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" aria-hidden="true" focusable="false"><defs>` +
    canopy('hcm-hardwood', 4, 0.17, '0.07 0.12 0.19 0.28 0.37', '0.08 0.13 0.2 0.28 0.36', '0.04 0.07 0.1 0.14 0.2') +
    canopy('hcm-pine', 12, 0.3, '0.02 0.05 0.08 0.12 0.17', '0.06 0.1 0.15 0.2 0.26', '0.04 0.06 0.09 0.12 0.15') +
    `<filter id="hcm-rows" x="-5%" y="-5%" width="110%" height="110%" color-interpolation-filters="sRGB"><feTurbulence type="fractalNoise" baseFrequency="0.006 0.36" numOctaves="2" seed="3"/>${grey}<feComposite in="SourceGraphic" operator="arithmetic" k1="1.1" k2="0.42" k3="0" k4="0" result="t"/><feComposite in="t" in2="SourceGraphic" operator="in"/></filter>` +
    `<filter id="hcm-relief" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB"><feTurbulence type="fractalNoise" baseFrequency="0.0032" numOctaves="4" seed="8"/><feDiffuseLighting surfaceScale="70" diffuseConstant="1.15" lighting-color="#fff"><feDistantLight azimuth="315" elevation="52"/></feDiffuseLighting></filter>` +
    `<filter id="hcm-soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="9"/></filter>` +
    `<filter id="hcm-softer" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="16"/></filter>` +
    `<mask id="hcm-pines"><g filter="url(#hcm-soft)" fill="#fff">${pines.map((d) => `<path d="${d}"/>`).join('')}</g></mask></defs>` +
    `<rect width="${W}" height="${H}" filter="url(#hcm-hardwood)"/>` +
    `<rect width="${W}" height="${H}" filter="url(#hcm-pine)" mask="url(#hcm-pines)"/>` +
    // the creek's darker bottomland, then the powerline cut
    `<path class="bottom" filter="url(#hcm-softer)" d="${creek}"/>` +
    `<path class="cut" d="${cut}"/>` +
    field([760, 150], [560, 210], 4, 'corn', 2) +
    field([1255, 498], [214, 108], -3, 'corn', 4) +
    field([930, 548], [86, 50], 12, 'plot', 6) +
    field([1188, 888], [104, 56], -20, 'plot', 8) +
    field([548, 830], [300, 236], 8, 'hay', 10) +
    field([1690, 870], [340, 250], -6, 'wheat', 12) +
    field([1640, 150], [400, 210], 2, 'hay', 14) +
    field([150, 760], [240, 300], -4, 'corn', 16) +
    `<ellipse class="yard" cx="1052" cy="470" rx="30" ry="22"/><path class="roof" d="M1040 460h18v12h-18zM1064 472h9v8h-9z"/>` +
    `<path class="contour" d="${contours}"/>` +
    `<path class="water" d="${creek}"/><path class="pond-rim" d="${pond}"/><path class="pond" d="${pond}"/>` +
    `<path class="road-edge" d="${road}"/><path class="road" d="${road}"/><path class="track" d="${track}"/>` +
    `<rect class="relief" width="${W}" height="${H}" filter="url(#hcm-relief)"/>` +
    `<g class="club-ink">${CLUB.areas.map((a) => `<path class="area" d="${pts(a.line)}"/>`).join('')}` +
    `<path class="line" d="${pts(CLUB.line)}"/><path class="line-inner" d="${pts(CLUB.line)}"/></g></svg>`;

  const at = ([x, y], turn) => `style="--x:${x};--y:${y}${turn ? `;--turn:${turn}deg` : ''}"`;
  const use = (id) => `<svg class="ic" aria-hidden="true"><use href="#i-${id}"/></svg>`;
  const occupied = new Set(CLUB.out.map((h) => h.where));
  const marks = [
    `<span class="lbl water" ${at([930, 742], 44)}>Mill Creek</span>`,
    `<span class="lbl water" ${at([1352, 622])}>Duck Pond</span>`,
    `<span class="lbl road" ${at([1420, 306], -4)}>County Road 12</span>`,
    `<span class="lbl line-name" ${at([990, 420])}>${CLUB.name}, ${CLUB.acres} acres</span>`,
    ...CLUB.areas.map((a) => `<span class="lbl area-name" ${at(a.at)}>${a.name}</span>`),
    `<span class="mk place" ${at([1052, 470])}><span class="tag"><b>Camp</b></span></span>`,
    // your scent, drifting downwind (the wind is from the north-west)
    `<svg class="scent" ${at(CLUB.you)} width="150" height="150" viewBox="0 0 150 150" aria-hidden="true"><path d="M0 0L128 62A96 96 0 0 1 62 128Z"/></svg>`,
    `<span class="lbl scent-name" ${at([CLUB.you[0] + 128, CLUB.you[1] + 58])}>Your scent</span>`,
    ...CLUB.stands
      .filter((s) => !occupied.has(s.name))
      .map((s) => `<span class="mk stand${s.side ? ` ${s.side}` : ''}" ${at(s.at)}><span class="sq">${use(s.type)}</span><span class="tag"><b>${s.name}</b><i>Open</i></span></span>`),
    ...CLUB.out.map(
      (h) =>
        `<span class="mk hunter${h.stale ? ' stale' : ''}${h.side ? ` ${h.side}` : ''}" ${at(h.at)}><span class="dot">${h.initials}</span><span class="tag"><b>${h.where}</b><i>${h.name}, ${h.ago} ago</i></span></span>`,
    ),
    `<span class="mk you" ${at(CLUB.you)}><span class="dot"></span><span class="tag"><b>You</b></span></span>`,
  ];
  return `<div class="hcm-world">${svg}${marks.join('')}</div>`;
}

// ------------------------------------------------------------------ logo mark
/** The mark from packages/design, with its paints renamed to roles the direction colours. */
function logoMark() {
  const { logoMarkSvg } = bundle('packages/design/src/logo.ts');
  const svg = logoMarkSvg({ background: 'none' })
    .replace('<svg ', '<svg class="mark" aria-hidden="true" focusable="false" ')
    .replace(/stroke="#[0-9A-Fa-f]{6}"/, 'data-s="link"')
    .replace(/fill="#FF7A1F"/i, 'data-p="you"')
    .replace(/fill="#[0-9A-Fa-f]{6}"/g, 'data-p="radio"');
  if (/#[0-9A-Fa-f]{6}/.test(svg)) throw new Error('logo mark: a paint was not given a role');
  return svg;
}

// ------------------------------------------------------------------ icons
const ICONS = {
  map: 'M9 4 3 6.5v13.5L9 17.5l6 2.5 6-2.5V4L15 6.5 9 4ZM9 4v13.5M15 6.5V20',
  chat: 'M4 5h16v11H10l-5 4v-4H4V5Z',
  checkin: 'M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21ZM9 9.8l2.2 2.2 4-4.2',
  club: 'M8.5 11a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4ZM2.5 19.5c.4-3.3 2.8-5.3 6-5.3s5.600 2 6 5.300M16 4.900a3.200 3.200 0 0 1 0 6M17.800 14.500c2 .6 3.400 2.300 3.700 5',
  layers: 'm12 3 9 5-9 5-9-5 9-5ZM3.500 12.500 12 17.200l8.500-4.700M3.500 16.500 12 21.200l8.500-4.700',
  north: 'M12 2.500 17 20l-5-3.500L7 20l5-17.500Z',
  locate: 'M12 8.500a3.500 3.500 0 1 0 0 7 3.500 3.500 0 0 0 0-7ZM12 2v4M12 18v4M2 12h4M18 12h4',
  hand: 'M8 13V6a1.500 1.500 0 0 1 3 0v5M11 11V4.500a1.500 1.500 0 0 1 3 0V11M14 11V6a1.500 1.500 0 0 1 3 0v9a6 6 0 0 1-6 6h-.700a6 6 0 0 1-5.100-2.900l-3-5a1.500 1.500 0 0 1 2.400-1.800L8 14',
  wind: 'M12 21V4M12 4 6.500 9.500M12 4l5.500 5.500',
  radio: 'M7 9h10v12H7V9ZM9.500 9V3M10 13h4M12 17.500h.01',
  sunrise: 'M3 18h18M6.500 18a5.500 5.500 0 0 1 11 0M12 3v6M12 3 9.500 5.500M12 3l2.500 2.500M4.500 11.500l1.400 1.400M19.500 11.500l-1.400 1.400',
  sunset: 'M3 18h18M6.500 18a5.500 5.500 0 0 1 11 0M12 9V3M12 9 9.500 6.500M12 9l2.500-2.500M4.500 11.500l1.400 1.400M19.500 11.500l-1.400 1.400',
  treestand: 'M12 21V6M7 6h10v4H7V6ZM9 14h6M9 18h6M8.500 6l-2-3M15.500 6l2-3',
  ladder: 'M8 3v18M16 3v18M8 7h8M8 12h8M8 17h8',
  blind: 'M3 20 12 5l9 15H3ZM10 20v-5h4v5',
  plus: 'M12 5v14M5 12h14',
  menu: 'M4 7h16M4 12h16M4 17h16',
  check: 'm5 12.500 4.500 4.500L19 7.500',
  no: 'M6 12h12',
  moon: 'M20 14.500A8 8 0 0 1 9.500 4a8 8 0 1 0 10.500 10.500Z',
  pause: 'M9 5v14M15 5v14',
  walk: 'M13 5.500a1.500 1.500 0 1 0 0-3 1.500 1.500 0 0 0 0 3ZM9 21l2.500-6-2-2.500 1-5 3 3 3.500 1M10.500 7.500 7 9.500v3M13.500 15l2 6',
  // added for the map-first direction
  search: 'M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13ZM15.5 15.5 21 21',
  down: 'm6 9 6 6 6-6',
  right: 'm9 6 6 6-6 6',
  send: 'M4 12 20 4l-5 16-3.5-6.5L4 12ZM11.5 13.5 20 4',
  pin: 'M12 21s6.5-5.8 6.5-11A6.5 6.5 0 0 0 5.5 10c0 5.2 6.5 11 6.5 11ZM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z',
  area: 'M5 6.5 14 4l6 5.5-2.5 9L7 20 4 13l1-6.5Z',
  temp: 'M12 3a2 2 0 0 0-2 2v9.3a4 4 0 1 0 4 0V5a2 2 0 0 0-2-2ZM12 9v8',
  battery: 'M3 8h15v8H3V8ZM21 11v2M6 11v2M9 11v2M12 11v2',
  tag: 'M4 4h8l8 8-8 8-8-8V4ZM8.5 8.5h.01',
  pack: 'M12 4v11M7.5 10.5 12 15l4.5-4.5M4 19.5h16',
  card: 'M3 6h18v12H3V6ZM3 10h18M7 14.5h4',
  mail: 'M3 6h18v12H3V6ZM3 7l9 6.5L21 7',
  eye: 'M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12ZM12 14.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z',
  out: 'M14 4h5v16h-5M10 8l-4 4 4 4M6 12h9',
  sun: 'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2',
};
const iconSprite = () =>
  `<svg class="icon-sprite" width="0" height="0" aria-hidden="true" focusable="false">${Object.entries(ICONS)
    .map(([id, d]) => `<symbol id="i-${id}" viewBox="0 0 24 24"><path d="${d.replace(/(\.\d)00/g, '$1')}"/></symbol>`)
    .join('')}</svg>`;

// ------------------------------------------------------------------ inject
const parts = { dawn: dawnStill, map: mapSvg, icons: iconSprite, ridge: ridgeEdge, world: worldHtml, mark: logoMark };
const made = {};
let count = 0;
for (const dir of readdirSync(directions, { withFileTypes: true })) {
  if (!dir.isDirectory() || dir.name === 'tools') continue;
  for (const file of readdirSync(join(directions, dir.name))) {
    if (!file.endsWith('.html')) continue;
    const path = join(directions, dir.name, file);
    const before = readFileSync(path, 'utf8');
    const after = before.replace(
      /<!-- inject:(\w+) -->[\s\S]*?<!-- \/inject:\1 -->/g,
      (_, name) => {
        if (!parts[name]) throw new Error(`${path}: unknown part "${name}"`);
        made[name] ??= parts[name]();
        return `<!-- inject:${name} -->${made[name]}<!-- /inject:${name} -->`;
      },
    );
    if (after !== before) {
      writeFileSync(path, after);
      count++;
    }
  }
}
console.log(`filled ${count} mockups; parts: ${Object.entries(made).map(([k, v]) => `${k} ${Math.round(v.length / 1024)} KB`).join(', ')}`);
