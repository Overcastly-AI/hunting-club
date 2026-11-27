// Dialog (native <dialog>), Toast and Tooltip (Radix), Tabs (Radix).
import { MOBILE_TAB_BAR_HEIGHT } from '../sizes';
import { color, focusRing, gap, PHONE, TAP, text, transition } from './shared';

/** Floating layers (menus, toasts, tooltips): s2, a 1 px border and the popover shadow. */
const popover = `background: ${color('surface-2')}; border: 1px solid ${color('border-subtle')};
  box-shadow: ${color('shadow-popover')}; color: ${color('text')};`;

const dialog = `
html.ui-scroll-lock { overflow: hidden; }
.ui-dialog { width: min(560px, calc(100vw - 2 * ${gap(4)})); max-height: calc(100dvh - 2 * ${gap(8)}); padding: 0;
  border: 1px solid ${color('border-subtle')}; border-radius: var(--radius-xl); background: ${color('surface-1')};
  color: ${color('text')}; box-shadow: ${color('shadow-dialog')}; color-scheme: var(--theme-color-scheme); }
.ui-dialog[open] { display: flex; flex-direction: column; animation: ui-fade-in var(--motion-base) var(--motion-easing); }
.ui-dialog:focus { outline: none; }
.ui-dialog::backdrop { background: ${color('scrim')}; }
.ui-dialog__header { display: flex; align-items: flex-start; justify-content: space-between; gap: ${gap(3)};
  padding: ${gap(5)} ${gap(4)} 0 ${gap(6)}; }
.ui-dialog__title { ${text('title2')}; margin: 0; padding-top: ${gap(2)}; }
.ui-dialog__description { ${text('body')}; color: ${color('text-secondary')}; margin: ${gap(2)} 0 0; }
.ui-dialog__body { padding: ${gap(4)} ${gap(6)}; overflow-y: auto; }
.ui-dialog__footer { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: ${gap(3)};
  padding: ${gap(4)} ${gap(6)} ${gap(6)}; }
@keyframes ui-fade-in { from { opacity: 0; } }
/* Phones: a full-width sheet from the bottom, the main action on top and full width. */
${PHONE} {
  .ui-dialog { width: 100%; max-width: 100%; margin: auto 0 0; max-height: calc(100dvh - ${gap(8)});
    border-radius: var(--radius-xl) var(--radius-xl) 0 0; border-bottom: 0;
    padding-bottom: env(safe-area-inset-bottom); }
  .ui-dialog__footer { flex-direction: column-reverse; }
  .ui-dialog__footer .ui-button { width: 100%; }
}
`;

const toast = `
.ui-toast-viewport { position: fixed; right: ${gap(6)}; bottom: ${gap(6)}; z-index: 100; display: grid; gap: ${gap(3)};
  width: min(420px, calc(100vw - 2 * ${gap(4)})); margin: 0; padding: 0; list-style: none; outline: none; }
${PHONE} {
  .ui-toast-viewport { left: ${gap(4)}; right: ${gap(4)}; width: auto;
    bottom: calc(${MOBILE_TAB_BAR_HEIGHT}px + env(safe-area-inset-bottom) + ${gap(4)}); }
}
.ui-toast { ${popover} display: flex; align-items: flex-start; gap: ${gap(3)}; padding: ${gap(3)} ${gap(2)} ${gap(3)} ${gap(4)};
  border-radius: var(--radius-md); }
.ui-toast[data-state='open'] { animation: ui-fade-in var(--motion-base) var(--motion-easing); }
.ui-toast[data-swipe='move'] { translate: var(--radix-toast-swipe-move-x) 0; }
.ui-toast[data-swipe='end'] { translate: var(--radix-toast-swipe-end-x) 0; }
.ui-toast__icon { flex: none; margin-top: ${gap(3)}; }
.ui-toast--success .ui-toast__icon { color: ${color('success')}; }
.ui-toast--danger .ui-toast__icon { color: ${color('danger')}; }
.ui-toast--info .ui-toast__icon { color: ${color('info')}; }
.ui-toast__body { flex: 1; display: grid; gap: ${gap(1)}; padding: ${gap(3)} 0; min-width: 0; }
.ui-toast__title { ${text('label')}; }
.ui-toast__description { ${text('body')}; color: ${color('text-secondary')}; }
`;

const tooltip = `
.ui-tooltip { ${popover} ${text('caption')}; padding: ${gap(1)} ${gap(2)}; border-radius: var(--radius-sm);
  z-index: 110; max-width: 32ch; }
.ui-tooltip__arrow { fill: ${color('surface-2')}; }
`;

const tabs = `
.ui-tabs__list { display: flex; gap: ${gap(1)}; border-bottom: 1px solid ${color('border-subtle')}; overflow-x: auto;
  margin-bottom: ${gap(6)}; }
.ui-tabs__tab { ${text('label')}; position: relative; flex: none; min-height: ${TAP}; padding: 0 ${gap(4)}; border: 0;
  border-radius: var(--radius-sm) var(--radius-sm) 0 0; background: transparent; color: ${color('text-secondary')};
  cursor: pointer; ${transition('background-color', 'color')} }
.ui-tabs__tab:hover { color: ${color('text')}; background: ${color('surface-2')}; }
.ui-tabs__tab[data-state='active'] { color: ${color('accent-text')}; }
.ui-tabs__tab[data-state='active']::after { content: ''; position: absolute; left: 0; right: 0; bottom: 0; height: 3px;
  border-radius: 3px 3px 0 0; background: ${color('accent')}; }
/* The list scrolls sideways, which would clip an outside ring. */
.ui-tabs__tab:focus-visible { outline-offset: -2px; }
`;

export const overlaysCss = () =>
  [focusRing(['.ui-tabs__tab', '.ui-tabs__panel', '.ui-toast']), dialog, toast, tooltip, tabs].join(
    '\n',
  );
