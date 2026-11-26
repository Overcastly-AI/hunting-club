// Button, Field (Input, Select, Textarea), Checkbox, Switch, RadioGroup and Segmented.
import { space } from '@huntclub/design';
import { BUTTON_HEIGHT, BUTTON_PADDING, ICON, type ButtonSize } from '../sizes';
import { color, focusRing, gap, PHONE, TAP, text, transition, visuallyHidden } from './shared';

/** While loading, the spinner takes an icon slot; the padding shrinks so the width holds. */
const busyPadding = (size: ButtonSize) => BUTTON_PADDING[size] - (ICON.md + space[2]) / 2;

const buttonSizes = (Object.keys(BUTTON_HEIGHT) as ButtonSize[])
  .map(
    (
      size,
    ) => `.ui-button--${size} { min-height: ${BUTTON_HEIGHT[size]}px; padding: 0 ${BUTTON_PADDING[size]}px; }
.ui-button--${size}.ui-button--busy-pad { padding: 0 ${busyPadding(size)}px; }
.ui-button--${size}.ui-button--icon-only { width: ${BUTTON_HEIGHT[size]}px; padding: 0; }`,
  )
  .join('\n');

const button = `
.ui-button { ${text('label')}; display: inline-flex; align-items: center; justify-content: center;
  gap: ${gap(2)}; border-radius: var(--radius-md); border: 1px solid transparent; cursor: pointer;
  text-decoration: none; white-space: nowrap; flex: none; ${transition('background-color', 'border-color', 'color')} }
${buttonSizes}
.ui-button svg { flex: none; }
.ui-button--primary { background: ${color('accent')}; border-color: ${color('accent-border')}; color: ${color('on-accent')}; }
.ui-button--primary:hover { background: ${color('accent-hover')}; }
.ui-button--secondary { background: ${color('surface-2')}; border-color: ${color('border-subtle')}; color: ${color('text')}; }
.ui-button--secondary:hover { background: ${color('surface-3')}; }
.ui-button--tertiary { background: transparent; color: ${color('text')}; }
.ui-button--tertiary:hover { background: ${color('surface-2')}; }
.ui-button--danger { background: transparent; border-color: ${color('danger')}; color: ${color('danger')}; }
.ui-button--danger:hover { background: ${color('danger-tint')}; }
.ui-button--danger-filled { background: ${color('danger')}; border-color: ${color('danger')}; color: ${color('on-danger')}; }
.ui-button--link { background: transparent; color: ${color('accent-text')}; text-decoration: underline;
  text-underline-offset: 3px; padding-left: ${gap(1)}; padding-right: ${gap(1)}; }
.ui-button--link:hover { text-decoration-thickness: 2px; }
.ui-button--block { display: flex; width: 100%; }
.ui-button:disabled, .ui-button[aria-disabled='true'] { cursor: not-allowed; background: ${color('surface-2')};
  border-color: ${color('border-subtle')}; color: ${color('text-tertiary')}; }
.ui-button--tertiary:disabled, .ui-button--link:disabled, .ui-button--tertiary[aria-disabled='true'],
  .ui-button--link[aria-disabled='true'] { background: transparent; border-color: transparent; }
.ui-button[aria-busy='true'] { cursor: progress; }
.ui-spinner { width: ${ICON.md}px; height: ${ICON.md}px; flex: none; border-radius: var(--radius-full);
  border: 2px solid currentColor; border-right-color: transparent; animation: ui-spin 800ms linear infinite; }
@keyframes ui-spin { to { transform: rotate(360deg); } }
`;

const field = `
.ui-field { display: grid; gap: ${gap(2)}; align-content: start; }
.ui-field__label { ${text('label')}; color: ${color('text')}; }
.ui-field__hint { ${text('caption')}; color: ${color('text-tertiary')}; margin-top: calc(${gap(1)} - ${gap(2)}); }
.ui-field__error { ${text('caption')}; font-weight: 600; color: ${color('danger')}; display: flex; gap: ${gap(1)};
  align-items: flex-start; }
.ui-field__error svg { flex: none; margin-top: 2px; }
.ui-input, .ui-select, .ui-textarea { ${text('body')}; width: 100%; min-height: ${TAP}; padding: 0 ${gap(4)};
  border-radius: var(--radius-md); border: 1px solid ${color('border-control')}; background: ${color('surface-2')};
  color: ${color('text')}; color-scheme: var(--theme-color-scheme); }
.ui-textarea { min-height: calc(2 * ${TAP}); padding: ${gap(3)} ${gap(4)}; resize: vertical; }
.ui-input::placeholder, .ui-textarea::placeholder { color: ${color('text-tertiary')}; }
/* 2 px accent edge on focus: the border plus a 1 px inset ring, so nothing shifts. */
.ui-input:focus, .ui-select:focus, .ui-textarea:focus { outline: none; border-color: ${color('accent')};
  box-shadow: inset 0 0 0 1px ${color('accent')}; }
.ui-input[aria-invalid='true'], .ui-select[aria-invalid='true'], .ui-textarea[aria-invalid='true'] {
  border-color: ${color('danger')}; }
.ui-input:disabled, .ui-select:disabled, .ui-textarea:disabled { cursor: not-allowed; color: ${color('text-tertiary')};
  background: ${color('surface-1')}; border-color: ${color('border-subtle')}; }
.ui-select-wrap { position: relative; }
.ui-select { appearance: none; padding-right: ${gap(10)}; cursor: pointer; }
.ui-select-wrap svg { position: absolute; right: ${gap(3)}; top: 50%; translate: 0 -50%; pointer-events: none;
  color: ${color('text-secondary')}; }
`;

/** The box of a checkbox and the dot of a radio: a native input drawn by us. */
const choice = `
.ui-check, .ui-radio { display: flex; align-items: flex-start; gap: ${gap(3)}; min-height: ${TAP};
  padding: ${gap(3)} 0; cursor: pointer; color: ${color('text')}; }
.ui-check__box { position: relative; flex: none; width: ${ICON.lg}px; height: ${ICON.lg}px; }
.ui-check__input, .ui-radio__input { appearance: none; margin: 0; width: ${ICON.lg}px; height: ${ICON.lg}px; flex: none;
  border: 1px solid ${color('border-control')}; background: ${color('surface-2')}; cursor: pointer;
  ${transition('background-color', 'border-color')} }
.ui-check__input { border-radius: var(--radius-sm); }
.ui-check__input:checked { background: ${color('accent')}; border-color: ${color('accent-border')}; }
.ui-check__icon { position: absolute; inset: 2px; color: ${color('on-accent')}; pointer-events: none; visibility: hidden; }
.ui-check__input:checked + .ui-check__icon { visibility: visible; }
.ui-radio__input { border-radius: var(--radius-full); }
.ui-radio__input:checked { border: 7px solid ${color('accent')}; background: ${color('on-accent')}; }
.ui-check__input:disabled, .ui-radio__input:disabled { cursor: not-allowed; border-color: ${color('border-subtle')}; }
.ui-check__text, .ui-radio__text { display: grid; gap: ${gap(1)}; padding-top: 2px; }
.ui-check__label, .ui-radio__label { ${text('label')}; }
.ui-check__hint, .ui-radio__hint { ${text('caption')}; color: ${color('text-tertiary')}; }
.ui-choice-group { border: 0; padding: 0; margin: 0; min-width: 0; display: grid; gap: ${gap(2)}; }
.ui-radio-list { display: grid; gap: ${gap(2)}; }
.ui-choice-group__legend { ${text('label')}; color: ${color('text')}; padding: 0; margin-bottom: ${gap(2)}; }
/* List radios: each option is a bordered row; the selected one gets the accent edge. */
.ui-radio--card { padding: ${gap(3)} ${gap(4)}; border: 1px solid ${color('border-control')};
  border-radius: var(--radius-md); background: ${color('surface-1')}; }
.ui-radio--card:has(:checked) { border-color: ${color('accent')}; box-shadow: inset 0 0 0 1px ${color('accent')}; }
`;

const switchCss = `
.ui-switch { display: inline-flex; align-items: center; gap: ${gap(3)}; min-height: ${TAP}; cursor: pointer;
  color: ${color('text')}; position: relative; }
.ui-switch__input { ${visuallyHidden} }
.ui-switch__track { flex: none; position: relative; width: 44px; height: ${ICON.lg + space[1]}px;
  border-radius: var(--radius-full); border: 1px solid ${color('border-control')}; background: ${color('surface-3')};
  ${transition('background-color', 'border-color')} }
.ui-switch__thumb { position: absolute; top: 3px; left: 3px; width: ${ICON.md}px; height: ${ICON.md}px;
  border-radius: var(--radius-full); background: ${color('text-secondary')}; ${transition('translate', 'background-color')} }
.ui-switch__input:checked + .ui-switch__track { background: ${color('accent')}; border-color: ${color('accent-border')}; }
.ui-switch__input:checked + .ui-switch__track .ui-switch__thumb { translate: ${ICON.md - space[1]}px 0;
  background: ${color('on-accent')}; }
.ui-switch__input:focus-visible + .ui-switch__track { outline: 2px solid ${color('focus-ring')}; outline-offset: 2px; }
.ui-switch__input:disabled + .ui-switch__track { border-color: ${color('border-subtle')}; }
.ui-switch:has(:disabled) { cursor: not-allowed; color: ${color('text-tertiary')}; }
.ui-switch__label { ${text('label')}; }
`;

const segmented = `
.ui-segmented { display: inline-flex; flex-wrap: wrap; gap: ${gap(1)}; padding: ${gap(1)}; max-width: 100%;
  border: 1px solid ${color('border-control')}; border-radius: var(--radius-md); background: ${color('surface-2')}; }
.ui-segmented--block { display: flex; }
.ui-segmented--block .ui-segment { flex: 1 1 0; }
.ui-segment { ${text('label')}; position: relative; display: inline-flex; flex-direction: column; align-items: center;
  justify-content: center; gap: ${gap(2)}; min-height: ${TAP}; padding: ${gap(1)} ${gap(4)}; border-radius: var(--radius-sm);
  color: ${color('text-secondary')}; cursor: pointer; ${transition('background-color', 'color')} }
.ui-segment__row { display: inline-flex; align-items: center; gap: ${gap(2)}; }
.ui-segment:hover { color: ${color('text')}; background: ${color('surface-3')}; }
.ui-segment__input { position: absolute; inset: 0; margin: 0; opacity: 0; cursor: pointer; }
.ui-segment:has(:checked) { background: ${color('accent')}; color: ${color('on-accent')}; }
.ui-segment:has(:focus-visible) { outline: 2px solid ${color('focus-ring')}; outline-offset: 2px; }
.ui-segment:has(:disabled) { cursor: not-allowed; color: ${color('text-tertiary')}; background: transparent; }
.ui-segment__preview { display: block; border-radius: var(--radius-sm); overflow: hidden; }
${PHONE} { .ui-segmented { display: flex; } .ui-segment { flex: 1 1 0; } }
`;

export const controlsCss = () =>
  [
    button,
    field,
    choice,
    switchCss,
    segmented,
    focusRing(['.ui-button', '.ui-check__input', '.ui-radio__input']),
  ].join('\n');
