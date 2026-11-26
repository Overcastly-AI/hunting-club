// Helpers for the component stylesheets in this folder. Colours come only from the
// generated `--theme-*` variables (packages/design theme.ts); sizes from the design tokens.
import {
  breakpoints,
  COMPACT_MEDIA,
  space,
  textScale,
  textStyleCss,
  type TextStyleName,
} from '@huntclub/design';

/** Phones (below the tablet breakpoint): the same query as the compact type sizes. */
export const PHONE = `@media ${COMPACT_MEDIA}`;
/** Desktop and up. */
export const DESKTOP = `@media (min-width: ${breakpoints.desktop}px)`;

/** Declarations for one shared text style. */
export const text = (name: TextStyleName) => textStyleCss(textScale[name]);

/** A theme colour variable: `color('surface-1')` → `var(--theme-surface-1)`. */
export const color = (name: string) => `var(--theme-${name})`;

/** A spacing token: `gap(4)` → `var(--space-4)`. */
export const gap = (step: keyof typeof space) => `var(--space-${step})`;

/** The 2 px focus ring with a 2 px offset, on :focus-visible only (section 4.1). */
export const focusRing = (selectors: readonly string[]) =>
  `${selectors.map((s) => `${s}:focus-visible`).join(', ')} { outline: 2px solid ${color('focus-ring')}; outline-offset: 2px; }`;

/** Hover and press transitions (instant under reduced motion: the variables are 0ms). */
export const transition = (...props: string[]) =>
  `transition: ${props.map((p) => `${p} var(--motion-fast) var(--motion-easing)`).join(', ')};`;

/** Hidden from sight but read by screen readers and still focusable when it is a control. */
export const visuallyHidden =
  'position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap;';

/** Every control is at least this tall (docs/UI_REDESIGN.md: 48 px, no exceptions). */
export const TAP = 'var(--tap-min)';
