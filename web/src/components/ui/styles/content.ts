// Card, StatTile, DataTable, EmptyState, Skeleton, Badge, Avatar, Banner and PageHeader.
import { AVATAR, ICON, TABLE_ROW_HEIGHT, type AvatarSize } from '../sizes';
import {
  color,
  DESKTOP,
  focusRing,
  gap,
  PHONE,
  TAP,
  text,
  transition,
  visuallyHidden,
} from './shared';

/** A card's face: surface-1 with a 1 px border (never a card without one), radius-lg. */
const cardFace = `background: ${color('surface-1')}; border: 1px solid ${color('border-subtle')};
  border-radius: var(--radius-lg); box-shadow: ${color('shadow-card')};`;

const card = `
.ui-card { ${cardFace} padding: ${gap(5)}; color: ${color('text')}; min-width: 0; }
.ui-card__header { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between;
  gap: ${gap(3)}; margin-bottom: ${gap(4)}; }
.ui-card__title { ${text('title3')}; margin: 0; }
.ui-card__footer { ${text('caption')}; color: ${color('text-secondary')}; margin-top: ${gap(5)};
  padding-top: ${gap(4)}; border-top: 1px solid ${color('border-subtle')}; }
${DESKTOP} { .ui-card { padding: ${gap(6)}; } }
`;

const statTile = `
.ui-stat-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: ${gap(4)};
  list-style: none; margin: 0; padding: 0; }
${DESKTOP} { .ui-stat-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); gap: ${gap(6)}; } }
.ui-stat-tile { ${cardFace} display: grid; align-content: start; gap: ${gap(2)}; padding: ${gap(5)};
  color: ${color('text')}; text-decoration: none; min-width: 0; height: 100%; }
a.ui-stat-tile { ${transition('background-color')} }
a.ui-stat-tile:hover { background: ${color('surface-2')}; }
.ui-stat-tile__label { ${text('caption')}; font-weight: 600; color: ${color('text-secondary')};
  display: flex; align-items: center; gap: ${gap(2)}; }
.ui-stat-tile__value { margin: 0; overflow-wrap: anywhere; }
.ui-stat-tile__hint { ${text('caption')}; color: ${color('text-tertiary')}; }
`;

const table = `
.ui-table-wrap { ${cardFace} overflow-x: auto; }
.ui-table-wrap--scroll { max-height: 70vh; overflow-y: auto; }
.ui-table { width: 100%; border-collapse: separate; border-spacing: 0; color: ${color('text')}; }
.ui-table th { ${text('caption')}; font-weight: 600; color: ${color('text-secondary')}; text-align: left;
  height: ${TAP}; padding: 0 ${gap(4)}; border-bottom: 1px solid ${color('border-subtle')};
  background: ${color('surface-1')}; position: sticky; top: 0; z-index: 1; white-space: nowrap; }
.ui-table__sort { ${text('caption')}; font-weight: 600; display: inline-flex; align-items: center; gap: ${gap(1)};
  min-height: ${TAP}; margin: 0 calc(-1 * ${gap(2)}); padding: 0 ${gap(2)}; border: 0; border-radius: var(--radius-sm);
  background: transparent; color: inherit; cursor: pointer; }
.ui-table__sort:hover { color: ${color('text')}; background: ${color('surface-2')}; }
.ui-table td { height: ${TABLE_ROW_HEIGHT}px; padding: ${gap(2)} ${gap(4)}; border-bottom: 1px solid ${color('border-subtle')};
  vertical-align: middle; }
.ui-table tbody tr:last-child td { border-bottom: 0; }
.ui-table tbody tr:hover td { background: ${color('surface-2')}; }
.ui-table tbody tr.ui-table__empty-row:hover td { background: transparent; }
.ui-table__actions { width: 1%; white-space: nowrap; text-align: right; }
.ui-table__label { ${text('caption')}; font-weight: 600; color: ${color('text-tertiary')}; display: none; }
${PHONE} {
  .ui-table-wrap { overflow-x: visible; }
  .ui-table, .ui-table tbody, .ui-table tr, .ui-table td { display: block; }
  .ui-table thead { ${visuallyHidden} }
  .ui-table tbody tr { padding: ${gap(4)}; border-bottom: 1px solid ${color('border-subtle')}; }
  .ui-table tbody tr:last-child { border-bottom: 0; }
  .ui-table tbody tr:hover td { background: transparent; }
  .ui-table td { height: auto; padding: ${gap(1)} 0; border: 0; display: grid;
    grid-template-columns: minmax(0, 2fr) minmax(0, 3fr); gap: ${gap(3)}; align-items: baseline; }
  .ui-table td.ui-table__primary { display: block; padding-bottom: ${gap(2)}; }
  .ui-table td.ui-table__actions { display: block; width: auto; text-align: left; padding-top: ${gap(2)}; }
  .ui-table__label { display: block; }
  .ui-table tr.ui-table__empty-row td { display: block; }
}
`;

const emptyState = `
.ui-empty { display: grid; justify-items: center; text-align: center; gap: ${gap(3)}; padding: ${gap(10)} ${gap(4)};
  color: ${color('text')}; }
.ui-empty__icon { display: grid; place-items: center; width: ${ICON.empty * 2}px; height: ${ICON.empty * 2}px;
  border-radius: var(--radius-full); background: ${color('surface-2')}; color: ${color('text-secondary')};
  margin-bottom: ${gap(2)}; }
.ui-empty__title { ${text('title3')}; margin: 0; }
.ui-empty__body { ${text('body')}; color: ${color('text-secondary')}; max-width: 48ch; margin: 0; }
.ui-empty__action { margin-top: ${gap(2)}; }
`;

const skeleton = `
.ui-skeleton { display: block; border-radius: var(--radius-sm); background: ${color('surface-2')};
  background-image: linear-gradient(90deg, ${color('surface-2')} 0%, ${color('surface-3')} 50%, ${color('surface-2')} 100%);
  background-size: 200% 100%; animation: ui-shimmer 1.4s linear infinite; }
.ui-skeleton--text { height: 1rem; margin: ${gap(1)} 0; }
.ui-skeleton--title { height: 1.5rem; width: 40%; margin-bottom: ${gap(2)}; }
.ui-skeleton--tile { height: 128px; border-radius: var(--radius-lg); }
.ui-skeleton--short { width: 60%; }
@keyframes ui-shimmer { from { background-position: 100% 0; } to { background-position: -100% 0; } }
@media (prefers-reduced-motion: reduce) { .ui-skeleton { animation: none; background-image: none; } }
.ui-skeleton-group { display: grid; gap: ${gap(2)}; }
`;

const badge = `
.ui-badge { ${text('badge')}; display: inline-flex; align-items: center; gap: ${gap(1)}; padding: 2px ${gap(2)};
  border-radius: var(--radius-full); white-space: nowrap; vertical-align: middle; }
.ui-badge svg { flex: none; }
.ui-badge--success { background: ${color('success-tint')}; color: ${color('success')}; }
.ui-badge--warning { background: ${color('warning-tint')}; color: ${color('warning')}; }
.ui-badge--danger { background: ${color('danger-tint')}; color: ${color('danger')}; }
.ui-badge--info { background: ${color('info-tint')}; color: ${color('info')}; }
.ui-badge--neutral { background: ${color('surface-2')}; color: ${color('text-secondary')}; }
`;

const avatarSizes = (Object.keys(AVATAR) as AvatarSize[])
  .map(
    (size) =>
      `.ui-avatar--${size} { width: ${AVATAR[size]}px; height: ${AVATAR[size]}px; ${text(
        size === 'sm' ? 'badge' : size === 'md' ? 'label' : 'title3',
      )}; }`,
  )
  .join('\n');

const avatar = `
.ui-avatar { display: inline-grid; place-items: center; flex: none; border-radius: var(--radius-full);
  background: ${color('surface-3')}; color: ${color('text')}; user-select: none; }
.ui-avatar--you { background: ${color('accent')}; color: ${color('on-accent')}; }
${avatarSizes}
`;

const banner = `
.ui-banner { display: flex; flex-wrap: wrap; align-items: flex-start; gap: ${gap(3)}; padding: ${gap(4)};
  border-radius: var(--radius-md); border: 1px solid currentColor; }
.ui-banner__icon { flex: none; margin-top: 2px; }
.ui-banner__body { flex: 1 1 20ch; display: grid; gap: ${gap(1)}; min-width: 0; }
.ui-banner__title { ${text('label')}; margin: 0; }
.ui-banner__text { ${text('body')}; margin: 0; }
.ui-banner__action { flex: none; align-self: center; }
.ui-banner--success { background: ${color('success-tint')}; color: ${color('success')}; }
.ui-banner--warning { background: ${color('warning-tint')}; color: ${color('warning')}; }
.ui-banner--danger { background: ${color('danger-tint')}; color: ${color('danger')}; }
.ui-banner--info { background: ${color('info-tint')}; color: ${color('info')}; }
`;

const pageHeader = `
.ui-page-header { display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between;
  gap: ${gap(4)}; margin-bottom: ${gap(6)}; color: ${color('text')}; }
.ui-page-header__main { display: grid; gap: ${gap(2)}; min-width: 0; flex: 1 1 32ch; }
.ui-page-header__back { justify-self: start; margin-left: calc(-1 * ${gap(1)}); }
.ui-page-header__title-row { display: flex; flex-wrap: wrap; align-items: center; gap: ${gap(3)}; }
.ui-page-header__title { margin: 0; }
.ui-page-header__title:focus { outline: none; }
.ui-page-header__title:focus-visible { outline: 2px solid ${color('focus-ring')}; outline-offset: 2px; }
.ui-page-header__description { ${text('bodyLarge')}; color: ${color('text-secondary')}; max-width: 68ch; margin: 0; }
.ui-page-header__actions { display: flex; flex-wrap: wrap; gap: ${gap(3)}; }
${PHONE} {
  .ui-page-header__actions { width: 100%; }
  .ui-page-header__actions > .ui-button--primary { order: -1; flex: 1 1 100%; }
}
`;

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
    focusRing(['a.ui-stat-tile', '.ui-table__sort', '.ui-table-wrap']),
  ].join('\n');
