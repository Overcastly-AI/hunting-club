// Dialog (native <dialog>), Toast and Tooltip (Radix), Popover (a disclosure), Tabs (Radix), in the
// map-first look (docs/DESIGN.md). Things that float over the page are plates with the floating shadow; a
// tooltip is inverted (plate on ink); tabs are words with the orange bar under the chosen one.
import { MOBILE_TAB_BAR_HEIGHT, SHELL } from '../sizes';
import {
  color,
  focusRing,
  gap,
  HAIR,
  PHONE,
  SHELL_BARS,
  TABLET_UP,
  TAP,
  text,
  transition,
} from './shared';

/** Floating layers (toasts): a plate with a hairline edge and the popover shadow. */
const popover = `background: ${color('plate')}; border: ${HAIR}; box-shadow: ${color('shadowPopover')};
  color: ${color('text')};`;

const dialog = `
html.ui-scroll-lock { overflow: hidden; }
.ui-dialog { width: min(560px, calc(100vw - 2 * ${gap(4)})); max-height: calc(100dvh - 2 * ${gap(8)}); padding: 0;
  border: ${HAIR}; border-radius: var(--radius-xl); background: ${color('plate')};
  color: ${color('text')}; box-shadow: ${color('shadowDialog')}; color-scheme: var(--theme-color-scheme); }
.ui-dialog[open] { display: flex; flex-direction: column; animation: ui-fade-in var(--motion-base) var(--motion-easing); }
.ui-dialog:focus { outline: none; }
.ui-dialog::backdrop { background: ${color('scrim')}; }
.ui-dialog__header { display: flex; align-items: flex-start; justify-content: space-between; gap: ${gap(3)};
  padding: ${gap(4)} ${gap(3)} ${gap(3)} ${gap(5)}; border-bottom: ${HAIR}; }
.ui-dialog__title { ${text('title2')}; margin: 0; padding-top: ${gap(2)}; }
.ui-dialog__description { ${text('body')}; color: ${color('textSecondary')}; margin: ${gap(1)} 0 0; }
.ui-dialog__body { padding: ${gap(4)} ${gap(5)}; overflow-y: auto; }
.ui-dialog__footer { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: ${gap(2)};
  padding: ${gap(3)} ${gap(5)} ${gap(4)}; border-top: ${HAIR}; }
@keyframes ui-fade-in { from { opacity: 0; } }
@keyframes ui-slide-in-end { from { opacity: 0; translate: ${gap(6)} 0; } }
/* Side panel (tablet up): full height down the right edge, as wide as My club's side panel, with
   the sheet's 16 px corners on its map side. On phones it is the same bottom sheet as any dialog. */
${TABLET_UP} {
  .ui-dialog--side { margin: 0 0 0 auto; width: min(${SHELL.sidePanelWidth}px, 100vw); height: 100dvh;
    max-height: 100dvh; border-width: 0 0 0 1px; border-radius: var(--radius-xl) 0 0 var(--radius-xl); }
  .ui-dialog--side[open] { animation: ui-slide-in-end var(--motion-base) var(--motion-easing); }
}
/* Phones: a sheet rising from the bottom (16 px top corners), the main action on top, full width,
   as tall as its contents up to the sheet's full detent (mapChrome); the body scrolls past that. */
${PHONE} {
  .ui-dialog { width: 100%; max-width: 100%; margin: auto 0 0; max-height: var(--map-chrome-sheet-max);
    border-radius: var(--radius-xl) var(--radius-xl) 0 0; border-bottom: 0;
    padding-bottom: env(safe-area-inset-bottom); }
  .ui-dialog__header { padding-left: ${gap(4)}; }
  .ui-dialog__body, .ui-dialog__footer { padding-left: ${gap(4)}; padding-right: ${gap(4)}; }
  .ui-dialog__footer { flex-direction: column-reverse; }
  .ui-dialog__footer .ui-button { width: 100%; }
}
`;

const toast = `
.ui-toast-viewport { position: fixed; right: ${gap(6)}; bottom: ${gap(6)}; z-index: 100; display: grid; gap: ${gap(2)};
  width: min(420px, calc(100vw - 2 * ${gap(4)})); margin: 0; padding: 0; list-style: none; outline: none; }
${SHELL_BARS} {
  .ui-toast-viewport { left: ${gap(3)}; right: ${gap(3)}; width: auto;
    bottom: calc(${MOBILE_TAB_BAR_HEIGHT}px + env(safe-area-inset-bottom) + ${gap(3)}); }
}
.ui-toast { ${popover} display: flex; align-items: flex-start; gap: ${gap(3)}; padding: ${gap(1)} ${gap(1)} ${gap(1)} ${gap(4)};
  border-radius: var(--radius-lg); }
.ui-toast[data-state='open'] { animation: ui-fade-in var(--motion-base) var(--motion-easing); }
.ui-toast[data-swipe='move'] { translate: var(--radix-toast-swipe-move-x) 0; }
.ui-toast[data-swipe='end'] { translate: var(--radix-toast-swipe-end-x) 0; }
.ui-toast__icon { flex: none; margin-top: ${gap(3)}; }
.ui-toast--success .ui-toast__icon { color: ${color('success')}; }
.ui-toast--danger .ui-toast__icon { color: ${color('danger')}; }
.ui-toast--info .ui-toast__icon { color: ${color('info')}; }
.ui-toast__body { flex: 1; display: grid; gap: 2px; padding: ${gap(3)} 0; min-width: 0; }
.ui-toast__title { ${text('label')}; }
.ui-toast__description { ${text('body')}; color: ${color('textSecondary')}; }
`;

/** Inverted, so it never reads as another plate: plate-coloured words on ink. */
const tooltip = `
.ui-tooltip { ${text('caption')}; font-weight: 600; padding: ${gap(1)} ${gap(2)}; border-radius: var(--radius-sm);
  background: ${color('text')}; color: ${color('plate')}; z-index: 110; max-width: 32ch; }
.ui-tooltip__arrow { fill: ${color('text')}; }
`;

const popoverCss = `
.ui-popover { position: relative; }
.ui-popover__trigger { font: inherit; color: inherit; min-height: ${TAP}; margin: 0; border: 0; border-radius: var(--radius-md);
  background: transparent; cursor: pointer; ${transition('background-color')} }
.ui-popover__trigger:hover, .ui-popover__trigger[aria-expanded='true'] { background: ${color('raised')}; }
.ui-popover__panel { ${popover} position: absolute; z-index: 90; width: max-content; min-width: 240px;
  max-width: min(340px, calc(100vw - 2 * ${gap(4)})); padding: ${gap(2)}; border-radius: var(--radius-md);
  animation: ui-fade-in var(--motion-base) var(--motion-easing); }
.ui-popover__panel[hidden] { display: none; }
.ui-popover__panel--bottom-start { top: calc(100% + ${gap(2)}); left: 0; }
.ui-popover__panel--bottom-end { top: calc(100% + ${gap(2)}); right: 0; }
.ui-popover__panel--top-start { bottom: calc(100% + ${gap(2)}); left: 0; }
.ui-popover__panel--right-end { bottom: 0; left: calc(100% + ${gap(2)}); }
.ui-popover__panel--left-start { top: 0; right: calc(100% + ${gap(2)}); }
`;

const tabs = `
.ui-tabs__list { display: flex; gap: ${gap(1)}; border-bottom: ${HAIR}; overflow-x: auto; margin-bottom: ${gap(5)}; }
.ui-tabs__tab { ${text('label')}; position: relative; flex: none; min-height: ${TAP}; padding: 0 ${gap(3)}; border: 0;
  background: transparent; color: ${color('textSecondary')}; cursor: pointer; ${transition('color')} }
.ui-tabs__tab:hover { color: ${color('text')}; }
.ui-tabs__tab[data-state='active'] { color: ${color('accentText')}; font-weight: 800; }
.ui-tabs__tab[data-state='active']::after { content: ''; position: absolute; left: ${gap(3)}; right: ${gap(3)}; bottom: 0;
  height: 3px; background: ${color('accentText')}; }
/* The list scrolls sideways, which would clip an outside ring. */
.ui-tabs__tab:focus-visible { outline-offset: -3px; }
`;

export const overlaysCss = () =>
  [
    focusRing(['.ui-tabs__tab', '.ui-tabs__panel', '.ui-toast', '.ui-popover__trigger']),
    dialog,
    toast,
    tooltip,
    popoverCss,
    tabs,
  ].join('\n');
