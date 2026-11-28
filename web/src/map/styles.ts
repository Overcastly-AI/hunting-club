// The club plan's stylesheet (ClubMap.tsx). The ground, grid, property line and map text use
// the map's own colours (the same in both themes, like the picture); stands and their plates
// are chrome, so they follow the theme.
import { boundary, fontFamily, fontWidth, sizes } from '@huntclub/design';
import {
  color,
  FLOATING,
  DESKTOP,
  gap,
  HAIR,
  PHONE,
  TAP,
  text,
  visuallyHidden,
} from '../components/ui/styles/shared';

/** A map colour from @huntclub/design (`--color-*`, not themed). */
const mapColor = (name: 'text' | 'mapHalo' | 'mapGround' | 'mapGrid') =>
  `var(--color-${name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)})`;

/** Map text: 3 px of halo behind it, so it reads on any ground. */
const INSET = 'var(--map-chrome-inset)';

const halo = `stroke: ${mapColor('mapHalo')}; stroke-width: ${sizes.mapHaloWidth}px; paint-order: stroke;
  stroke-linejoin: round;`;

export const mapCss = () => `
.plan { position: relative; overflow: hidden; background: ${mapColor('mapGround')}; isolation: isolate; }
.plan__svg { position: absolute; inset: 0; display: block; }
.plan__ground { fill: ${mapColor('mapGround')}; }
.plan__grid { stroke: ${mapColor('mapGrid')}; stroke-opacity: 0.12; stroke-width: 1; fill: none; }
.plan__area { fill: ${mapColor('text')}; fill-opacity: 0.06; stroke: ${mapColor('text')}; stroke-width: 1.5;
  stroke-dasharray: 2 5; stroke-linecap: round; }
.plan__line { fill: none; stroke: ${boundary.stroke}; stroke-width: ${boundary.width}; stroke-linejoin: round; }
.plan__line-inner { fill: none; stroke: ${boundary.innerLine}; stroke-width: ${boundary.innerLineWidth};
  stroke-linejoin: round; }
.plan__line-halo { display: none; fill: none; stroke: ${boundary.onLight.halo}; stroke-width: ${boundary.onLight.haloWidth};
  stroke-linejoin: round; }
/* On Topo's light paper the white line would vanish: wider and solid, over a dark halo. */
.plan--light .plan__line-halo { display: inline; }
.plan--light .plan__line { stroke: ${boundary.onLight.stroke}; stroke-width: ${boundary.onLight.width}; }
.plan--light .plan__line-inner { stroke-width: ${boundary.onLight.innerLineWidth}; }
.plan--light .plan__area { stroke: ${boundary.onLight.halo}; fill: ${boundary.onLight.halo}; }
.plan__label { ${text('markerDetail')}; font-weight: 750; fill: ${mapColor('text')}; ${halo} }
.plan__stand-box { fill: ${color('plate')}; stroke: ${color('borderControl')}; stroke-width: var(--control-border); }
.plan__stand-icon { color: ${color('text')}; }
.plan__stand--closed .plan__stand-icon { color: ${color('textSecondary')}; }
/* A stand's name: no box, 13 px semibold on a 2 px themed halo (mapChrome.labels.text). */
.plan__stand-label { font-family: '${fontFamily}', sans-serif; font-size: var(--map-chrome-label-size);
  font-weight: var(--map-chrome-label-weight); fill: var(--map-chrome-label-color);
  stroke: var(--map-chrome-label-halo-color); stroke-width: calc(2 * var(--map-chrome-label-halo));
  stroke-linejoin: round; paint-order: stroke; }
.plan__stand--closed .plan__stand-label { fill: ${color('textSecondary')}; }
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
/* A map that pans and zooms owns every finger on it, on any layer (the ground, a stand, a name, a
   corner) and its chrome: a pinch zooms the map, never the page, and no drag scrolls the page. */
.plan--interactive, .plan--interactive * { touch-action: none; }
/* A map that takes taps: the ground takes drags (no page scroll or browser zoom over it). */
.plan__svg--ground { touch-action: none; cursor: crosshair; }
.plan--interactive .plan__svg--ground { cursor: grab; }
.plan--interactive .plan__svg--ground:active { cursor: grabbing; }
.plan__svg--ground:focus { outline: none; }
.plan__svg--ground:focus-visible { outline: 3px solid ${color('focusRing')}; outline-offset: -3px; }
/* Drawing the property line (PropertyLineEditor): the corners take taps; the rest goes to the map. */
.plan__draw { pointer-events: none; }
.draw__line { fill: none; stroke: ${boundary.stroke}; stroke-width: 3; stroke-dasharray: 8 6; stroke-linejoin: round; }
.draw__cross { stroke: ${mapColor('text')}; stroke-width: 2; ${halo} }
.draw__corner { pointer-events: auto; cursor: move; }
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
/* A phone keeps the stand editor short: the how-to is read out, not shown. */
${PHONE} { .draw--stand .draw__how { ${visuallyHidden} } }
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
${chromeCss}
`;

/**
 * The map chrome (docs/DESIGN.md "Map chrome", sizes from mapChrome as --map-chrome-*): the top
 * pill, the right-edge icon stack, the Layers popover, the bottom sheet and the draw bar.
 * Everything marked map-fade fades while the map moves and comes back when it is still.
 */
const chromeCss = `
/* Fully gone while the map moves (or under a full sheet), not dimmed: hidden once faded, so
   nothing under it is blocked and nothing faded takes a tap. */
.map-fade { transition: opacity var(--map-chrome-fade) var(--motion-easing), visibility 0s; }
.plan--moving .map-fade, .plan--covered .map-fade { opacity: 0; visibility: hidden; pointer-events: none;
  transition: opacity var(--map-chrome-fade) var(--motion-easing), visibility 0s linear var(--map-chrome-fade); }
.map-stack { position: absolute; z-index: 2; top: ${INSET}; right: ${INSET}; display: flex; flex-direction: column;
  align-items: flex-end; gap: var(--map-chrome-stack-gap); }
.map-stack .map-stack__button, .map-stack__zoom .ui-button { width: var(--map-chrome-stack-button);
  height: var(--map-chrome-stack-button); min-height: var(--map-chrome-stack-button); padding: 0;
  display: inline-flex; align-items: center; justify-content: center; color: ${color('text')}; ${FLOATING}
  border: 0; }
.map-stack .map-stack__button:hover, .map-stack__zoom .ui-button:hover,
  .map-stack .map-stack__button[aria-expanded='true'] { background: ${color('raised')}; }
/* The split zoom: one plate, + over -, desktop only (touch zooms with the fingers). */
.map-stack__zoom { display: none; flex-direction: column; width: var(--map-chrome-zoom-width);
  height: var(--map-chrome-zoom-height); overflow: hidden; ${FLOATING} }
.map-stack__zoom .ui-button { box-shadow: none; border-radius: 0; }
.map-stack__zoom .ui-button + .ui-button { border-top: ${HAIR}; }
${DESKTOP} { .map-stack__zoom { display: flex; } }
.map-stack__note { ${text('caption')}; width: min(260px, calc(100vw - 4 * var(--map-chrome-inset))); margin: 0;
  padding: ${gap(2)} ${gap(3)}; color: ${color('text')}; ${FLOATING} }
/* Layers opens beside the stack, never over it: the basemap, two switches and Fit property. */
.map-layers.ui-popover__panel:not([hidden]) { display: grid; gap: ${gap(2)}; min-width: 0; padding: ${gap(2)};
  width: min(220px, calc(100vw - 3 * ${INSET} - var(--map-chrome-stack-button) - ${gap(2)})); }
.map-layers .ui-choice-group { margin: 0; }
.map-layers__switches { display: grid; border-top: ${HAIR}; border-bottom: ${HAIR}; }
.map-layers .ui-button { justify-self: stretch; }
/* The top pill: the next time only, one line, 48 by about 200. On phones and tablets it is a
   button whose tap drops the conditions card; on a desktop plain text (no hover, no pointer). */
.map-pill { position: absolute; z-index: 2; top: ${INSET}; left: ${INSET}; box-sizing: border-box;
  width: max-content; min-width: var(--map-chrome-pill-width);
  max-width: min(var(--map-chrome-pill-max-width), calc(100% - 3 * ${INSET} - var(--map-chrome-stack-button)));
  margin: 0; overflow: hidden; color: ${color('text')}; ${FLOATING} }
.map-pill--open { width: min(var(--map-chrome-pill-max-width), calc(100% - 3 * ${INSET} - var(--map-chrome-stack-button))); }
.map-pill__face { display: flex; align-items: center; gap: ${gap(2)}; box-sizing: border-box;
  height: var(--map-chrome-pill-height); padding: 0 ${gap(3)}; }
.map-pill__icon { flex: none; color: ${color('textSecondary')}; }
.map-pill__next { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.map-pill__toggle { width: 100%; margin: 0; border: 0; border-radius: var(--radius-lg); background: transparent; font: inherit;
  color: inherit; text-align: left; cursor: pointer; }
.map-pill__toggle:hover { background: color-mix(in srgb, ${color('raised')} 50%, transparent); }
.map-pill__toggle:focus-visible { outline: 3px solid ${color('focusRing')}; outline-offset: -3px; }
.map-pill__chevron { flex: none; color: ${color('textSecondary')}; transition: rotate var(--motion-fast) var(--motion-easing); }
.map-pill__toggle[aria-expanded='true'] .map-pill__chevron { rotate: 180deg; }
.map-pill__card { border-top: ${HAIR}; }
.map-pill__card[hidden] { display: none; }
.map-pill__card .ui-stat-grid { border: 0; border-radius: 0; }
/* Editing: one line, what is being edited, then Done and Cancel. The stack hides while editing,
   so the pill may run the map's width ("Drawing property line" whole on an iPhone SE). */
.map-pill--edit { display: flex; align-items: center; gap: ${gap(1)}; height: var(--map-chrome-pill-height);
  padding: 0 0 0 ${gap(3)}; max-width: calc(100% - 2 * ${INSET}); }
.map-pill__edit-label { ${text('label')}; font-weight: 750; font-stretch: ${fontWidth.title}%; flex: 1; min-width: 0; margin: 0 ${gap(1)} 0 0;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.map-pill--edit .ui-button { flex: none; border-radius: 0; }
.map-pill--edit .ui-button--primary { padding: 0 ${gap(3)}; }
.map-pill--edit .ui-button--secondary { border: 0; background: transparent; }
/* The footer line's credit is never covered: it sits left, its clearance above the sheet, and
   rides the sheet (--map-footer-lift, set by MapSheet; live, with no easing, while dragging). */
.plan__footer { pointer-events: none; translate: 0 calc(-1 * var(--map-footer-lift, 0px));
  transition: opacity var(--map-chrome-fade) var(--motion-easing), visibility 0s, translate var(--motion-base) var(--motion-easing); }
*:has(> .map-sheet--dragging) .plan__footer { transition: none; }
/* The bottom sheet (phones and tablets): peek, half, full; the handle zone drags it. */
.map-sheet { position: absolute; z-index: 3; left: 0; right: 0; bottom: 0; display: flex; flex-direction: column;
  background: ${color('plate')}; border-radius: var(--radius-xl) var(--radius-xl) 0 0; box-shadow: ${color('shadowPlate')};
  overflow: hidden; transition: height var(--motion-base) var(--motion-easing); }
.map-sheet--peek { height: var(--map-chrome-sheet-peek); }
.map-sheet--half { height: var(--map-chrome-sheet-half); }
.map-sheet--full { height: var(--map-chrome-sheet-full); }
.map-sheet--dragging { height: var(--sheet-drag); transition: none; }
.map-sheet__handle { position: relative; flex: none; display: flex; align-items: center; gap: ${gap(2)};
  min-height: var(--map-chrome-sheet-handle); padding: ${gap(3)} 0 ${gap(1)} ${gap(4)}; touch-action: none;
  cursor: grab; user-select: none; -webkit-user-select: none; }
.map-sheet--full .map-sheet__handle { border-bottom: ${HAIR}; }
.map-sheet__title { ${text('title3')}; margin: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.map-sheet__grabber { position: absolute; top: 6px; left: 50%; translate: -50% 0; width: ${sizes.grabberWidth}px;
  height: ${sizes.grabberHeight}px; border-radius: var(--radius-full); background: ${color('borderControl')}; }
.map-sheet__summary { flex: 1; min-width: 0; }
.map-sheet__toggle { flex: none; display: inline-flex; align-items: center; justify-content: center;
  width: ${TAP}; height: ${TAP}; margin: 0; padding: 0; border: 0; border-radius: var(--radius-md);
  background: transparent; color: ${color('text')}; cursor: pointer; }
.map-sheet__toggle:hover { background: ${color('raised')}; }
.map-sheet__toggle:focus-visible { outline: 3px solid ${color('focusRing')}; outline-offset: -3px; }
.map-sheet__body { flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; display: flex;
  flex-direction: column; gap: ${gap(6)}; padding: ${gap(2)} ${gap(4)} ${gap(8)}; }
/* The draw bar: the editor's count and its tools, one 48 px row. */
.draw-bar { display: flex; align-items: center; gap: ${gap(1)}; min-height: ${TAP}; }
.draw-bar .draw__count { flex: 1; min-width: 0; ${text('label')}; overflow: hidden; text-overflow: ellipsis;
  white-space: nowrap; }
`;
