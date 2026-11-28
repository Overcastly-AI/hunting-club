// CSS for the map window, its markers, plates and the readout strip (docs/DESIGN.md). Every
// colour is a token: chrome from the theme (--theme-*), the map's own ink (text on the aerial,
// its halo, the you dot and the property line) from `colors` (--color-*), the same in both
// themes because the picture is. Marker positions are classes generated from SAMPLE_CLUB.
import { AERIAL_WORLD, type AerialPoint } from '@huntclub/design/aerial';
import {
  fontWidth,
  opacity,
  radii,
  rem,
  sizes,
  textScale,
  textStyleCss,
  textWidth,
} from '@huntclub/design';
import { AT } from './MapView';
import {
  hunterFreshness,
  openStands,
  SAMPLE_CLUB,
  SAMPLE_CONDITIONS,
  SAMPLE_LABELS,
  SAMPLE_SCALE,
  SCENT_LABEL,
  type SampleLabel,
} from './sampleClub';

/** At this width and below the hero stacks: the map on top, the pitch rising over it as a sheet. */
export const MAP_PHONE_MAX_WIDTH = 700;

/**
 * Which part of the aerial each layout frames: its top-left corner, in aerial px. Chosen with
 * HERO_HEIGHT so no marker or the scale bar sits under a floating plate: on a wide screen the
 * club sits between the pitch and the readout strip, which has the band under the property to
 * itself; on a phone the club sits below the strip. site/scripts/shoot.mjs checks it.
 */
export const MAP_FRAME = {
  wide: [240, 360],
  phone: [790, 368],
} as const satisfies Record<string, AerialPoint>;

/**
 * The widest screen the hero must fill edge to edge. Past the point where the wide frame
 * would run out of picture, the aerial slides left just enough to reach the right edge.
 */
export const MAP_COVERED_WIDTH = 1920;

/** The hero's height on a wide screen, and the map's height above the sheet on a phone. */
export const HERO_HEIGHT = { wide: 720, phone: 400 } as const;

/** A marker's plate starts this far from the marker's point (your own: `you`). */
const TAG_OFFSET = { marker: 28, you: 20 } as const;
/** A plate's side padding, px. */
const TAG_PADDING_X = 8;
/** Each kind of map label on the aerial (`.lbl-<kind>`): its size in px and width in %. */
const LABEL = {
  water: { size: 14, width: 90 },
  road: { size: textScale.mapLabel.size, width: 80 },
  name: { size: 14, width: textScale.markerName.width },
} as const satisfies Record<SampleLabel['kind'], { size: number; width: number }>;

const pct = (n: number) => `${Math.round(n * 100)}%`;
const at = ([x, y]: AerialPoint) => `left: ${x}px; top: ${y}px;`;

/** One rule per placed thing: `.at-h0 { left: 872px; top: 612px; }`. */
function positionsCss(): string {
  const rules = [
    ...SAMPLE_LABELS.map(
      (l, i) =>
        `.${AT.label(i)} { ${at(l.at)}${l.turn ? ` transform: translate(-50%, -50%) rotate(${l.turn}deg);` : ''} }`,
    ),
    ...SAMPLE_CLUB.stands.map((s, i) => `.${AT.stand(i)} { ${at(s.at)} }`),
    ...SAMPLE_CLUB.hunters.map((h, i) => `.${AT.hunter(i)} { ${at(h.at)} }`),
    `.${AT.you} { ${at(SAMPLE_CLUB.you)} }`,
    `.${AT.camp} { ${at(SAMPLE_CLUB.camp)} }`,
    `.${AT.scentLabel} { ${at(SCENT_LABEL.at)} }`,
  ];
  return rules.join('\n');
}

/** About how wide a marker plate is: its longer line, plus the side padding (a little over, never under). */
const tagWidth = (name: string, detail = '') =>
  Math.max(
    textWidth(name, textScale.markerName.size, fontWidth.marker),
    textWidth(detail, textScale.markerDetail.size, fontWidth.markerDetail),
  ) *
    1.15 +
  2 * TAG_PADDING_X;

/** About how wide a map label is, across its turn. */
function labelWidth(l: SampleLabel): number {
  const { size, width } = LABEL[l.kind];
  const w = textWidth(l.text, size, width) * 1.15;
  const turn = ((l.turn ?? 0) * Math.PI) / 180;
  return w * Math.abs(Math.cos(turn)) + size * 1.2 * Math.abs(Math.sin(turn));
}

/** A thing on the aerial: its class and how far it reaches left and right of its point's x, px. */
interface Reach {
  readonly cls: string;
  readonly x: number;
  readonly left: number;
  readonly right: number;
}

/** Everything the hero draws on the aerial, with its reach (marker and plate together). */
function reaches(): Reach[] {
  const marker = (cls: string, x: number, half: number, plate: number, onLeft: boolean): Reach =>
    onLeft
      ? { cls, x, left: TAG_OFFSET.marker + plate, right: half }
      : { cls, x, left: half, right: TAG_OFFSET.marker + plate };
  const open = new Set(openStands().map((s) => s.name));
  const standHalf = sizes.standMarker / 2 + sizes.controlBorder;
  const hunterHalf = sizes.hunterMarker / 2 + sizes.freshnessRing;
  const camp = tagWidth('Camp') / 2;
  return [
    ...SAMPLE_LABELS.map((l, i) => {
      const half = labelWidth(l) / 2;
      return { cls: AT.label(i), x: l.at[0], left: half, right: half };
    }),
    ...SAMPLE_CLUB.stands.flatMap((s, i) =>
      open.has(s.name)
        ? [marker(AT.stand(i), s.at[0], standHalf, tagWidth(s.name, 'Open'), 'left' in s)]
        : [],
    ),
    ...SAMPLE_CLUB.hunters.map((h, i) =>
      marker(
        AT.hunter(i),
        h.at[0],
        hunterHalf,
        tagWidth(h.where, `${h.name}, ${hunterFreshness(h).short}`),
        'left' in h,
      ),
    ),
    {
      cls: AT.you,
      x: SAMPLE_CLUB.you[0],
      left: sizes.youPulse / 2,
      right: TAG_OFFSET.you + tagWidth('You'),
    },
    { cls: AT.camp, x: SAMPLE_CLUB.camp[0], left: camp, right: camp },
    {
      cls: AT.scentLabel,
      x: SCENT_LABEL.at[0],
      left: labelWidth(SCENT_LABEL) / 2,
      right: labelWidth(SCENT_LABEL) / 2,
    },
  ];
}

/**
 * The window widths over which each frame holds still: the phone frame up to
 * MAP_PHONE_MAX_WIDTH, then the wide frame until the aerial's right edge reaches the window's
 * (past that it slides with the window).
 */
const STILL_FRAMES = [
  { x: MAP_FRAME.phone[0], from: 0, to: MAP_PHONE_MAX_WIDTH },
  {
    x: MAP_FRAME.wide[0],
    from: MAP_PHONE_MAX_WIDTH + 1,
    to: AERIAL_WORLD.width - MAP_FRAME.wide[0],
  },
] as const;

/**
 * The map window shows the aerial from its frame's left edge to the window's width. A label or
 * marker whose plate would run off that edge is left out at the widths where it would be cut,
 * so nothing on the hero is ever half a word (site/scripts/shoot.mjs checks it).
 */
function edgeCss(): string {
  return STILL_FRAMES.flatMap((frame) =>
    reaches().flatMap(({ cls, x, left, right }) => {
      const from = Math.max(frame.from, Math.floor(x - frame.x - left));
      const to = Math.min(frame.to, Math.ceil(x - frame.x + right));
      if (to < from) return [];
      return [
        `@media (min-width: ${from}px) and (max-width: ${to}px) { .hero .${cls} { display: none; } }`,
      ];
    }),
  ).join('\n');
}

/** Text on the aerial: map ink with a dark halo, so it reads over any picture. */
const halo = `text-shadow: 0 0 3px var(--color-map-halo), 0 0 3px var(--color-map-halo), 0 0 3px var(--color-map-halo), 0 0 2px var(--color-map-halo);`;

export function mapCss(): string {
  const { width, height } = AERIAL_WORLD;
  const [wx, wy] = MAP_FRAME.wide;
  const [px, py] = MAP_FRAME.phone;
  const ring = sizes.freshnessRing;
  return `
/* The map window: .world is the whole aerial behind it, moved to frame the club. */
.mapview { position: relative; overflow: hidden; background: var(--color-map-ground); }
.world { position: absolute; left: max(-${wx}px, calc(100% - ${width}px)); top: -${wy}px; width: ${width}px; height: ${height}px; }
.world-map { display: block; width: ${width}px; height: ${height}px; max-width: none; }
.lbl, .mk, .scent { position: absolute; }
.lbl { transform: translate(-50%, -50%); color: var(--color-text); ${textStyleCss(textScale.mapLabel)}; line-height: 1.2;
  white-space: nowrap; ${halo} }
.lbl-water { color: var(--color-water-label); font-style: italic; font-stretch: ${LABEL.water.width}%;
  font-size: ${rem(LABEL.water.size)}; }
.lbl-road { font-stretch: ${LABEL.road.width}%; }
.lbl-name { ${textStyleCss(textScale.markerName)}; font-size: ${rem(LABEL.name.size)}; }
.scent { overflow: visible; }
.scent path { fill: var(--color-text); fill-opacity: ${opacity.scentFill}; stroke: var(--color-text);
  stroke-opacity: ${opacity.scentLine}; stroke-width: 1.2; stroke-dasharray: 3 4; }
${positionsCss()}

/* Markers: a shape on the point and a plate beside it. */
.mk { display: block; width: 0; height: 0; }
.mk .dot, .mk .sq { position: absolute; left: 0; top: 0; transform: translate(-50%, -50%); display: grid;
  place-items: center; background: var(--theme-plate); color: var(--theme-text);
  box-shadow: 0 0 0 1.5px var(--color-map-halo); }
.mk.hunter .dot { width: ${sizes.hunterMarker}px; height: ${sizes.hunterMarker}px; border-radius: 50%;
  border: ${ring}px solid var(--theme-fresh); ${textStyleCss(textScale.markerName)}; }
.mk.ring-stale .dot, .mk.ring-faded .dot { border-color: var(--theme-stale); border-style: dashed; }
.mk.ring-faded { opacity: ${opacity.faded}; }
.mk.stand .sq { width: ${sizes.standMarker}px; height: ${sizes.standMarker}px; border-radius: ${radii.standMarker}px;
  border: ${sizes.controlBorder}px solid var(--theme-border-control); }
.mk.you .dot { width: ${sizes.youDot}px; height: ${sizes.youDot}px; border-radius: 50%; background: var(--color-accent);
  border: ${ring}px solid var(--color-text);
  box-shadow: 0 0 0 1.5px var(--color-map-halo), 0 0 0 11px color-mix(in srgb, var(--color-accent) 30%, transparent),
    0 0 0 ${sizes.youPulse / 2 - 4}px color-mix(in srgb, var(--color-accent) 13%, transparent); }
.mk .tag { position: absolute; left: ${TAG_OFFSET.marker}px; top: 0; transform: translateY(-50%); display: block;
  padding: 4px ${TAG_PADDING_X}px 5px;
  border-radius: ${radii.markerPlate}px; background: color-mix(in srgb, var(--theme-plate) ${pct(opacity.markerPlate)}, transparent);
  color: var(--theme-text); box-shadow: var(--theme-shadow-plate); white-space: nowrap; line-height: 1.12; }
.mk.left .tag { left: auto; right: ${TAG_OFFSET.marker}px; }
.mk.you .tag { left: ${TAG_OFFSET.you}px; }
.mk.place .tag { left: 0; transform: translate(-50%, 14px); padding: 2px 7px 3px; }
.mk .tag b { display: block; ${textStyleCss(textScale.markerName)}; }
.mk.place .tag b { ${textStyleCss(textScale.mapLabel)}; font-weight: 700; }
.mk .tag i { display: block; font-style: normal; ${textStyleCss(textScale.markerDetail)}; color: var(--theme-text-secondary); }
.mk .tag i.open { color: var(--theme-fresh); }

/* Chrome floating over the map. */
.plate { background: var(--theme-plate); color: var(--theme-text); border-radius: ${radii.lg}px; box-shadow: var(--theme-shadow-plate); }
.fields { display: grid; grid-template-columns: 1fr 1fr 1.4fr 0.78fr; margin: 0; }
.field { padding: 7px 10px 8px; border-left: 1px solid var(--theme-border-subtle); min-width: 0; }
.field:first-child { border-left: 0; }
.field dt { display: flex; align-items: center; gap: 4px; ${textStyleCss(textScale.labelNarrow)}; font-size: ${rem(13)};
  color: var(--theme-text-secondary); white-space: nowrap; }
.field dd { margin: 0; ${textStyleCss(textScale.readout)}; line-height: 1.05; white-space: nowrap; }
.field dd small { ${textStyleCss(textScale.mapLabel)}; color: var(--theme-text-secondary); margin-left: 2px; }
.field .toward { display: inline-block; margin-left: 3px; vertical-align: -1px; color: var(--theme-wind);
  transform: rotate(${SAMPLE_CONDITIONS.wind.towardDeg ?? 0}deg); }
.live .mesh { display: flex; align-items: center; gap: 8px; margin: 0; padding: 8px 12px;
  border-top: 1px solid var(--theme-border-subtle); ${textStyleCss(textScale.labelNarrow)}; font-size: ${rem(15)}; }
.meshdot { width: 10px; height: 10px; border-radius: 50%; background: var(--theme-fresh); flex: none; }
.scale { position: absolute; width: ${SAMPLE_SCALE.px}px; padding-bottom: 3px; border: 3px solid var(--color-text);
  border-top: 0; color: var(--color-text); ${textStyleCss(textScale.mapLabel)}; font-weight: 700; text-align: center; ${halo} }
.map-note { position: absolute; margin: 0; color: var(--color-text); ${textStyleCss(textScale.mapLabel)}; ${halo} }

/* The home hero: the map is the page; the pitch and the readout strip float on it. */
.hero.mapview { height: ${HERO_HEIGHT.wide}px; }
.hero .pitch { position: absolute; left: 40px; top: 52px; width: 484px; padding: 30px 30px 26px; z-index: 2; }
.hero .pitch h1 { margin-bottom: 16px; }
.hero .pitch p { color: var(--theme-text-secondary); }
.hero .pitch .lede { margin: 0; }
.hero .pitch .fine { margin: 0; }
.hero .live { position: absolute; right: 24px; bottom: 20px; width: 404px; z-index: 2; }
.hero .scale { right: 452px; bottom: 24px; }
.hero .map-note { left: 40px; bottom: 16px; }
@media (max-width: ${MAP_PHONE_MAX_WIDTH}px) {
  .world { left: -${px}px; top: -${py}px; }
  .hero.mapview { height: auto; padding-top: ${HERO_HEIGHT.phone}px; }
  .hero .live { top: 10px; bottom: auto; left: 10px; right: 10px; width: auto; }
  .hero .pitch { position: relative; left: auto; top: auto; width: auto; padding: 24px 16px 22px;
    border-radius: ${radii.sheetTop}px ${radii.sheetTop}px 0 0; }
  .hero .pitch .btn { width: 100%; }
  .hero .scale, .live .mesh { display: none; }
  .hero .map-note { left: 16px; top: ${HERO_HEIGHT.phone - 40}px; bottom: auto; }
}
${edgeCss()}

/* A legend symbol: one marker or line on a scrap of map ground. */
.sym { position: relative; width: 76px; height: 60px; border-radius: 8px; background: var(--color-map-ground); overflow: hidden; }
.sym .mk, .sym .scent { left: 50%; top: 50%; }
.sym svg.draw { position: absolute; inset: 0; width: 100%; height: 100%; }
.sym .s-line { fill: none; stroke: var(--color-text); stroke-width: 4.5; }
.sym .s-inner { fill: none; stroke: var(--color-accent); stroke-width: 1.2; }
.sym .s-area { fill: var(--color-text); fill-opacity: 0.1; stroke: var(--color-text); stroke-width: 1.6;
  stroke-dasharray: 2 6; stroke-linecap: round; }
`;
}
