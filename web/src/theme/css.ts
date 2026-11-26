import {
  colors,
  fontAxisLimits,
  fontFamily,
  fontWidth,
  radii,
  sizes,
  spacing,
  textScale,
  type TextScaleEntry,
  type TextStyleName,
} from '@huntclub/design';
// Archivo, Latin subset of the app's font file (see fonts/README.md); Vite fingerprints it.
import fontUrl from './fonts/Archivo-Latin.woff2?url';

/** Browser default root size: type is set in rem so it follows the reader's text-size setting. */
const ROOT_FONT_PX = 16;
const rem = (px: number) => `${px / ROOT_FONT_PX}rem`;

const kebab = (name: string) => name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

/** CSS custom properties for every design token, e.g. `--color-surface-raised`. */
export function tokenVariables(): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const [name, value] of Object.entries(colors)) vars[`--color-${kebab(name)}`] = value;
  for (const [name, value] of Object.entries(spacing)) vars[`--space-${name}`] = `${value}px`;
  for (const [name, value] of Object.entries(radii)) vars[`--radius-${kebab(name)}`] = `${value}px`;
  vars['--tap-min'] = `${sizes.minTapTarget}px`;
  vars['--button-min-height'] = `${sizes.primaryButtonMinHeight}px`;
  return vars;
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

/** The whole stylesheet: font face, tokens, base elements and components. */
export function globalCss(): string {
  const vars = Object.entries(tokenVariables())
    .map(([k, v]) => `${k}: ${v};`)
    .join(' ');
  return `
@font-face {
  font-family: '${fontFamily}';
  src: url('${fontUrl}') format('woff2');
  font-weight: ${fontAxisLimits.weight.min} ${fontAxisLimits.weight.max};
  font-stretch: ${fontAxisLimits.width.min}% ${fontAxisLimits.width.max}%;
  font-display: swap;
}
:root { ${vars} color-scheme: dark; }
* { box-sizing: border-box; }
html, body { margin: 0; background: var(--color-surface); color: var(--color-text); }
body { ${textStyleCss(textScale.body)}; }
${textClasses()}
h1 { ${textStyleCss(textScale.sheetTitle)}; margin: 0 0 var(--space-md); }
h2 { ${textStyleCss(textScale.bodyLarge)}; font-weight: 700; margin: var(--space-lg) 0 var(--space-sm); }
p { margin: 0 0 var(--space-md); }
.muted { color: var(--color-text-secondary); }
a { color: var(--color-text); }
:focus-visible { outline: 3px solid var(--color-accent); outline-offset: 2px; }
.layout { max-width: 960px; margin: 0 auto; padding: var(--space-lg) var(--space-md); }
.not-found { display: grid; justify-items: center; text-align: center; gap: var(--space-sm);
  padding: var(--space-xl) 0; }
.nav { display: flex; flex-wrap: wrap; gap: var(--space-sm); margin-bottom: var(--space-lg); }
.nav a { ${textStyleCss(textScale.label)}; display: inline-flex; align-items: center;
  min-height: var(--tap-min); padding: 0 var(--space-md); border-radius: var(--radius-control);
  background: var(--color-surface-raised); color: var(--color-text-secondary); text-decoration: none; }
.nav a[aria-current='page'] { color: var(--color-accent); font-weight: 700;
  text-decoration: underline; text-decoration-thickness: 3px; text-underline-offset: 6px; }
.skip-link { position: absolute; left: var(--space-md); top: -100px; z-index: 1;
  padding: var(--space-sm) var(--space-md); background: var(--color-surface-raised); }
.skip-link:focus { top: var(--space-md); }
.visually-hidden { position: absolute; width: 1px; height: 1px; overflow: hidden;
  clip-path: inset(50%); white-space: nowrap; }
h1:focus { outline: none; }
h1:focus-visible { outline: 3px solid var(--color-accent); outline-offset: 2px; }
.button { ${textStyleCss(textScale.label)}; min-height: var(--tap-min); padding: 0 var(--space-lg);
  border-radius: var(--radius-primary-button); border: 1px solid var(--color-border);
  background: var(--color-surface-raised); color: var(--color-text); cursor: pointer; }
.button.primary { min-height: var(--button-min-height); background: var(--color-accent);
  border-color: var(--color-accent); color: var(--color-surface); }
.button:disabled { opacity: 0.5; cursor: not-allowed; }
.button.wide { width: 100%; }
.row { display: flex; flex-wrap: wrap; gap: var(--space-md); }
fieldset.choices { border: 0; padding: 0; margin: 0 0 var(--space-md); display: flex; flex-wrap: wrap; gap: var(--space-sm); }
fieldset.choices legend { ${textStyleCss(textScale.label)}; margin-bottom: var(--space-xs); }
.choice { ${textStyleCss(textScale.body)}; display: inline-flex; align-items: center; gap: var(--space-sm);
  min-height: var(--tap-min); padding: 0 var(--space-md); border: 1px solid var(--color-border);
  border-radius: var(--radius-control); cursor: pointer; }
.choice input { width: 20px; height: 20px; accent-color: var(--color-accent); }
a.button { display: inline-flex; align-items: center; text-decoration: none; }
.field { display: grid; gap: var(--space-xs); margin-bottom: var(--space-md); }
.field input { ${textStyleCss(textScale.bodyLarge)}; min-height: var(--tap-min); padding: 0 var(--space-md);
  border-radius: var(--radius-control); border: 1px solid var(--color-control-border);
  background: var(--color-surface-raised); color: var(--color-text); }
.field input::placeholder { color: var(--color-text-secondary); }
/* 2 px accent edge on focus: the border plus a 1 px inset ring, so nothing shifts. */
.field input:focus { outline: none; border-color: var(--color-accent);
  box-shadow: inset 0 0 0 1px var(--color-accent); }
.field input[aria-invalid='true'] { border-color: var(--color-alert); }
.auth { display: grid; justify-items: center; gap: var(--space-md); padding-top: var(--space-lg); }
.auth-card { width: 100%; max-width: 440px; background: var(--color-surface-raised);
  border-radius: var(--radius-control); padding: var(--space-lg); }
.auth-card .field input { background: var(--color-surface); }
.auth-brand { display: flex; gap: var(--space-md); align-items: flex-start; margin-bottom: var(--space-lg); }
.auth-brand img { flex: none; }
.auth-brand p { margin: 0; }
.auth-app-name { ${textStyleCss(textScale.bodyLarge)}; font-weight: 700; }
.auth-secondary { margin-top: var(--space-md); }
.auth-footer { display: flex; gap: var(--space-lg); }
.auth-footer a { color: var(--color-text-secondary); display: inline-flex; align-items: center;
  min-height: var(--tap-min); }
.button + .panel { margin-top: var(--space-md); }
.panel { background: var(--color-surface-raised); border-radius: var(--radius-control);
  padding: var(--space-md); margin-bottom: var(--space-md); }
.table-scroll { overflow-x: auto; margin-bottom: var(--space-md); }
table { width: 100%; border-collapse: collapse; }
th, td { text-align: left; padding: var(--space-sm); border-bottom: 1px solid var(--color-border); }
th { color: var(--color-text-secondary); font-weight: 600; }
.banner { border: 1px solid var(--color-help); border-radius: var(--radius-control);
  padding: var(--space-sm) var(--space-md); margin-bottom: var(--space-md); }
.error { color: var(--color-alert); }
/* Narrow screens: stacked tables turn each row into a card with labelled cells. */
@media (max-width: 600px) {
  table.stack thead { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
  table.stack tr { display: block; padding: var(--space-sm) 0; border-bottom: 1px solid var(--color-border); }
  table.stack td { display: grid; grid-template-columns: 40% 1fr; gap: var(--space-sm); border: 0;
    padding: var(--space-xs) var(--space-sm); }
  table.stack td::before { content: attr(data-label); color: var(--color-text-secondary); font-weight: 600; }
}
.code { font-family: ui-monospace, monospace; word-break: break-all; }
`;
}
