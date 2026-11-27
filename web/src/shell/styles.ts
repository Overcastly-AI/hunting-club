// The admin shell's stylesheet (Shell.tsx): sidebar from 1024 px, icon rail from 640 px,
// top bar and tab bar below. Theme colours and tokens only; every target is 48 px or more.
import { MOBILE_TAB_BAR_HEIGHT, SHELL } from '../components/ui/sizes';
import {
  color,
  focusRing,
  gap,
  PHONE,
  TABLET,
  TAP,
  text,
  transition,
} from '../components/ui/styles/shared';

const SAFE_BOTTOM = 'env(safe-area-inset-bottom)';
const TAB_BAR = `calc(${MOBILE_TAB_BAR_HEIGHT}px + ${SAFE_BOTTOM})`;

/** Desktop is the base; the rail and the phone bars override it below. */
const base = `
.shell { min-height: 100vh; background: ${color('canvas')}; color: ${color('text')}; }
.shell-side { position: fixed; z-index: 20; top: 0; bottom: 0; left: 0; width: ${SHELL.sidebarWidth}px;
  display: flex; flex-direction: column; gap: ${gap(4)}; padding: ${gap(4)} ${gap(3)};
  background: ${color('surface-0')}; border-right: 1px solid ${color('border-subtle')}; }
.shell-brand { display: flex; align-items: center; gap: ${gap(3)}; min-height: ${TAP}; padding: 0 ${gap(2)}; }
.shell-brand__mark { flex: none; }
.shell-brand__name { ${text('title3')}; min-width: 0; }
.shell-club { display: grid; gap: ${gap(2)}; padding-bottom: ${gap(4)}; border-bottom: 1px solid ${color('border-subtle')}; }
.shell-club__button { ${text('title3')}; display: flex; align-items: center; gap: ${gap(2)}; width: 100%;
  padding: ${gap(1)} ${gap(2)}; text-align: left; }
.shell-club__name { flex: 1; min-width: 0; overflow-wrap: anywhere; }
.shell-club__button svg { flex: none; color: ${color('text-secondary')}; }
.shell-club__status { padding: 0 ${gap(2)}; }
.shell-nav { flex: 1; min-height: 0; overflow-y: auto; margin: 0 calc(-1 * ${gap(1)}); padding: 0 ${gap(1)}; }
.shell-nav__list, .shell-more, .shell-menu { list-style: none; margin: 0; padding: 0; display: grid; gap: ${gap(2)}; }
.shell-nav__slot--more { display: none; }
.shell-nav__item { ${text('label')}; position: relative; display: flex; align-items: center; gap: ${gap(3)};
  width: 100%; min-height: ${TAP}; padding: 0 ${gap(3)}; border: 0; border-radius: var(--radius-md);
  background: transparent; color: ${color('text-secondary')}; text-decoration: none; cursor: pointer;
  ${transition('background-color', 'color')} }
.shell-nav__item:hover { background: ${color('surface-2')}; color: ${color('text')}; }
.shell-nav__item[aria-current='page'], .shell-nav__item--current { background: ${color('surface-3')};
  color: ${color('accent-text')}; }
/* The selected item's 3 px accent bar on its left edge. */
.shell-nav__item[aria-current='page']::before, .shell-nav__item--current::before { content: ''; position: absolute;
  left: 0; top: ${gap(2)}; bottom: ${gap(2)}; width: 3px; border-radius: 0 3px 3px 0; background: ${color('accent')}; }
.shell-nav__icon { position: relative; display: inline-flex; flex: none; }
.shell-dot { position: absolute; top: -2px; right: -4px; width: ${SHELL.dot}px; height: ${SHELL.dot}px;
  border-radius: var(--radius-full); border: 2px solid ${color('surface-0')}; box-sizing: content-box; }
.shell-dot--pastDue { background: ${color('danger')}; }
.shell-dot--trialEnding { background: ${color('warning')}; }
.shell-account__button { display: flex; align-items: center; gap: ${gap(3)}; width: 100%; padding: ${gap(2)}; }
.shell-account__email { ${text('caption')}; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  color: ${color('text-secondary')}; }
.shell-account { border-top: 1px solid ${color('border-subtle')}; padding-top: ${gap(3)}; }
.shell-account .ui-popover__panel { top: auto; bottom: calc(100% + ${gap(2)}); left: 0; right: auto; }
.shell-account-panel { display: grid; gap: ${gap(3)}; }
.shell-account-panel__who { display: flex; align-items: center; gap: ${gap(3)}; margin: 0; padding: ${gap(1)} ${gap(2)}; }
.shell-account-panel__email { ${text('label')}; min-width: 0; overflow-wrap: anywhere; }
.shell-account-panel .ui-segment { padding: ${gap(1)} ${gap(2)}; }
.shell-menu { gap: ${gap(1)}; }
.shell-menu .ui-button, .shell-more .shell-nav__item { justify-content: flex-start; }
.shell-more { margin-bottom: ${gap(4)}; }
.shell-more__heading { ${text('label')}; color: ${color('text-secondary')}; margin: 0 0 ${gap(2)}; }
.shell-main { margin-left: ${SHELL.sidebarWidth}px; padding: ${gap(8)}; }
.shell-content { max-width: ${SHELL.contentMaxWidth}px; margin: 0 auto; }
${focusRing(['.shell-nav__item'])}
.shell-nav__item:focus-visible { outline-offset: -2px; }
`;

/** 640–1023 px: a 72 px rail, icon over a 14 px label; the club block moves to the pages. */
const rail = `
${TABLET} {
  .shell-side { width: ${SHELL.railWidth}px; padding: ${gap(3)} ${gap(1)}; align-items: stretch; }
  .shell-brand { justify-content: center; padding: 0; }
  .shell-brand__name, .shell-club, .shell-account__email, .shell-nav__label-rest { display: none; }
  .shell-nav { margin: 0; padding: 0; }
  .shell-nav__list { gap: ${gap(1)}; }
  .shell-nav__item { ${text('caption')}; font-weight: 600; flex-direction: column; justify-content: center;
    gap: ${gap(1)}; min-height: ${SHELL.railWidth - 8}px; padding: ${gap(1)}; text-align: center; overflow-wrap: anywhere; }
  .shell-account { padding-top: ${gap(2)}; }
  .shell-account__button { justify-content: center; padding: 0; }
  .shell-account .ui-popover__panel { bottom: 0; left: calc(100% + ${gap(2)}); }
  .shell-main { margin-left: ${SHELL.railWidth}px; padding: ${gap(6)}; }
}
`;

/** Under 640 px: the side becomes the top bar and its nav the bottom tab bar. */
const phone = `
${PHONE} {
  .shell-side { bottom: auto; right: 0; width: auto; height: ${SHELL.topBarHeight}px; flex-direction: row;
    align-items: center; gap: ${gap(2)}; padding: 0 ${gap(2)} 0 ${gap(4)}; border-right: 0;
    border-bottom: 1px solid ${color('border-subtle')}; }
  .shell-brand { padding: 0; min-height: 0; }
  .shell-brand__name, .shell-club__status, .shell-account__email, .shell-nav__label-rest,
    .shell-nav__slot--in-more { display: none; }
  .shell-club { flex: 1; min-width: 0; padding: 0; border: 0; }
  .shell-club .ui-skeleton { margin: 0; }
  .shell-club__button { ${text('label')}; }
  .shell-club__name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; overflow-wrap: normal; }
  .shell-club__panel { position: fixed; top: ${SHELL.topBarHeight + 8}px; left: ${gap(4)}; }
  .shell-nav { position: fixed; left: 0; right: 0; bottom: 0; height: ${TAB_BAR}; margin: 0; padding: 0 0 ${SAFE_BOTTOM};
    overflow: visible; background: ${color('surface-0')}; border-top: 1px solid ${color('border-subtle')}; }
  .shell-nav__list { height: ${MOBILE_TAB_BAR_HEIGHT}px; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 0; }
  .shell-nav__slot--more { display: block; }
  .shell-nav__item { ${text('caption')}; font-weight: 600; flex-direction: column; justify-content: center; gap: ${gap(1)};
    height: 100%; padding: ${gap(1)} 2px; border-radius: 0; text-align: center; white-space: nowrap; }
  .shell-nav__item[aria-current='page'], .shell-nav__item--current { background: transparent; }
  /* The selected tab: accent icon and word, with the bar along its top edge. */
  .shell-nav__item[aria-current='page']::before, .shell-nav__item--current::before { left: ${gap(3)}; right: ${gap(3)};
    top: 0; bottom: auto; width: auto; height: 3px; border-radius: 0 0 3px 3px; }
  .shell-more .shell-nav__item { ${text('label')}; flex-direction: row; gap: ${gap(3)}; height: auto;
    padding: 0 ${gap(3)}; border-radius: var(--radius-md); }
  .shell-more .shell-nav__item[aria-current='page'] { background: ${color('surface-3')}; }
  .shell-more .shell-nav__item[aria-current='page']::before { left: 0; right: auto; top: ${gap(2)}; bottom: ${gap(2)};
    width: 3px; height: auto; border-radius: 0 3px 3px 0; }
  .shell-account { border: 0; padding: 0; }
  .shell-account__button { padding: 0; min-width: ${TAP}; justify-content: center; }
  .shell-account .ui-popover__panel { position: fixed; top: ${SHELL.topBarHeight + 8}px; bottom: auto; left: auto; right: ${gap(4)}; }
  .shell-main { margin: 0; padding: calc(${SHELL.topBarHeight}px + ${gap(4)}) ${gap(4)} calc(${TAB_BAR} + ${gap(8)}); }
}
`;

/** Pages off /app/: the logo bar and the content column, no nav. */
const publicShell = `
.shell-public-bar { display: flex; align-items: center; min-height: ${SHELL.topBarHeight}px; padding: 0 ${gap(4)};
  background: ${color('surface-0')}; border-bottom: 1px solid ${color('border-subtle')}; }
.shell-public-main { max-width: calc(${SHELL.contentMaxWidth}px + 2 * ${gap(8)}); margin: 0 auto; padding: ${gap(8)}; }
${PHONE} { .shell-public-main { padding: ${gap(6)} ${gap(4)}; } }
`;

export const shellCss = () => [base, rail, phone, publicShell].join('\n');
