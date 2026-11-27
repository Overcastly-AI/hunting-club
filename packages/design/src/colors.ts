import { darkTheme } from './theme.ts';

const dark = darkTheme.colors;

/**
 * The map's own colours and the app's current screens (docs/DESIGN.md "Palette", dark).
 * New UI uses the semantic theme tokens (./theme.ts); every name here that is a theme colour
 * takes it from the dark theme, so each value has one source. Components must use these
 * tokens; never hard-code colors.
 *
 * Orange (`accent`) is reserved for three things: you, the main action and the selected
 * item. On the web it is also the dawn scene's sun and its light (dawnScene.ts).
 */
export const colors = {
  /** Floating panels, bottom sheet (the dark plate). */
  surface: dark.plate,
  /** Secondary buttons. */
  surfaceRaised: dark.raised,
  /** Dividers (hairlines). */
  border: dark.borderSubtle,
  /**
   * Outline of text inputs and other controls: at least MIN_UI_CONTRAST (3:1) against
   * both `surface` and `surfaceRaised`, so a field's edge is visible.
   */
  controlBorder: dark.borderControl,
  /** Primary text. */
  text: dark.text,
  /** Labels, inactive tabs. */
  textSecondary: dark.textSecondary,
  /** You marker, primary button (Check Out), active tab only; on the web, also the dawn scene's sun. */
  accent: dark.accent,
  /** Ask for a Hand outline and icon; stale position ring. */
  help: dark.warning,
  /** Fresh position ring, mesh connected. */
  fresh: dark.fresh,
  /** Unread badges, compass north. */
  alert: dark.alert,
  /** Wind arrow. */
  wind: dark.wind,
  /** Creek and pond names. */
  waterLabel: '#C9DCDD',
  /** 3 px outline behind all map text (the direction's halo; the picture is the same in both themes). */
  mapHalo: '#0B0D0E',
} as const;

/** Club property line: white at 85% plus a 1 px accent inner line. */
export const boundary = {
  stroke: 'rgba(255, 255, 255, 0.85)',
  innerLine: colors.accent,
  innerLineWidth: 1,
} as const;

export type ColorToken = keyof typeof colors;

/**
 * The club plan: the map the web admin draws from the club's own geometry (property line,
 * areas, stands) where it has no imagery. Its ground is the aerial's base tone and its
 * distance grid the aerial's contour tone (the direction's world), the same in both themes,
 * like the picture.
 */
export const mapPlanColors = {
  /**
   * The ground under the property: the admin's plan, and on the site the tone behind the aerial
   * stand-in (aerial.ts) while it loads and around it on wide screens.
   */
  mapGround: '#3B3A2D',
  /** The distance grid, drawn faintly over the ground. */
  mapGrid: '#D8C9A0',
} as const;

/**
 * The little pictures of each basemap in the phone's layers sheet (docs/DESIGN.md, "Layers as a
 * sheet: three basemap thumbnails"). They are imagery, not interface, so they are the same in
 * both themes; the values are the mockups' aerial stand-in and topo swatch (design-map-first
 * branch, styles.css).
 */
export const basemapSwatch = {
  /** Aerial: timber, a field, a creek. */
  woods: '#2C3323',
  field: '#A39160',
  water: '#17323B',
  /** Topo: paper, green woods, brown contours, blue water. */
  paper: '#E4DFC8',
  paperWoods: '#C5D6A8',
  contour: '#9A7B4F',
  topoWater: '#1B5EA6',
  /** Hybrid: aerial with pale contours over it. */
  hybridContour: '#F1E6C0',
} as const;
