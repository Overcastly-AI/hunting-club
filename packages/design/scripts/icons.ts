/**
 * Renders the app's icon and splash PNGs (APP_ICONS) and the web page's favicon.ico
 * (FAVICON_ICO) from the logo mark with resvg. Node only (dev tool):
 * `npm run icons -w @huntclub/design` rewrites app/assets and site/public.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { APP_ICONS, FAVICON_ICO, logoMarkSvg, type LogoMarkOptions } from '../src/logo';
import { svgToPng } from './png';

export type AppIcon = (typeof APP_ICONS)[number];

/** app/assets, from this package's directory (npm runs scripts there). */
export const APP_ASSETS_DIR = join(process.cwd(), '..', '..', 'app', 'assets');

/** site/public: the public site serves it from the root unchanged. */
export const SITE_PUBLIC_DIR = join(process.cwd(), '..', '..', 'site', 'public');

const renderPng = (mark: LogoMarkOptions, size: number) =>
  svgToPng(logoMarkSvg(mark), { width: size });

export function renderAppIcon(icon: AppIcon): Buffer {
  return renderPng(icon.mark, icon.size);
}

/**
 * An ICO holding PNG images (supported by every current browser): a 6-byte header, one
 * 16-byte directory entry per image, then the PNGs. Sizes are square, at most 256.
 */
export function packIco(images: readonly { size: number; png: Buffer }[]): Buffer {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(images.length, 4);
  let offset = 6 + 16 * images.length;
  const entries = images.map(({ size, png }) => {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size % 256, 0); // width (0 means 256)
    entry.writeUInt8(size % 256, 1); // height
    entry.writeUInt16LE(1, 4); // color planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(png.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += png.length;
    return entry;
  });
  return Buffer.concat([header, ...entries, ...images.map((i) => i.png)]);
}

export function renderFaviconIco(): Buffer {
  return packIco(
    FAVICON_ICO.sizes.map((size) => ({ size, png: renderPng(FAVICON_ICO.mark, size) })),
  );
}

if (require.main === module) {
  for (const icon of APP_ICONS) {
    writeFileSync(join(APP_ASSETS_DIR, icon.file), renderAppIcon(icon));
    console.log(`${icon.file} ${icon.size}x${icon.size}`);
  }
  mkdirSync(SITE_PUBLIC_DIR, { recursive: true });
  writeFileSync(join(SITE_PUBLIC_DIR, FAVICON_ICO.file), renderFaviconIco());
  console.log(`site/public/${FAVICON_ICO.file} ${FAVICON_ICO.sizes.join(', ')}`);
}
