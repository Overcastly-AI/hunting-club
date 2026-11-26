import type { TextStyle } from 'react-native';

import { colors } from './colors';
import { sizes } from './sizes';

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

/** Design D's narrow width: the sheet title and any text that must fit a tight panel. */
const NARROW_WIDTH = 82;

/** Widths as a percentage of normal (`wdth` axis). The spec allows 75–100. */
export const fontWidth = {
  normal: 100,
  narrow: NARROW_WIDTH,
  /** Bottom sheet title. */
  sheetTitle: NARROW_WIDTH,
} as const;

/**
 * Largest system text size the app follows (spec: support up to 200%). Pass it
 * as `maxFontSizeMultiplier` wherever text must stay inside a fixed layout.
 */
export const maxFontScale = 2;

/** Axis ranges allowed by the design system. */
export const fontAxisLimits = {
  weight: { min: 500, max: 800 },
  width: { min: 75, max: 100 },
} as const;

export type FontWeight = (typeof fontWeight)[keyof typeof fontWeight];
export type FontWidth = (typeof fontWidth)[keyof typeof fontWidth];

/**
 * Archivo at a given weight and width. Both axes are always set explicitly
 * through `fontVariationSettings`, so iOS and Android render the same
 * instance of the variable font. Android needs API 26+, which is why the app's
 * Android minSdkVersion is 26 (app.config.ts).
 *
 * `fontWeight` stays 'normal' on purpose: it overrides weights that libraries
 * (for example React Navigation's tab labels) apply, which would otherwise make
 * iOS look for a separate bold face or Android fake-bold the glyphs.
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
  /** Clubhouse board: details read from across a room (place, since when). */
  boardDetail: 24,
  /** Clubhouse board: names and section headings read from across a room. */
  boardName: 32,
  /** Clubhouse board: the club name and clock. */
  boardTitle: 40,
} as const;

/** Ready-made text styles. Mixed case only; no letter-spaced all-caps. */
export const textStyles = {
  body: { ...archivo(fontWeight.medium), fontSize: fontSize.body, lineHeight: 22 },
  bodyLarge: { ...archivo(fontWeight.medium), fontSize: fontSize.bodyLarge, lineHeight: 24 },
  label: { ...archivo(fontWeight.semiBold), fontSize: fontSize.body, lineHeight: 22 },
  /** `label` at the narrow width, for panels that must not truncate (map conditions). */
  labelNarrow: {
    ...archivo(fontWeight.semiBold, fontWidth.narrow),
    fontSize: fontSize.body,
    lineHeight: 22,
  },
  tabLabel: { ...archivo(fontWeight.semiBold), fontSize: fontSize.tabLabel, lineHeight: 20 },
  mapLabel: { ...archivo(fontWeight.bold), fontSize: fontSize.mapLabelMin },
  markerName: { ...archivo(fontWeight.extraBold), fontSize: fontSize.markerName },
  sheetTitle: {
    ...archivo(fontWeight.extraBold, fontWidth.sheetTitle),
    fontSize: fontSize.sheetTitle,
    lineHeight: 30,
  },
  boardDetail: { ...archivo(fontWeight.semiBold), fontSize: fontSize.boardDetail, lineHeight: 32 },
  boardName: { ...archivo(fontWeight.extraBold), fontSize: fontSize.boardName, lineHeight: 40 },
  boardTitle: {
    ...archivo(fontWeight.extraBold, fontWidth.narrow),
    fontSize: fontSize.boardTitle,
    lineHeight: 48,
  },
} as const satisfies Record<string, TextStyle>;

/** Dark outline behind all text drawn on the map (map-halo token, 3 px). */
export const mapTextHalo = {
  textShadowColor: colors.mapHalo,
  textShadowRadius: sizes.mapHaloWidth,
  textShadowOffset: { width: 0, height: 0 },
} as const satisfies TextStyle;
