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
  hunterMarker: 42,
  /** Freshness ring around a hunter marker. */
  freshnessRing: 3,
  /** Club stand marker (rounded square). */
  standMarker: 38,
  /** Your orange dot. */
  youDot: 24,
  /** Pulse around your dot at its largest. */
  youPulse: 56,
  /** Small drawn icons inside controls and markers. */
  icon: 22,
  /** Height of the scale bar's end ticks. */
  scaleBarTick: 8,
  /** Thin strokes in drawn icons and the scale bar. */
  hairline: 2,
  /** Outline of a control (button, field, stand marker): 1.5 px, so it reads at a glance. */
  controlBorder: 1.5,
  /** Outline of the selected option (a basemap, a check-in mode): 2 px of accent edge. */
  selectedBorder: 2,
  /** The map's control column (Layers, North, Find me): one plate this wide. */
  mapToolWidth: 58,
  /** One control in that column. */
  mapToolHeight: 56,
  /** A check-in mode button (At a stand, In an area, Right here, On the move). */
  modeButton: 58,
  /** A row in a sheet list (stands to check in at, map layers). */
  listRow: 56,
  /** The radio mark at the end of a pick-one row. */
  radioMark: 26,
  /** The dot inside a chosen radio mark. */
  radioDot: 14,
  /** A basemap thumbnail's picture in the layers sheet. */
  swatchHeight: 56,
  /** The on/off switch's track and knob. */
  switchWidth: 46,
  switchHeight: 28,
  switchKnob: 18,
  /** The mesh status dot. */
  meshDot: 10,
  /** The grab handle on top of a sheet. */
  grabberWidth: 40,
  grabberHeight: 4,
  /** The strip of map above the chat thread, and the peek of map above Check In. */
  chatMapStrip: 96,
  checkInMapPeek: 180,
  /** The orange edge on your own message. */
  mineEdge: 3,
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
  /** Backing of a marker plate over the aerial, so busy imagery never shows through its text. */
  markerPlate: 0.94,
  /** Hybrid basemap: the topo map drawn over the aerial at this opacity. */
  hybridTopo: 0.45,
} as const;

/**
 * Corner radii in px (docs/DESIGN.md "Self-critique"): three radii with jobs, plus round.
 * Never one radius on everything regardless of hierarchy.
 */
const radius = {
  /** A marker plate (the name tag beside a marker); badges and other small tags. */
  sm: 6,
  /** Controls: buttons, inputs, selects, segmented controls. */
  md: 10,
  /** Plates: anything floating on the map, panels, tables. */
  lg: 12,
  /** The top corners of a sheet; dialogs. */
  xl: 16,
  /** Hunters, avatars, switches: round things only. */
  full: 999,
} as const;

export const radii = {
  ...radius,
  /** The map's control plate (Layers, North, Find me). */
  control: radius.lg,
  /** Club stand markers. */
  standMarker: 9,
  /** The name tag beside a marker. */
  markerPlate: radius.sm,
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
