// CSS for the web surfaces (club admin and public site), generated from the tokens so no
// page retypes a value. Plain strings: no DOM code here.
import { colors, lightColors } from './colors';
import { radii, sizes, spacing } from './sizes';
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

const kebab = (name: string) => name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

/** CSS custom properties for every design token, e.g. `--color-surface-raised`. */
export function tokenVariables(): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const [name, value] of Object.entries({ ...colors, ...lightColors })) {
    vars[`--color-${kebab(name)}`] = value;
  }
  for (const [name, value] of Object.entries(spacing)) vars[`--space-${name}`] = `${value}px`;
  for (const [name, value] of Object.entries(radii)) vars[`--radius-${kebab(name)}`] = `${value}px`;
  vars['--tap-min'] = `${sizes.minTapTarget}px`;
  vars['--button-min-height'] = `${sizes.primaryButtonMinHeight}px`;
  return vars;
}

/** `:root { … }` declaring every token variable. */
export function rootVariablesCss(): string {
  const vars = Object.entries(tokenVariables())
    .map(([k, v]) => `${k}: ${v};`)
    .join(' ');
  return `:root { ${vars} color-scheme: dark; }`;
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
  ]
    .filter(Boolean)
    .join('; ');
}

/** Utility classes `.text-body`, `.text-sheet-title`, … one per text style. */
export function textClasses(): string {
  return (Object.entries(textScale) as [TextStyleName, TextScaleEntry][])
    .map(([name, entry]) => `.text-${kebab(name)} { ${textStyleCss(entry)}; }`)
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
