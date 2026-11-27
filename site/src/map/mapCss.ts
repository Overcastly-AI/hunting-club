// CSS for the map window, its markers, plates and the readout strip (docs/DESIGN.md). Every
// colour is a token: chrome from the theme (--theme-*), the map's own ink (text on the aerial,
// its halo, the you dot and the property line) from `colors` (--color-*), the same in both
// themes because the picture is. Marker positions are classes generated from SAMPLE_CLUB.
import { AERIAL_WORLD, type AerialPoint } from '@huntclub/design/aerial';
import { opacity, radii, rem, sizes, textScale, textStyleCss } from '@huntclub/design';
import { AT } from './MapView';
import { SAMPLE_CLUB, SAMPLE_CONDITIONS, SAMPLE_LABELS, SAMPLE_SCALE } from './sampleClub';

/** At this width and below the hero stacks: the map on top, the pitch rising over it as a sheet. */
export const MAP_PHONE_MAX_WIDTH = 700;

/** Which part of the aerial each layout frames: its top-left corner, in aerial px. */
export const MAP_FRAME = {
  wide: [240, 350],
  phone: [790, 470],
} as const satisfies Record<string, AerialPoint>;

/** The hero's height on a wide screen, and the map's height above the sheet on a phone. */
export const HERO_HEIGHT = { wide: 664, phone: 300 } as const;

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
    `.${AT.scentLabel} { ${at([SAMPLE_CLUB.you[0] + 128, SAMPLE_CLUB.you[1] + 58])} }`,
  ];
  return rules.join('\n');
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
.world { position: absolute; left: -${wx}px; top: -${wy}px; width: ${width}px; height: ${height}px; }
.world-map { display: block; width: ${width}px; height: ${height}px; max-width: none; }
.lbl, .mk, .scent { position: absolute; }
.lbl { transform: translate(-50%, -50%); color: var(--color-text); ${textStyleCss(textScale.mapLabel)}; line-height: 1.2;
  white-space: nowrap; ${halo} }
.lbl-water { color: var(--color-water-label); font-style: italic; font-stretch: 90%; font-size: ${rem(14)}; }
.lbl-road { font-stretch: 80%; }
.lbl-name { ${textStyleCss(textScale.markerName)}; font-size: ${rem(14)}; }
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
.mk .tag { position: absolute; left: 28px; top: 0; transform: translateY(-50%); display: block; padding: 4px 8px 5px;
  border-radius: ${radii.markerPlate}px; background: color-mix(in srgb, var(--theme-plate) ${pct(opacity.markerPlate)}, transparent);
  color: var(--theme-text); box-shadow: var(--theme-shadow-plate); white-space: nowrap; line-height: 1.12; }
.mk.left .tag { left: auto; right: 28px; }
.mk.you .tag { left: 20px; }
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
