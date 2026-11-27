import { darkTheme, lightTheme } from './theme.ts';

const dark = darkTheme.colors;
const light = lightTheme.colors;

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
  /** The ground under the property. */
  mapGround: '#3B3A2D',
  /** The distance grid, drawn faintly over the ground. */
  mapGrid: '#D8C9A0',
} as const;

/**
 * Light sections of the public marketing site: the daylight theme's own colours (no cream),
 * until the site moves to the daylight theme itself (docs/DESIGN.md "Open points").
 */
export const lightColors = {
  /** Background of a light section. */
  bgLight: light.canvas,
  /** Text on a light section. */
  textOnLight: light.text,
  /** Secondary text on a light section. */
  mutedOnLight: light.textSecondary,
  /** Links on a light section (orange as text). */
  linkOnLight: light.accentText,
  /** Control edges and rules on a light section (the dark edge is too light for it). */
  edgeOnLight: light.borderControl,
} as const;
