// CSS for the web surfaces (club admin and public site), generated from the tokens so no
// page retypes a value. Plain strings: no DOM code here.
import { colors, mapPlanColors } from './colors';
import { mapChrome } from './mapChrome';
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
export const ROOT_FONT_PX = 16;
export const rem = (px: number) => `${px / ROOT_FONT_PX}rem`;

/** `surfaceRaised` → `surface-raised`, `surface0` → `surface-0`, `title1` → `title-1`. */
const kebab = (name: string) => name.replace(/[A-Z]|\d+/g, (c) => `-${c.toLowerCase()}`);

/** Below this width the compact type sizes apply (phones). */
export const COMPACT_MEDIA = `(max-width: ${breakpoints.tablet - 1}px)`;

/** Under desktop width and shorter than a tablet: a phone on its side. */
export const SHORT_MEDIA = `(max-width: ${breakpoints.desktop - 1}px) and (max-height: ${breakpoints.shortHeight - 1}px)`;

/** A phone held either way: narrower than `breakpoints.phone`, or on its side (SHORT_MEDIA). */
export const PHONE_MEDIA = `(max-width: ${breakpoints.phone - 1}px), ${SHORT_MEDIA}`;

/**
 * The iPhone's notch, rounded corners and home indicator, for CSS: what each edge of a web page
 * keeps clear once the viewport is viewport-fit=cover (VIEWPORT_META, @huntclub/shared); 0 on
 * screens without them. The club admin and the public site both pad with these.
 */
export const SAFE_AREA = {
  top: 'env(safe-area-inset-top, 0px)',
  right: 'env(safe-area-inset-right, 0px)',
  bottom: 'env(safe-area-inset-bottom, 0px)',
  left: 'env(safe-area-inset-left, 0px)',
} as const;

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
  Object.assign(vars, mapChromeVariables());
  return vars;
}

/** The map chrome spec as `--map-chrome-*` variables (px and ms), e.g. `--map-chrome-pill-height`. */
export function mapChromeVariables(): Record<string, string> {
  const { inset, pill, stack, sheet, footer, autoHide, labels } = mapChrome;
  const px = (n: number) => `${n}px`;
  return {
    '--map-chrome-inset': px(inset),
    '--map-chrome-pill-height': px(pill.height),
    '--map-chrome-pill-max-width': px(pill.maxWidth),
    '--map-chrome-pill-width': px(pill.width),
    '--map-chrome-stack-button': px(stack.button),
    '--map-chrome-stack-gap': px(stack.gap),
    '--map-chrome-zoom-width': px(stack.zoomWidth),
    '--map-chrome-zoom-height': px(stack.zoomHeight),
    '--map-chrome-sheet-handle': px(sheet.handleZone),
    '--map-chrome-sheet-peek': px(sheet.detents.peek),
    '--map-chrome-sheet-half': `${sheet.detents.half * 100}%`,
    '--map-chrome-sheet-full': `${sheet.detents.full * 100}%`,
    // The tallest any phone sheet gets (dialogs, menus), as a share of the window.
    '--map-chrome-sheet-max': `${sheet.detents.full * 100}dvh`,
    '--map-chrome-footer-height': px(footer.height),
    '--map-chrome-fade': `${autoHide.fadeMs}ms`,
    '--map-chrome-label-max-width': px(labels.maxWidth),
    '--map-chrome-label-max-height': px(labels.maxHeight),
    '--map-chrome-label-size': px(labels.text.size),
    '--map-chrome-label-weight': String(labels.text.weight),
    '--map-chrome-label-halo': px(labels.text.halo),
    '--map-chrome-label-color': themeVar(labels.text.color),
    '--map-chrome-label-halo-color': themeVar(labels.text.haloColor),
  };
}

const declarations = (vars: Record<string, string>) =>
  Object.entries(vars)
    .map(([k, v]) => `${k}: ${v};`)
    .join(' ');

/** `:root { … }` declaring every token variable; motion is instant under reduced motion. */
export function rootVariablesCss(): string {
  return [
    `:root { ${declarations(tokenVariables())} color-scheme: dark; }`,
    `@media (prefers-reduced-motion: reduce) { :root { --motion-fast: 0ms; --motion-base: 0ms; --map-chrome-fade: 0ms; } }`,
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

/** A smaller step of a text style under `media`, or '' when the style has none. */
function stepCss(
  media: string,
  selector: string,
  step: TextScaleEntry['compact'] | TextScaleEntry['phone'],
): string {
  if (!step) return '';
  return `@media ${media} { ${selector} { font-size: ${rem(step.size)}; line-height: ${rem(step.lineHeight)}; } }`;
}

/**
 * One text style as rules for `selector`: the style, then its compact step (below the tablet
 * width) and its phone step (PHONE_MEDIA), in that order so the smallest that applies wins.
 */
export function textRulesCss(selector: string, entry: TextScaleEntry): string {
  return [
    `${selector} { ${textStyleCss(entry)}; }`,
    stepCss(COMPACT_MEDIA, selector, entry.compact),
    stepCss(PHONE_MEDIA, selector, entry.phone),
  ]
    .filter(Boolean)
    .join('\n');
}

/** Utility classes `.text-body`, `.text-title-1`, … one per text style, with phone sizes. */
export function textClasses(): string {
  return (Object.entries(textScale) as [TextStyleName, TextScaleEntry][])
    .map(([name, entry]) => textRulesCss(`.text-${kebab(name)}`, entry))
    .join('\n');
}

/**
 * The base every web page starts from (the club admin and the public site): the Archivo face at
 * `fontUrl`, the token and theme variables, border-box sizing, native controls in the theme,
 * text the browser never inflates (iOS Safari enlarges text in landscape without it), and the
 * page in the canvas tone with the theme's text colour.
 */
export function baseCss(fontUrl: string): string {
  return [
    fontFaceCss(fontUrl),
    rootVariablesCss(),
    themeCss(),
    '* { box-sizing: border-box; }',
    'html { color-scheme: var(--theme-color-scheme); -webkit-text-size-adjust: 100%; text-size-adjust: 100%; }',
    `html, body { margin: 0; background: ${themeVar('canvas')}; color: ${themeVar('text')}; }`,
  ].join('\n');
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
