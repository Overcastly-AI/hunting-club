// Build step (Node): writes dist/<path>/index.html for every registered route, plus
// join/index.html, 404.html, sitemap.xml, favicon.svg, logo.png and the Open Graph cards
// (og/*.png). Vite builds this file for Node
// with the font emitted to dist/assets; `npm run build` then runs it.
import fontUrl from '@huntclub/design/fonts/Archivo-Latin.woff2?url';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FAVICON_SVG, logoMarkSvg } from '@huntclub/design';
import { ogImageSvg, OG_FONT_FILE, renderPng } from './og';
import { JOIN_SCRIPT_ENTRY } from '../vite.config';
import { renderJoin, renderNotFound, renderPage } from './render';
import {
  JOIN_PAGE,
  NOT_FOUND_PAGE,
  ogHeadline,
  ogImagePath,
  outputFile,
  ROUTES,
  SITE_LOGO,
  SITEMAP_FILE,
  sitemapXml,
} from './routes';
import { siteCss } from './styles';

/** dist/, the parent of dist/.server where this file runs from. */
const DIST = join(dirname(fileURLToPath(import.meta.url)), '..');

// The stylesheet as a content-hashed file beside the font (cached for a year like it).
const css = siteCss(fontUrl);
const cssFile = `assets/site-${createHash('sha256').update(css).digest('hex').slice(0, 10)}.css`;
writeFileSync(join(DIST, cssFile), css);
const assets = { fontUrl, cssUrl: `/${cssFile}` };
for (const route of ROUTES) {
  const file = join(DIST, outputFile(route.path));
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, renderPage(route.path, assets));
  console.log(`${route.path} → ${outputFile(route.path)}`);
}
writeFileSync(join(DIST, NOT_FOUND_PAGE.file), renderNotFound(assets));

// The /join script, from the client build's manifest (`vite build --mode client`).
const MANIFEST = join(DIST, '.vite', 'manifest.json');
const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8')) as Record<string, { file: string }>;
const joinScript = manifest[JOIN_SCRIPT_ENTRY]?.file;
if (!joinScript) throw new Error(`No ${JOIN_SCRIPT_ENTRY} in ${MANIFEST}`);
mkdirSync(dirname(join(DIST, JOIN_PAGE.file)), { recursive: true });
writeFileSync(join(DIST, JOIN_PAGE.file), renderJoin(assets, `/${joinScript}`));
console.log(`${JOIN_PAGE.path} → ${JOIN_PAGE.file} (${joinScript})`);
writeFileSync(join(DIST, SITEMAP_FILE), sitemapXml(new Date().toISOString().slice(0, 10)));
// The SVG favicon from the logo mark (favicon.ico is in public/, from the icons script).
writeFileSync(join(DIST, FAVICON_SVG), logoMarkSvg());
console.log(`${NOT_FOUND_PAGE.file}, ${SITEMAP_FILE}, ${FAVICON_SVG}`);
// Open Graph cards (every page, and one generic /join card) and the logo PNG.
const FONT = join(DIST, '..', '..', OG_FONT_FILE);
const cards = [
  ...ROUTES.map((r) => ({ path: r.path, headline: ogHeadline(r.title), subline: r.description })),
  { path: JOIN_PAGE.path, headline: JOIN_PAGE.ogHeadline, subline: JOIN_PAGE.description },
];
for (const card of cards) {
  const file = join(DIST, ogImagePath(card.path));
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, renderPng(ogImageSvg(card), FONT));
}
writeFileSync(join(DIST, SITE_LOGO.file), renderPng(logoMarkSvg(), FONT, SITE_LOGO.size));
console.log(`${cards.length} Open Graph cards, ${SITE_LOGO.file}`);

// The Node bundle and the manifest are build tools, not part of the site.
rmSync(join(DIST, '.server'), { recursive: true, force: true });
rmSync(join(DIST, '.vite'), { recursive: true, force: true });
