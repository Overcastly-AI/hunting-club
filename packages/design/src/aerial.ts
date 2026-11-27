// The stand-in aerial picture of the map-first direction (docs/DESIGN.md): a leaf-off November
// aerial of a sample property, drawn as one standalone SVG with a club's property line and areas
// on top. The site's hero shows it until real imagery replaces it. It is a picture, not
// interface: its paints are imagery values (AERIAL_PAINTS), the same in both themes, and only
// the club's own ink (the property line and areas) comes from the tokens.
//
// The SVG uses presentation attributes only (no <style>, no script), so it can be served as a
// plain image file under the strict CSP. Deterministic: the same picture on every build.
import { basemapSwatch, boundary, mapPlanColors } from './colors';

/** The picture's size in px: 1 px is about 6 ft on the ground. */
export const AERIAL_WORLD = { width: 2000, height: 1400 } as const;

/** A point on the picture, in px from its top left. */
export type AerialPoint = readonly [number, number];

/** What a club draws on the map: its property line and its named areas. */
export interface AerialClub {
  readonly line: readonly AerialPoint[];
  readonly areas: readonly { readonly line: readonly AerialPoint[] }[];
}

/**
 * The picture's paints (imagery, not interface: docs/DESIGN.md "Hard rules"). The ground is
 * the map ground (`mapPlanColors.mapGround`), so the page behind the picture matches it while it loads; colours the
 * phone's aerial basemap thumbnail also draws come from `basemapSwatch`.
 */
export const AERIAL_PAINTS = {
  ground: mapPlanColors.mapGround,
  corn: basemapSwatch.field,
  hay: '#86864F',
  wheat: '#62833F',
  plot: '#5F8F3C',
  cut: '#6F7648',
  water: basemapSwatch.water,
  waterRim: '#0D1E22',
  road: '#BBB094',
  roadEdge: '#34352A',
  track: '#AAA081',
  yard: '#8F8966',
  roof: '#DCD8CC',
  contour: basemapSwatch.hybridContour,
  bottom: '#08120A',
  /** The light the canopy and the relief are lit by. */
  light: '#FFFFFF',
} as const;

/** The club's line and areas: white, with the accent inner line (colors.ts `boundary`). */
const CLUB_INK = {
  line: { width: 4.5 },
  inner: { width: boundary.innerLineWidth * 1.2 },
  area: { fillOpacity: 0.07, strokeOpacity: 0.8, width: 1.6, dash: '2 6' },
} as const;

/** Deterministic random numbers, so the picture is the same on every build. */
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

const n = (v: number) => String(Math.round(v * 10) / 10);
const path = (points: readonly AerialPoint[]) =>
  `M${points.map(([x, y]) => `${x} ${y}`).join('L')}Z`;

/** A wobbly closed shape: a pond, a stand of pines, a hill's contour. */
function blob(cx: number, cy: number, r: number, wobble: number, seed: number, squash = 1) {
  const p = random(seed);
  const k = [p() * 6, p() * 6, p() * 6] as const;
  const out: string[] = [];
  for (let i = 0; i < 36; i++) {
    const a = (i / 36) * Math.PI * 2;
    const rr =
      r *
      (1 +
        wobble *
          (Math.sin(a * 2 + k[0]) * 0.5 +
            Math.sin(a * 3 + k[1]) * 0.3 +
            Math.sin(a * 5 + k[2]) * 0.2));
    out.push(`${n(cx + Math.cos(a) * rr)} ${n(cy + Math.sin(a) * rr * squash)}`);
  }
  return `M${out.join('L')}Z`;
}

type FieldKind = 'corn' | 'hay' | 'wheat' | 'plot';

/** A farmed field: four slightly-off corners, with rows along its long side. */
function field(
  [cx, cy]: AerialPoint,
  [fw, fh]: AerialPoint,
  rot: number,
  kind: FieldKind,
  seed: number,
) {
  const p = random(seed);
  const j = () => (p() - 0.5) * 22;
  const corners: AerialPoint[] = [
    [-fw / 2 + j(), -fh / 2 + j()],
    [fw / 2 + j(), -fh / 2 + j()],
    [fw / 2 + j(), fh / 2 + j()],
    [-fw / 2 + j(), fh / 2 + j()],
  ];
  const d = `M${corners.map(([x, y]) => `${n(x)} ${n(y)}`).join('L')}Z`;
  return `<g transform="translate(${cx} ${cy}) rotate(${rot})"><path fill="${AERIAL_PAINTS[kind]}" filter="url(#a-rows)" d="${d}"/></g>`;
}

const GREY = '<feColorMatrix type="matrix" values="1 0 0 0 0 1 0 0 0 0 1 0 0 0 0 0 0 0 0 1"/>';
const ramp = (r: string, g: string, b: string) =>
  `<feComponentTransfer><feFuncR type="table" tableValues="${r}"/><feFuncG type="table" tableValues="${g}"/><feFuncB type="table" tableValues="${b}"/></feComponentTransfer>`;
const linear = (slope: number, intercept: number, result: string) =>
  `<feComponentTransfer result="${result}">${['R', 'G', 'B']
    .map((c) => `<feFunc${c} type="linear" slope="${slope}" intercept="${intercept}"/>`)
    .join('')}</feComponentTransfer>`;

/** Tree crowns: small bumps lit from the north-west, over a slow tone for stands of timber. */
const canopy = (id: string, seed: number, crown: number, r: string, g: string, b: string) =>
  `<filter id="${id}" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">` +
  `<feTurbulence type="fractalNoise" baseFrequency="${crown}" numOctaves="3" seed="${seed}" result="n"/>` +
  `<feDiffuseLighting in="n" surfaceScale="6" diffuseConstant="1.2" lighting-color="${AERIAL_PAINTS.light}"><feDistantLight azimuth="315" elevation="38"/></feDiffuseLighting>${GREY}${linear(1.2, -0.25, 'fine')}` +
  `<feTurbulence type="fractalNoise" baseFrequency="0.011" numOctaves="3" seed="${seed + 5}"/>${GREY}${linear(2, -0.5, 'slow')}` +
  `<feComposite in="fine" in2="slow" operator="arithmetic" k1="0" k2="0.62" k3="0.38" k4="0"/>${ramp(r, g, b)}</filter>`;

const ROAD = 'M-20 286C380 322 760 372 1180 344S1700 300 2020 330';
const TRACK =
  'M1020 352C1030 400 1040 440 1050 470S1060 530 1075 560S1120 620 1130 660S1160 740 1150 780S1120 870 1100 900S1070 970 1060 1000';
const CREEK =
  'M520 380C640 470 760 540 850 640S960 800 1060 850S1260 930 1340 1010S1500 1120 1620 1240';
const POWERLINE_CUT = 'M540 1260L1780 330';

/**
 * The aerial as a standalone SVG document, with `club`'s property line and areas drawn on it.
 * Marker positions and labels are the page's: they share this picture's px coordinates.
 */
export function aerialSvg(club: AerialClub): string {
  const { width: W, height: H } = AERIAL_WORLD;
  const P = AERIAL_PAINTS;
  const pond = blob(1290, 606, 30, 0.22, 21, 0.8);
  const pines = [
    blob(430, 560, 190, 0.2, 31, 0.8),
    path([
      [866, 934],
      [1046, 926],
      [1052, 1026],
      [962, 1030],
      [872, 992],
    ]),
    blob(1650, 560, 170, 0.18, 33, 0.75),
    blob(1500, 1200, 200, 0.2, 35, 0.7),
    blob(240, 1150, 210, 0.2, 36, 0.8),
  ];
  let contours = '';
  for (const [cx, cy, seed] of [
    [930, 520, 9],
    [1330, 900, 13],
    [600, 1000, 17],
    [1560, 420, 19],
    [300, 300, 23],
  ] as const) {
    for (let k = 1; k <= 7; k++) contours += blob(cx, cy, k * 34, 0.18, seed, 0.85);
  }
  const whole = `x="0" y="0" width="${W}" height="${H}" filterUnits="userSpaceOnUse"`;
  const defs =
    canopy(
      'a-hardwood',
      4,
      0.17,
      '0.07 0.12 0.19 0.28 0.37',
      '0.08 0.13 0.2 0.28 0.36',
      '0.04 0.07 0.1 0.14 0.2',
    ) +
    canopy(
      'a-pine',
      12,
      0.3,
      '0.02 0.05 0.08 0.12 0.17',
      '0.06 0.1 0.15 0.2 0.26',
      '0.04 0.06 0.09 0.12 0.15',
    ) +
    `<filter id="a-rows" x="-5%" y="-5%" width="110%" height="110%" color-interpolation-filters="sRGB"><feTurbulence type="fractalNoise" baseFrequency="0.006 0.36" numOctaves="2" seed="3"/>${GREY}<feComposite in="SourceGraphic" operator="arithmetic" k1="1.1" k2="0.42" k3="0" k4="0" result="t"/><feComposite in="t" in2="SourceGraphic" operator="in"/></filter>` +
    // Hill shading over the whole picture: lit noise, soft-light blended into the terrain.
    `<filter id="a-relief" ${whole} color-interpolation-filters="sRGB"><feTurbulence type="fractalNoise" baseFrequency="0.0032" numOctaves="4" seed="8"/><feDiffuseLighting surfaceScale="70" diffuseConstant="1.15" lighting-color="${P.light}" result="light"><feDistantLight azimuth="315" elevation="52"/></feDiffuseLighting>` +
    `<feBlend in="light" in2="SourceGraphic" mode="soft-light" result="lit"/><feComposite in="lit" in2="SourceGraphic" operator="arithmetic" k1="0" k2="0.85" k3="0.15" k4="0"/></filter>` +
    `<filter id="a-soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="9"/></filter>` +
    `<filter id="a-softer" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="16"/></filter>` +
    `<mask id="a-pines"><g filter="url(#a-soft)" fill="${P.light}">${pines.map((d) => `<path d="${d}"/>`).join('')}</g></mask>`;

  const stroke = (paint: string, width: number, extra = '') =>
    `fill="none" stroke="${paint}" stroke-width="${width}"${extra ? ` ${extra}` : ''}`;
  const terrain =
    `<rect width="${W}" height="${H}" fill="${P.ground}"/>` +
    `<rect width="${W}" height="${H}" filter="url(#a-hardwood)"/>` +
    `<rect width="${W}" height="${H}" filter="url(#a-pine)" mask="url(#a-pines)"/>` +
    // The creek's darker bottomland, then the powerline cut.
    `<path ${stroke(P.bottom, 54, 'stroke-opacity="0.5"')} filter="url(#a-softer)" d="${CREEK}"/>` +
    `<path ${stroke(P.cut, 24, 'stroke-opacity="0.8"')} d="${POWERLINE_CUT}"/>` +
    field([760, 150], [560, 210], 4, 'corn', 2) +
    field([1255, 498], [214, 108], -3, 'corn', 4) +
    field([930, 548], [86, 50], 12, 'plot', 6) +
    field([1188, 888], [104, 56], -20, 'plot', 8) +
    field([548, 830], [300, 236], 8, 'hay', 10) +
    field([1690, 870], [340, 250], -6, 'wheat', 12) +
    field([1640, 150], [400, 210], 2, 'hay', 14) +
    field([150, 760], [240, 300], -4, 'corn', 16) +
    `<ellipse fill="${P.yard}" cx="1052" cy="470" rx="30" ry="22"/><path fill="${P.roof}" d="M1040 460h18v12h-18zM1064 472h9v8h-9z"/>` +
    `<path ${stroke(P.contour, 1, 'stroke-opacity="0.12"')} d="${contours}"/>` +
    `<path ${stroke(P.water, 5, 'stroke-linecap="round"')} d="${CREEK}"/>` +
    `<path ${stroke(P.waterRim, 6)} d="${pond}"/><path fill="${P.water}" d="${pond}"/>` +
    `<path ${stroke(P.roadEdge, 9, 'stroke-opacity="0.6"')} d="${ROAD}"/><path ${stroke(P.road, 5)} d="${ROAD}"/>` +
    `<path ${stroke(P.track, 2.4, 'stroke-opacity="0.75"')} d="${TRACK}"/>`;

  const { line, inner, area } = CLUB_INK;
  const clubInk =
    club.areas
      .map(
        (a) =>
          `<path fill="${boundary.stroke}" fill-opacity="${area.fillOpacity}" stroke="${boundary.stroke}" stroke-opacity="${area.strokeOpacity}" stroke-width="${area.width}" stroke-dasharray="${area.dash}" stroke-linecap="round" d="${path(a.line)}"/>`,
      )
      .join('') +
    `<path fill="none" stroke="${boundary.stroke}" stroke-width="${line.width}" stroke-linejoin="round" d="${path(club.line)}"/>` +
    `<path fill="none" stroke="${boundary.innerLine}" stroke-width="${inner.width}" stroke-linejoin="round" d="${path(club.line)}"/>`;

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
    `<defs>${defs}</defs><g filter="url(#a-relief)">${terrain}</g>${clubInk}</svg>`
  );
}
