import { join } from 'node:path';
import { colors } from '@huntclub/design';
import { ogImageSvg, OG_FONT_FILE, renderPng, wrapText } from '../og';
import { JOIN_PAGE, OG_IMAGE, ogHeadline, ogImagePath, ROUTES } from '../routes';

const FONT = join(__dirname, '..', '..', '..', OG_FONT_FILE);
/** Width and height from a PNG's IHDR chunk. */
const pngSize = (png: Buffer) => [png.readUInt32BE(16), png.readUInt32BE(20)];
const cards = [
  ...ROUTES.map((r) => ({ path: r.path, headline: ogHeadline(r.title), subline: r.description })),
  { path: JOIN_PAGE.path, headline: JOIN_PAGE.ogHeadline, subline: JOIN_PAGE.description },
];

describe('Open Graph cards', () => {
  it('have one file per page, the generic one for /join', () => {
    const files = cards.map((c) => ogImagePath(c.path));
    expect(new Set(files).size).toBe(files.length);
    expect(ogImagePath('/')).toBe(`/${OG_IMAGE.dir}/home.png`);
    expect(ogImagePath(JOIN_PAGE.path)).toBe(`/${OG_IMAGE.dir}/join.png`);
    expect(JOIN_PAGE.ogHeadline).not.toMatch(/club name|party name/i);
  });

  it.each(cards)('$path fits its card without cutting the headline', (card) => {
    expect(wrapText(card.headline, 30, 3).join(' ')).toBe(card.headline);
    expect(ogHeadline(card.headline)).not.toMatch(/\| Hunt Club Mesh$/);
  });

  it('wraps at word boundaries and ends overflow with an ellipsis', () => {
    expect(wrapText('one two three four', 9, 3)).toEqual(['one two', 'three', 'four']);
    expect(wrapText('one two three four five', 9, 2)).toEqual(['one two', 'three…']);
  });

  it('draws with token colors only and escapes text', () => {
    const svg = ogImageSvg({ headline: 'Tom & <Jerry>', subline: 'a "quote"' });
    expect(svg).toContain('Tom &amp; &lt;Jerry&gt;');
    expect(svg).toContain('a &quot;quote&quot;');
    const tokenHexes = new Set(Object.values(colors).map((c) => c.toLowerCase()));
    for (const hex of svg.match(/#[0-9a-f]{3,8}\b/gi) ?? []) {
      expect(tokenHexes.has(hex.toLowerCase())).toBe(true);
    }
  });

  it('renders to a 1200×630 PNG with Archivo, small enough to share', () => {
    const png = renderPng(ogImageSvg(cards[0]!), FONT);
    expect(pngSize(png)).toEqual([OG_IMAGE.width, OG_IMAGE.height]);
    expect(png.length).toBeLessThan(300_000);
  });
});
