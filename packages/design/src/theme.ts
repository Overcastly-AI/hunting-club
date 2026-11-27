/**
 * Dark and light themes: the map-first direction (docs/DESIGN.md "Palette"). Dark ("gunmetal")
 * is the default; light is the direction's "daylight" ("overcast"): a cool grey-green white
 * chosen for glare, never cream. Both themes have the same semantic names, so a component
 * written against one works in the other. Every pair the direction draws is held to WCAG
 * contrast by THEME_CONTRAST_RULES below (scripts/__tests__/theme.test.ts), in both themes.
 *
 * The chrome is three tones, deepest to highest: `canvas` (the direction's pit), `plate` and
 * `raised`. Orange (`accent`, the direction's blaze) has three jobs only: you, the main action
 * and the selected item.
 */

/** Hex colours of one theme. Every theme defines every name. */
export interface ThemeColors {
  /** The page; also the tab bar, the admin rail and text fields (the direction's pit). */
  readonly canvas: string;
  /** Anything floating on the map; sheets, panels, dialogs and tables (the direction's plate). */
  readonly plate: string;
  /** Secondary buttons, table heads, the selected row. */
  readonly raised: string;
  /** A raised control while hovered or pressed. */
  readonly pressed: string;
  /** Hairlines that divide cells and rows (the direction's hair; nothing depends on seeing them). */
  readonly borderSubtle: string;
  /** Outlines of controls (the direction's edge): 3:1 on every surface. */
  readonly borderControl: string;
  /** Words and readouts (the direction's ink). */
  readonly text: string;
  /** Second-line text (the direction's quiet). */
  readonly textSecondary: string;
  /** Disabled labels and placeholders only: still 4.5:1 on every surface. */
  readonly textTertiary: string;
  /** Fill of the main action, the selected item and you (the direction's blaze). */
  readonly accent: string;
  readonly accentHover: string;
  /** Edge of an accent fill. Light: ink, because orange alone does not pass 3:1 on white. */
  readonly accentBorder: string;
  /** Text and icons on an accent fill: near-black. White on accent is banned (2.6:1). */
  readonly onAccent: string;
  /** Orange as text: links, the selected tab and nav item (the direction's blaze-ink). */
  readonly accentText: string;
  /** Focus ring, on :focus-visible only (orange as text, so it passes 3:1). */
  readonly focusRing: string;
  readonly success: string;
  readonly successTint: string;
  readonly onSuccess: string;
  /** A position heard just now (the solid freshness ring); "Open"; mesh connected. */
  readonly fresh: string;
  /** A position not heard just now (the broken freshness ring). */
  readonly stale: string;
  /** Ask for a Hand (the direction's lantern) and the warning tone. Never styled like 911. */
  readonly warning: string;
  /** Ask for a Hand's wash and the warning tint (the direction's lantern-wash). */
  readonly warningTint: string;
  /** Destructive actions and errors. */
  readonly danger: string;
  readonly dangerTint: string;
  /** Text on a filled danger button (the confirm step only). */
  readonly onDanger: string;
  /** The unread badge and the north arrow: the only other red. */
  readonly alert: string;
  readonly onAlert: string;
  readonly info: string;
  readonly infoTint: string;
  /** The wind arrow in the conditions readout. */
  readonly wind: string;
}

/** Shadows and the dialog scrim (CSS values, not contrast-checked). */
export interface ThemeEffects {
  /**
   * A plate floating over imagery (the map or a scene): a 1 px dark ring and a soft drop.
   * Plates on the page have none: shadows only go under things that float over a picture.
   */
  readonly shadowPlate: string;
  readonly shadowPopover: string;
  readonly shadowDialog: string;
  readonly scrim: string;
}

export interface Theme {
  /** CSS `color-scheme` for native controls and scrollbars. */
  readonly colorScheme: 'dark' | 'light';
  readonly colors: ThemeColors;
  readonly effects: ThemeEffects;
}

/** Hunter orange: the same fill in both themes. */
const BLAZE = '#FF7A1F';
const BLAZE_HOVER = '#FF8F40';
/** Near-black text on orange (7.3:1). */
const ON_BLAZE = '#160E06';
const WHITE = '#FFFFFF';

/** Dark ("gunmetal") values that more than one token uses. */
const GUNMETAL = {
  pit: '#0B0E10',
  ink: '#F3F1EA',
  green: '#4ADE80',
  gold: '#F5C04E',
  sky: '#8EC5FF',
  red: '#FF5A4E',
  onRed: '#1A0503',
} as const;

export const darkTheme = {
  colorScheme: 'dark',
  colors: {
    canvas: GUNMETAL.pit,
    plate: '#14191C',
    raised: '#232B30',
    pressed: '#2A3338',
    borderSubtle: '#353F45',
    borderControl: '#7F8B91',
    text: GUNMETAL.ink,
    textSecondary: '#AEB7B6',
    textTertiary: '#97A1A0',
    accent: BLAZE,
    accentHover: BLAZE_HOVER,
    accentBorder: BLAZE,
    onAccent: ON_BLAZE,
    accentText: BLAZE,
    focusRing: BLAZE,
    success: GUNMETAL.green,
    successTint: '#16291E',
    onSuccess: GUNMETAL.pit,
    fresh: GUNMETAL.green,
    stale: GUNMETAL.gold,
    warning: GUNMETAL.gold,
    warningTint: '#2A2412',
    // A touch lighter than alert, so it still reads as text on a pressed fill.
    danger: '#FF6B5E',
    dangerTint: '#3A1C1A',
    onDanger: GUNMETAL.onRed,
    alert: GUNMETAL.red,
    onAlert: GUNMETAL.onRed,
    info: GUNMETAL.sky,
    infoTint: '#1A2733',
    wind: GUNMETAL.sky,
  },
  effects: {
    shadowPlate: '0 0 0 1px rgba(0, 0, 0, 0.6), 0 6px 18px rgba(0, 0, 0, 0.45)',
    shadowPopover: '0 0 0 1px rgba(0, 0, 0, 0.6), 0 8px 24px rgba(0, 0, 0, 0.45)',
    shadowDialog: '0 0 0 1px rgba(0, 0, 0, 0.6), 0 16px 48px rgba(0, 0, 0, 0.6)',
    scrim: 'rgba(0, 0, 0, 0.6)',
  },
} as const satisfies Theme;

/** Daylight ("overcast") values that more than one token uses. */
const OVERCAST = {
  ink: '#0E1416',
  blazeInk: '#A8420A',
  blue: '#1B5EA6',
} as const;

/** Daylight ("overcast"): body text at 7:1 or better on every surface. Not cream. */
export const lightTheme = {
  colorScheme: 'light',
  colors: {
    canvas: '#DCE1DF',
    plate: '#FBFCFB',
    raised: '#E7EBE9',
    pressed: '#E0E5E3',
    borderSubtle: '#C9D0CD',
    borderControl: '#66706C',
    text: OVERCAST.ink,
    textSecondary: '#45504D',
    textTertiary: '#545F5B',
    accent: BLAZE,
    accentHover: BLAZE_HOVER,
    // Orange is always outlined in ink in daylight, so its edge passes 3:1.
    accentBorder: OVERCAST.ink,
    onAccent: ON_BLAZE,
    accentText: OVERCAST.blazeInk,
    focusRing: OVERCAST.blazeInk,
    // Darker than fresh: success text sits on every surface, fresh text only on a plate.
    success: '#0F6B3A',
    successTint: '#DDEFE2',
    onSuccess: WHITE,
    fresh: '#157F3C',
    stale: '#8A6200',
    warning: '#6B4C00',
    warningTint: '#FBE7B0',
    danger: '#B3261E',
    dangerTint: '#F7E0DD',
    onDanger: WHITE,
    alert: '#C2281C',
    onAlert: WHITE,
    info: OVERCAST.blue,
    infoTint: '#DCE8F5',
    wind: OVERCAST.blue,
  },
  effects: {
    shadowPlate: '0 0 0 1px rgba(28, 38, 34, 0.55), 0 6px 18px rgba(28, 38, 34, 0.3)',
    shadowPopover: '0 0 0 1px rgba(28, 38, 34, 0.35), 0 8px 24px rgba(28, 38, 34, 0.2)',
    shadowDialog: '0 0 0 1px rgba(28, 38, 34, 0.35), 0 16px 48px rgba(28, 38, 34, 0.3)',
    scrim: 'rgba(14, 20, 22, 0.5)',
  },
} as const satisfies Theme;

export const themes = { dark: darkTheme, light: lightTheme } as const;
export type ThemeName = keyof typeof themes;
export type ThemeColorToken = keyof ThemeColors;

/** What the reader picks: follow the device, or force one theme. */
export const THEME_PREFERENCES = ['system', 'dark', 'light'] as const;
export type ThemePreference = (typeof THEME_PREFERENCES)[number];
export const DEFAULT_THEME_PREFERENCE: ThemePreference = 'system';
/** Word for each theme choice (the app's Settings → Theme and the admin's theme menu). */
export const THEME_PREFERENCE_LABELS = {
  system: 'System',
  dark: 'Dark',
  light: 'Light',
} as const satisfies Record<ThemePreference, string>;

/** Web: localStorage key holding the reader's ThemePreference. */
export const THEME_STORAGE_KEY = 'hcm-theme';
/** Web: attribute on <html> that forces a theme (absent means "system"). */
export const THEME_ATTRIBUTE = 'data-theme';

/** Every surface text and controls sit on, deepest to highest. */
export const SURFACES = ['canvas', 'plate', 'raised', 'pressed'] as const;

/**
 * Contrast rules for every theme: every pair the map-first direction draws (the pairs its
 * tools/contrast.mjs checks), widened to every surface wherever the token can land on one.
 * Each foreground is checked on each listed background, in both themes.
 */
export interface ContrastRule {
  readonly foreground: ThemeColorToken;
  readonly backgrounds: readonly ThemeColorToken[];
  /** `text`: 4.5:1 (MIN_TEXT_CONTRAST); `ui`: 3:1 for edges and rings (MIN_UI_CONTRAST). */
  readonly kind: 'text' | 'ui';
}

const onEverySurface = (kind: ContrastRule['kind'], foregrounds: readonly ThemeColorToken[]) =>
  foregrounds.map((foreground) => ({ foreground, backgrounds: SURFACES, kind }));

export const THEME_CONTRAST_RULES: readonly ContrastRule[] = [
  ...onEverySurface('text', [
    'text',
    'textSecondary',
    'textTertiary',
    'accentText',
    'success',
    'warning',
    'danger',
    'info',
  ]),
  // Control edges, the focus ring, the accent's edge and every ring, arrow or icon on chrome.
  ...onEverySurface('ui', [
    'borderControl',
    'focusRing',
    'accentBorder',
    'fresh',
    'stale',
    'alert',
    'wind',
  ]),
  // "Open" beside a stand and "heard 2 min ago" are fresh text, on a plate only.
  { foreground: 'fresh', backgrounds: ['plate'], kind: 'text' },
  // The selected segment and the on switch are inverted: plate on ink.
  { foreground: 'plate', backgrounds: ['text'], kind: 'text' },
  { foreground: 'onAccent', backgrounds: ['accent', 'accentHover'], kind: 'text' },
  { foreground: 'onSuccess', backgrounds: ['success'], kind: 'text' },
  { foreground: 'onDanger', backgrounds: ['danger'], kind: 'text' },
  { foreground: 'onAlert', backgrounds: ['alert'], kind: 'text' },
  // Status text on its own tint (badges, banners, Ask for a Hand). Never text on any other tint.
  { foreground: 'success', backgrounds: ['successTint'], kind: 'text' },
  { foreground: 'warning', backgrounds: ['warningTint'], kind: 'text' },
  { foreground: 'danger', backgrounds: ['dangerTint'], kind: 'text' },
  { foreground: 'info', backgrounds: ['infoTint'], kind: 'text' },
  // Ask for a Hand's second line ("Pings club members") is ink on the gold wash.
  { foreground: 'text', backgrounds: ['warningTint'], kind: 'text' },
];
