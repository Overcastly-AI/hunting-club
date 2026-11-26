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
  /** Hunter marker circle (initials inside). */
  hunterMarker: 44,
  /** Freshness ring around a hunter marker. */
  freshnessRing: 3,
  /** Club stand marker (rounded square). */
  standMarker: 40,
  /** Your orange dot. */
  youDot: 20,
  /** Pulse around your dot at its largest. */
  youPulse: 56,
  /** Small drawn icons inside controls and markers. */
  icon: 22,
  /** Height of the scale bar's end ticks. */
  scaleBarTick: 8,
  /** Thin strokes in drawn icons and the scale bar. */
  hairline: 2,
} as const;

/** Opacity levels used on the map. */
export const opacity = {
  /** Positions older than 10 min, so nobody mistakes them for live. */
  faded: 0.5,
  /** Fill of your scent cone. */
  scentFill: 0.22,
  /** Outline of your scent cone. */
  scentLine: 0.8,
  /** Pressed buttons. */
  pressed: 0.7,
} as const;

export const radii = {
  control: 14,
  /** Club stand markers. */
  standMarker: 10,
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
