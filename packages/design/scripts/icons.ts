/**
 * Renders the app's icon and splash PNGs (APP_ICONS) from the logo mark with resvg.
 * Node only (dev tool): `npm run icons -w @huntclub/design` rewrites app/assets.
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Resvg } from '@resvg/resvg-js';
import { APP_ICONS, logoMarkSvg } from '../src/logo';

export type AppIcon = (typeof APP_ICONS)[number];

/** app/assets, from this package's directory (npm runs scripts there). */
export const APP_ASSETS_DIR = join(process.cwd(), '..', '..', 'app', 'assets');

export function renderAppIcon(icon: AppIcon): Buffer {
  const svg = logoMarkSvg(icon.mark);
  return Buffer.from(
    new Resvg(svg, { fitTo: { mode: 'width', value: icon.size } }).render().asPng(),
  );
}

if (require.main === module) {
  for (const icon of APP_ICONS) {
    writeFileSync(join(APP_ASSETS_DIR, icon.file), renderAppIcon(icon));
    console.log(`${icon.file} ${icon.size}x${icon.size}`);
  }
}
