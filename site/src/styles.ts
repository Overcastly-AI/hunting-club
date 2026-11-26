import { fontFaceCss, rootVariablesCss, textScale, textStyleCss } from '@huntclub/design';

/** The whole site stylesheet, inlined in every page: tokens only, no hard-coded colors. */
export function siteCss(fontUrl: string): string {
  return `
${fontFaceCss(fontUrl)}
${rootVariablesCss()}
* { box-sizing: border-box; }
html, body { margin: 0; background: var(--color-surface); color: var(--color-text); }
body { ${textStyleCss(textScale.body)}; }
h1 { ${textStyleCss(textScale.sheetTitle)}; font-size: 2.5rem; line-height: 1.15; margin: 0 0 var(--space-md); }
h2 { ${textStyleCss(textScale.sheetTitle)}; margin: 0 0 var(--space-md); }
h3 { ${textStyleCss(textScale.bodyLarge)}; font-weight: 700; margin: 0 0 var(--space-xs); }
p { margin: 0 0 var(--space-md); }
a { color: var(--color-text); }
:focus-visible { outline: 3px solid var(--color-accent); outline-offset: 2px; }
.wrap { max-width: 1040px; margin: 0 auto; padding: 0 var(--space-md); }
.skip-link { position: absolute; left: var(--space-md); top: -100px; z-index: 2;
  padding: var(--space-sm) var(--space-md); background: var(--color-surface-raised); }
.skip-link:focus { top: var(--space-md); }
.lead { ${textStyleCss(textScale.bodyLarge)}; color: var(--color-text-secondary); max-width: 40rem; }
.muted { color: var(--color-text-secondary); }
.tap { display: inline-flex; align-items: center; min-height: var(--tap-min); }
.button { ${textStyleCss(textScale.label)}; display: inline-flex; align-items: center; justify-content: center;
  min-height: var(--tap-min); padding: 0 var(--space-lg); border-radius: var(--radius-primary-button);
  border: 1px solid var(--color-border); background: var(--color-surface-raised); color: var(--color-text);
  text-decoration: none; }
.button.primary { min-height: var(--button-min-height); background: var(--color-accent);
  border-color: var(--color-accent); color: var(--color-surface); }
.actions { display: flex; flex-wrap: wrap; gap: var(--space-md); margin-top: var(--space-lg); }

.site-header { border-bottom: 1px solid var(--color-border); }
.site-header .wrap { display: flex; align-items: center; gap: var(--space-md); min-height: 72px; flex-wrap: wrap; }
.brand { display: inline-flex; align-items: center; gap: var(--space-sm); min-height: var(--tap-min);
  ${textStyleCss(textScale.bodyLarge)}; font-weight: 700; text-decoration: none; margin-right: auto; }
.brand svg { width: 36px; height: 36px; }
.nav-list { display: flex; gap: var(--space-xs) var(--space-md); list-style: none; margin: 0; padding: 0; }
.nav-list a { ${textStyleCss(textScale.label)}; display: inline-flex; align-items: center;
  min-height: var(--tap-min); padding: 0 var(--space-xs); text-decoration: none; }
.nav-list a:hover { text-decoration: underline; }
.menu { display: none; }
.menu summary { ${textStyleCss(textScale.label)}; display: inline-flex; align-items: center; min-height: var(--tap-min);
  padding: 0 var(--space-md); border: 1px solid var(--color-border); border-radius: var(--radius-control);
  cursor: pointer; list-style: none; }
.menu summary::-webkit-details-marker { display: none; }
.menu[open] .nav-list { flex-direction: column; padding: var(--space-sm) 0; }
@media (max-width: 860px) {
  .site-header .desktop { display: none; }
  .menu { display: block; }
  .menu[open] { flex-basis: 100%; order: 3; }
}

section { padding: var(--space-xl) 0; }
.band-light { background: var(--color-bg-light); color: var(--color-text-on-light); }
.band-light a { color: var(--color-link-on-light); }
.band-light .muted, .band-light .lead { color: var(--color-muted-on-light); }
.band-light .button { color: var(--color-text-on-light); background: transparent; border-color: var(--color-text-on-light); }
.band-light .button.primary { color: var(--color-surface); background: var(--color-accent); border-color: var(--color-accent); }
.hero { padding: var(--space-xl) 0 calc(var(--space-xl) * 2); }
.grid { display: grid; gap: var(--space-lg); grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr)); }
.steps { counter-reset: step; list-style: none; padding: 0; margin: 0; }
.steps li { counter-increment: step; margin-bottom: var(--space-lg); padding-left: 3rem; position: relative; }
.steps li::before { content: counter(step); position: absolute; left: 0; top: 0; width: 2.25rem; height: 2.25rem;
  border-radius: 50%; display: grid; place-items: center; background: var(--color-surface-raised); font-weight: 700; }
.faq h3 { margin-top: var(--space-lg); }

.site-footer { border-top: 1px solid var(--color-border); padding: var(--space-xl) 0; color: var(--color-text-secondary); }
.site-footer a { color: var(--color-text-secondary); }
.site-footer .nav-list { margin-bottom: var(--space-md); }
`;
}
