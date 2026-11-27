// The admin pages' layouts, in the map-first look (docs/DESIGN.md): the map is the page on
// sign-in and My club, with plates floating on it; away from the map, content is tables and
// rows divided by hairlines, never boxes around each part. Components draw themselves
// (components/ui/styles); this file only places them. Theme tokens only.
import { opacity, sizes } from '@huntclub/design';
import { MOBILE_TAB_BAR_HEIGHT, SHELL } from '../components/ui/sizes';
import {
  color,
  DESKTOP,
  gap,
  HAIR,
  PHONE,
  TABLET_UP,
  TAP,
  text,
} from '../components/ui/styles/shared';

/** A plate floating over the map: the plate tone and the floating shadow (over imagery only). */
const floating = `background: ${color('plate')}; border-radius: var(--radius-lg); box-shadow: ${color('shadowPlate')};`;

const common = `
.page-pad { padding: ${gap(6)} ${gap(8)}; max-width: calc(${SHELL.contentMaxWidth}px + 2 * ${gap(8)}); margin: 0 auto; }
${PHONE} { .page-pad { padding: ${gap(5)} ${gap(4)}; } }
.loading--stats, .loading--page { gap: ${gap(3)}; }
.stale-notice { margin-bottom: ${gap(4)}; }
.quiet { color: ${color('textSecondary')}; }
.section-title { ${text('title3')}; display: flex; align-items: baseline; gap: ${gap(2)}; margin: 0 0 ${gap(3)}; }
.section-title__count { color: ${color('textSecondary')}; }
.section-head { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: ${gap(3)};
  margin: ${gap(8)} 0 ${gap(3)}; }
.section-head .section-title { margin: 0; }
.ui-table-wrap + .section-title, .ui-table-wrap + .section-head { margin-top: ${gap(8)}; }
.form-plate { display: grid; gap: ${gap(4)}; max-width: 560px; }
.form-plate__actions { display: flex; flex-wrap: wrap; gap: ${gap(2)}; }
.form-note { ${text('body')}; color: ${color('textSecondary')}; margin: 0; max-width: 68ch; }
.form-error { ${text('label')}; color: ${color('danger')}; margin: ${gap(2)} 0 0; }
.stack-action { display: grid; gap: ${gap(1)}; justify-items: end; }
.filters { display: flex; flex-wrap: wrap; align-items: flex-end; gap: ${gap(3)}; margin-bottom: ${gap(4)}; }
.filters__search { flex: 1 1 18rem; }
/* Date fields: the same field box as the search, a fixed share of the row, wrapping side by side. */
.filters__date { flex: 0 1 15rem; min-width: 10rem; }
.filters__date .ui-input { display: flex; align-items: center; }
${PHONE} { .filters__date { flex: 1 1 0; } }
.filters .ui-choice-group__legend { margin-bottom: ${gap(2)}; }
.toolbar { display: flex; flex-wrap: wrap; align-items: center; gap: ${gap(2)}; margin-bottom: ${gap(4)}; }
.toolbar__text { ${text('label')}; color: ${color('textSecondary')}; margin: 0 auto 0 0; }
${PHONE} { .toolbar__text { flex: 1 1 100%; } .toolbar .ui-button { flex: 1 1 0; } }
`;

/** Sign-in: the form on a plate over the sample property; on a phone, the map is a band on top. */
const signin = `
.signin { position: relative; display: flex; align-items: center; min-height: 100vh; isolation: isolate;
  padding: ${gap(10)}; }
.signin__map { position: absolute; inset: 0; z-index: -1; }
/* The sample's aerial, dimmed into the plain ground: a quiet backdrop, never competing with the form. */
.signin__map .plan__basemap { opacity: ${opacity.backdrop}; }
/* Sized to its contents and centred on the map's height: no empty slab under the form. */
.signin__door { position: relative; display: flex; flex-direction: column; gap: ${gap(4)}; width: 440px;
  padding: ${gap(8)} ${gap(8)} ${gap(5)}; ${floating} }
/* The field on the plate: the plate fill inside the control edge (the placeholder is textTertiary, 4.5:1 on it). */
.signin__door .ui-input { background: ${color('plate')}; }
.signin__brand { display: flex; align-items: center; gap: ${gap(3)}; }
.signin__app-name { ${text('title3')}; margin: 0; }
.signin__door .ui-page-header { margin: ${gap(6)} 0 0; }
.signin__door .ui-page-header__title { ${text('display')}; }
.signin__door .ui-page-header__description { ${text('body')}; }
.signin__form { display: grid; gap: ${gap(4)}; }
.signin__code { ${text('codeField')}; }
.signin__secondary { display: flex; flex-wrap: wrap; gap: ${gap(2)}; }
.signin__note { ${text('body')}; color: ${color('textSecondary')}; margin: 0; }
.signin__error { ${text('label')}; color: ${color('danger')}; margin: 0; }
.signin__footer { padding-top: ${gap(4)}; border-top: ${HAIR}; display: grid; gap: ${gap(1)};
  color: ${color('textSecondary')}; }
.signin__footer p { margin: 0; }
.signin__legal { display: flex; gap: ${gap(5)}; }
.signin__legal a { ${text('label')}; display: inline-flex; align-items: center; min-height: ${TAP};
  color: ${color('accentText')}; }
.signin__sample { position: absolute; right: ${gap(6)}; top: ${gap(6)}; margin: 0; padding: ${gap(2)} ${gap(3)};
  ${text('label')}; ${floating} }
${PHONE} {
  .signin { flex-direction: column; align-items: stretch; padding: 0; }
  .signin__map { position: relative; inset: auto; z-index: 0; order: -1; height: 300px; flex: none; }
  .signin__door { width: auto; min-height: 0; flex: 1; margin: -${gap(4)} 0 0; padding: ${gap(6)} ${gap(4)} ${gap(4)};
    border-radius: var(--radius-xl) var(--radius-xl) 0 0; z-index: 1; }
  .signin__door .ui-page-header { margin-top: ${gap(2)}; }
  .signin__sample { top: ${gap(3)}; bottom: auto; left: ${gap(3)}; right: auto; ${text('caption')}; font-weight: 700; }
}
`;

/**
 * My club: the map edge to edge with the club's plate on it, and the side panel (a sheet rising
 * over the map on phones and tablets).
 */
const clubview = `
.clubview { display: grid; }
.clubview__map { height: ${SHELL.phoneMapHeight}px; }
.clubview__plate { position: absolute; top: ${gap(3)}; left: ${gap(3)}; right: ${gap(3)}; overflow: hidden; ${floating} }
.clubview__plate .ui-stat-grid { border: 0; border-top: ${HAIR}; border-radius: 0; }
.clubview__title { padding: ${gap(3)} ${gap(4)}; }
.clubview__title h1 { margin: 0; }
.clubview__facts { ${text('body')}; color: ${color('textSecondary')}; margin: 2px 0 0; }
.clubview__line { display: flex; flex-wrap: wrap; align-items: center; gap: ${gap(2)} ${gap(3)};
  padding: ${gap(3)} ${gap(4)}; border-top: ${HAIR}; }
.clubview__line-note { ${text('body')}; flex: 1 1 14rem; margin: 0; }
.clubview__side { position: relative; z-index: 1; display: grid; align-content: start; gap: ${gap(6)};
  margin-top: -${gap(4)}; padding: ${gap(5)} ${gap(4)} ${gap(8)}; background: ${color('plate')};
  border-radius: var(--radius-xl) var(--radius-xl) 0 0; }
.clubview__overdue { ${text('body')}; color: ${color('textSecondary')}; margin: 0; padding-top: ${gap(3)};
  border-top: ${HAIR}; }
.side-section__title { ${text('title2')}; display: flex; justify-content: space-between; align-items: baseline;
  margin: 0 0 ${gap(2)}; }
.side-section__count { color: ${color('textSecondary')}; }
.side-section__empty-state { border-top: ${HAIR}; }
.side-section__empty-state .ui-empty { padding: ${gap(4)} 0 ${gap(2)}; }
.your-name .form-plate { padding-top: ${gap(3)}; border-top: ${HAIR}; }
.rows { list-style: none; margin: 0; padding: 0; }
.rows > li { border-top: ${HAIR}; }
.row-item { display: flex; align-items: center; gap: ${gap(3)}; min-height: 64px; padding: ${gap(2)} 0; }
.row-item__text { flex: 1; min-width: 0; }
.row-item__title { ${text('label')}; font-weight: 750; margin: 0; }
.row-item__detail { ${text('caption')}; color: ${color('textSecondary')}; margin: 2px 0 0; }
.row-item__where { ${text('caption')}; font-weight: 600; color: ${color('textSecondary')}; white-space: nowrap; }
.row-link { display: flex; align-items: center; justify-content: space-between; gap: ${gap(3)}; min-height: ${TAP};
  padding: 0 ${gap(1)}; color: ${color('text')}; text-decoration: none; border-radius: var(--radius-sm); }
.row-link:hover { background: ${color('raised')}; }
.row-link__label { ${text('body')}; color: ${color('textSecondary')}; }
/* Drawing on a phone: the map fills the screen between the top bar and the tab bar. */
${PHONE} { .clubview--drawing .clubview__map { height: calc(100dvh - ${SHELL.topBarHeight + MOBILE_TAB_BAR_HEIGHT}px);
  min-height: ${SHELL.phoneMapHeight}px; } }
${TABLET_UP} { .clubview__plate { right: auto; width: min(460px, calc(100% - 2 * ${gap(4)})); top: ${gap(4)}; left: ${gap(4)}; } }
${DESKTOP} {
  .clubview { grid-template-columns: minmax(0, 1fr) ${SHELL.sidePanelWidth}px; height: 100vh; }
  .clubview__map { height: auto; min-height: 0; }
  .clubview__side { margin: 0; border-radius: 0; border-left: ${HAIR}; overflow-y: auto; padding: ${gap(5)} ${gap(5)} ${gap(8)}; }
}
`;

/** Lists beside a small map: the map on top on phones, to the right (sticky) from desktop. */
const besideMap = `
.beside-map { display: grid; gap: ${gap(6)}; }
.beside-map__lists { min-width: 0; }
.beside-map__map { order: -1; height: ${SHELL.insetMapHeightPhone}px; border-radius: var(--radius-lg); border: ${HAIR}; }
${DESKTOP} {
  .beside-map { grid-template-columns: minmax(0, 1fr) 360px; align-items: start; }
  .beside-map__map { order: 0; height: ${SHELL.insetMapHeight}px; position: sticky; top: ${gap(6)}; }
}
.place { display: inline-flex; align-items: center; gap: ${gap(3)}; font-weight: 700; }
.place__mark { display: inline-grid; place-items: center; width: ${sizes.standMarker}px; height: ${sizes.standMarker}px; flex: none;
  border-radius: var(--radius-stand-marker); border: var(--control-border) solid ${color('borderControl')};
  background: ${color('raised')}; }
.count-tables { display: grid; gap: ${gap(6)}; margin-top: ${gap(6)}; }
${DESKTOP} { .count-tables { grid-template-columns: repeat(2, minmax(0, 1fr)); align-items: start; } }
.count-table .ui-table-wrap { max-height: 420px; overflow-y: auto; }
.estimate { max-width: 420px; }
.estimate .ui-stat-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.status-reason { display: inline-flex; flex-wrap: wrap; align-items: center; gap: ${gap(2)}; }
`;

/** A person: initials in a ring, the name, the role under it. */
const roster = `
.person { display: inline-flex; align-items: center; gap: ${gap(3)}; min-width: 0; }
.person__text { display: grid; min-width: 0; }
.person__name { ${text('label')}; font-weight: 750; }
.person__role { ${text('caption')}; color: ${color('textSecondary')}; }
/* The roster and, beside it from desktop (after it on phones), the club's invite QR and link. */
.roster { display: grid; gap: ${gap(8)}; }
.roster__members { min-width: 0; }
.roster__members > .ui-empty { padding-left: 0; padding-right: 0; }
.roster__invite { padding-top: ${gap(5)}; border-top: ${HAIR}; }
${DESKTOP} {
  .roster { grid-template-columns: minmax(0, 1fr) 320px; align-items: start; }
  .roster__invite { position: sticky; top: ${gap(6)}; padding: 0 0 0 ${gap(6)}; border: 0; border-left: ${HAIR}; }
}
.invite { display: grid; gap: ${gap(5)}; justify-items: start; }
.invite__start { display: grid; gap: ${gap(4)}; justify-items: start; }
.invite__start .form-note { margin: 0; }
.invite__link { display: grid; gap: ${gap(3)}; width: 100%; }
.invite__link .ui-input { ${text('code')}; text-overflow: ellipsis; }
.invite__link .ui-button { justify-self: start; }
`;

/** The QR code: dark modules on a light ground with its quiet zone, in both themes. */
const qr = `
.qr { display: block; width: min(240px, 100%); border-radius: var(--radius-md); overflow: hidden; }
.qr svg { display: block; width: 100%; height: auto; }
`;

/** Page not found: the crossed-out pin, one line and the ways back. */
const notFound = `
.not-found { display: grid; gap: ${gap(3)}; justify-items: start; }
.not-found__icon { display: grid; color: ${color('textSecondary')}; }
.not-found__links { display: flex; flex-wrap: wrap; gap: ${gap(2)}; margin-top: ${gap(2)}; }
`;

const billing = `
.billing { display: grid; gap: ${gap(5)}; max-width: 760px; }
.billing__free { ${text('body')}; display: flex; align-items: center; gap: ${gap(2)}; margin: ${gap(8)} 0 0;
  padding-top: ${gap(4)}; border-top: ${HAIR}; color: ${color('textSecondary')}; max-width: 760px; }
.billing__free svg { flex: none; color: ${color('fresh')}; }
.billing__invoices { margin-top: ${gap(3)}; }
.billing__invoices .ui-empty { padding: ${gap(4)} 0 0; border-top: ${HAIR}; }
`;

export const pagesCss = () =>
  [common, signin, clubview, besideMap, roster, qr, notFound, billing].join('\n');
