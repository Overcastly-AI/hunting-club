// The admin shell's stylesheet (Shell.tsx), in the map-first look (docs/DESIGN.md): a dense rail
// in the pit tone with a word on every item from 1024 px, an icon rail with short words from
// 640 px, and below that a top bar and a docked tab bar. The selected item is raised with the
// orange edge (orange's "selected item" job); everything else is ink and quiet. Theme colours
// and tokens only; every target is 48 px or more.
import { MOBILE_TAB_BAR_HEIGHT, SHELL } from '../components/ui/sizes';
import {
  color,
  focusRing,
  gap,
  HAIR,
  SHELL_BARS,
  SHELL_RAIL,
  TAP,
  text,
  transition,
} from '../components/ui/styles/shared';

const SAFE_BOTTOM = 'env(safe-area-inset-bottom)';
const TAB_BAR = `calc(${MOBILE_TAB_BAR_HEIGHT}px + ${SAFE_BOTTOM})`;
/** The selected item's orange edge: inset, so it never shifts the word. */
const SELECTED_EDGE = `inset 3px 0 0 ${color('accent')}`;

/** Desktop is the base; the rail and the phone bars override it below. */
const base = `
.shell { min-height: 100vh; background: ${color('canvas')}; color: ${color('text')}; }
.shell-side { position: fixed; z-index: 20; top: 0; bottom: 0; left: 0; width: ${SHELL.sidebarWidth}px;
  display: flex; flex-direction: column; gap: ${gap(3)}; padding: ${gap(3)} ${gap(3)} ${gap(2)};
  background: ${color('canvas')}; border-right: ${HAIR}; }
.shell-brand { display: flex; align-items: center; gap: ${gap(3)}; min-height: ${TAP}; padding: 0 ${gap(2)}; }
.shell-brand__mark { flex: none; }
.shell-brand__name { ${text('title3')}; font-size: 1.125rem; min-width: 0; }
.shell-club { display: grid; gap: ${gap(1)}; padding: 0 0 ${gap(3)}; border-bottom: ${HAIR}; }
.shell-club__button { ${text('label')}; display: flex; align-items: center; gap: ${gap(2)}; width: 100%;
  padding: ${gap(1)} ${gap(2)}; text-align: left; border-radius: var(--radius-md); }
.shell-club__name { flex: 1; min-width: 0; overflow-wrap: anywhere; }
.shell-club__button svg { flex: none; color: ${color('textSecondary')}; }
.shell-club__status { padding: 0 ${gap(2)}; }
/* The club switcher: 4 px under its button and the rail's full inner width, edges in line. */
.shell-club .ui-popover__panel.shell-club__panel { top: calc(100% + ${gap(1)}); left: 0; right: 0; width: auto;
  min-width: 0; }
.shell-club__panel .shell-menu { border-top: 0; padding-top: 0; }
.shell-club__panel .ui-button { white-space: normal; text-align: left; overflow-wrap: anywhere; }
.shell-nav { flex: 1; min-height: 0; overflow-y: auto; }
.shell-nav__list, .shell-more, .shell-menu { list-style: none; margin: 0; padding: 0; display: grid; gap: 2px; }
.shell-nav__slot--more { display: none; }
.shell-nav__item { ${text('label')}; font-weight: 650; position: relative; display: flex; align-items: center;
  gap: ${gap(3)}; width: 100%; min-height: ${TAP}; padding: 0 ${gap(3)}; border: 0; border-radius: var(--radius-md);
  background: transparent; color: ${color('textSecondary')}; text-decoration: none; cursor: pointer;
  ${transition('background-color', 'color')} }
.shell-nav__item:hover { background: ${color('plate')}; color: ${color('text')}; }
.shell-nav__item[aria-current='page'], .shell-nav__item--current { background: ${color('raised')};
  color: ${color('text')}; box-shadow: ${SELECTED_EDGE}; }
.shell-nav__icon { position: relative; display: inline-flex; flex: none; }
.shell-dot { position: absolute; top: -2px; right: -4px; width: ${SHELL.dot}px; height: ${SHELL.dot}px;
  border-radius: var(--radius-full); border: 2px solid ${color('canvas')}; box-sizing: content-box; }
.shell-dot--pastDue { background: ${color('danger')}; }
.shell-dot--trialEnding { background: ${color('warning')}; }
.shell-account { border-top: ${HAIR}; padding-top: ${gap(2)}; }
.shell-account__button { display: flex; align-items: center; gap: ${gap(3)}; width: 100%; padding: ${gap(1)} ${gap(2)};
  text-align: left; border-radius: var(--radius-md); }
.shell-account__who { display: grid; min-width: 0; }
.shell-account__email { ${text('label')}; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.shell-account__role { ${text('caption')}; color: ${color('textSecondary')}; }
.shell-account .ui-popover__panel { top: auto; bottom: calc(100% + ${gap(2)}); left: 0; right: auto; }
.shell-account-panel { display: grid; gap: ${gap(3)}; }
.shell-account-panel__who { display: flex; align-items: center; gap: ${gap(3)}; margin: 0; padding: ${gap(1)} ${gap(2)}; }
.shell-account-panel__lines { display: grid; min-width: 0; }
.shell-account-panel__name { ${text('label')}; min-width: 0; overflow-wrap: anywhere; }
.shell-account-panel__email { ${text('label')}; min-width: 0; overflow-wrap: anywhere; }
.shell-account-panel__name + .shell-account-panel__email { ${text('caption')}; color: ${color('textSecondary')}; }
.shell-account-panel .ui-choice-group { padding: 0 ${gap(2)}; }
.shell-account-panel .ui-segment { padding: ${gap(1)} ${gap(2)}; }
.shell-menu { border-top: ${HAIR}; padding-top: ${gap(2)}; }
.shell-menu .ui-button, .shell-more .shell-nav__item { justify-content: flex-start; }
.shell-more { margin-bottom: ${gap(4)}; }
.shell-more .shell-nav__item { color: ${color('text')}; }
.shell-more__heading { ${text('label')}; color: ${color('textSecondary')}; margin: 0 0 ${gap(2)}; }
.shell-main { margin-left: ${SHELL.sidebarWidth}px; padding: ${gap(6)} ${gap(8)} ${gap(10)}; }
.shell-content { max-width: ${SHELL.contentMaxWidth}px; margin: 0 auto; }
/* Pages where the map is the page: edge to edge, no column. */
.shell-main--bleed { padding: 0; }
.shell-main--bleed .shell-content { max-width: none; }
${focusRing(['.shell-nav__item'])}
.shell-nav__item:focus-visible { outline-offset: -3px; }
`;

/** 640–1023 px and tall: the rail narrows to icons over short words; the club block moves to the pages. */
const rail = `
${SHELL_RAIL} {
  .shell-side { width: ${SHELL.railWidth}px; padding: ${gap(3)} ${gap(1)} ${gap(2)}; }
  .shell-brand { justify-content: center; padding: 0; }
  .shell-brand__name, .shell-club, .shell-account__who, .shell-nav__label-rest { display: none; }
  .shell-nav__item { ${text('tabLabel')}; flex-direction: column; justify-content: center; gap: ${gap(1)};
    min-height: 64px; padding: ${gap(1)}; text-align: center; overflow-wrap: anywhere; }
  .shell-nav__item[aria-current='page'], .shell-nav__item--current { box-shadow: ${SELECTED_EDGE}; }
  .shell-account__button { justify-content: center; padding: ${gap(1)} 0; }
  .shell-account .ui-popover__panel { bottom: 0; left: calc(100% + ${gap(2)}); }
  .shell-main { margin-left: ${SHELL.railWidth}px; padding: ${gap(6)}; }
  .shell-main--bleed { padding: 0; }
}
`;

/** Phones either way up (under 640 px, or on their side): the top bar and the docked tab bar. */
const phone = `
${SHELL_BARS} {
  .shell-side { bottom: auto; right: 0; width: auto; height: ${SHELL.topBarHeight}px; flex-direction: row;
    align-items: center; gap: ${gap(2)}; padding: 0 ${gap(2)} 0 ${gap(4)}; border-right: 0; border-bottom: ${HAIR}; }
  .shell-brand { padding: 0; min-height: 0; }
  .shell-brand__name, .shell-club__status, .shell-account__who, .shell-nav__label-rest,
    .shell-nav__slot--in-more { display: none; }
  .shell-club { flex: 1; min-width: 0; padding: 0; border: 0; }
  .shell-club .ui-skeleton { margin: 0; }
  .shell-club__name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; overflow-wrap: normal; }
  .shell-club .ui-popover__panel.shell-club__panel { position: fixed; top: ${SHELL.topBarHeight + 8}px;
    left: ${gap(4)}; right: ${gap(4)}; }
  .shell-nav { position: fixed; left: 0; right: 0; bottom: 0; height: ${TAB_BAR}; padding: 0 0 ${SAFE_BOTTOM};
    overflow: visible; background: ${color('canvas')}; border-top: ${HAIR}; }
  .shell-nav__list { height: ${MOBILE_TAB_BAR_HEIGHT}px; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 0; }
  .shell-nav__slot--more { display: block; }
  .shell-nav__item { ${text('tabLabel')}; flex-direction: column; justify-content: center; gap: 2px;
    height: 100%; padding: ${gap(1)} 2px; border-radius: 0; text-align: center; white-space: nowrap; }
  .shell-nav__item:hover { background: transparent; }
  /* The selected tab: ink word on the raised tone, with the orange edge along its top. */
  .shell-nav__item[aria-current='page'], .shell-nav__item--current {
    box-shadow: inset 0 3px 0 ${color('accent')}; }
  .shell-more .shell-nav__item { ${text('label')}; flex-direction: row; gap: ${gap(3)}; height: auto;
    padding: 0 ${gap(3)}; border-radius: var(--radius-md); }
  .shell-more .shell-nav__item[aria-current='page'] { box-shadow: ${SELECTED_EDGE}; }
  .shell-account { border: 0; padding: 0; }
  .shell-account__button { padding: 0; min-width: ${TAP}; min-height: ${TAP}; justify-content: center; }
  .shell-account .ui-popover__panel { position: fixed; top: ${SHELL.topBarHeight + 8}px; bottom: auto; left: auto;
    right: ${gap(4)}; }
  /* Menus under the top bar: as tall as their contents, up to the sheet's full detent, then they scroll. */
  .shell-account .ui-popover__panel, .shell-club .ui-popover__panel.shell-club__panel {
    max-height: calc(var(--map-chrome-sheet-max) - ${SHELL.topBarHeight + 8}px); overflow-y: auto;
    overscroll-behavior: contain; }
  .shell-main { margin: 0; padding: calc(${SHELL.topBarHeight}px + ${gap(5)}) ${gap(4)} calc(${TAB_BAR} + ${gap(8)}); }
  .shell-main--bleed { padding: ${SHELL.topBarHeight}px 0 ${TAB_BAR}; }
}
`;

/** Pages off /app/ (Checkout return, Page not found): the logo bar and one plate, no nav. */
const publicShell = `
.shell-public-bar { display: flex; align-items: center; min-height: ${SHELL.topBarHeight}px; padding: 0 ${gap(4)};
  background: ${color('canvas')}; border-bottom: ${HAIR}; }
.shell-public-main { max-width: calc(${SHELL.contentMaxWidth}px + 2 * ${gap(8)}); margin: 0 auto; padding: ${gap(8)}; }
${SHELL_BARS} { .shell-public-main { padding: ${gap(6)} ${gap(4)}; } }
`;

export const shellCss = () => [base, rail, phone, publicShell].join('\n');
