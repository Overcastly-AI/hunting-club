/**
 * Color tokens from docs/SPEC.md, "Design system (from Design D)".
 * Components must use these tokens; never hard-code colors.
 *
 * Orange (`accent`) is reserved for three things: you, the main action and
 * the selected tab.
 */
export const colors = {
  /** Floating panels, bottom sheet, tab bar. */
  surface: '#121416',
  /** Secondary buttons. */
  surfaceRaised: '#23272B',
  /** Dividers and outlines. */
  border: '#2A2E33',
  /**
   * Outline of text inputs and other controls: at least MIN_UI_CONTRAST (3:1) against
   * both `surface` and `surfaceRaised`, so a field's edge is visible.
   */
  controlBorder: '#7A828A',
  /** Primary text. */
  text: '#FFFFFF',
  /** Labels, inactive tabs. */
  textSecondary: '#B8BDC2',
  /** You marker, primary button (Check Out), active tab only. */
  accent: '#FF7A1F',
  /** Ask for a Hand outline and icon; stale position ring. */
  help: '#F5C04E',
  /** Fresh position ring, mesh connected. */
  fresh: '#4ADE80',
  /** Unread badges, compass north. */
  alert: '#FF5A4E',
  /** Wind arrow. */
  wind: '#8EC5FF',
  /** Creek and pond names. */
  waterLabel: '#C9DCDD',
  /** 3 px outline behind all map text. */
  mapHalo: '#0B0D0E',
} as const;

/** Club property line: white at 85% plus a 1 px accent inner line. */
export const boundary = {
  stroke: 'rgba(255, 255, 255, 0.85)',
  innerLine: colors.accent,
  innerLineWidth: 1,
} as const;

export type ColorToken = keyof typeof colors;
