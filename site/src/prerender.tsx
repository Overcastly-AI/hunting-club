// Build step (Node): writes dist/<path>/index.html for every registered route. Vite builds
// this file for Node with the font emitted to dist/assets; `npm run build` then runs it.
import fontUrl from '@huntclub/design/fonts/Archivo-Latin.woff2?url';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderPage } from './render';
import { outputFile, ROUTES } from './routes';
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
// The Node bundle is a build tool, not part of the site.
rmSync(join(DIST, '.server'), { recursive: true, force: true });
