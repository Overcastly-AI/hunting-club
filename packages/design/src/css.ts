// CSS for the web surfaces (club admin and public site), generated from the tokens so no
// page retypes a value. Plain strings: no DOM code here.
import { colors, mapPlanColors } from './colors';
import { breakpoints, motion, radii, sizes, spacing } from './sizes';
import {
  THEME_ATTRIBUTE,
  THEME_STORAGE_KEY,
  themes,
  type Theme,
  type ThemeEffects,
  type ThemeColorToken,
} from './theme';
import {
  fontAxisLimits,
  fontFamily,
  fontWidth,
  textScale,
  type TextScaleEntry,
  type TextStyleName,
} from './type';

/** Browser default root size: type is set in rem so it follows the reader's text-size setting. */
const ROOT_FONT_PX = 16;
export const rem = (px: number) => `${px / ROOT_FONT_PX}rem`;

/** `surfaceRaised` → `surface-raised`, `surface0` → `surface-0`, `title1` → `title-1`. */
const kebab = (name: string) => name.replace(/[A-Z]|\d+/g, (c) => `-${c.toLowerCase()}`);

/** Below this width the compact type sizes apply (phones). */
export const COMPACT_MEDIA = `(max-width: ${breakpoints.tablet - 1}px)`;

/** CSS custom properties for every design token, e.g. `--color-surface-raised`. */
export function tokenVariables(): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const [name, value] of Object.entries({ ...colors, ...mapPlanColors })) {
    vars[`--color-${kebab(name)}`] = value;
  }
  for (const [name, value] of Object.entries(spacing)) vars[`--space-${name}`] = `${value}px`;
  for (const [name, value] of Object.entries(radii)) vars[`--radius-${kebab(name)}`] = `${value}px`;
  vars['--tap-min'] = `${sizes.minTapTarget}px`;
  vars['--button-min-height'] = `${sizes.primaryButtonMinHeight}px`;
  vars['--control-border'] = `${sizes.controlBorder}px`;
  vars['--selected-border'] = `${sizes.selectedBorder}px`;
  vars['--motion-fast'] = `${motion.fast}ms`;
  vars['--motion-base'] = `${motion.base}ms`;
  vars['--motion-easing'] = motion.easing;
  return vars;
}

const declarations = (vars: Record<string, string>) =>
  Object.entries(vars)
    .map(([k, v]) => `${k}: ${v};`)
    .join(' ');

/** `:root { … }` declaring every token variable; motion is instant under reduced motion. */
export function rootVariablesCss(): string {
  return [
    `:root { ${declarations(tokenVariables())} color-scheme: dark; }`,
    `@media (prefers-reduced-motion: reduce) { :root { --motion-fast: 0ms; --motion-base: 0ms; } }`,
  ].join('\n');
}

/**
 * CSS custom properties for one theme: `--theme-plate`, `--theme-text`,
 * `--theme-shadow-plate`, `--theme-scrim`, … and `--theme-color-scheme` (`dark` or `light`),
 * which a page applies with `color-scheme: var(--theme-color-scheme)` when it adopts the theme.
 */
/**
 * The CSS variable of one theme colour or effect: `themeVar('successTint')` →
 * `var(--theme-success-tint)`. Typed, so a renamed token fails the build where it is used.
 */
export const themeVar = (token: ThemeColorToken | keyof ThemeEffects) =>
  `var(--theme-${kebab(token)})`;

export function themeVariables(theme: Theme): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const [name, value] of Object.entries({ ...theme.colors, ...theme.effects })) {
    vars[`--theme-${kebab(name)}`] = value;
  }
  vars['--theme-color-scheme'] = theme.colorScheme;
  return vars;
}

/**
 * The themes as CSS: dark on :root (and any `[data-theme="dark"]` subtree), light where
 * `[data-theme="light"]` is set, and light for "system" when the device prefers it (no
 * data-theme attribute). The attribute is set before first paint by themeBootstrapJs().
 */
export function themeCss(): string {
  const attr = (name: string) => `[${THEME_ATTRIBUTE}="${name}"]`;
  const dark = declarations(themeVariables(themes.dark));
  const light = declarations(themeVariables(themes.light));
  return [
    `:root, ${attr('dark')} { ${dark} }`,
    `@media (prefers-color-scheme: light) { :root:not(${attr('dark')}) { ${light} } }`,
    `${attr('light')} { ${light} }`,
  ].join('\n');
}

/**
 * The theme bootstrap: a tiny classic script, loaded from its own file in <head> before the
 * stylesheet (no inline script: the CSP is strict). It reads the reader's choice from
 * localStorage and sets data-theme on <html> before first paint. "system", no choice, an
 * unknown value or blocked storage leave the attribute off, so the device setting applies.
 */
export function themeBootstrapJs(): string {
  const forced = JSON.stringify(Object.keys(themes));
  return (
    `(function(){try{var t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});` +
    `if(${forced}.indexOf(t)>=0)document.documentElement.setAttribute(${JSON.stringify(THEME_ATTRIBUTE)},t)}` +
    `catch(e){}})();\n`
  );
}

/** CSS declarations for one named text style of the shared type scale. */
export function textStyleCss(entry: TextScaleEntry): string {
  const width = entry.width ?? fontWidth.normal;
  return [
    `font-family: '${fontFamily}', sans-serif`,
    `font-weight: ${entry.weight}`,
    `font-stretch: ${width}%`,
    `font-size: ${rem(entry.size)}`,
    entry.lineHeight === undefined ? '' : `line-height: ${rem(entry.lineHeight)}`,
    entry.tabularNums ? 'font-variant-numeric: tabular-nums' : '',
  ]
    .filter(Boolean)
    .join('; ');
}

/** The compact (phone) override of a text style, or '' when it has none. */
function compactCss(selector: string, entry: TextScaleEntry): string {
  if (!entry.compact) return '';
  const { size, lineHeight } = entry.compact;
  return `@media ${COMPACT_MEDIA} { ${selector} { font-size: ${rem(size)}; line-height: ${rem(lineHeight)}; } }`;
}

/** Utility classes `.text-body`, `.text-title-1`, … one per text style, with phone sizes. */
export function textClasses(): string {
  return (Object.entries(textScale) as [TextStyleName, TextScaleEntry][])
    .flatMap(([name, entry]) => {
      const selector = `.text-${kebab(name)}`;
      return [`${selector} { ${textStyleCss(entry)}; }`, compactCss(selector, entry)];
    })
    .filter(Boolean)
    .join('\n');
}

/** The Archivo @font-face for the WOFF2 at `url` (fonts/Archivo-Latin.woff2, fingerprinted). */
export function fontFaceCss(url: string): string {
  return `@font-face {
  font-family: '${fontFamily}';
  src: url('${url}') format('woff2');
  font-weight: ${fontAxisLimits.weight.min} ${fontAxisLimits.weight.max};
  font-stretch: ${fontAxisLimits.width.min}% ${fontAxisLimits.width.max}%;
  font-display: swap;
}`;
}

/** Matches the fingerprinted font file name, for the preload link. */
export const FONT_FILE_PATTERN = /Archivo-Latin-[\w-]+\.woff2$/;
