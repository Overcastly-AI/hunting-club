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
import { dawnSceneCss } from '@huntclub/design/dawnScene';
import { ogImageSvg, OG_FONT_FILE, renderPng } from './og';
import { DAWN_SCRIPT_ENTRY, JOIN_SCRIPT_ENTRY } from '../vite.config';
import { renderJoin, renderNotFound, renderPage } from './render';
import {
  HASH_FORWARD_SCRIPT,
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

/** Writes `content` to assets/<name>-<hash>.<ext> (cached for a year like the font); its URL. */
function hashedAsset(name: string, ext: string, content: string): string {
  const hash = createHash('sha256').update(content).digest('hex').slice(0, 10);
  const file = `assets/${name}-${hash}.${ext}`;
  writeFileSync(join(DIST, file), content);
  return `/${file}`;
}

// The browser scripts, from the client build's manifest (`vite build --mode client`).
const MANIFEST = join(DIST, '.vite', 'manifest.json');
const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8')) as Record<string, { file: string }>;
const clientScript = (entry: string) => {
  const file = manifest[entry]?.file;
  if (!file) throw new Error(`No ${entry} in ${MANIFEST}`);
  return `/${file}`;
};

// Stylesheets and scripts are all files: no inline code under the CSP.
const assets = {
  fontUrl,
  cssUrl: hashedAsset('site', 'css', siteCss(fontUrl)),
  // The home page's old-bookmark forward.
  forwardScriptUrl: hashedAsset('forward', 'js', HASH_FORWARD_SCRIPT),
  // The home hero's dawn scene: its CSS in its own file (only the home page links it).
  dawn: {
    cssUrl: hashedAsset('dawn', 'css', dawnSceneCss()),
    scriptUrl: clientScript(DAWN_SCRIPT_ENTRY),
  },
};
for (const route of ROUTES) {
  const file = join(DIST, outputFile(route.path));
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, renderPage(route.path, assets));
  console.log(`${route.path} → ${outputFile(route.path)}`);
}
writeFileSync(join(DIST, NOT_FOUND_PAGE.file), renderNotFound(assets));

// The /join page with its script.
const joinScript = clientScript(JOIN_SCRIPT_ENTRY);
mkdirSync(dirname(join(DIST, JOIN_PAGE.file)), { recursive: true });
writeFileSync(join(DIST, JOIN_PAGE.file), renderJoin(assets, joinScript));
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
