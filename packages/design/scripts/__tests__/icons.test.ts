// The committed app icons must be exactly what the mark renders to. If this fails,
// run `npm run icons -w @huntclub/design` and commit app/assets.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { APP_ICONS } from '../../src/logo';
import { renderAppIcon } from '../icons';

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
