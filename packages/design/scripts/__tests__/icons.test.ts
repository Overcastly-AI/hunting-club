// The committed app icons and web favicon.ico must be exactly what the mark renders to.
// If this fails, run `npm run icons -w @huntclub/design` and commit app/assets and web/public.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { APP_ICONS, FAVICON_ICO } from '../../src/logo';
import { packIco, renderAppIcon, renderFaviconIco } from '../icons';

const ASSETS = join(__dirname, '..', '..', '..', '..', 'app', 'assets');

/** Width and height from a PNG's IHDR chunk. */
const pngSize = (png: Buffer) => [png.readUInt32BE(16), png.readUInt32BE(20)];

describe.each(APP_ICONS)('$file', (icon) => {
  it('is in sync with the logo mark', () => {
    const committed = readFileSync(join(ASSETS, icon.file));
    expect(pngSize(committed)).toEqual([icon.size, icon.size]);
    expect(committed.equals(renderAppIcon(icon))).toBe(true);
  });
});

describe(FAVICON_ICO.file, () => {
  const committed = readFileSync(
    join(__dirname, '..', '..', '..', '..', 'web', 'public', FAVICON_ICO.file),
  );

  it('is in sync with the logo mark', () => {
    expect(committed.equals(renderFaviconIco())).toBe(true);
  });

  it('is an ICO with one PNG per size', () => {
    expect([committed.readUInt16LE(0), committed.readUInt16LE(2)]).toEqual([0, 1]);
    expect(committed.readUInt16LE(4)).toBe(FAVICON_ICO.sizes.length);
    FAVICON_ICO.sizes.forEach((size, i) => {
      const entry = 6 + 16 * i;
      expect([committed.readUInt8(entry), committed.readUInt8(entry + 1)]).toEqual([size, size]);
      const offset = committed.readUInt32LE(entry + 12);
      const png = committed.subarray(offset, offset + committed.readUInt32LE(entry + 8));
      expect(pngSize(png)).toEqual([size, size]);
    });
  });

  it('packs 256 px as 0, as the ICO format requires', () => {
    const ico = packIco([{ size: 256, png: Buffer.from('png') }]);
    expect(ico.readUInt8(6)).toBe(0);
    expect(ico.readUInt32LE(6 + 12)).toBe(22);
  });
});
