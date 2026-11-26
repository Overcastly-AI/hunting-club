import { darkTheme, lightTheme } from './theme.ts';

const dark = darkTheme.colors;

/**
 * Color tokens from docs/SPEC.md, "Design system (from Design D)": the map and the
 * app's current screens. New UI uses the semantic theme tokens (./theme.ts); a name
 * here that is the same colour takes it from the dark theme, so each value has one source.
 * Components must use these tokens; never hard-code colors.
 *
 * Orange (`accent`) is reserved for three things: you, the main action and
 * the selected tab. On the web it is also the dawn scene's sun and its light
 * (dawnScene.ts, the home hero and sign-in background): the owner kept it.
 */
export const colors = {
  /** Floating panels, bottom sheet, tab bar. */
  surface: dark.surface0,
  /** Secondary buttons. */
  surfaceRaised: dark.surface2,
  /** Dividers and outlines. */
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
  fresh: dark.success,
  /** Unread badges, compass north. */
  alert: '#FF5A4E',
  /** Wind arrow. */
  wind: dark.info,
  /** Creek and pond names. */
  waterLabel: '#C9DCDD',
  /** 3 px outline behind all map text. */
  mapHalo: dark.canvas,
} as const;

/** Club property line: white at 85% plus a 1 px accent inner line. */
export const boundary = {
  stroke: 'rgba(255, 255, 255, 0.85)',
  innerLine: colors.accent,
  innerLineWidth: 1,
} as const;

export type ColorToken = keyof typeof colors;

/**
 * Light sections of the public marketing site (docs/SPEC.md "Light sections"). The app
 * and the club admin use the full light theme (./theme.ts) instead.
 */
export const lightColors = {
  /** Background of a light section. */
  bgLight: lightTheme.colors.canvas,
  /** Text on a light section. */
  textOnLight: lightTheme.colors.text,
  /** Secondary text on a light section. */
  mutedOnLight: '#4A5158',
  /** Links on a light section (accent darkened to read as text). */
  linkOnLight: lightTheme.colors.accentText,
} as const;
