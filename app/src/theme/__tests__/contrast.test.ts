import { readFileSync } from 'node:fs';

import { colors, opacity } from '..';
import { MIN_TEXT_CONTRAST, blendOver, contrastRatio } from '@huntclub/design';
import { SRC, sourceFiles } from '../../test-utils/sourceFiles';

describe('contrastRatio', () => {
  it('matches the WCAG reference values', () => {
    expect(contrastRatio('#FFFFFF', '#000000')).toBeCloseTo(21, 5);
    expect(contrastRatio('#777777', '#FFFFFF')).toBeCloseTo(4.48, 2);
  });

  it('blends a colour over a background', () => {
    expect(blendOver('#FFFFFF', '#000000', 0.5)).toBe('#808080');
  });
});

/** Every text colour drawn on the map sits on the map-halo outline. */
const MAP_TEXT = ['text', 'textSecondary', 'fresh', 'help', 'waterLabel'] as const;

/** Text on floating panels, the bottom sheet and buttons: [text, background]. */
const PANEL_TEXT: [keyof typeof colors, keyof typeof colors][] = [
  ['text', 'surface'],
  ['textSecondary', 'surface'],
  ['wind', 'surface'],
  ['help', 'surface'],
  ['text', 'surfaceRaised'],
  ['textSecondary', 'surfaceRaised'],
  ['surface', 'accent'], // primary button label
];

describe('text contrast (spec: at least 4.5:1)', () => {
  it.each(MAP_TEXT)('map label in %s on its halo', (token) => {
    expect(contrastRatio(colors[token], colors.mapHalo)).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
  });

  it.each(PANEL_TEXT)('%s on %s', (fg, bg) => {
    expect(contrastRatio(colors[fg], colors[bg])).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
  });

  it('keeps disabled choices readable', () => {
    const dimmed = blendOver(colors.textSecondary, colors.surfaceRaised, opacity.pressed);
    expect(contrastRatio(dimmed, colors.surfaceRaised)).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
  });

  it('would fail if faded markers dimmed their labels, which is why only the circle fades', () => {
    const dimmed = blendOver(colors.textSecondary, colors.mapHalo, opacity.faded);
    expect(contrastRatio(dimmed, colors.mapHalo)).toBeLessThan(MIN_TEXT_CONTRAST);
  });
});

/** Backgrounds every screen, sheet and card is drawn on. */
const SCREEN_BACKGROUNDS = ['surface', 'surfaceRaised'] as const;

/** Every token the app's source uses as a text colour (`color: colors.x`), so new ones are checked too. */
function textColorTokens(): (keyof typeof colors)[] {
  const used = sourceFiles(SRC, /\.tsx?$/).flatMap((file) =>
    [...readFileSync(file, 'utf8').matchAll(/\bcolor: colors\.(\w+)/g)].map((m) => m[1]!),
  );
  return [...new Set(used)].sort() as (keyof typeof colors)[];
}

describe('every text colour in the app on every screen background', () => {
  const tokens = textColorTokens();
  // A background colour used as text (the primary button label) is checked as a pair above.
  const onScreens = tokens.filter((t) => !(SCREEN_BACKGROUNDS as readonly string[]).includes(t));

  it('finds the text colours it checks', () => {
    expect(onScreens).toEqual(expect.arrayContaining(['text', 'textSecondary', 'help']));
  });

  it.each(onScreens.flatMap((fg) => SCREEN_BACKGROUNDS.map((bg) => [fg, bg] as const)))(
    '%s on %s',
    (fg, bg) => {
      expect(contrastRatio(colors[fg], colors[bg])).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
    },
  );
});
