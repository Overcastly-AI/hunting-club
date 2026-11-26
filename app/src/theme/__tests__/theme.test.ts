import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { TextStyle } from 'react-native';

import { readFontFile } from '../../test-utils/fontFile';
import {
  archivo,
  boundary,
  colors,
  fontAxisLimits,
  fontFamily,
  fontSize,
  fontWeight,
  radii,
  sizes,
  theme,
} from '..';

describe('color tokens', () => {
  it('match the Design D values in docs/SPEC.md exactly', () => {
    expect(colors).toEqual({
      surface: '#121416',
      surfaceRaised: '#23272B',
      border: '#2A2E33',
      controlBorder: '#7A828A',
      text: '#FFFFFF',
      textSecondary: '#B8BDC2',
      accent: '#FF7A1F',
      help: '#F5C04E',
      fresh: '#4ADE80',
      alert: '#FF5A4E',
      wind: '#8EC5FF',
      waterLabel: '#C9DCDD',
      mapHalo: '#0B0D0E',
    });
  });

  it('draws the club boundary in white at 85% with a 1 px accent inner line', () => {
    expect(boundary).toEqual({
      stroke: 'rgba(255, 255, 255, 0.85)',
      innerLine: colors.accent,
      innerLineWidth: 1,
    });
  });
});

describe('type tokens', () => {
  const styles = Object.entries(theme.textStyles);

  it('use the spec sizes', () => {
    expect(fontSize).toEqual({
      mapLabelMin: 13,
      tabLabel: 14,
      markerName: 15,
      body: 16,
      bodyLarge: 17,
      sheetTitle: 25,
      boardDetail: 24,
      boardName: 32,
      boardTitle: 40,
      display: 40,
      title1: 28,
      title1Compact: 24,
      title2: 22,
      title3: 18,
      stat: 36,
      statCompact: 30,
      caption: 14,
      code: 15,
      codeField: 24,
    });
  });

  it('keep map text at 13 px or more and body text at 16 px or more', () => {
    expect(theme.textStyles.mapLabel.fontSize).toBeGreaterThanOrEqual(13);
    expect(theme.textStyles.markerName.fontSize).toBeGreaterThanOrEqual(13);
    expect(theme.textStyles.body.fontSize).toBeGreaterThanOrEqual(16);
    expect(theme.textStyles.bodyLarge.fontSize).toBeGreaterThanOrEqual(16);
    expect(theme.textStyles.label.fontSize).toBeGreaterThanOrEqual(16);
  });

  it('use the spec axis limits: weight 500–800, width 75–100', () => {
    expect(fontAxisLimits).toEqual({
      weight: { min: 500, max: 800 },
      width: { min: 75, max: 100 },
    });
  });

  it.each(styles)('%s uses Archivo with both axes inside the limits', (_name, style) => {
    expect(style.fontFamily).toBe(fontFamily);
    expect(style.fontWeight).toBe('normal');
    const { wght, wdth } = style.fontVariationSettings;
    expect(wght).toBeGreaterThanOrEqual(fontAxisLimits.weight.min);
    expect(wght).toBeLessThanOrEqual(fontAxisLimits.weight.max);
    expect(wdth).toBeGreaterThanOrEqual(fontAxisLimits.width.min);
    expect(wdth).toBeLessThanOrEqual(fontAxisLimits.width.max);
  });

  it('draws marker names at 800 and the sheet title at 800 and 82% width', () => {
    expect(theme.textStyles.markerName.fontVariationSettings).toEqual({ wght: 800, wdth: 100 });
    expect(theme.textStyles.sheetTitle.fontVariationSettings).toEqual({ wght: 800, wdth: 82 });
  });

  it('archivo() defaults to normal width', () => {
    expect(archivo(fontWeight.bold)).toEqual({
      fontFamily,
      fontWeight: 'normal',
      fontVariationSettings: { wght: 700, wdth: 100 },
    });
  });
});

describe('bundled font file', () => {
  const font = readFontFile(join(__dirname, '../../../assets/fonts/Archivo-Variable.ttf'));

  it('is the Archivo family', () => {
    expect(font.family).toBe(fontFamily);
  });

  it('has weight and width axes covering the design system limits', () => {
    const axis = (tag: string) => font.axes.find((a) => a.tag === tag);
    expect(axis('wght')?.min).toBeLessThanOrEqual(fontAxisLimits.weight.min);
    expect(axis('wght')?.max).toBeGreaterThanOrEqual(fontAxisLimits.weight.max);
    expect(axis('wdth')?.min).toBeLessThanOrEqual(fontAxisLimits.width.min);
    expect(axis('wdth')?.max).toBeGreaterThanOrEqual(fontAxisLimits.width.max);
  });

  it('fits in every line height a text style sets, so glyphs are never clipped', () => {
    const tooTight = Object.entries(theme.textStyles as Record<string, TextStyle>)
      .filter(([, style]) => style.lineHeight !== undefined)
      .filter(([, style]) => style.lineHeight! < Math.ceil(font.lineHeightEm * style.fontSize!))
      .map(([name]) => name);
    expect(tooTight).toEqual([]);
  });

  it('ships with its OFL license', () => {
    const license = readFileSync(join(__dirname, '../../../assets/fonts/Archivo-OFL.txt'), 'utf8');
    expect(license).toContain('SIL Open Font License, Version 1.1');
  });
});

describe('shape and size tokens', () => {
  it('use the spec sizes and corners', () => {
    expect(sizes.control).toBe(52);
    expect(radii.control).toBe(14);
    expect(sizes.primaryButtonMinHeight).toBe(62);
    expect(sizes.primaryButtonMaxHeight).toBe(66);
    expect(radii.primaryButton).toBe(12);
    expect(radii.sheetTop).toBe(20);
    expect(sizes.mapHaloWidth).toBe(3);
  });

  it('never go below the 48 px minimum tap target', () => {
    expect(sizes.minTapTarget).toBe(48);
    expect(sizes.control).toBeGreaterThanOrEqual(sizes.minTapTarget);
    expect(sizes.primaryButtonMinHeight).toBeGreaterThanOrEqual(sizes.minTapTarget);
  });
});
