/** Shape and size tokens in px from the design system. */
export const sizes = {
  /** Minimum tap target everywhere. */
  minTapTarget: 48,
  /** Round map controls (layers, north-up, center on me). */
  control: 52,
  /** Primary buttons: 62–66 px tall. */
  primaryButtonMinHeight: 62,
  primaryButtonMaxHeight: 66,
  /** Width of the dark outline behind all map text. */
  mapHaloWidth: 3,
} as const;

export const radii = {
  control: 14,
  primaryButton: 12,
  /** Top corners of the bottom sheet. */
  sheetTop: 20,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;
