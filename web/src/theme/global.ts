// The admin's whole stylesheet as a pure function of the font URL: the Vite plugin
// (../../global-stylesheet.ts) writes it to a hashed file at build time, so the page needs
// no inline styles under its Content-Security-Policy; tests and `vite dev` use globalCss().
// Colours are the theme's (`--theme-*`), so dark and light both work.
import {
  fontFaceCss,
  rootVariablesCss,
  textClasses,
  textScale,
  textStyleCss,
  themeCss,
} from '@huntclub/design';
import { uiCss } from '../components/ui/styles';
import { color } from '../components/ui/styles/shared';
import { shellCss } from '../shell/styles';

/** The whole stylesheet: font face, tokens, base elements, components and the shell. */
export function globalCssFor(fontUrl: string): string {
  return `
${fontFaceCss(fontUrl)}
${rootVariablesCss()}
${themeCss()}
* { box-sizing: border-box; }
/* Native controls and scrollbars follow the theme. */
html { color-scheme: var(--theme-color-scheme); }
html, body { margin: 0; background: ${color('canvas')}; color: ${color('text')}; }
body { ${textStyleCss(textScale.body)}; }
${textClasses()}
h1 { ${textStyleCss(textScale.sheetTitle)}; margin: 0 0 var(--space-md); }
h2 { ${textStyleCss(textScale.bodyLarge)}; font-weight: 700; margin: var(--space-lg) 0 var(--space-sm); }
p { margin: 0 0 var(--space-md); }
.muted { color: ${color('text-secondary')}; }
a { color: ${color('text')}; }
:focus-visible { outline: 2px solid ${color('focus-ring')}; outline-offset: 2px; }
/* Pages outside the signed-in shell: sign-in, Checkout return, Page not found off /app/. */
.layout { max-width: calc(960px + 2 * var(--space-md)); margin: 0 auto; padding: var(--space-lg) var(--space-md); }
.summary-row { display: flex; flex-wrap: wrap; gap: var(--space-sm); list-style: none;
  padding: 0; margin: var(--space-md) 0 0; }
.summary-row a { display: inline-flex; align-items: center; gap: var(--space-sm);
  min-height: var(--tap-min); padding: 0 var(--space-md); border-radius: var(--radius-control);
  background: ${color('surface-2')}; text-decoration: none; }
.skip-link { position: absolute; left: var(--space-md); top: -100px; z-index: 100;
  padding: var(--space-sm) var(--space-md); background: ${color('surface-2')}; color: ${color('text')}; }
.skip-link:focus { top: var(--space-md); }
.visually-hidden { position: absolute; width: 1px; height: 1px; overflow: hidden;
  clip-path: inset(50%); white-space: nowrap; }
h1:focus { outline: none; }
h1:focus-visible { outline: 2px solid ${color('focus-ring')}; outline-offset: 2px; }
.button { ${textStyleCss(textScale.label)}; min-height: var(--tap-min); padding: 0 var(--space-lg);
  border-radius: var(--radius-primary-button); border: 1px solid ${color('border-subtle')};
  background: ${color('surface-2')}; color: ${color('text')}; cursor: pointer; }
.button.primary { min-height: var(--button-min-height); background: ${color('accent')};
  border-color: ${color('accent-border')}; color: ${color('on-accent')}; }
.button:disabled { cursor: not-allowed; color: ${color('text-tertiary')}; }
.button.wide { width: 100%; }
.row { display: flex; flex-wrap: wrap; gap: var(--space-md); }
fieldset.choices { border: 0; padding: 0; margin: 0 0 var(--space-md); display: flex; flex-wrap: wrap; gap: var(--space-sm); }
fieldset.choices legend { ${textStyleCss(textScale.label)}; margin-bottom: var(--space-xs); }
.choice { ${textStyleCss(textScale.body)}; display: inline-flex; align-items: center; gap: var(--space-sm);
  min-height: var(--tap-min); padding: 0 var(--space-md); border: 1px solid ${color('border-control')};
  border-radius: var(--radius-control); cursor: pointer; }
.choice input { width: 20px; height: 20px; accent-color: ${color('accent')}; }
a.button { display: inline-flex; align-items: center; text-decoration: none; }
.field { display: grid; gap: var(--space-xs); margin-bottom: var(--space-md); }
.field input { ${textStyleCss(textScale.bodyLarge)}; min-height: var(--tap-min); padding: 0 var(--space-md);
  border-radius: var(--radius-control); border: 1px solid ${color('border-control')};
  background: ${color('surface-2')}; color: ${color('text')}; }
.field input::placeholder { color: ${color('text-tertiary')}; }
/* 2 px accent edge on focus: the border plus a 1 px inset ring, so nothing shifts. */
.field input:focus { outline: none; border-color: ${color('accent')};
  box-shadow: inset 0 0 0 1px ${color('accent')}; }
.field input[aria-invalid='true'] { border-color: ${color('danger')}; }
/* The dawn scene (lazy, with its own stylesheet) fills .auth behind the card; the card stays
   opaque, the footer sits low on the dark ground (below the sun and its light) and the pause
   button (48 px) has the bottom row, on the scene's foreground band. */
.auth { position: relative; overflow: hidden; display: grid; justify-items: center;
  grid-template-rows: auto 1fr; gap: var(--space-md); min-height: calc(100vh - 2 * var(--space-lg));
  padding: var(--space-lg) var(--space-md) calc(var(--tap-min) + 2 * var(--space-md));
  border-radius: var(--radius-control); }
.auth-card, .auth-footer { position: relative; }
.auth-card { width: 100%; max-width: 440px; background: ${color('surface-1')};
  border: 1px solid ${color('border-subtle')}; border-radius: var(--radius-control); padding: var(--space-lg); }
.auth-brand { display: flex; gap: var(--space-md); align-items: flex-start; margin-bottom: var(--space-lg); }
.auth-brand img { flex: none; }
.auth-brand p { margin: 0; }
.auth-app-name { ${textStyleCss(textScale.bodyLarge)}; font-weight: 700; }
.auth-secondary { margin-top: var(--space-md); }
.auth-footer { display: flex; gap: var(--space-lg); align-self: end; }
/* On the dawn scene's ground, which is dark in both themes: the scene's own palette. */
.auth-footer a { color: var(--color-text-secondary); display: inline-flex; align-items: center;
  min-height: var(--tap-min); }
.button + .panel { margin-top: var(--space-md); }
.panel { background: ${color('surface-1')}; border: 1px solid ${color('border-subtle')};
  border-radius: var(--radius-control); padding: var(--space-md); margin-bottom: var(--space-md); }
.table-scroll { overflow-x: auto; margin-bottom: var(--space-md); }
table { width: 100%; border-collapse: collapse; }
th, td { text-align: left; padding: var(--space-sm); border-bottom: 1px solid ${color('border-subtle')}; }
th { color: ${color('text-secondary')}; font-weight: 600; }
.banner { border: 1px solid ${color('warning')}; border-radius: var(--radius-control);
  padding: var(--space-sm) var(--space-md); margin-bottom: var(--space-md); }
.error { color: ${color('danger')}; }
/* Narrow screens: stacked tables turn each row into a card with labelled cells. */
@media (max-width: 600px) {
  table.stack thead { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
  table.stack tr { display: block; padding: var(--space-sm) 0; border-bottom: 1px solid ${color('border-subtle')}; }
  table.stack td { display: grid; grid-template-columns: 40% 1fr; gap: var(--space-sm); border: 0;
    padding: var(--space-xs) var(--space-sm); }
  table.stack td::before { content: attr(data-label); color: ${color('text-secondary')}; font-weight: 600; }
}
.code { font-family: ui-monospace, monospace; word-break: break-all; }
${uiCss()}
${shellCss()}
`;
}
