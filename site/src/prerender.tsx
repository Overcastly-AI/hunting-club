// Build step (Node): writes dist/<path>/index.html for every registered route, plus
// join/index.html, 404.html, sitemap.xml and favicon.svg. Vite builds this file for Node
// with the font emitted to dist/assets; `npm run build` then runs it.
import fontUrl from '@huntclub/design/fonts/Archivo-Latin.woff2?url';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FAVICON_SVG, logoMarkSvg } from '@huntclub/design';
import { JOIN_SCRIPT_ENTRY } from '../vite.config';
import { renderJoin, renderNotFound, renderPage } from './render';
import { JOIN_PAGE, NOT_FOUND_PAGE, outputFile, ROUTES, SITEMAP_FILE, sitemapXml } from './routes';
import { siteCss } from './styles';

/** dist/, the parent of dist/.server where this file runs from. */
const DIST = join(dirname(fileURLToPath(import.meta.url)), '..');

const assets = { fontUrl, css: siteCss(fontUrl) };
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
// The Node bundle and the manifest are build tools, not part of the site.
rmSync(join(DIST, '.server'), { recursive: true, force: true });
rmSync(join(DIST, '.vite'), { recursive: true, force: true });
