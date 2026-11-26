import { gzipSync } from 'node:zlib';
import { colors } from '../../src/colors';
import { blendOver, contrastRatio, MIN_TEXT_CONTRAST } from '../../src/contrast';
import {
  DAWN_PAINTS,
  DAWN_PAUSED_CLASS,
  DAWN_TEXT_BACKDROPS,
  dawnSceneSvg,
} from '../../src/dawnScene';
import { dawnSprites } from '../../src/dawnSprites.generated';

/** Transfer budget for the whole scene (it replaces a 1.5 MB video and a poster image). */
const MAX_GZIP_BYTES = 90_000;

const svg = dawnSceneSvg();

describe('dawn scene', () => {
  it('paints with design tokens only', () => {
    const tokens = new Set<string>(Object.values(colors));
    const used = new Set(svg.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []);
    expect(used.size).toBeGreaterThan(0);
    for (const color of used) expect(tokens).toContain(color);
    expect(svg).not.toMatch(/rgb\(|hsl\(/);
  });

  it('has no gradients, images, scripts or outside requests', () => {
    expect(svg).not.toMatch(/Gradient|<image|<script|<use|href|url\((?!#dawn-)/);
  });

  it('keeps both text tokens readable on everything text can sit on', () => {
    for (const { base, over } of DAWN_TEXT_BACKDROPS) {
      const backdrop = over.reduce<string>(
        (under, paint) => blendOver(colors[paint.token], under, paint.opacity),
        colors[base],
      );
      expect(contrastRatio(colors.text, backdrop)).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
      expect(contrastRatio(colors.textSecondary, backdrop)).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
    }
  });

  it('uses the accent for light only, never as a solid block outside the sun', () => {
    const accentPaints = Object.entries(DAWN_PAINTS).filter(([, p]) => p.token === 'accent');
    expect(accentPaints.map(([name]) => name).sort()).toEqual(['glow', 'sun']);
    expect(svg.match(new RegExp(`fill="${colors.accent}"`, 'g'))).toHaveLength(4);
  });

  it('keeps the sun behind the far ridge, drifting with it', () => {
    const layer = svg.indexOf('<g class="dawn-layer-far">');
    const clip = svg.indexOf('<g clip-path="url(#dawn-sky)">');
    const ridge = svg.indexOf('class="dawn-ridge-far"');
    expect(layer).toBeGreaterThan(-1);
    expect(clip).toBeGreaterThan(layer);
    expect(ridge).toBeGreaterThan(clip);
    expect(svg.slice(layer, ridge)).not.toMatch(/dawn-layer-(?!far)/);
    for (const match of svg.matchAll(new RegExp(`fill="${colors.accent}"`, 'g'))) {
      expect(match.index).toBeGreaterThan(clip);
      expect(match.index).toBeLessThan(ridge);
    }
    expect(svg).toMatch(/<clipPath id="dawn-sky"><path d="M[^"]+L-?\d+ 0Z"\/><\/clipPath>/);
  });

  it('is decorative, stops for reduced motion and can be paused', () => {
    expect(svg).toContain('aria-hidden="true"');
    expect(svg).toContain('focusable="false"');
    expect(svg).toContain('@media (prefers-reduced-motion:reduce){.dawn *{animation:none!important}}');
    expect(svg).toContain(`.${DAWN_PAUSED_CLASS} *{animation-play-state:paused!important}`);
  });

  it('walks the turkeys at the speed of their stride, so feet do not slide', () => {
    const walk = dawnSprites.turkeyWalk;
    const cycleSeconds = walk.frames.length / walk.fps;
    for (const [, id, seconds, from, to] of svg.matchAll(
      /\.dawn-go-(jake-[a-z]+)\{[^}]*?animation:dawn-go-\1 (\d+)s linear[^}]*\}@keyframes dawn-go-\1\{from\{transform:translateX\((-?[\d.]+)px\)\}to\{transform:translateX\((-?[\d.]+)px\)\}\}/g,
    )) {
      const scale = Number(new RegExp(`dawn-go-${id}"><g transform="[^"]*scale\\(([\\d.]+) `).exec(svg)?.[1]);
      const perCycle = ((Number(to) - Number(from)) / Number(seconds)) * cycleSeconds;
      expect(perCycle).toBeCloseTo((walk.stride ?? 0) * scale, 0);
    }
    expect(svg.match(/\.dawn-go-jake-/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it('stays inside its transfer budget', () => {
    expect(gzipSync(svg, { level: 9 }).length).toBeLessThanOrEqual(MAX_GZIP_BYTES);
  });

  it('has every frame of every animal', () => {
    for (const sprite of Object.values(dawnSprites)) {
      expect(sprite.cells.length).toBeGreaterThan(0);
      expect(sprite.cells.every((d) => d.startsWith('M'))).toBe(true);
      expect(Math.max(...sprite.frames)).toBe(sprite.cells.length - 1);
    }
  });
});
