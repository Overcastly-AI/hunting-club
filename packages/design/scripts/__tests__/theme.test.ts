import { runInNewContext } from 'node:vm';
import { colors, lightColors } from '../../src/colors';
import { contrastRatio, MIN_TEXT_CONTRAST, MIN_UI_CONTRAST } from '../../src/contrast';
import {
  rootVariablesCss,
  textClasses,
  themeBootstrapJs,
  themeCss,
  themeVariables,
} from '../../src/css';
import { BUTTON_HEIGHT, STATUS_TONE_COLORS, STATUS_TONES } from '../../src/components';
import { radii, space, spacing } from '../../src/sizes';
import {
  THEME_ATTRIBUTE,
  THEME_CONTRAST_RULES,
  THEME_PREFERENCE_LABELS,
  THEME_PREFERENCES,
  THEME_STORAGE_KEY,
  themes,
  type ThemeName,
} from '../../src/theme';
import { fontAxisLimits, fontSize, textScale } from '../../src/type';

const THEME_NAMES = Object.keys(themes) as ThemeName[];
const MIN = { text: MIN_TEXT_CONTRAST, ui: MIN_UI_CONTRAST } as const;

/** [theme, foreground, background, minimum] for every rule, in both themes. */
const PAIRS = THEME_NAMES.flatMap((theme) =>
  THEME_CONTRAST_RULES.flatMap((rule) =>
    rule.backgrounds.map((bg) => [theme, rule.foreground, bg, MIN[rule.kind]] as const),
  ),
);

describe('theme contrast (fails the build if any pair drops under its threshold)', () => {
  it('checks every theme', () => {
    expect(THEME_NAMES).toEqual(['dark', 'light']);
    expect(PAIRS.length).toBeGreaterThan(100);
  });

  it.each(PAIRS)('%s: %s on %s at %s:1 or better', (theme, fg, bg, min) => {
    const { colors: c } = themes[theme];
    expect(contrastRatio(c[fg], c[bg])).toBeGreaterThanOrEqual(min);
  });

  it('defines the same tokens in every theme', () => {
    expect(Object.keys(themes.light.colors).sort()).toEqual(Object.keys(themes.dark.colors).sort());
    expect(Object.keys(themes.light.effects).sort()).toEqual(
      Object.keys(themes.dark.effects).sort(),
    );
  });

  it('keeps body text at 7:1 or better on every light surface (sunlight)', () => {
    const c = themes.light.colors;
    for (const bg of ['canvas', 'surface0', 'surface1', 'surface2', 'surface3'] as const) {
      expect(contrastRatio(c.text, c[bg])).toBeGreaterThanOrEqual(7);
    }
  });

  it('never puts white on the accent fill', () => {
    for (const theme of THEME_NAMES) {
      const c = themes[theme].colors;
      expect(contrastRatio('#FFFFFF', c.accent)).toBeLessThan(MIN_TEXT_CONTRAST);
      expect(c.onAccent).not.toBe('#FFFFFF');
    }
  });

  it('gives the light accent fill an edge that reads on cream', () => {
    const c = themes.light.colors;
    expect(contrastRatio(c.accent, c.canvas)).toBeLessThan(MIN_UI_CONTRAST);
    expect(contrastRatio(c.accentBorder, c.canvas)).toBeGreaterThanOrEqual(MIN_UI_CONTRAST);
  });

  it('keeps the map and marketing tokens equal to their theme sources', () => {
    const dark = themes.dark.colors;
    expect(colors.surface).toBe(dark.surface0);
    expect(colors.surfaceRaised).toBe(dark.surface2);
    expect(colors.mapHalo).toBe(dark.canvas);
    expect(colors.help).toBe(dark.warning);
    expect(colors.fresh).toBe(dark.success);
    expect(lightColors.bgLight).toBe(themes.light.colors.canvas);
  });
});

describe('theme CSS', () => {
  const css = themeCss();

  it('declares every token of a theme as a --theme- variable', () => {
    const vars = themeVariables(themes.dark);
    expect(vars['--theme-surface-0']).toBe(themes.dark.colors.surface0);
    expect(vars['--theme-text-secondary']).toBe(themes.dark.colors.textSecondary);
    expect(vars['--theme-shadow-dialog']).toBe(themes.dark.effects.shadowDialog);
    expect(vars['--theme-color-scheme']).toBe('dark');
    expect(Object.keys(vars)).toHaveLength(
      Object.keys(themes.dark.colors).length + Object.keys(themes.dark.effects).length + 1,
    );
  });

  it('puts dark on :root, light on data-theme="light" and on "system" when the device prefers light', () => {
    expect(css).toContain(
      `:root, [${THEME_ATTRIBUTE}="dark"] { --theme-canvas: ${themes.dark.colors.canvas};`,
    );
    expect(css).toContain(
      `@media (prefers-color-scheme: light) { :root:not([${THEME_ATTRIBUTE}="dark"]) { --theme-canvas: ${themes.light.colors.canvas};`,
    );
    expect(css).toContain(
      `[${THEME_ATTRIBUTE}="light"] { --theme-canvas: ${themes.light.colors.canvas};`,
    );
    // The forced light block comes after the dark one, so it wins at equal specificity.
    expect(css.indexOf(`[${THEME_ATTRIBUTE}="light"] {`)).toBeGreaterThan(css.indexOf(':root, '));
  });

  it('has no hard-coded colour outside the generated values', () => {
    const values = new Set(
      THEME_NAMES.flatMap((t) => Object.values(themes[t].colors).map((v) => v.toLowerCase())),
    );
    for (const hex of css.match(/#[0-9a-f]{6}/gi) ?? [])
      expect(values).toContain(hex.toLowerCase());
  });
});

describe('theme bootstrap script', () => {
  /** Runs the script against a stand-in <html> and localStorage. */
  function run(stored: string | null | Error) {
    const attrs: Record<string, string> = {};
    const localStorage = {
      getItem: (key: string) => {
        if (stored instanceof Error) throw stored;
        return key === THEME_STORAGE_KEY ? stored : null;
      },
    };
    const document = {
      documentElement: { setAttribute: (k: string, v: string) => (attrs[k] = v) },
    };
    runInNewContext(themeBootstrapJs(), { localStorage, document });
    return attrs[THEME_ATTRIBUTE];
  }

  it('forces the stored theme', () => {
    expect(run('dark')).toBe('dark');
    expect(run('light')).toBe('light');
  });

  it('leaves "system", no choice and unknown values to the device', () => {
    expect(THEME_PREFERENCES).toContain('system');
    expect(run('system')).toBeUndefined();
    expect(run(null)).toBeUndefined();
    expect(run('sepia')).toBeUndefined();
  });

  it('survives blocked storage', () => {
    expect(run(new Error('SecurityError'))).toBeUndefined();
  });

  it('stays tiny', () => {
    expect(themeBootstrapJs().length).toBeLessThan(300);
  });
});

describe('type, spacing, radii and motion', () => {
  it('keeps every text style at 14 px or more, except map text at 13 px', () => {
    for (const [name, entry] of Object.entries(textScale)) {
      const min = name === 'mapLabel' ? fontSize.mapLabelMin : 14;
      expect(entry.size).toBeGreaterThanOrEqual(min);
      if ('compact' in entry) expect(entry.compact.size).toBeGreaterThanOrEqual(min);
    }
  });

  it('uses weights 500–800 only', () => {
    for (const entry of Object.values(textScale)) {
      expect(entry.weight).toBeGreaterThanOrEqual(fontAxisLimits.weight.min);
      expect(entry.weight).toBeLessThanOrEqual(fontAxisLimits.weight.max);
    }
  });

  it('shrinks the page title and stat values on phones', () => {
    const classes = textClasses();
    expect(classes).toContain(
      '@media (max-width: 639px) { .text-title-1 { font-size: 1.5rem; line-height: 2rem; } }',
    );
    expect(classes).toContain('.text-stat {');
    expect(classes).toMatch(/\.text-stat \{[^}]*font-variant-numeric: tabular-nums/);
    expect(classes).not.toMatch(/text-transform:\s*uppercase|letter-spacing/);
  });

  it('keeps the old spacing names as aliases of the new scale', () => {
    expect(spacing).toMatchObject({ xs: 4, sm: 8, md: 16, lg: 24, xl: 32 });
    expect(Object.values(space)).toEqual([4, 8, 12, 16, 20, 24, 32, 40, 48, 64]);
    expect(radii).toMatchObject({ sm: 8, md: 12, lg: 16, xl: 20, full: 999, sheetTop: 20 });
  });

  it('declares spacing and motion variables, instant under reduced motion', () => {
    const root = rootVariablesCss();
    expect(root).toContain('--space-1: 4px;');
    expect(root).toContain('--space-xs: 4px;');
    expect(root).toContain('--radius-lg: 16px;');
    expect(root).toContain('--motion-fast: 120ms;');
    expect(root).toContain(
      '@media (prefers-reduced-motion: reduce) { :root { --motion-fast: 0ms; --motion-base: 0ms; } }',
    );
  });
});

describe('theme choice labels', () => {
  it('names every choice in one word, each different', () => {
    const labels = THEME_PREFERENCES.map((p) => THEME_PREFERENCE_LABELS[p]);
    expect(labels).toEqual(['System', 'Dark', 'Light']);
    expect(Object.keys(THEME_PREFERENCE_LABELS).sort()).toEqual([...THEME_PREFERENCES].sort());
  });
});

describe('component sizes and status tones', () => {
  it('keeps every button at the 48 px tap minimum or more', () => {
    for (const height of Object.values(BUTTON_HEIGHT)) {
      expect(height).toBeGreaterThanOrEqual(48);
    }
    expect(BUTTON_HEIGHT).toEqual({ sm: 48, md: 48, lg: 56 });
  });

  it.each(THEME_NAMES)('draws every status tone readably in the %s theme', (name) => {
    const c = themes[name].colors;
    for (const tone of STATUS_TONES) {
      const { foreground, background } = STATUS_TONE_COLORS[tone];
      expect(contrastRatio(c[foreground], c[background])).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
    }
  });
});
