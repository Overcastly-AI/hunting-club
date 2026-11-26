/**
 * Type scale from docs/SPEC.md "Design system (from Design D)", platform-neutral.
 * The app turns it into React Native text styles (app/src/theme/typography.ts) and
 * the web admin page into CSS (web/src/theme/css.ts).
 */

/**
 * Archivo variable font (axes `wght` and `wdth`). The single font file lives in
 * app/assets/fonts/Archivo-Variable.ttf; the web build bundles that same file.
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

/** One named text style: font axes, size and (optionally) line height, in px. */
export interface TextScaleEntry {
  readonly weight: FontWeight;
  /** Defaults to fontWidth.normal. */
  readonly width?: FontWidth;
  readonly size: number;
  readonly lineHeight?: number;
}

/** Named text styles. Mixed case only; no letter-spaced all-caps. */
export const textScale = {
  body: { weight: fontWeight.medium, size: fontSize.body, lineHeight: 22 },
  bodyLarge: { weight: fontWeight.medium, size: fontSize.bodyLarge, lineHeight: 24 },
  label: { weight: fontWeight.semiBold, size: fontSize.body, lineHeight: 22 },
  tabLabel: { weight: fontWeight.semiBold, size: fontSize.tabLabel },
  mapLabel: { weight: fontWeight.bold, size: fontSize.mapLabelMin },
  markerName: { weight: fontWeight.extraBold, size: fontSize.markerName },
  sheetTitle: {
    weight: fontWeight.extraBold,
    width: fontWidth.sheetTitle,
    size: fontSize.sheetTitle,
    lineHeight: 30,
  },
} as const satisfies Record<string, TextScaleEntry>;

export type TextStyleName = keyof typeof textScale;
