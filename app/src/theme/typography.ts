import type { TextStyle } from 'react-native';

/**
 * Archivo variable font (axes `wght` and `wdth`), loaded once in the root
 * layout from `assets/fonts/Archivo-Variable.ttf` under this family name.
 */
export const fontFamily = 'Archivo';

/** Weights the design system uses. The spec allows 500–800. */
export const fontWeight = {
  medium: 500,
  semiBold: 600,
  bold: 700,
  extraBold: 800,
} as const;

/** Widths as a percentage of normal (`wdth` axis). The spec allows 75–100. */
export const fontWidth = {
  normal: 100,
  /** Bottom sheet title. */
  sheetTitle: 82,
} as const;

/** Axis ranges allowed by the design system. */
export const fontAxisLimits = {
  weight: { min: 500, max: 800 },
  width: { min: 75, max: 100 },
} as const;

export type FontWeight = (typeof fontWeight)[keyof typeof fontWeight];
export type FontWidth = (typeof fontWidth)[keyof typeof fontWidth];

/**
 * Archivo at a given weight and width. Both axes are always set explicitly
 * through `fontVariationSettings` (iOS, Android 8+ / API 26+), so both
 * platforms render the same instance of the variable font.
 *
 * `fontWeight` stays 'normal' on purpose: it overrides weights that libraries
 * (for example React Navigation's tab labels) apply, which would otherwise make
 * iOS look for a separate bold face or Android fake-bold the glyphs.
 *
 * Android 7 (API 24–25) ignores `fontVariationSettings` and shows the font's
 * default instance: weight 600, width 100.
 */
export function archivo(weight: FontWeight, width: FontWidth = fontWidth.normal) {
  return {
    fontFamily,
    fontWeight: 'normal',
    fontVariationSettings: { wght: weight, wdth: width },
  } as const satisfies TextStyle;
}

/** Type sizes in px from the design system. */
export const fontSize = {
  /** Minimum for any text drawn on the map. */
  mapLabelMin: 13,
  /** Tab bar labels. */
  tabLabel: 14,
  /** Hunter and stand marker names. */
  markerName: 15,
  /** Body text, minimum. */
  body: 16,
  /** Body text, large. */
  bodyLarge: 17,
  /** Bottom sheet title. */
  sheetTitle: 25,
} as const;

/** Ready-made text styles. Mixed case only; no letter-spaced all-caps. */
export const textStyles = {
  body: { ...archivo(fontWeight.medium), fontSize: fontSize.body, lineHeight: 22 },
  bodyLarge: { ...archivo(fontWeight.medium), fontSize: fontSize.bodyLarge, lineHeight: 24 },
  label: { ...archivo(fontWeight.semiBold), fontSize: fontSize.body, lineHeight: 22 },
  tabLabel: { ...archivo(fontWeight.semiBold), fontSize: fontSize.tabLabel },
  mapLabel: { ...archivo(fontWeight.bold), fontSize: fontSize.mapLabelMin },
  markerName: { ...archivo(fontWeight.extraBold), fontSize: fontSize.markerName },
  sheetTitle: {
    ...archivo(fontWeight.extraBold, fontWidth.sheetTitle),
    fontSize: fontSize.sheetTitle,
    lineHeight: 30,
  },
} as const satisfies Record<string, TextStyle>;
