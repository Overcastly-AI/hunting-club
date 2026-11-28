// Card, StatTile, DataTable, EmptyState, Skeleton, Badge, Avatar, Banner and PageHeader, in the
// map-first look (docs/DESIGN.md): plates, not cards. A plate is one flat tone with a hairline
// edge and no shadow (shadows only go under things floating over imagery); its parts are
// divided by hairlines, never boxed one by one. Values read out in condensed tabular figures.
import { STATUS_TONE_COLORS, STATUS_TONES, type StatusTone } from '@huntclub/design';
import { AVATAR, SHELL, TABLE_ROW_HEIGHT, type AvatarSize } from '../sizes';
import {
  color,
  DESKTOP,
  FOCUS_OUTLINE,
  focusRing,
  gap,
  HAIR,
  PHONE,
  TAP,
  text,
  transition,
  visuallyHidden,
} from './shared';

/** A plate's face: the plate tone, a hairline edge, the plate radius. No shadow on the page. */
const plateFace = `background: ${color('plate')}; border: ${HAIR}; border-radius: var(--radius-lg);`;

const card = `
.ui-card { ${plateFace} padding: ${gap(4)}; color: ${color('text')}; min-width: 0; }
.ui-card__header { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between;
  gap: ${gap(3)}; margin: calc(-1 * ${gap(1)}) 0 ${gap(4)}; padding-bottom: ${gap(3)}; border-bottom: ${HAIR}; }
.ui-card__title { ${text('title3')}; margin: 0; }
.ui-card__footer { ${text('caption')}; color: ${color('textSecondary')}; margin: ${gap(4)} calc(-1 * ${gap(4)}) calc(-1 * ${gap(4)});
  padding: ${gap(3)} ${gap(4)}; border-top: ${HAIR}; }
${DESKTOP} { .ui-card { padding: ${gap(5)}; }
  .ui-card__footer { margin: ${gap(5)} calc(-1 * ${gap(5)}) calc(-1 * ${gap(5)}); padding: ${gap(3)} ${gap(5)}; } }
`;

/**
 * The readout strip: one plate of labelled cells divided by hairlines (the conditions strip on
 * the phone, the site and My club), not a row of tiles. The 1 px gap shows the hairline tone.
 */
const statTile = `
.ui-stat-grid { ${plateFace} display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1px;
  background: ${color('borderSubtle')}; overflow: hidden; list-style: none; margin: 0; padding: 0; }
${DESKTOP} { .ui-stat-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); } }
/* Three cells (the conditions): the last is a little wider, so "Overdue at" sits on one line
   and all three values share a baseline. */
.ui-stat-grid.ui-stat-grid--three { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1.2fr); }
.ui-stat-grid > li { display: grid; background: ${color('plate')}; min-width: 0; }
.ui-stat-tile { display: grid; align-content: start; gap: 2px; padding: ${gap(2)} ${gap(3)} ${gap(3)};
  color: ${color('text')}; text-decoration: none; min-width: 0; min-height: 76px; }
a.ui-stat-tile { ${transition('background-color')} }
a.ui-stat-tile:hover { background: ${color('raised')}; }
a.ui-stat-tile:focus-visible { ${FOCUS_OUTLINE} outline-offset: -3px; }
.ui-stat-tile__label { ${text('caption')}; font-weight: 600; color: ${color('textSecondary')};
  display: flex; align-items: center; gap: ${gap(1)}; }
.ui-stat-tile__value { margin: 0; overflow-wrap: anywhere; }
.ui-stat-tile__hint { ${text('caption')}; color: ${color('textSecondary')}; }
`;

/** A table on one plate: a raised head, hairlines between rows, the selected row raised. */
const table = `
.ui-table-wrap { ${plateFace} overflow-x: auto; }
.ui-table-wrap--scroll { max-height: 70vh; overflow-y: auto; }
.ui-table { width: 100%; border-collapse: separate; border-spacing: 0; color: ${color('text')}; }
.ui-table th { ${text('caption')}; font-weight: 700; color: ${color('textSecondary')}; text-align: left;
  height: ${TAP}; padding: 0 ${gap(3)}; background: ${color('raised')}; position: sticky; top: 0; z-index: 1;
  white-space: nowrap; }
.ui-table__sort { ${text('caption')}; font-weight: 700; display: inline-flex; align-items: center; gap: ${gap(1)};
  min-height: ${TAP}; margin: 0 calc(-1 * ${gap(2)}); padding: 0 ${gap(2)}; border: 0; border-radius: var(--radius-sm);
  background: transparent; color: inherit; cursor: pointer; }
.ui-table__sort:hover { color: ${color('text')}; background: ${color('pressed')}; }
.ui-table td { height: ${TABLE_ROW_HEIGHT}px; padding: ${gap(2)} ${gap(3)}; border-top: ${HAIR}; vertical-align: middle; }
.ui-table tbody tr:hover td { background: ${color('raised')}; }
.ui-table tbody tr.ui-table__empty-row:hover td { background: transparent; }
.ui-table__actions { width: 1%; white-space: nowrap; text-align: right; }
.ui-table__label { ${text('caption')}; font-weight: 600; color: ${color('textSecondary')}; display: none; }
${PHONE} {
  .ui-table-wrap { overflow-x: visible; }
  .ui-table, .ui-table tbody, .ui-table tr, .ui-table td { display: block; }
  .ui-table thead { ${visuallyHidden} }
  .ui-table tbody tr { padding: ${gap(3)}; }
  .ui-table tbody tr + tr { border-top: ${HAIR}; }
  .ui-table tbody tr:hover td { background: transparent; }
  .ui-table td { height: auto; padding: ${gap(1)} 0; border: 0; display: grid;
    grid-template-columns: minmax(0, 2fr) minmax(0, 3fr); gap: ${gap(3)}; align-items: baseline; }
  .ui-table td.ui-table__primary { display: block; padding-bottom: ${gap(2)}; }
  .ui-table td.ui-table__actions { display: block; width: auto; text-align: left; padding-top: ${gap(2)}; }
  .ui-table__label { display: block; }
  .ui-table tr.ui-table__empty-row td { display: block; }
}
`;

/** Left aligned like everything else: the icon in quiet ink, the words, one action. */
const emptyState = `
.ui-empty { display: grid; justify-items: start; gap: ${gap(2)}; padding: ${gap(6)} ${gap(4)}; color: ${color('text')}; }
.ui-empty__icon { display: grid; color: ${color('textSecondary')}; margin-bottom: ${gap(1)}; }
.ui-empty__title { ${text('title3')}; margin: 0; }
.ui-empty__body { ${text('body')}; color: ${color('textSecondary')}; max-width: 48ch; margin: 0; }
.ui-empty__action { margin-top: ${gap(3)}; }
`;

const skeleton = `
.ui-skeleton { display: block; border-radius: var(--radius-sm); background: ${color('raised')};
  background-image: linear-gradient(90deg, ${color('raised')} 0%, ${color('pressed')} 50%, ${color('raised')} 100%);
  background-size: 200% 100%; animation: ui-shimmer 1.4s linear infinite; }
.ui-skeleton--text { height: 1rem; margin: ${gap(1)} 0; }
.ui-skeleton--title { height: 1.5rem; width: 40%; margin-bottom: ${gap(2)}; }
.ui-skeleton--tile { height: 76px; border-radius: 0; }
.ui-skeleton--short { width: 60%; }
/* A map that is still loading: the map's own height (My club), with no corners on the bleed page. */
.ui-skeleton--map { height: ${SHELL.phoneMapHeight}px; border-radius: 0; }
${DESKTOP} { .ui-skeleton--map { height: 100vh; } }@keyframes ui-shimmer { from { background-position: 100% 0; } to { background-position: -100% 0; } }
@media (prefers-reduced-motion: reduce) { .ui-skeleton { animation: none; background-image: none; } }
.ui-skeleton-group { display: grid; gap: ${gap(2)}; }`;

/** `.block--tone` rules: each tone's text and icon colour on its background (STATUS_TONE_COLORS). */
const toneCss = (block: string, tones: readonly StatusTone[]) =>
  tones
    .map((tone) => {
      const { foreground, background } = STATUS_TONE_COLORS[tone];
      return `.${block}--${tone} { background: ${color(background)}; color: ${color(foreground)}; }`;
    })
    .join('\n');

/** Banners have no neutral tone. */
const BANNER_TONES = STATUS_TONES.filter((t) => t !== 'neutral');

/** A small squared tag, like a marker plate: icon and word on the tone's tint. Never a pill. */
const badge = `
.ui-badge { ${text('badge')}; display: inline-flex; align-items: center; gap: ${gap(1)}; padding: 1px ${gap(2)} 1px 6px;
  border-radius: var(--radius-sm); white-space: nowrap; vertical-align: middle; }
.ui-badge svg { flex: none; }
${toneCss('ui-badge', STATUS_TONES)}
`;

const avatarSizes = (Object.keys(AVATAR) as AvatarSize[])
  .map((size) => `.ui-avatar--${size} { width: ${AVATAR[size]}px; height: ${AVATAR[size]}px; }`)
  .join('\n');

/** Initials in a ring, like a hunter on the map; the ring is a hairline (no freshness here). */
const avatar = `
.ui-avatar { display: inline-grid; place-items: center; flex: none; border-radius: var(--radius-full);
  ${text('markerName')}; border: 2px solid ${color('borderSubtle')}; background: ${color('plate')};
  color: ${color('text')}; user-select: none; }
.ui-avatar--you { background: ${color('accent')}; border-color: ${color('accentBorder')}; color: ${color('onAccent')}; }
${avatarSizes}
`;

/** The tone's wash with its own 1.5 px edge, like Ask for a Hand: no shadow, no gradient. */
const banner = `
.ui-banner { display: flex; flex-wrap: wrap; align-items: flex-start; gap: ${gap(3)}; padding: ${gap(3)} ${gap(4)};
  border-radius: var(--radius-md); border: var(--control-border) solid currentColor; }
.ui-banner__icon { flex: none; margin-top: 2px; }
.ui-banner__body { flex: 1 1 20ch; display: grid; gap: 2px; min-width: 0; }
.ui-banner__title { ${text('label')}; margin: 0; }
.ui-banner__text { ${text('body')}; margin: 0; }
.ui-banner__action { flex: none; align-self: center; }
${toneCss('ui-banner', BANNER_TONES)}
`;

const pageHeader = `
.ui-page-header { display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between;
  gap: ${gap(4)}; margin-bottom: ${gap(5)}; color: ${color('text')}; }
.ui-page-header__main { display: grid; gap: ${gap(1)}; min-width: 0; flex: 1 1 32ch; }
.ui-page-header__back { justify-self: start; margin-left: calc(-1 * ${gap(1)}); }
.ui-page-header__title-row { display: flex; flex-wrap: wrap; align-items: center; gap: ${gap(3)}; }
.ui-page-header__title { margin: 0; }
.ui-page-header__title:focus { outline: none; }
.ui-page-header__title:focus-visible { ${FOCUS_OUTLINE} }
.ui-page-header__description { ${text('bodyLarge')}; color: ${color('textSecondary')}; max-width: 68ch; margin: 0; }
.ui-page-header__actions { display: flex; flex-wrap: wrap; gap: ${gap(2)}; }
${PHONE} {
  .ui-page-header__actions { width: 100%; }
  .ui-page-header__actions > .ui-button { flex: 1 1 0; }
  .ui-page-header__actions > .ui-button--primary { order: -1; flex: 1 1 100%; }
}
`;

/** Forced colours drop the tint: an outline keeps a badge reading as one tag. */
const forcedColors = `@media (forced-colors: active) { .ui-badge { border: 1px solid currentColor; } }`;

export const contentCss = () =>
  [
    card,
    statTile,
    table,
    emptyState,
    skeleton,
    badge,
    avatar,
    banner,
    pageHeader,
    forcedColors,
    focusRing(['.ui-table__sort', '.ui-table-wrap']),
  ].join('\n');
