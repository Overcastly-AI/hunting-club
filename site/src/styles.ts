import {
  baseCss,
  breakpoints,
  BUTTON_HEIGHT,
  radii,
  rem,
  sizes,
  textRulesCss,
  textScale,
  textStyleCss,
} from '@huntclub/design';
import { mapCss } from './map/mapCss';
import {
  MENU_OPEN_CLASS,
  MENU_SHEET_ID,
  MENU_TOGGLE_CLASS,
  PHONE_HEADER_HEIGHT,
  PHONE_HEADER_MEDIA,
} from './menu/menu';
/** Below this the page's two-column layouts stack, and the gutters narrow. */
export const NARROW_MAX_WIDTH = 700;
/** The narrowest phone the layout must fit with no sideways scrolling. */
export const NARROWEST_PHONE = 360;
/** The content column on wide screens (1440 to 1920 px and up), inside the gutters. */
export const CONTENT_MAX_WIDTH = 1120;
/** From this width, lists of features sit in two columns. */
export const FEATURE_COLUMNS_MIN_WIDTH = breakpoints.desktop;
/** The page's side gutters: wide screens, and phones (16 px, the design's phone gutter). */
export const GUTTER = { wide: 40, phone: 16 } as const;

/**
 * Links and controls drawn at the 48 px tap minimum (or more). Every link and button on a
 * page is one of these, or a link inside a sentence (site.test.ts checks both).
 */
export const SIZED_CONTROLS = [
  '.btn',
  '.tap',
  '.brand',
  '.skip-link',
  '.site-nav a',
  '.nav-list a',
  `.${MENU_TOGGLE_CLASS}`,
  '.faq summary',
] as const;

/** A ring of the focus colour on whatever has keyboard focus. */
const FOCUS = 'outline: 3px solid var(--theme-focus-ring); outline-offset: 2px;';

/**
 * The whole site stylesheet (a hashed file, never inline). Colours are tokens only: the theme
 * (`--theme-*`, dark by default and daylight when the device asks for light) for the chrome,
 * and the map's own colours (`--color-*`) on the aerial.
 */
export function siteCss(fontUrl: string): string {
  return `
${baseCss(fontUrl)}
body { ${textStyleCss(textScale.bodyLarge)}; }
h1, h2, h3 { margin: 0; }
${textRulesCss('h1', textScale.display)}
h1 { max-width: 18em; }
${textRulesCss('h2', textScale.title1)}
h2 { margin-bottom: var(--space-3); }
${textRulesCss('h3', textScale.title3)}
p, ul, ol, dl { margin: 0 0 var(--space-4); }
ul, ol { padding: 0; list-style: none; }
img, svg { max-width: 100%; }
a { color: var(--theme-text); }
p a { color: var(--theme-accent-text); font-weight: 650; }
:focus-visible { ${FOCUS} }
.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
.quiet { color: var(--theme-text-secondary); }
.num { ${textStyleCss(textScale.readout)}; }
.lede { font-size: ${rem(19)}; line-height: 1.45; color: var(--theme-text-secondary); max-width: 34em; }
.fine { font-size: ${rem(16)}; color: var(--theme-text-secondary); }
.ic { flex: none; }
.wrap { max-width: ${CONTENT_MAX_WIDTH + 2 * GUTTER.wide}px; margin: 0 auto; padding: 0 ${GUTTER.wide}px; }
.skip-link { position: absolute; left: var(--space-4); top: -100px; z-index: 5; display: inline-flex; align-items: center;
  min-height: var(--tap-min); padding: 0 var(--space-4); background: var(--theme-plate); }
.skip-link:focus { top: var(--space-4); }
.tap { display: inline-flex; align-items: center; min-height: var(--tap-min); font-weight: 650; }

/* Buttons: raised by default, orange for the one main action, plain beside it. */
.btn { ${textStyleCss(textScale.button)}; display: inline-flex; align-items: center; justify-content: center; gap: 10px;
  min-height: ${BUTTON_HEIGHT.md}px; padding: 0 20px; border: ${sizes.controlBorder}px solid var(--theme-border-control);
  border-radius: ${radii.md}px; background: var(--theme-raised); color: var(--theme-text); text-decoration: none;
  text-align: center; cursor: pointer; }
.btn:hover { background: var(--theme-pressed); }
.btn.go { background: var(--theme-accent); border-color: var(--theme-accent-border); color: var(--theme-on-accent); }
.btn.go:hover { background: var(--theme-accent-hover); }
.btn.plain { background: transparent; }
.btn.big { min-height: ${BUTTON_HEIGHT.lg}px; font-size: ${rem(20)}; font-weight: 800; }
.actions { display: flex; flex-wrap: wrap; gap: 10px; margin: 22px 0 14px; }

/* The header bar. */
.site-header { background: var(--theme-canvas); border-bottom: 1px solid var(--theme-border-subtle); }
.bar { display: flex; align-items: center; gap: 28px; min-height: 68px; padding: 0 ${GUTTER.wide}px; flex-wrap: wrap; }
.brand { display: inline-flex; align-items: center; gap: 10px; min-height: var(--tap-min); ${textStyleCss(textScale.title3)};
  font-size: ${rem(20)}; font-stretch: 86%; text-decoration: none; white-space: nowrap; }
.brand svg { width: 32px; height: 32px; }
.brand svg g { stroke: var(--theme-text-secondary); }
.brand svg circle { fill: var(--theme-text); }
.brand svg circle:first-of-type { fill: var(--theme-accent); }
.site-nav { display: flex; gap: 4px; margin-right: auto; }
.site-nav a { display: flex; align-items: center; min-height: var(--tap-min); padding: 0 12px; font-weight: 650;
  text-decoration: none; color: var(--theme-text-secondary); }
.site-nav a:hover { color: var(--theme-text); }
.site-nav a[aria-current] { color: var(--theme-text); box-shadow: inset 0 -3px 0 var(--theme-accent-text); }
.bar .btn { min-height: ${BUTTON_HEIGHT.sm}px; padding: 0 16px; }
.header-actions { display: flex; gap: 12px; }
/* Phones: the header is one row, the logo and a Menu button; the links open as a sheet under it. */
.${MENU_TOGGLE_CLASS} { ${textStyleCss(textScale.button)}; display: none; align-items: center; margin-left: auto;
  min-height: var(--tap-min); min-width: 88px; justify-content: center; padding: 0 var(--space-4);
  border: ${sizes.controlBorder}px solid var(--theme-border-control); border-radius: ${radii.md}px;
  background: transparent; color: var(--theme-text); cursor: pointer; }
.${MENU_TOGGLE_CLASS}[aria-expanded="true"] { background: var(--theme-raised); }
#${MENU_SHEET_ID} { position: fixed; top: ${PHONE_HEADER_HEIGHT}px; left: 0; right: 0; z-index: 10;
  max-height: calc(100dvh - ${PHONE_HEADER_HEIGHT}px); overflow-y: auto; overscroll-behavior: contain;
  padding: 0 ${GUTTER.phone}px var(--space-4); background: var(--theme-plate); box-shadow: var(--theme-shadow-popover); }
.nav-list a { display: flex; align-items: center; min-height: 56px; padding: 0 var(--space-1); font-weight: 650;
  text-decoration: none; border-top: 1px solid var(--theme-border-subtle); }
#${MENU_SHEET_ID} .nav-list { margin: 0; }
#${MENU_SHEET_ID} .nav-list li:first-child a { border-top: 0; }
@media ${PHONE_HEADER_MEDIA} {
  html { scroll-padding-top: ${PHONE_HEADER_HEIGHT}px; }
  html.${MENU_OPEN_CLASS}, html.${MENU_OPEN_CLASS} body { overflow: hidden; }
  /* The hairline is drawn inside the 64 px, so the sheet meets the header exactly. */
  .site-header { position: sticky; top: 0; z-index: 10; border-bottom: 0; box-shadow: inset 0 -1px 0 var(--theme-border-subtle); }
  .bar { height: ${PHONE_HEADER_HEIGHT}px; min-height: ${PHONE_HEADER_HEIGHT}px; flex-wrap: nowrap; gap: 8px; padding: 0 12px 0 ${GUTTER.phone}px; }
  .brand { min-width: 0; }
  .site-nav, .header-actions { display: none; }
  .${MENU_TOGGLE_CLASS} { display: inline-flex; flex: none; }
}
@media not ${PHONE_HEADER_MEDIA} {
  #${MENU_SHEET_ID} { display: none; }
}

/* Sections: divided by hairlines, never boxed. */
.band { padding: 84px 0; border-top: 1px solid var(--theme-border-subtle); }
.band.lifted { background: var(--theme-plate); }
/* Block padding only: a page head is usually also a .wrap, whose side gutters must stay. */
.page-head { padding-block: 64px 36px; }
.page-head h1 { margin-bottom: 14px; }
.two { display: grid; grid-template-columns: 5fr 7fr; gap: 64px; align-items: start; }
.narrow { max-width: 760px; }

/* Rows: one thing per line, with hairlines between (features, legend, questions). */
.rows > li, .rows > div { padding: 14px 0; border-top: 1px solid var(--theme-border-subtle); }
.rows > :last-child { border-bottom: 1px solid var(--theme-border-subtle); }
.rows h3 { margin-bottom: 2px; }
.rows p { margin: 0; color: var(--theme-text-secondary); }
.rows h3 .tap { color: var(--theme-text); text-decoration-color: var(--theme-accent-text); text-underline-offset: 4px; }
.rows.cols { display: grid; grid-template-columns: 1fr; }
@media (min-width: ${FEATURE_COLUMNS_MIN_WIDTH}px) {
  .rows.cols { grid-template-columns: 1fr 1fr; column-gap: 48px; }
  .rows.cols > :nth-last-child(2) { border-bottom: 1px solid var(--theme-border-subtle); }
}
.plan-word { ${textStyleCss(textScale.badge)}; color: var(--theme-text-secondary); margin-left: 8px; }

/* The map legend: each line has its symbol drawn on map ground. */
.legend { margin: 0; }
/* Each row is a dt/dd pair; the dt holds the symbol and the term on a subgrid of the row. */
.legend > div { display: grid; grid-template-columns: 76px 1fr; grid-template-rows: auto auto; gap: 0 18px; }
.legend dt { grid-column: 1 / -1; grid-row: 1 / span 2; display: grid; grid-template-columns: subgrid;
  grid-template-rows: subgrid; ${textStyleCss(textScale.title3)}; font-stretch: 90%; }
.legend .sym { grid-column: 1; grid-row: 1 / span 2; align-self: center; }
.legend .term { grid-column: 2; grid-row: 1; align-self: end; }
.legend dd { grid-column: 2; grid-row: 2; align-self: start; margin: 0; color: var(--theme-text-secondary); }

/* Steps: a real sequence, so numbered. */
.steps { counter-reset: step; margin: 26px 0 0; }
.steps li { counter-increment: step; display: grid; grid-template-columns: 56px 1fr; gap: 4px 12px; padding: 18px 0;
  border-top: 1px solid var(--theme-border-subtle); }
.steps li::before { content: counter(step); grid-row: 1 / span 2; ${textStyleCss(textScale.readout)}; font-size: ${rem(44)};
  line-height: 1; font-weight: 800; color: var(--theme-text-secondary); }
.steps h3 { font-size: ${rem(22)}; }
.steps p { grid-column: 2; margin: 0; color: var(--theme-text-secondary); }

/* Free and Club side by side, split by one hairline. */
.split { display: grid; grid-template-columns: 1fr 1fr; }
.split > div { padding: 0 48px 0 0; }
.split > div + div { padding: 0 0 0 48px; border-left: 1px solid var(--theme-border-subtle); }
.split h2 { margin-bottom: 4px; }
.split .price { font-size: ${rem(19)}; color: var(--theme-text-secondary); margin-bottom: 14px; }
.ticks li { display: flex; gap: 10px; padding: 7px 0; line-height: 1.35; }
.ticks .ic, .plans .yes .ic { color: var(--theme-fresh); }

/* Pricing: the plans and the table share one grid of columns. */
.plans { border: 1px solid var(--theme-border-subtle); border-radius: ${radii.lg + 2}px; background: var(--theme-plate); overflow: hidden; }
.plan-heads { display: grid; grid-template-columns: 1.3fr 1fr 1fr; }
.plan-heads > * { padding: 26px 22px; border-left: 1px solid var(--theme-border-subtle); }
.plan-heads > :first-child { border-left: 0; align-self: end; color: var(--theme-text-secondary); margin: 0; }
.plan h2 { ${textStyleCss(textScale.title2)}; margin: 0; }
.plan .amount { ${textStyleCss(textScale.readout)}; font-size: ${rem(46)}; line-height: 1.1; margin: 6px 0 2px; color: var(--theme-text); }
.plan .amount small { font-size: ${rem(19)}; font-weight: 600; color: var(--theme-text-secondary); }
.plan p { color: var(--theme-text-secondary); line-height: 1.35; margin: 0; }
.plan .btn { width: 100%; margin: 16px 0 10px; line-height: 1.15; padding: 8px 12px; }
.plan .fine { margin: 0; }
.compare { width: 100%; border-collapse: collapse; table-layout: fixed; }
.compare col.feature { width: 39.4%; }
.compare thead th { ${textStyleCss(textScale.caption)}; color: var(--theme-text-secondary); text-align: left; padding: 8px 22px; }
.compare tbody th, .compare td { text-align: left; font-weight: 450; padding: 13px 22px; border-top: 1px solid var(--theme-border-subtle);
  vertical-align: top; }
.compare td { border-left: 1px solid var(--theme-border-subtle); font-weight: 650; }
.compare .group th { background: var(--theme-raised); ${textStyleCss(textScale.label)}; font-stretch: 90%; }
.compare .yes, .compare .no { display: inline-flex; align-items: center; gap: 8px; }
.compare .no { color: var(--theme-text-secondary); }
@media (min-width: ${NARROW_MAX_WIDTH + 1}px) { .compare thead { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); } }

/* Questions that open in place. */
.faq details { border-top: 1px solid var(--theme-border-subtle); }
.faq details:last-of-type { border-bottom: 1px solid var(--theme-border-subtle); }
.faq summary { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 60px;
  ${textStyleCss(textScale.title3)}; font-weight: 750; font-stretch: 92%; cursor: pointer; list-style: none; }
.faq summary::-webkit-details-marker { display: none; }
.faq details[open] summary .ic { transform: rotate(180deg); }
.faq details p { padding: 0 0 18px; color: var(--theme-text-secondary); max-width: 38em; margin: 0; }

/* Where a real screenshot will go: a labelled frame at its final crop. */
.shot { margin: 0; }
.shot-frame { display: grid; place-items: center; border: 2px dashed var(--theme-border-control);
  border-radius: ${radii.xl}px; color: var(--theme-text-secondary); background: var(--theme-plate); }
.shot-4x5 .shot-frame { aspect-ratio: 4 / 5; max-width: 22rem; }
.shot-16x10 .shot-frame { aspect-ratio: 16 / 10; }
.shot figcaption { margin-top: var(--space-2); color: var(--theme-text-secondary); }

.rows h2.question, .legal h2 { ${textStyleCss(textScale.title3)}; margin: 0 0 2px; }
.legal h2 { margin-top: var(--space-8); }
.notice { display: inline-block; padding: var(--space-2) var(--space-4); border: ${sizes.controlBorder}px solid var(--theme-border-control);
  border-radius: ${radii.md}px; color: var(--theme-text-secondary); }
.join-qr { display: none; margin-top: var(--space-8); padding: 24px; width: fit-content; }
.join-qr svg { display: block; }
@media (min-width: 960px) and (pointer: fine) { .join-qr { display: block; } }
[hidden] { display: none !important; }

/* The footer: link groups, the Meshtastic credit and the safety note. */
.site-footer { padding: 28px 0 40px; border-top: 1px solid var(--theme-border-subtle); color: var(--theme-text-secondary); }
.footer-groups { display: grid; gap: var(--space-6); grid-template-columns: repeat(4, 1fr); margin-bottom: var(--space-6); }
.footer-heading { ${textStyleCss(textScale.label)}; color: var(--theme-text-secondary); margin: 0 0 var(--space-1); }
.site-footer .nav-list a { min-height: var(--tap-min); border: 0; padding: 0; color: var(--theme-text); font-weight: 600;
  text-decoration: underline; }
.site-footer p { max-width: 60em; margin: 0 0 10px; font-size: ${rem(16)}; }

@media (max-width: ${NARROW_MAX_WIDTH}px) {
  .wrap { padding: 0 ${GUTTER.phone}px; }
  .band { padding: 52px 0; }
  .page-head { padding-block: 36px 24px; }
  .two, .split { grid-template-columns: 1fr; gap: 28px; }
  .split > div, .split > div + div { padding: 0; border: 0; }
  .split > div + div { padding-top: 28px; border-top: 1px solid var(--theme-border-subtle); }
  .split .btn, .actions .btn { width: 100%; }
  .footer-groups { grid-template-columns: 1fr 1fr; }
  .plan-heads { grid-template-columns: 1fr; }
  .plan-heads > * { border-left: 0; border-top: 1px solid var(--theme-border-subtle); padding: 20px 14px; }
  .plan-heads > :first-child { display: none; }
  .plan-heads > :nth-child(2) { border-top: 0; }
  .compare col.feature { width: auto; }
  .compare col.plan-col { width: 76px; }
  .compare thead th, .compare tbody th, .compare td { padding: 12px 10px; }
  .compare td { font-size: ${rem(16)}; }
  .compare .yes, .compare .no { gap: 3px; }
  .compare .yes .ic { width: 18px; height: 18px; }
}
${mapCss()}
`;
}
