// Button, Field (Input, Select, Textarea), Checkbox, Switch, RadioGroup and Segmented, in the
// map-first look (docs/DESIGN.md): squared controls with a 1.5 px edge and a word on each,
// orange only for the main action and the selected item, "on" drawn in ink.
import { BUTTON_HEIGHT, BUTTON_PADDING, ICON_SIZE, space, type ButtonSize } from '@huntclub/design';
import {
  color,
  edge,
  FIELD_HEIGHT,
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

/** While loading, the spinner takes an icon slot; the padding shrinks so the width holds. */
const busyPadding = (size: ButtonSize) => BUTTON_PADDING[size] - (ICON_SIZE.md + space[2]) / 2;

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
.ui-button { ${text('button')}; display: inline-flex; align-items: center; justify-content: center;
  gap: ${gap(2)}; border-radius: var(--radius-md); border: ${edge()}; cursor: pointer;
  text-decoration: none; white-space: nowrap; flex: none; ${transition('background-color', 'border-color', 'color')} }
${buttonSizes}
.ui-button--lg { ${text('title3')}; }
.ui-button svg { flex: none; }
.ui-button--primary { background: ${color('accent')}; border-color: ${color('accentBorder')}; color: ${color('onAccent')}; }
.ui-button--primary:hover { background: ${color('accentHover')}; }
.ui-button--secondary { background: ${color('raised')}; color: ${color('text')}; }
.ui-button--secondary:hover { background: ${color('pressed')}; }
.ui-button--tertiary { background: transparent; border-color: transparent; color: ${color('text')}; }
.ui-button--tertiary:hover { background: ${color('raised')}; }
.ui-button--danger { background: transparent; border-color: ${color('danger')}; color: ${color('danger')}; }
.ui-button--danger:hover { background: ${color('dangerTint')}; }
.ui-button--danger-filled { background: ${color('danger')}; border-color: ${color('danger')}; color: ${color('onDanger')}; }
.ui-button--link { background: transparent; border-color: transparent; color: ${color('accentText')};
  text-decoration: underline; text-underline-offset: 3px; padding-left: ${gap(1)}; padding-right: ${gap(1)}; }
.ui-button--link:hover { text-decoration-thickness: 2px; }
.ui-button--block { display: flex; width: 100%; }
.ui-button:disabled, .ui-button[aria-disabled='true'] { cursor: not-allowed; background: transparent;
  border-color: ${color('borderSubtle')}; color: ${color('textTertiary')}; }
.ui-button--tertiary:disabled, .ui-button--link:disabled, .ui-button--tertiary[aria-disabled='true'],
  .ui-button--link[aria-disabled='true'] { border-color: transparent; }
.ui-button[aria-busy='true'] { cursor: progress; }
.ui-spinner { width: ${ICON_SIZE.md}px; height: ${ICON_SIZE.md}px; flex: none; border-radius: var(--radius-full);
  border: 2px solid currentColor; border-right-color: transparent; animation: ui-spin 800ms linear infinite; }
@keyframes ui-spin { to { transform: rotate(360deg); } }
`;

/** Text fields are recessed: the page tone (pit) inside a plate, with the control edge. */
const field = `
.ui-field { display: grid; gap: ${gap(2)}; align-content: start; }
.ui-field__label { ${text('label')}; color: ${color('text')}; }
.ui-field__hint { ${text('caption')}; color: ${color('textSecondary')}; margin-top: calc(${gap(1)} - ${gap(2)}); }
.ui-field__error { ${text('caption')}; font-weight: 700; color: ${color('danger')}; display: flex; gap: ${gap(1)};
  align-items: flex-start; }
.ui-field__error svg { flex: none; margin-top: 2px; }
.ui-input, .ui-select, .ui-textarea { ${text('bodyLarge')}; width: 100%; min-height: ${FIELD_HEIGHT}; padding: 0 ${gap(3)};
  border-radius: var(--radius-md); border: ${edge()}; background: ${color('canvas')};
  color: ${color('text')}; color-scheme: var(--theme-color-scheme); }
.ui-textarea { min-height: calc(2 * ${TAP}); padding: ${gap(3)}; resize: vertical; }
.ui-input::placeholder, .ui-textarea::placeholder { color: ${color('textTertiary')}; }
/* A 3 px orange edge on focus: the border plus an inset ring, so nothing shifts. */
.ui-input:focus, .ui-select:focus, .ui-textarea:focus { outline: none; border-color: ${color('focusRing')};
  box-shadow: inset 0 0 0 1.5px ${color('focusRing')}; }
.ui-input[aria-invalid='true'], .ui-select[aria-invalid='true'], .ui-textarea[aria-invalid='true'] {
  border-color: ${color('danger')}; }
.ui-input:disabled, .ui-select:disabled, .ui-textarea:disabled { cursor: not-allowed; color: ${color('textTertiary')};
  background: transparent; border-color: ${color('borderSubtle')}; }
.ui-select-wrap { position: relative; }
.ui-select { appearance: none; padding-right: ${gap(10)}; cursor: pointer; }
.ui-select-wrap svg { position: absolute; right: ${gap(3)}; top: 50%; translate: 0 -50%; pointer-events: none;
  color: ${color('textSecondary')}; }
`;

/**
 * A checkbox is "on", so it fills with ink (orange is kept for the selected item). A radio
 * picks an item, so its dot is orange, on the accent edge.
 */
const choice = `
.ui-check, .ui-radio { display: flex; align-items: flex-start; gap: ${gap(3)}; min-height: ${TAP};
  padding: ${gap(3)} 0; cursor: pointer; color: ${color('text')}; }
.ui-check__box { position: relative; flex: none; width: ${ICON_SIZE.lg}px; height: ${ICON_SIZE.lg}px; }
.ui-check__input, .ui-radio__input { appearance: none; margin: 0; width: ${ICON_SIZE.lg}px; height: ${ICON_SIZE.lg}px; flex: none;
  border: ${edge()}; background: ${color('canvas')}; cursor: pointer;
  ${transition('background-color', 'border-color')} }
.ui-check__input { border-radius: var(--radius-sm); }
.ui-check__input:checked { background: ${color('text')}; border-color: ${color('text')}; }
.ui-check__icon { position: absolute; inset: 2px; color: ${color('plate')}; pointer-events: none; visibility: hidden; }
.ui-check__input:checked + .ui-check__icon { visibility: visible; }
.ui-radio__input { border-radius: var(--radius-full); }
.ui-radio__input:checked { border: var(--selected-border) solid ${color('accentBorder')};
  background: radial-gradient(circle, ${color('accent')} 0 6px, transparent 7px) ${color('canvas')}; }
.ui-check__input:disabled, .ui-radio__input:disabled { cursor: not-allowed; border-color: ${color('borderSubtle')}; }
.ui-check__input:checked:disabled { background: ${color('textTertiary')}; border-color: ${color('textTertiary')}; }
.ui-check:has(:disabled), .ui-radio:has(:disabled) { cursor: not-allowed; color: ${color('textTertiary')}; }
.ui-check__text, .ui-radio__text { display: grid; gap: 2px; padding-top: 1px; }
.ui-check__label, .ui-radio__label { ${text('label')}; }
.ui-check__hint, .ui-radio__hint { ${text('caption')}; color: ${color('textSecondary')}; }
.ui-choice-group { border: 0; padding: 0; margin: 0; min-width: 0; display: grid; gap: ${gap(2)}; }
.ui-choice-group__legend { ${text('label')}; color: ${color('text')}; padding: 0; margin-bottom: ${gap(2)}; }
/* List radios: rows divided by hairlines on one plate (no box per row); the chosen row is raised. */
.ui-radio-list { display: grid; border: ${HAIR}; border-radius: var(--radius-lg); background: ${color('plate')};
  overflow: hidden; }
.ui-radio--card { padding: ${gap(3)} ${gap(4)}; min-height: 56px; ${transition('background-color')} }
.ui-radio--card + .ui-radio--card { border-top: ${HAIR}; }
.ui-radio--card:has(:checked) { background: ${color('raised')}; }
.ui-radio--card:has(:focus-visible) { ${FOCUS_OUTLINE} outline-offset: -3px; }
`;

/** Off: an outline and a grey knob. On: ink, with a plate knob (never orange: on is not a pick). */
const switchCss = `
.ui-switch { display: flex; width: fit-content; align-items: center; gap: ${gap(3)}; min-height: ${TAP}; cursor: pointer;
  color: ${color('text')}; position: relative; }
.ui-switch__input { ${visuallyHidden} }
.ui-switch__track { flex: none; position: relative; width: 46px; height: 28px;
  border-radius: var(--radius-full); border: ${edge()}; background: transparent;
  ${transition('background-color', 'border-color')} }
.ui-switch__thumb { position: absolute; top: 3px; left: 3px; width: ${ICON_SIZE.md - space[1] / 2}px;
  height: ${ICON_SIZE.md - space[1] / 2}px; border-radius: var(--radius-full); background: ${color('borderControl')};
  ${transition('translate', 'background-color')} }
.ui-switch__input:checked + .ui-switch__track { background: ${color('text')}; border-color: ${color('text')}; }
.ui-switch__input:checked + .ui-switch__track .ui-switch__thumb { translate: 18px 0;
  background: ${color('plate')}; }
.ui-switch__input:focus-visible + .ui-switch__track { ${FOCUS_OUTLINE} }
.ui-switch__input:disabled + .ui-switch__track { border-color: ${color('borderSubtle')}; }
.ui-switch__input:disabled + .ui-switch__track .ui-switch__thumb { background: ${color('borderSubtle')}; }
.ui-switch:has(:disabled) { cursor: not-allowed; color: ${color('textTertiary')}; }
.ui-switch__label { ${text('label')}; }
`;

/** One squared outline, segments divided by the edge; the chosen one is inverted (ink). */
const segmented = `
.ui-segmented { display: inline-flex; justify-self: start; max-width: 100%; border: ${edge()}; border-radius: var(--radius-md);
  overflow: hidden; background: ${color('plate')}; }
.ui-segmented--block { display: flex; justify-self: stretch; }
.ui-segmented--block .ui-segment { flex: 1 1 0; }
.ui-segment { ${text('button')}; position: relative; display: inline-flex; flex-direction: column; align-items: center;
  justify-content: center; gap: ${gap(1)}; min-height: ${TAP}; padding: ${gap(1)} ${gap(4)};
  color: ${color('textSecondary')}; cursor: pointer; ${transition('background-color', 'color')} }
.ui-segment + .ui-segment { border-left: ${edge()}; }
.ui-segment__row { display: inline-flex; align-items: center; gap: ${gap(2)}; }
.ui-segment:hover { color: ${color('text')}; background: ${color('raised')}; }
.ui-segment__input { position: absolute; inset: 0; margin: 0; opacity: 0; cursor: pointer; }
.ui-segment:has(:checked) { background: ${color('text')}; color: ${color('plate')}; }
.ui-segment:has(:focus-visible) { ${FOCUS_OUTLINE} outline-offset: -4px; }
.ui-segment:has(:disabled) { cursor: not-allowed; color: ${color('textTertiary')}; background: transparent; }
.ui-segment:has(:checked:disabled) { background: ${color('raised')}; color: ${color('textTertiary')}; }
.ui-segment__preview { display: block; border-radius: var(--radius-sm); overflow: hidden; }
${PHONE} { .ui-segmented { display: flex; justify-self: stretch; } .ui-segment { flex: 1 1 0; } }
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
