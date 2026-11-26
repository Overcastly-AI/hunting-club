import { colors, type ColorToken } from './colors';
import { dawnSprites, type DawnSprite } from './dawnSprites.generated';

/**
 * The dawn scene: a layered, slowly moving illustration for the public home page hero and
 * the web sign-in page. Paper-cut silhouettes of a ridge, bare hardwoods, a doe, a buck,
 * wild turkeys and crows, with the sun coming up behind the ridge and fog drifting through.
 *
 * It is one inline SVG with its own CSS: no video, no script, no network request.
 * - Every colour is a design token, some at a fixed opacity (DAWN_PAINTS lists them all).
 *   No gradients: light and fog are flat shapes.
 * - The animals are frame-by-frame silhouettes rendered from the Blender rigs in
 *   design/background (see dawnSprites.generated.ts); everything else is drawn here.
 * - `prefers-reduced-motion: reduce` shows a still picture (the doe with her head up).
 * - Adding DAWN_PAUSED_CLASS to the <svg> freezes it (the "Pause background" button).
 * - It is decorative: aria-hidden, not focusable.
 */

/** Drawing area in viewBox units. The page scales it to cover the hero, anchored at the bottom. */
export const DAWN_VIEW = { width: 1600, height: 900 } as const;

/** Put this class on the scene's <svg> to pause every animation in it. */
export const DAWN_PAUSED_CLASS = 'dawn--paused';

/** A token at an opacity. Everything the scene paints is one of these. */
export interface Paint {
  token: ColorToken;
  opacity: number;
}

/**
 * Every paint in the scene, back to front. Tests hold the text tokens to MIN_TEXT_CONTRAST on
 * the paints text can sit on (DAWN_TEXT_BACKDROPS).
 */
export const DAWN_PAINTS = {
  /** The sky is the page colour with first light in it: a wash of the control outline grey. */
  skyBase: { token: 'surface', opacity: 1 },
  skyLight: { token: 'controlBorder', opacity: 0.3 },
  /** Three wide rings of light round the sun; they stack, so the sky warms towards it. */
  glow: { token: 'accent', opacity: 0.06 },
  /** The sun itself: the one solid piece of accent in the picture. */
  sun: { token: 'accent', opacity: 0.85 },
  farRidge: { token: 'surface', opacity: 0.45 },
  fog: { token: 'textSecondary', opacity: 0.09 },
  midRidge: { token: 'surface', opacity: 0.8 },
  nearGround: { token: 'surface', opacity: 1 },
  foreground: { token: 'mapHalo', opacity: 1 },
} as const satisfies Record<string, Paint>;

/** How many glow rings overlap at most outside the innermost one (where text may reach). */
export const DAWN_GLOW_RINGS = 3;

/**
 * The lightest things text can sit on: plain sky, and sky under all but the innermost glow
 * ring. Text stays out of the innermost ring and off the sun (they are low and to the right,
 * behind the doe); the layout rules in docs/BACKGROUND_LOOP.md say where.
 * The middle of the picture holds the doe and the sun, because a phone shows only the middle.
 */
export const DAWN_TEXT_BACKDROPS: readonly { base: ColorToken; over: readonly Paint[] }[] = [
  { base: 'surface', over: [DAWN_PAINTS.skyLight] },
  {
    base: 'surface',
    over: [DAWN_PAINTS.skyLight, ...Array.from({ length: DAWN_GLOW_RINGS - 1 }, () => DAWN_PAINTS.glow)],
  },
];

const SUN = { x: 930, y: 700, r: 46, rings: [140, 240, 360] } as const;
/** The line the doe and the turkeys stand on. */
const GROUND_Y = 800;
const MID_Y = 734;
const FAR_Y = 684;
/** Extra drawing beyond both sides, so the slow sideways drift never shows an edge. */
const BLEED = 80;

// ---------------------------------------------------------------- small helpers
const n = (v: number) => String(Math.round(v * 10) / 10);
const fill = (p: Paint) =>
  `fill="${colors[p.token]}"${p.opacity < 1 ? ` fill-opacity="${p.opacity}"` : ''}`;

/** Deterministic random numbers, so the drawing is the same on every build. */
function random(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A rolling skyline from left to right, closed along the bottom of the picture. */
function ridge(seed: number, y: number, roll: number, step: number): string {
  const rnd = random(seed);
  const pts: string[] = [];
  let level = y;
  for (let x = -BLEED; x <= DAWN_VIEW.width + BLEED; x += step) {
    level += (rnd() - 0.5) * roll;
    level += (y - level) * 0.25;
    pts.push(`${n(x)} ${n(level)}`);
  }
  const [first, ...rest] = pts;
  return `M${first} ${rest.map((p, i) => (i % 2 ? p : `Q${p}`)).join(' ')} L${DAWN_VIEW.width + BLEED} ${DAWN_VIEW.height} L${-BLEED} ${DAWN_VIEW.height}Z`;
}

/**
 * A bare hardwood: a tapering trunk that forks into rising limbs and twigs. Returns one path
 * per stroke width (thick first).
 */
function tree(seed: number, x: number, baseY: number, height: number, girth: number, depth: number): string {
  const rnd = random(seed);
  const strokes = new Map<number, string[]>();
  const line = (x1: number, y1: number, x2: number, y2: number, w: number) => {
    const key = Math.max(1, Math.round(w));
    const list = strokes.get(key) ?? [];
    list.push(`M${Math.round(x1)} ${Math.round(y1)}L${Math.round(x2)} ${Math.round(y2)}`);
    strokes.set(key, list);
  };
  const grow = (x0: number, y0: number, angle: number, length: number, w: number, depth: number) => {
    const x1 = x0 + Math.sin(angle) * length;
    const y1 = y0 - Math.cos(angle) * length;
    line(x0, y0, x1, y1, w);
    if (depth === 0 || w < 1.2) return;
    // the leader carries on nearly straight; one or two limbs leave it at an acute angle
    grow(x1, y1, angle * 0.6 + (rnd() - 0.5) * 0.22, length * 0.8, w * 0.72, depth - 1);
    const limbs = rnd() < 0.3 ? 2 : 1;
    for (let i = 0; i < limbs; i++) {
      const side = (i === 0 ? 1 : -1) * (rnd() < 0.5 ? 1 : -1);
      grow(x1, y1, angle + side * (0.35 + rnd() * 0.3), length * (0.45 + rnd() * 0.25), w * 0.45, depth - 1);
    }
  };
  grow(x, baseY + 6, (rnd() - 0.5) * 0.06, height * 0.36, girth, depth);
  return [...strokes.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([w, d]) => `<path stroke-width="${w}" d="${d.join('')}"/>`)
    .join('');
}

/** A row of trees as strokes in one paint. */
function grove(
  seed: number,
  paint: Paint,
  trees: readonly [x: number, height: number, girth: number][],
  baseY: number,
  depth: number,
): string {
  return `<g fill="none" stroke="${colors[paint.token]}" stroke-linecap="round">${trees
    .map(([x, h, g], i) => tree(seed + i * 101, x, baseY, h, g, depth))
    .join('')}</g>`;
}

/** A fog bank: a long flat shape with a scalloped top, drawn twice so it can drift for ever. */
function fogBank(seed: number, y: number, thickness: number, name: string): string {
  const rnd = random(seed);
  const period = DAWN_VIEW.width + 2 * BLEED;
  let d = '';
  for (let x = 0; x < period; ) {
    const w = 180 + rnd() * 260;
    const h = thickness * (0.5 + rnd() * 0.5);
    d += `M${n(x - 30)} ${y}a${n(w / 2 + 30)} ${n(h)} 0 0 1 ${n(w + 60)} 0z`;
    x += w * 0.72;
  }
  const bank = `<path d="${d}"/><rect x="0" y="${y - 1}" width="${period}" height="${n(thickness * 0.5)}"/>`;
  return `<g class="dawn-fog dawn-fog-${name}" ${fill(DAWN_PAINTS.fog)}><g>${bank}</g><g transform="translate(${period})">${bank}</g></g>`;
}

// ---------------------------------------------------------------- animals (frame strips)
interface Placement {
  /** Unique name: the CSS animation and clip path are named after it. */
  id: string;
  sprite: DawnSprite;
  /** Where the animal's ground point goes. */
  x: number;
  y: number;
  /** Viewbox units per path unit. */
  scale: number;
  /** Sprites face right; true turns the animal to face left. */
  faceLeft?: boolean;
  /** Start this far into the loop (seconds), so animals of one kind are out of step. */
  offset?: number;
  /** The frame shown when motion is off. */
  still: number;
  paint: Paint;
}

const cellOf = (s: DawnSprite, frame: number) => s.frames[frame % s.frames.length] ?? 0;

/**
 * One animal: its distinct frames side by side behind a one-frame window, and a stepped
 * animation that slides the right frame into the window. Returns the markup and its CSS.
 */
function animal(p: Placement): { svg: string; css: string } {
  const s = p.sprite;
  const seconds = s.frames.length / s.fps;
  const steps: string[] = [];
  let last = -1;
  s.frames.forEach((cell, i) => {
    if (cell === last) return;
    last = cell;
    steps.push(`${Math.round((i / s.frames.length) * 100000) / 1000}%{transform:translateX(${-cell * s.width}px)}`);
  });
  const flip = p.faceLeft ? -1 : 1;
  const svg =
    `<g transform="translate(${n(p.x)} ${n(p.y)}) scale(${p.scale * flip} ${p.scale}) translate(${-s.originX} ${-s.groundY})" ${fill(p.paint)} fill-rule="evenodd">` +
    `<g clip-path="url(#dawn-window-${p.id})"><g class="dawn-strip dawn-${p.id}">${s.cells
      .map((d, i) => `<path${i ? ` transform="translate(${i * s.width})"` : ''} d="${d}"/>`)
      .join('')}</g></g></g>`;
  const css =
    `.dawn-${p.id}{transform:translateX(${-cellOf(s, p.still) * s.width}px);animation:dawn-${p.id} ${seconds}s step-end ${-(p.offset ?? 0)}s infinite}` +
    `@keyframes dawn-${p.id}{${steps.join('')}}`;
  return { svg, css };
}

const window_ = (id: string, s: DawnSprite) =>
  `<clipPath id="dawn-window-${id}"><rect width="${s.width}" height="${s.height}"/></clipPath>`;

// ---------------------------------------------------------------- the scene
const sprite = (name: keyof typeof dawnSprites): DawnSprite => dawnSprites[name] as DawnSprite;

/** Scale that draws a path unit at the size of an animal standing on the near ground. */
const NEAR_SCALE = 0.62;

const WALK_SECONDS = 84;

export function dawnSceneSvg(): string {
  const { width, height } = DAWN_VIEW;
  const doe: Placement = { id: 'doe', sprite: sprite('doe'), x: 850, y: GROUND_Y + 3, scale: NEAR_SCALE, faceLeft: true, still: 78, paint: DAWN_PAINTS.foreground };
  const buck: Placement = { id: 'buck', sprite: sprite('buck'), x: 540, y: MID_Y + 4, scale: 0.4, still: 0, paint: DAWN_PAINTS.nearGround };
  const feeders: Placement[] = [
    { id: 'hen-a', sprite: sprite('turkeyFeed'), x: 610, y: GROUND_Y + 14, scale: 0.6, still: 50, paint: DAWN_PAINTS.foreground },
    { id: 'hen-b', sprite: sprite('turkeyFeed'), x: 1130, y: GROUND_Y + 10, scale: 0.56, faceLeft: true, offset: 3.4, still: 12, paint: DAWN_PAINTS.foreground },
  ];
  const walk = sprite('turkeyWalk');
  const walkScale = 0.6;
  // A walker's ground speed must equal its stride at its own scale, or its feet would slide.
  const walkDistance = (scale: number) =>
    (walk.stride ?? 0) * scale * (WALK_SECONDS / (walk.frames.length / walk.fps));
  const walkers: (Placement & { delay: number; rest: number })[] = [
    { id: 'jake-a', sprite: walk, x: 0, y: GROUND_Y + 22, scale: walkScale, still: 2, paint: DAWN_PAINTS.foreground, delay: 0.2, rest: 440 },
    { id: 'jake-b', sprite: walk, x: 0, y: GROUND_Y + 18, scale: walkScale * 0.94, offset: 0.4, still: 8, paint: DAWN_PAINTS.foreground, delay: 0.56, rest: 1010 },
  ];
  const crow = sprite('crow');
  const crows = [
    { id: 'crow-a', scale: 0.11, delay: 9, y: 330, rest: 1180 },
    { id: 'crow-b', scale: 0.09, delay: 10.6, y: 300, rest: 1245 },
    { id: 'crow-c', scale: 0.1, delay: 31, y: 390, rest: 1330 },
  ];

  const placed = [doe, buck, ...feeders].map(animal);
  const walkParts = walkers.map((w) => ({ w, a: animal(w) }));
  const crowParts = crows.map((c, i) => ({
    c,
    a: animal({ id: c.id, sprite: crow, x: 0, y: 0, scale: c.scale, faceLeft: true, offset: i * 0.17, still: 1 + i, paint: DAWN_PAINTS.foreground }),
  }));
  const startX = -260;

  const css = [
    // slow sideways drift of each layer: nearer layers move further (parallax)
    ...[['far', 5, 46], ['mid', 10, 46], ['near', 18, 46], ['front', 30, 46]].map(
      ([name, px, s]) => `.dawn-layer-${name}{animation:dawn-drift-${name} ${s}s ease-in-out infinite alternate}@keyframes dawn-drift-${name}{from{transform:translateX(${-(px as number)}px)}to{transform:translateX(${px}px)}}`,
    ),
    `.dawn-fog{animation:dawn-fog linear infinite}@keyframes dawn-fog{to{transform:translateX(${-(width + 2 * BLEED)}px)}}`,
    `.dawn-fog-a{animation-duration:210s}.dawn-fog-b{animation-duration:150s;animation-direction:reverse}.dawn-fog-c{animation-duration:110s}`,
    `.dawn-glow{animation:dawn-glow 14s ease-in-out infinite alternate}@keyframes dawn-glow{from{transform:scale(.97)}to{transform:scale(1.04)}}`,
    ...placed.map((a) => a.css),
    ...walkParts.flatMap(({ w, a }) => [
      a.css,
      `.dawn-go-${w.id}{transform:translateX(${n(w.rest)}px);animation:dawn-go-${w.id} ${WALK_SECONDS}s linear ${n(-w.delay * WALK_SECONDS)}s infinite}` +
        `@keyframes dawn-go-${w.id}{from{transform:translateX(${startX}px)}to{transform:translateX(${n(startX + walkDistance(w.scale))}px)}}`,
    ]),
    ...crowParts.flatMap(({ c, a }) => [
      a.css,
      `.dawn-go-${c.id}{transform:translate(${c.rest}px,${c.y}px);animation:dawn-go-${c.id} 52s linear ${-c.delay}s infinite}` +
        `@keyframes dawn-go-${c.id}{from{transform:translate(${width + 140}px,${c.y + 110}px)}to{transform:translate(-160px,${c.y - 190}px)}}`,
    ]),
    `.${DAWN_PAUSED_CLASS} *{animation-play-state:paused!important}`,
    `@media (prefers-reduced-motion:reduce){.dawn *{animation:none!important}}`,
  ].join('');

  // [x, height, girth]. The left half is kept sparse: that is where desktop text sits.
  const midTrees: [number, number, number][] = [
    [60, 470, 8], [300, 560, 10], [560, 430, 7], [742, 520, 9], [860, 400, 6], [1120, 540, 9],
    [1215, 410, 6], [1340, 580, 10], [1450, 450, 7], [1560, 520, 8],
  ];
  const nearTrees: [number, number, number][] = [[185, 980, 22], [455, 800, 14], [1275, 860, 17], [1490, 1000, 24]];
  const frontTrees: [number, number, number][] = [[-22, 1500, 60], [1612, 1400, 50]];

  const tufts = (() => {
    const rnd = random(77);
    let d = '';
    for (let x = -BLEED; x < width + BLEED; x += 16 + rnd() * 54) {
      const blades = 2 + Math.floor(rnd() * 3);
      for (let b = 0; b < blades; b++) {
        const h = 8 + rnd() * 24;
        const lean = (rnd() - 0.5) * 14;
        const foot = x + b * 3.5;
        d += `M${n(foot)} ${GROUND_Y + 30}q${n(lean * 0.2)} ${n(-h * 0.6)} ${n(lean)} ${n(-h)}q${n(-lean * 0.5 + 1.5)} ${n(h * 0.5)} ${n(-lean + 3)} ${n(h)}z`;
      }
    }
    return d;
  })();

  return [
    `<svg class="dawn" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMax slice" aria-hidden="true" focusable="false">`,
    `<style>${css}</style>`,
    `<defs>${[doe, buck, ...feeders, ...walkers].map((p) => window_(p.id, p.sprite)).join('')}${crows.map((c) => window_(c.id, crow)).join('')}</defs>`,
    `<rect width="${width}" height="${height}" ${fill(DAWN_PAINTS.skyBase)}/><rect width="${width}" height="${height}" ${fill(DAWN_PAINTS.skyLight)}/>`,
    // light: flat rings, then the sun
    `<g class="dawn-glow" style="transform-origin:${SUN.x}px ${SUN.y}px">${[...SUN.rings].reverse().map((r) => `<circle cx="${SUN.x}" cy="${SUN.y}" r="${r}" ${fill(DAWN_PAINTS.glow)}/>`).join('')}</g>`,
    `<circle cx="${SUN.x}" cy="${SUN.y}" r="${SUN.r}" ${fill(DAWN_PAINTS.sun)}/>`,
    ...crowParts.map(({ c, a }) => `<g class="dawn-go-${c.id}">${a.svg}</g>`),
    // far ridge
    `<g class="dawn-layer-far" opacity="${DAWN_PAINTS.farRidge.opacity}"><path fill="${colors.surface}" d="${ridge(11, FAR_Y, 34, 40)}"/></g>`,
    fogBank(5, FAR_Y + 34, 30, 'a'),
    // middle ridge with its trees and the buck
    `<g class="dawn-layer-mid" opacity="${DAWN_PAINTS.midRidge.opacity}"><path fill="${colors.surface}" d="${ridge(23, MID_Y, 18, 60)}"/>${grove(300, { token: 'surface', opacity: 1 }, midTrees, MID_Y, 3)}${placed[1]!.svg}</g>`,
    fogBank(9, MID_Y + 44, 38, 'b'),
    // near ground: big trees, the doe and the turkeys
    `<g class="dawn-layer-near"><path ${fill(DAWN_PAINTS.nearGround)} d="${ridge(37, GROUND_Y, 5, 90)}"/>${grove(700, DAWN_PAINTS.nearGround, nearTrees, GROUND_Y, 4)}`,
    placed[0]!.svg,
    placed[2]!.svg,
    placed[3]!.svg,
    ...walkParts.map(({ w, a }) => `<g class="dawn-go-${w.id}">${a.svg}</g>`),
    `</g>`,
    fogBank(14, GROUND_Y + 40, 26, 'c'),
    // foreground: two trunks that frame the picture, and grass
    `<g class="dawn-layer-front">${grove(900, DAWN_PAINTS.foreground, frontTrees, height, 1)}<path ${fill(DAWN_PAINTS.foreground)} d="${tufts}"/><rect x="${-BLEED}" y="${GROUND_Y + 29}" width="${width + 2 * BLEED}" height="${height - GROUND_Y}" ${fill(DAWN_PAINTS.foreground)}/></g>`,
    `</svg>`,
  ].join('');
}
