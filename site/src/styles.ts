import { fontFaceCss, rootVariablesCss, textScale, textStyleCss } from '@huntclub/design';

/** Phones and small tablets: the header is the logo and one Menu button. */
export const PHONE_HEADER_MAX_WIDTH = 860;
/** The narrowest phone the layout must fit with no sideways scrolling. */
export const NARROWEST_PHONE = 360;

/** The whole site stylesheet (a hashed file, never inline): tokens only, no hard-coded colors. */
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
.skip-link { position: absolute; left: var(--space-md); top: -100px; z-index: 2; display: inline-flex; align-items: center; min-height: var(--tap-min);
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
@media (max-width: ${PHONE_HEADER_MAX_WIDTH}px) {
  .site-header .desktop, .site-header .header-action { display: none; }
  .menu { display: block; }
  .menu[open] { flex-basis: 100%; order: 3; }
}

section { padding: var(--space-xl) 0; }
.band-light { background: var(--color-bg-light); color: var(--color-text-on-light); }
.band-light a { color: var(--color-link-on-light); }
.band-light .muted, .band-light .lead { color: var(--color-muted-on-light); }
.band-light .button { color: var(--color-text-on-light); background: transparent; border-color: var(--color-text-on-light); }
/* Accent is under 3:1 on the light background, so a primary button there keeps a dark edge. */
.band-light .button.primary { color: var(--color-surface); background: var(--color-accent); border-color: var(--color-text-on-light); }
.band-light :focus-visible { outline-color: var(--color-link-on-light); }
.hero { position: relative; overflow: hidden; padding: var(--space-xl) 0 calc(var(--space-xl) * 2); }
/* The home hero's background slot (HERO_ART_SLOT): decorative, behind the content. */
.hero-art { position: absolute; inset: 0; z-index: 0; pointer-events: none; }
.hero > .wrap { position: relative; z-index: 1; }
.feature { display: grid; gap: var(--space-lg); align-items: center; grid-template-columns: repeat(auto-fit, minmax(18rem, 1fr)); }
.shot { margin: 0; }
.shot-frame { display: grid; place-items: center; border: 2px dashed var(--color-control-border);
  border-radius: var(--radius-sheet-top); color: var(--color-text-secondary); }
.band-light .shot-frame { color: var(--color-muted-on-light); }
.shot-4x5 .shot-frame { aspect-ratio: 4 / 5; max-width: 22rem; }
.shot-16x10 .shot-frame { aspect-ratio: 16 / 10; }
.shot figcaption { margin-top: var(--space-sm); }
.faq-page .wrap { max-width: 45rem; }
.faq-page h2 { ${textStyleCss(textScale.bodyLarge)}; font-weight: 700; margin-top: var(--space-lg); }
.grid { display: grid; gap: var(--space-lg); grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr)); }
.steps { counter-reset: step; list-style: none; padding: 0; margin: 0; }
.steps li { counter-increment: step; margin-bottom: var(--space-lg); padding-left: 3rem; position: relative; }
.steps li::before { content: counter(step); position: absolute; left: 0; top: 0; width: 2.25rem; height: 2.25rem;
  border-radius: 50%; display: grid; place-items: center; background: var(--color-surface-raised); font-weight: 700; }
.faq h3 { margin-top: var(--space-lg); }
.faq details { border-bottom: 1px solid var(--color-control-border); }
.faq summary { ${textStyleCss(textScale.bodyLarge)}; font-weight: 700; display: flex; align-items: center;
  min-height: 56px; cursor: pointer; }
.card { background: var(--color-surface-raised); border: 1px solid var(--color-border);
  border-radius: var(--radius-sheet-top); padding: var(--space-lg); }
.card .button { width: 100%; margin-top: var(--space-md); }
.price { ${textStyleCss(textScale.sheetTitle)}; font-size: 2.5rem; line-height: 1.1; margin: 0 0 var(--space-xs); }
.price-note { ${textStyleCss(textScale.bodyLarge)}; color: var(--color-text-secondary); }
.fine-print { margin-top: var(--space-md); }
.checklist { padding-left: 1.25rem; margin: 0 0 var(--space-md); }
.checklist li { margin-bottom: var(--space-sm); }
.plans { padding-top: 0; }
.club-includes { margin-top: var(--space-xl); }
.compare { width: 100%; border-collapse: collapse; }
.compare th, .compare td { text-align: left; padding: var(--space-sm) var(--space-md) var(--space-sm) 0;
  border-bottom: 1px solid var(--color-control-border); vertical-align: top; }
@media (max-width: 600px) {
  .compare thead { display: none; }
  .compare tr { display: block; padding: var(--space-sm) 0; border-bottom: 1px solid var(--color-control-border); }
  .compare th, .compare td { display: block; border: 0; padding: var(--space-xs) 0; }
  .compare td::before { content: attr(data-label) ": "; font-weight: 700; }
}
.notice { display: inline-block; padding: var(--space-sm) var(--space-md); border: 1px solid var(--color-control-border);
  border-radius: var(--radius-control); color: var(--color-text-secondary); }
.legal .wrap { max-width: 45rem; }
.eyebrow { ${textStyleCss(textScale.label)}; color: var(--color-text-secondary); margin: 0 0 var(--space-sm); }
.join .wrap { max-width: 45rem; }
.join-qr { display: none; margin-top: var(--space-xl); }
.join-qr svg { display: block; }
@media (min-width: 960px) and (pointer: fine) { .join-qr { display: block; } }
[hidden] { display: none !important; }

.site-footer { border-top: 1px solid var(--color-border); padding: var(--space-xl) 0; color: var(--color-text-secondary); }
.site-footer a { color: var(--color-text-secondary); }
.site-footer .nav-list { flex-direction: column; gap: 0; margin-bottom: var(--space-md); }
.footer-groups { display: grid; gap: var(--space-lg); grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
  margin-bottom: var(--space-lg); }
.footer-heading { ${textStyleCss(textScale.label)}; color: var(--color-text); margin: 0 0 var(--space-xs); }
`;
}
