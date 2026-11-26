import type { TextStyle } from 'react-native';

/**
 * Archivo font faces loaded in the root layout. The spec allows weights 500–800.
 * The keys are the font family names registered with expo-font.
 */
export const fontFamily = {
  medium: 'Archivo_500Medium',
  semiBold: 'Archivo_600SemiBold',
  bold: 'Archivo_700Bold',
  extraBold: 'Archivo_800ExtraBold',
} as const;

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
  body: { fontFamily: fontFamily.medium, fontSize: fontSize.body, lineHeight: 22 },
  bodyLarge: { fontFamily: fontFamily.medium, fontSize: fontSize.bodyLarge, lineHeight: 24 },
  label: { fontFamily: fontFamily.semiBold, fontSize: fontSize.body, lineHeight: 22 },
  tabLabel: { fontFamily: fontFamily.semiBold, fontSize: fontSize.tabLabel },
  mapLabel: { fontFamily: fontFamily.bold, fontSize: fontSize.mapLabelMin },
  markerName: { fontFamily: fontFamily.extraBold, fontSize: fontSize.markerName },
  sheetTitle: { fontFamily: fontFamily.extraBold, fontSize: fontSize.sheetTitle, lineHeight: 30 },
} as const satisfies Record<string, TextStyle>;
