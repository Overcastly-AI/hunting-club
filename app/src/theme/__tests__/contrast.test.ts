import { readFileSync } from 'node:fs';

import { colors, opacity } from '..';
import {
  MIN_TEXT_CONTRAST,
  MIN_UI_CONTRAST,
  blendOver,
  contrastRatio,
  themes,
  type Theme,
  type ThemeColorToken,
  type ThemeName,
} from '@huntclub/design';
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

describe('map text contrast (spec: at least 4.5:1)', () => {
  it.each(MAP_TEXT)('map label in %s on its halo', (token) => {
    expect(contrastRatio(colors[token], colors.mapHalo)).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
  });

  it('would fail if faded markers dimmed their labels, which is why only the circle fades', () => {
    const dimmed = blendOver(colors.textSecondary, colors.mapHalo, opacity.faded);
    expect(contrastRatio(dimmed, colors.mapHalo)).toBeLessThan(MIN_TEXT_CONTRAST);
  });
});

/** Backgrounds every screen, sheet and card is drawn on (the app's surface0 and surface2). */
const SCREEN_BACKGROUNDS = ['surface0', 'surface2'] as const satisfies readonly ThemeColorToken[];
const THEMES = Object.entries(themes) as [ThemeName, Theme][];

/** Every theme token the app's source uses as a text colour (`color: theme.colors.x`). */
function textColorTokens(): ThemeColorToken[] {
  const used = sourceFiles(SRC, /\.tsx?$/).flatMap((file) =>
    [...readFileSync(file, 'utf8').matchAll(/\bcolor: theme\.colors\.(\w+)/g)].map((m) => m[1]!),
  );
  return [...new Set(used)].sort() as ThemeColorToken[];
}

describe.each(THEMES)('%s theme: app text contrast (at least 4.5:1)', (_name, theme) => {
  const c = theme.colors;
  const tokens = textColorTokens();

  it('finds the text colours it checks', () => {
    expect(tokens).toEqual(
      expect.arrayContaining(['text', 'textSecondary', 'warning', 'onAccent']),
    );
  });

  // Text on an accent fill (the primary button label) is checked on the accent itself.
  it.each(tokens.filter((t) => t !== 'onAccent'))('%s on every screen background', (fg) => {
    for (const bg of SCREEN_BACKGROUNDS) {
      expect({ fg, bg, ratio: contrastRatio(c[fg], c[bg]) >= MIN_TEXT_CONTRAST }).toEqual({
        fg,
        bg,
        ratio: true,
      });
    }
  });

  it('primary button label on the accent', () => {
    expect(contrastRatio(c.onAccent, c.accent)).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
  });

  it('slide-to-confirm chevrons on their thumbs (3:1 for graphics)', () => {
    expect(contrastRatio(c.onAccent, c.accent)).toBeGreaterThanOrEqual(MIN_UI_CONTRAST);
    expect(contrastRatio(c.surface0, c.warning)).toBeGreaterThanOrEqual(MIN_UI_CONTRAST);
  });

  it('keeps disabled controls readable: tertiary text on every disabled fill', () => {
    // Button, Choice, OptionButtons and SlideToConfirm draw disabled with their own colours
    // (no fading), so the label keeps 4.5:1 in both themes.
    for (const fill of ['surface1', 'surface2', 'surface3'] as const) {
      expect(contrastRatio(c.textTertiary, c[fill])).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
    }
  });
});
