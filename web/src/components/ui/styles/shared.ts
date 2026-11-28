// Helpers for the component stylesheets in this folder. Colours come only from the
// generated `--theme-*` variables (packages/design theme.ts); sizes from the design tokens.
import {
  BUTTON_HEIGHT,
  breakpoints,
  COMPACT_MEDIA,
  SHORT_MEDIA,
  space,
  textScale,
  textStyleCss,
  themeVar,
  type TextStyleName,
} from '@huntclub/design';

/** Phones (below the tablet breakpoint): the same query as the compact type sizes. */
export const PHONE = `@media ${COMPACT_MEDIA}`;
const TABLET_QUERY = `(min-width: ${breakpoints.tablet}px) and (max-width: ${breakpoints.desktop - 1}px)`;
/** Tablets: from the tablet breakpoint up to desktop. */
export const TABLET = `@media ${TABLET_QUERY}`;
/**
 * The admin shell's phone layout (a top bar and the docked tab bar): a phone held upright, or
 * on its side (SHORT_MEDIA), so landscape has every tab, the club switcher and More, as portrait.
 */
export const SHELL_BARS_QUERY = `${COMPACT_MEDIA}, ${SHORT_MEDIA}`;
export const SHELL_BARS = `@media ${SHELL_BARS_QUERY}`;
/** The admin shell's icon rail: tablet widths tall enough to hold every item. */
export const SHELL_RAIL = `@media ${TABLET_QUERY} and (min-height: ${breakpoints.shortHeight}px)`;
/** Tablet and up (not phones). */
export const TABLET_UP = `@media (min-width: ${breakpoints.tablet}px)`;
/** Desktop and up, as a query (for matchMedia) and as a media rule. */
export const DESKTOP_QUERY = `(min-width: ${breakpoints.desktop}px)`;
export const DESKTOP = `@media ${DESKTOP_QUERY}`;

/** Declarations for one shared text style. */
export const text = (name: TextStyleName) => textStyleCss(textScale[name]);

/** A theme colour or effect, type-checked: `color('plate')` → `var(--theme-plate)`. */
export const color = themeVar;

/** A spacing token: `gap(4)` → `var(--space-4)`. */
export const gap = (step: keyof typeof space) => `var(--space-${step})`;

/** A control's outline: 1.5 px of `token` (the border-control edge by default). */
export const edge = (token: Parameters<typeof themeVar>[0] = 'borderControl') =>
  `var(--control-border) solid ${color(token)}`;

/** A plate floating over the map: the plate tone and the floating shadow (over imagery only). */
export const FLOATING = `background: ${color('plate')}; border-radius: var(--radius-lg); box-shadow: ${color('shadowPlate')};`;

/** A hairline: 1 px of border-subtle, dividing cells and rows. */
export const HAIR = `1px solid ${color('borderSubtle')}`;

/** The focus ring: 3 px of orange-as-text with a 2 px offset, on :focus-visible only. */
export const FOCUS_OUTLINE = `outline: 3px solid ${color('focusRing')}; outline-offset: 2px;`;
export const focusRing = (selectors: readonly string[]) =>
  `${selectors.map((s) => `${s}:focus-visible`).join(', ')} { ${FOCUS_OUTLINE} }`;

/** Hover and press transitions (instant under reduced motion: the variables are 0ms). */
export const transition = (...props: string[]) =>
  `transition: ${props.map((p) => `${p} var(--motion-fast) var(--motion-easing)`).join(', ')};`;

/** Hidden from sight but read by screen readers and still focusable when it is a control. */
export const visuallyHidden =
  'position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap;';

/** Every control is at least this tall (48 px, no exceptions). */
export const TAP = 'var(--tap-min)';

/** Text fields line up with the default button (52 px). */
export const FIELD_HEIGHT = `${BUTTON_HEIGHT.md}px`;
