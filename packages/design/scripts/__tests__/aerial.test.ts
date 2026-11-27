import { AERIAL_PAINTS, AERIAL_WORLD, aerialSvg } from '../../src/aerial';
import { boundary, mapPlanColors } from '../../src/colors';

const club = {
  line: [
    [800, 400],
    [1400, 430],
    [1290, 1010],
  ],
  areas: [
    {
      line: [
        [900, 600],
        [1000, 640],
        [960, 760],
      ],
    },
  ],
} as const;
const svg = aerialSvg(club);

describe('aerial stand-in', () => {
  it('is one standalone SVG at the world size, the same on every build', () => {
    const { width, height } = AERIAL_WORLD;
    expect(
      svg.startsWith(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"`),
    ).toBe(true);
    expect(aerialSvg(club)).toBe(svg);
  });

  it('has no style element, style attribute or script, so it passes a strict CSP as an image', () => {
    expect(svg).not.toMatch(/<style|\sstyle=|<script|\son[a-z]+=|href=/i);
  });

  it('paints only with the imagery paints and the club ink from the tokens', () => {
    const allowed = new Set<string>([
      ...Object.values(AERIAL_PAINTS),
      boundary.stroke,
      boundary.innerLine,
    ]);
    const used = [
      ...svg.matchAll(/(?:fill|stroke|lighting-color)="(#[0-9A-F]{6}|rgba\([^)]*\))"/gi),
    ];
    expect(used.length).toBeGreaterThan(10);
    for (const [, paint] of used) expect(allowed.has(paint!)).toBe(true);
    expect(AERIAL_PAINTS.ground).toBe(mapPlanColors.mapGround);
  });

  it("draws the club's line (white with the accent inner line) and each area", () => {
    const line = `M${club.line.map(([x, y]) => `${x} ${y}`).join('L')}Z`;
    expect(svg).toContain(
      `stroke="${boundary.stroke}" stroke-width="4.5" stroke-linejoin="round" d="${line}"`,
    );
    expect(svg).toContain(`stroke="${boundary.innerLine}"`);
    expect(svg.match(/stroke-dasharray/g)).toHaveLength(club.areas.length);
  });
});
