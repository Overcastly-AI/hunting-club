// The club plan's stylesheet (ClubMap.tsx). The ground, grid, property line and map text use
// the map's own colours (the same in both themes, like the picture); stands and their plates
// are chrome, so they follow the theme.
import { boundary, opacity, sizes, themeVar } from '@huntclub/design';
import { color, gap, HAIR, PHONE, TAP, text, visuallyHidden } from '../components/ui/styles/shared';
import { DRAW_BAR_HEIGHT } from './plan';

/** A map colour from @huntclub/design (`--color-*`, not themed). */
const mapColor = (name: 'text' | 'mapHalo' | 'mapGround' | 'mapGrid') =>
  `var(--color-${name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)})`;

/** Map text: 3 px of halo behind it, so it reads on any ground. */
const halo = `stroke: ${mapColor('mapHalo')}; stroke-width: ${sizes.mapHaloWidth}px; paint-order: stroke;
  stroke-linejoin: round;`;

export const mapCss = () => `
.plan { position: relative; overflow: hidden; background: ${mapColor('mapGround')}; isolation: isolate; }
.plan__svg { position: absolute; inset: 0; display: block; }
.plan__ground { fill: ${mapColor('mapGround')}; }
.plan__grid { stroke: ${mapColor('mapGrid')}; stroke-opacity: 0.12; stroke-width: 1; fill: none; }
.plan__area { fill: ${mapColor('text')}; fill-opacity: 0.06; stroke: ${mapColor('text')}; stroke-width: 1.5;
  stroke-dasharray: 2 5; stroke-linecap: round; }
.plan__line { fill: none; stroke: ${boundary.stroke}; stroke-width: 4; stroke-linejoin: round; }
.plan__line-inner { fill: none; stroke: ${boundary.innerLine}; stroke-width: ${boundary.innerLineWidth};
  stroke-linejoin: round; }
.plan__label { ${text('markerDetail')}; font-weight: 750; fill: ${mapColor('text')}; ${halo} }
.plan__stand-box { fill: ${color('plate')}; stroke: ${color('borderControl')}; stroke-width: var(--control-border); }
.plan__stand-icon { color: ${color('text')}; }
.plan__stand--closed .plan__stand-icon { color: ${color('textSecondary')}; }
.plan__plate { fill: ${color('plate')}; fill-opacity: ${opacity.markerPlate}; stroke: ${mapColor('mapHalo')};
  stroke-opacity: 0.5; stroke-width: 1; }
.plan__plate-name { ${text('markerName')}; fill: ${color('text')}; }
.plan__plate-detail { ${text('markerDetail')}; fill: ${color('textSecondary')}; }
.plan__plate-detail--open { fill: ${themeVar('fresh')}; }
.plan__scale-bar { fill: none; stroke: ${mapColor('text')}; stroke-width: 2; ${halo} }
.plan__scale-label { ${text('markerDetail')}; fill: ${mapColor('text')}; ${halo} }
.plan__credit { ${text('markerDetail')}; font-weight: 600; fill: ${mapColor('text')}; ${halo} }
/* Stands that open their details: the layer lets taps through except on a stand, whose 48 px square
   takes them. Focus draws the ring around that square; the open stand's marker is the selected
   item (orange, docs/DESIGN.md: one of orange's three jobs). */
.plan__stands { pointer-events: none; }
.plan__stand--button { pointer-events: auto; cursor: pointer; }
.plan__stand--button:focus { outline: none; }
.plan__stand-hit { fill: transparent; stroke: none; }
.plan__stand--button:focus-visible .plan__stand-hit { stroke: ${color('focusRing')}; stroke-width: 3; }
.plan__stand--button:hover .plan__stand-box { fill: ${color('raised')}; }
.plan__stand--selected .plan__stand-box { stroke: ${color('accentBorder')}; stroke-width: ${sizes.selectedBorder}px;
  fill: ${color('accent')}; }
.plan__stand--selected .plan__stand-icon { color: ${color('onAccent')}; }
/* A map that pans and zooms: the ground takes drags (no page scroll or browser zoom over it). */
.plan__svg--ground { touch-action: none; cursor: crosshair; }
.plan--interactive .plan__svg--ground { cursor: grab; }
.plan--interactive .plan__svg--ground:active { cursor: grabbing; }
.plan__svg--ground:focus { outline: none; }
.plan__svg--ground:focus-visible { outline: 3px solid ${color('focusRing')}; outline-offset: -3px; }
/* The map's controls: one plate at the right edge, above the credit (docs/DESIGN.md). */
.plan__controls { position: absolute; right: ${gap(3)}; bottom: ${gap(8)}; display: flex; flex-wrap: wrap;
  justify-content: flex-end; align-items: center; gap: ${gap(2)}; width: max-content;
  max-width: min(440px, calc(100% - 2 * ${gap(3)})); padding: ${gap(2)}; border-radius: var(--radius-lg);
  background: ${color('plate')}; box-shadow: ${color('shadowPlate')}; }
.plan__controls .ui-choice-group { margin: 0; }
.plan__controls-note { ${text('caption')}; color: ${color('textSecondary')}; margin: 0; flex: 1 1 100%; }
/* Drawing the property line (PropertyLineEditor): the corners take taps; the rest goes to the map. */
.plan__draw { pointer-events: none; }
.draw__line { fill: none; stroke: ${boundary.stroke}; stroke-width: 3; stroke-dasharray: 8 6; stroke-linejoin: round; }
.draw__cross { stroke: ${mapColor('text')}; stroke-width: 2; ${halo} }
.draw__corner { pointer-events: auto; cursor: move; touch-action: none; }
.draw__corner:focus { outline: none; }
.draw__hit { fill: transparent; }
.draw__corner:focus-visible .draw__hit { stroke: ${color('focusRing')}; stroke-width: 3; }
.draw__dot { fill: ${color('plate')}; stroke: ${color('text')}; stroke-width: ${sizes.selectedBorder}px; }
.draw__corner--closes .draw__dot { stroke-width: 4px; }
.draw__corner--selected .draw__dot { fill: ${color('accent')}; stroke: ${color('accentBorder')}; }
.draw { display: grid; gap: ${gap(2)}; padding: ${gap(3)} ${gap(4)} ${gap(4)}; border-top: ${HAIR}; }
.draw__how, .draw__count, .draw__problem, .draw__error { margin: 0; }
.draw__how { ${text('body')}; }
.draw__count { color: ${color('textSecondary')}; }
.draw__problem { ${text('label')}; color: ${color('text')}; }
.draw__error { ${text('label')}; color: ${color('danger')}; }
.draw__actions { display: flex; flex-wrap: wrap; gap: ${gap(2)}; }
/* On a phone: the draw tools as a bar along the map's bottom, More tools opening above it (and over the map's controls). */
.plan__controls.plan__controls--lifted { bottom: calc(${DRAW_BAR_HEIGHT}px + ${gap(8)}); }
.draw-bar { position: absolute; z-index: 1; left: 0; right: 0; bottom: 0; display: grid; gap: ${gap(2)};
  min-height: ${DRAW_BAR_HEIGHT}px; padding: ${gap(2)} ${gap(3)}; background: ${color('plate')}; border-radius: var(--radius-xl) var(--radius-xl) 0 0;
  box-shadow: ${color('shadowPlate')}; }
.draw-bar__row { display: flex; align-items: center; gap: ${gap(2)}; }
.draw-bar__row .draw__count, .draw-bar__space { flex: 1; min-width: 0; }
.draw-bar__more { display: grid; gap: ${gap(2)}; padding-bottom: ${gap(2)}; border-bottom: ${HAIR}; }
/* A phone keeps the stand editor short: the how-to is read out, not shown. */
${PHONE} { .draw--stand .draw__how { ${visuallyHidden} } }
${PHONE} { .plan__controls { right: ${gap(2)}; bottom: ${gap(6)}; max-width: calc(100% - 2 * ${gap(2)}); } }
.plan__empty { position: absolute; left: 50%; top: 50%; translate: -50% -50%; width: min(36ch, calc(100% - 2 * ${gap(4)}));
  padding: ${gap(3)} ${gap(4)}; border-radius: var(--radius-lg); background: ${color('plate')};
  box-shadow: ${color('shadowPlate')}; color: ${color('text')}; margin: 0; }
.plan__empty .ui-empty { padding: 0; }
/* A stand's details (StandDrawer): labelled rows divided by hairlines, then its recent harvests. */
.stand-facts { margin: 0; }
.stand-facts__row { display: grid; grid-template-columns: 9rem minmax(0, 1fr); align-items: center; gap: ${gap(3)};
  min-height: ${TAP}; padding: ${gap(2)} 0; border-bottom: ${HAIR}; }
.stand-facts dt { ${text('label')}; color: ${color('textSecondary')}; }
.stand-facts dd { ${text('body')}; margin: 0; min-width: 0; }
.stand-facts__type { display: flex; align-items: center; gap: ${gap(2)}; }
.stand-facts__notes { white-space: pre-line; overflow-wrap: anywhere; }
.stand-edit { margin-top: ${gap(4)}; }
.draw__confirm { display: grid; gap: ${gap(2)}; flex: 1 1 100%; }
.draw__fields { display: grid; grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr)); gap: ${gap(3)}; }
.plan__area-button .plan__label { pointer-events: none; }
.stand-harvests { display: grid; gap: ${gap(3)}; justify-items: start; margin-top: ${gap(6)}; }
.stand-harvests > .rows { justify-self: stretch; }
.stand-harvests__title { ${text('title3')}; margin: 0; }
.stand-harvests__empty { ${text('body')}; color: ${color('textSecondary')}; margin: 0; }
`;
