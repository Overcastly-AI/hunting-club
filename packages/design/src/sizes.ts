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

/** Corner radii in px (docs/UI_REDESIGN.md 4.4), plus the map and app names that use them. */
const radius = {
  /** Badges, chips in table cells. */
  sm: 8,
  /** Buttons, inputs, selects. */
  md: 12,
  /** Cards, tiles. */
  lg: 16,
  /** Dialogs, sheets. */
  xl: 20,
  /** Avatars, pills. */
  full: 999,
} as const;

export const radii = {
  ...radius,
  control: 14,
  /** Club stand markers. */
  standMarker: 10,
  primaryButton: radius.md,
  /** Top corners of the bottom sheet. */
  sheetTop: radius.xl,
} as const;

/** The 4/8 spacing scale in px (docs/UI_REDESIGN.md 4.3): `space-1` … `space-16`. */
export const space = {
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
} as const;

/** The spacing scale plus the original xs–xl names, kept as aliases. */
export const spacing = {
  ...space,
  xs: space[1],
  sm: space[2],
  md: space[4],
  lg: space[6],
  xl: space[8],
} as const;

/** Layout breakpoints in px: tablet from 640, desktop from 1024. */
export const breakpoints = {
  tablet: 640,
  desktop: 1024,
} as const;

/** Motion (docs/UI_REDESIGN.md 4.4). Under prefers-reduced-motion: no transforms, instant. */
export const motion = {
  /** Hover and press, in ms. */
  fast: 120,
  /** Dialogs and menus, in ms. */
  base: 200,
  easing: 'ease-out',
} as const;
