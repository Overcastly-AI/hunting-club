import { boundary, colors, fontFamily, fontSize, radii, sizes, theme } from '..';

describe('color tokens', () => {
  it('match the Design D values in docs/SPEC.md exactly', () => {
    expect(colors).toEqual({
      surface: '#121416',
      surfaceRaised: '#23272B',
      border: '#2A2E33',
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
  it('use the spec sizes', () => {
    expect(fontSize).toEqual({
      mapLabelMin: 13,
      tabLabel: 14,
      markerName: 15,
      body: 16,
      bodyLarge: 17,
      sheetTitle: 25,
    });
  });

  it('keep map text at 13 px or more and body text at 16 px or more', () => {
    expect(theme.textStyles.mapLabel.fontSize).toBeGreaterThanOrEqual(13);
    expect(theme.textStyles.markerName.fontSize).toBeGreaterThanOrEqual(13);
    expect(theme.textStyles.body.fontSize).toBeGreaterThanOrEqual(16);
    expect(theme.textStyles.bodyLarge.fontSize).toBeGreaterThanOrEqual(16);
    expect(theme.textStyles.label.fontSize).toBeGreaterThanOrEqual(16);
  });

  it('use only Archivo, weights 500 to 800', () => {
    for (const family of Object.values(fontFamily)) {
      expect(family).toMatch(/^Archivo_(500Medium|600SemiBold|700Bold|800ExtraBold)$/);
    }
    for (const style of Object.values(theme.textStyles)) {
      expect(Object.values(fontFamily)).toContain(style.fontFamily);
    }
  });

  it('marker names and the sheet title are extra bold', () => {
    expect(theme.textStyles.markerName.fontFamily).toBe(fontFamily.extraBold);
    expect(theme.textStyles.sheetTitle.fontFamily).toBe(fontFamily.extraBold);
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
