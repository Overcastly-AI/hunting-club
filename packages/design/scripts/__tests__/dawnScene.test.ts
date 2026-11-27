import { gzipSync } from 'node:zlib';
import { colors } from '../../src/colors';
import { blendOver, contrastRatio, MIN_TEXT_CONTRAST } from '../../src/contrast';
import {
  DAWN_PAINTS,
  DAWN_PAUSED_CLASS,
  DAWN_TEXT_BACKDROPS,
  dawnSceneCss,
  dawnSceneSvg,
} from '../../src/dawnScene';
import { DAWN_PAUSE_BUTTON_CLASS } from '../../src/dawnControl';
import { dawnSprites } from '../../src/dawnSprites.generated';

/** Transfer budget for the whole scene (it replaces a 1.5 MB video and a poster image). */
const MAX_GZIP_BYTES = 90_000;

const svg = dawnSceneSvg();
const css = dawnSceneCss();

describe('dawn scene', () => {
  it('paints with design tokens only', () => {
    const tokens = new Set<string>(Object.values(colors));
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgb\(|hsl\(/);
    const used = new Set(svg.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []);
    expect(used.size).toBeGreaterThan(0);
    for (const color of used) expect(tokens).toContain(color);
    expect(svg).not.toMatch(/rgb\(|hsl\(/);
  });

  it('has no gradients, images, scripts or outside requests', () => {
    expect(svg).not.toMatch(/Gradient|<image|<script|<use|href|url\((?!#dawn-)/);
    expect(css).not.toMatch(/Gradient|url\(|@import/);
  });

  it('keeps its CSS out of the markup, so a strict CSP (no inline styles) allows it', () => {
    expect(svg).not.toMatch(/<style|\sstyle=/);
    expect(css).toContain('.dawn{position:absolute;inset:0;width:100%;height:100%}');
  });

  it('keeps both text tokens readable on everything text can sit on', () => {
    for (const { base, over } of DAWN_TEXT_BACKDROPS) {
      const backdrop = over.reduce<string>(
        (under, paint) => blendOver(colors[paint.token], under, paint.opacity),
        colors[base],
      );
      expect(contrastRatio(colors.text, backdrop)).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
      expect(contrastRatio(colors.textSecondary, backdrop)).toBeGreaterThanOrEqual(
        MIN_TEXT_CONTRAST,
      );
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
    expect(css).toContain(
      '@media (prefers-reduced-motion:reduce){.dawn *{animation:none!important}}',
    );
    expect(css).toContain(`.${DAWN_PAUSED_CLASS} *{animation-play-state:paused!important}`);
    expect(css).toContain(
      `@media (prefers-reduced-motion:reduce){.${DAWN_PAUSE_BUTTON_CLASS}{display:none}}`,
    );
  });

  it('walks the turkeys at the speed of their stride, so feet do not slide', () => {
    const walk = dawnSprites.turkeyWalk;
    const cycleSeconds = walk.frames.length / walk.fps;
    for (const [, id, seconds, from, to] of css.matchAll(
      /\.dawn-go-(jake-[a-z]+)\{[^}]*?animation:dawn-go-\1 (\d+)s linear[^}]*\}@keyframes dawn-go-\1\{from\{transform:translateX\((-?[\d.]+)px\)\}to\{transform:translateX\((-?[\d.]+)px\)\}\}/g,
    )) {
      const scale = Number(
        new RegExp(`dawn-go-${id}"><g transform="[^"]*scale\\(([\\d.]+) `).exec(svg)?.[1],
      );
      const perCycle = ((Number(to) - Number(from)) / Number(seconds)) * cycleSeconds;
      expect(perCycle).toBeCloseTo((walk.stride ?? 0) * scale, 0);
    }
    expect(css.match(/\.dawn-go-jake-[a-z]+\{/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it('stays inside its transfer budget', () => {
    expect(gzipSync(svg + css, { level: 9 }).length).toBeLessThanOrEqual(MAX_GZIP_BYTES);
  });

  it('has every frame of every animal', () => {
    for (const sprite of Object.values(dawnSprites)) {
      expect(sprite.cells.length).toBeGreaterThan(0);
      expect(sprite.cells.every((d) => d.startsWith('M'))).toBe(true);
      expect(Math.max(...sprite.frames)).toBe(sprite.cells.length - 1);
    }
  });
});

/** Numbers each SVG path command takes (per repeat); Z takes none. */
const PATH_ARITY: Record<string, number> = {
  M: 2,
  L: 2,
  H: 1,
  V: 1,
  C: 6,
  S: 4,
  Q: 4,
  T: 2,
  A: 7,
  Z: 0,
};

/**
 * Problems in an SVG path's `d`: an unknown command, or a command whose number count is not a
 * whole multiple of what it takes (a browser stops drawing the path at that point).
 */
function pathProblems(d: string): string[] {
  const problems: string[] = [];
  const tokens = d.match(/[A-Za-z]|[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?/g) ?? [];
  if (tokens.join('').length !== d.replace(/[\s,]/g, '').length) problems.push('stray characters');
  if (!/^[Mm]$/.test(tokens[0] ?? '')) problems.push('does not start with M');
  let i = 0;
  while (i < tokens.length) {
    const command = tokens[i]!;
    const arity = PATH_ARITY[command.toUpperCase()];
    if (arity === undefined) {
      problems.push(`unknown command ${command}`);
      break;
    }
    let count = 0;
    for (i++; i < tokens.length && !/[A-Za-z]/.test(tokens[i]!); i++) count++;
    const ok = arity === 0 ? count === 0 : count > 0 && count % arity === 0;
    if (!ok) problems.push(`${command} with ${count} numbers`);
  }
  return problems;
}

describe('dawn scene path data', () => {
  const paths = [...svg.matchAll(/\sd="([^"]*)"/g)].map((m) => m[1]!);
  const cells = Object.values(dawnSprites).flatMap((sprite) => sprite.cells);

  it('finds the paths it checks: the ridges, trees, grass and every animal frame', () => {
    expect(paths.length).toBeGreaterThan(5);
    expect(cells.length).toBeGreaterThan(10);
  });

  it('has no malformed command in any path, drawn or sprite', () => {
    const bad = [...paths, ...cells]
      .map((d) => ({ problems: pathProblems(d), start: d.slice(0, 40) }))
      .filter((p) => p.problems.length > 0);
    expect(bad).toEqual([]);
  });

  it('catches an incomplete Q, the bug this test was written for', () => {
    expect(pathProblems('M0 0 Q10 10 L20 20Z')).toEqual(['Q with 2 numbers']);
    expect(pathProblems('M0 0 Q10 10 20 20 L20 20Z')).toEqual([]);
    expect(pathProblems('M0 0 X1 2')).toEqual(['unknown command X']);
  });
});
