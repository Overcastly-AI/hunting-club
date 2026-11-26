// The admin's whole stylesheet as a pure function of the font URL: the Vite plugin
// (../../global-stylesheet.ts) writes it to a hashed file at build time, so the page needs
// no inline styles under its Content-Security-Policy; tests and `vite dev` use globalCss().
import {
  fontFaceCss,
  rootVariablesCss,
  textClasses,
  textScale,
  textStyleCss,
} from '@huntclub/design';

/** The whole stylesheet: font face, tokens, base elements and components. */
export function globalCssFor(fontUrl: string): string {
  return `
${fontFaceCss(fontUrl)}
${rootVariablesCss()}
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
/* Content (and tables) up to 960px wide on desktop; the padding sits outside it. */
.layout { max-width: calc(960px + 2 * var(--space-md)); margin: 0 auto; padding: var(--space-lg) var(--space-md); }
.not-found { display: grid; justify-items: center; text-align: center; gap: var(--space-sm);
  padding: var(--space-xl) 0; }
.nav { display: flex; flex-wrap: wrap; gap: var(--space-sm); margin-bottom: var(--space-lg); }
.nav a { ${textStyleCss(textScale.label)}; display: inline-flex; align-items: center;
  min-height: var(--tap-min); padding: 0 var(--space-md); border-radius: var(--radius-control);
  background: var(--color-surface-raised); color: var(--color-text-secondary); text-decoration: none; }
.nav a[aria-current='page'] { color: var(--color-accent); font-weight: 700;
  text-decoration: underline; text-decoration-thickness: 3px; text-underline-offset: 6px; }
.summary-row { display: flex; flex-wrap: wrap; gap: var(--space-sm); list-style: none;
  padding: 0; margin: var(--space-md) 0 0; }
.summary-row a { display: inline-flex; align-items: center; gap: var(--space-sm);
  min-height: var(--tap-min); padding: 0 var(--space-md); border-radius: var(--radius-control);
  background: var(--color-surface-raised); text-decoration: none; }
.app-footer { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between;
  gap: var(--space-sm); margin-top: var(--space-lg); }
.app-footer p { margin: 0; }
/* Phones: the nav is one row, in page order, that scrolls sideways. */
@media (max-width: 639px) {
  .nav { flex-wrap: nowrap; overflow-x: auto; }
  .nav a { flex: none; white-space: nowrap; }
}
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
/* The dawn scene (lazy, with its own stylesheet) fills .auth behind the card; the card stays
   opaque, the footer sits low on the dark ground (below the sun and its light) and the pause
   button (48 px) has the bottom row, on the scene's foreground band. */
.auth { position: relative; overflow: hidden; display: grid; justify-items: center;
  grid-template-rows: auto 1fr; gap: var(--space-md); min-height: calc(100vh - 2 * var(--space-lg));
  padding: var(--space-lg) var(--space-md) calc(var(--tap-min) + 2 * var(--space-md));
  border-radius: var(--radius-control); }
.auth-card, .auth-footer { position: relative; }
.auth-card { width: 100%; max-width: 440px; background: var(--color-surface-raised);
  border-radius: var(--radius-control); padding: var(--space-lg); }
.auth-card .field input { background: var(--color-surface); }
.auth-brand { display: flex; gap: var(--space-md); align-items: flex-start; margin-bottom: var(--space-lg); }
.auth-brand img { flex: none; }
.auth-brand p { margin: 0; }
.auth-app-name { ${textStyleCss(textScale.bodyLarge)}; font-weight: 700; }
.auth-secondary { margin-top: var(--space-md); }
.auth-footer { display: flex; gap: var(--space-lg); align-self: end; }
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
