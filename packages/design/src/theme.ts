/**
 * Dark and light themes (docs/UI_REDESIGN.md section 4.1, docs/SPEC.md "Design system").
 * Dark-first; the light ("sunlight") theme has the same semantic names so a component
 * written against one works in the other. Every text and control pair is held to WCAG
 * contrast by src/__tests__/theme-contrast.test.ts, for both themes.
 *
 * Orange (`accent`) is for you, the main action and the selected item only.
 */

/** Hex colours of one theme. Every theme defines every name. */
export interface ThemeColors {
  /** Page field behind cards. */
  readonly canvas: string;
  /** Sidebar, top bar, tab bar. */
  readonly surface0: string;
  /** Cards. */
  readonly surface1: string;
  /** Inputs, secondary buttons, hover rows. */
  readonly surface2: string;
  /** Pressed, selected row. */
  readonly surface3: string;
  /** Decorative dividers and card edges only (nothing depends on seeing them). */
  readonly borderSubtle: string;
  /** Edges of inputs, checkboxes and other controls (3:1 on every surface). */
  readonly borderControl: string;
  readonly text: string;
  readonly textSecondary: string;
  /** Meta text only. */
  readonly textTertiary: string;
  /** Fill of the main action, the selected item and you. */
  readonly accent: string;
  readonly accentHover: string;
  /** Edge of an accent fill (light theme: the fill alone does not read on cream). */
  readonly accentBorder: string;
  /** Text and icons on an accent fill. White on accent is banned (2.6:1). */
  readonly onAccent: string;
  /** Links and selected nav text. */
  readonly accentText: string;
  /** 2 px focus ring with a 2 px offset, on :focus-visible only. */
  readonly focusRing: string;
  readonly success: string;
  readonly successTint: string;
  readonly onSuccess: string;
  readonly warning: string;
  readonly warningTint: string;
  readonly danger: string;
  readonly dangerTint: string;
  /** Text on a filled danger button (the confirm step only). */
  readonly onDanger: string;
  readonly info: string;
  readonly infoTint: string;
}

/** Shadows and the dialog scrim (CSS values, not contrast-checked). */
export interface ThemeEffects {
  /** Dark cards separate by tone and border, so `none`. */
  readonly shadowCard: string;
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

const DARK_ACCENT = '#FF7A1F';
const INK = '#121416';
const WHITE = '#FFFFFF';

export const darkTheme = {
  colorScheme: 'dark',
  colors: {
    canvas: '#0B0D0E',
    surface0: INK,
    surface1: '#1A1D20',
    surface2: '#23272B',
    surface3: '#2C3136',
    borderSubtle: '#2A2E33',
    borderControl: '#7A828A',
    text: WHITE,
    textSecondary: '#B8BDC2',
    textTertiary: '#9AA2A9',
    accent: DARK_ACCENT,
    accentHover: '#FF8F40',
    accentBorder: DARK_ACCENT,
    onAccent: INK,
    accentText: '#FF9A4D',
    focusRing: DARK_ACCENT,
    success: '#4ADE80',
    successTint: '#223C2F',
    onSuccess: INK,
    warning: '#F5C04E',
    warningTint: '#3D3727',
    danger: '#FF6B5E',
    dangerTint: '#3F292A',
    onDanger: INK,
    info: '#8EC5FF',
    infoTint: '#2D3844',
  },
  effects: {
    shadowCard: 'none',
    shadowPopover: '0 8px 24px rgba(0, 0, 0, 0.45)',
    shadowDialog: '0 16px 48px rgba(0, 0, 0, 0.6)',
    scrim: 'rgba(0, 0, 0, 0.6)',
  },
} as const satisfies Theme;

/** "Sunlight": all body text at 7:1 or better on every surface. */
export const lightTheme = {
  colorScheme: 'light',
  colors: {
    canvas: '#F4F1EA',
    // The brief names no light surface-0; the sidebar and bars sit on white like cards.
    surface0: WHITE,
    surface1: WHITE,
    surface2: '#ECE8DE',
    surface3: '#E4DFD3',
    borderSubtle: '#D9D3C5',
    borderControl: '#6B737A',
    text: INK,
    textSecondary: '#3F464C',
    textTertiary: '#586068',
    accent: DARK_ACCENT,
    accentHover: darkTheme.colors.accentHover,
    accentBorder: '#A8420A',
    onAccent: INK,
    accentText: '#A8420A',
    focusRing: INK,
    success: '#0F6B3A',
    successTint: '#E2EDE7',
    onSuccess: WHITE,
    warning: '#7A4A00',
    warningTint: '#EFE9E0',
    danger: '#B3261E',
    dangerTint: '#F6E5E4',
    onDanger: WHITE,
    info: '#0B5CA8',
    infoTint: '#E2EBF5',
  },
  effects: {
    shadowCard: '0 1px 2px rgba(18, 20, 22, 0.08)',
    shadowPopover: '0 8px 24px rgba(18, 20, 22, 0.16)',
    shadowDialog: '0 16px 48px rgba(18, 20, 22, 0.24)',
    scrim: 'rgba(18, 20, 22, 0.5)',
  },
} as const satisfies Theme;

export const themes = { dark: darkTheme, light: lightTheme } as const;
export type ThemeName = keyof typeof themes;
export type ThemeColorToken = keyof ThemeColors;

/** What the reader picks: follow the device, or force one theme. */
export const THEME_PREFERENCES = ['system', 'dark', 'light'] as const;
export type ThemePreference = (typeof THEME_PREFERENCES)[number];
export const DEFAULT_THEME_PREFERENCE: ThemePreference = 'system';

/** Web: localStorage key holding the reader's ThemePreference. */
export const THEME_STORAGE_KEY = 'hcm-theme';
/** Web: attribute on <html> that forces a theme (absent means "system"). */
export const THEME_ATTRIBUTE = 'data-theme';

/**
 * Contrast rules for every theme (docs/UI_REDESIGN.md 4.1). Each foreground is checked on
 * each listed background. This is a superset of the brief's pairs: text and controls are
 * checked on every surface, not only the ones the brief measured.
 */
const SURFACES = ['canvas', 'surface0', 'surface1', 'surface2', 'surface3'] as const;

export interface ContrastRule {
  readonly foreground: ThemeColorToken;
  readonly backgrounds: readonly ThemeColorToken[];
  /** `text`: 4.5:1 (MIN_TEXT_CONTRAST); `ui`: 3:1 for edges and rings (MIN_UI_CONTRAST). */
  readonly kind: 'text' | 'ui';
}

export const THEME_CONTRAST_RULES: readonly ContrastRule[] = [
  ...(
    [
      'text',
      'textSecondary',
      'textTertiary',
      'accentText',
      'success',
      'warning',
      'danger',
      'info',
    ] as const
  ).map((foreground) => ({ foreground, backgrounds: SURFACES, kind: 'text' as const })),
  ...(['borderControl', 'focusRing', 'accentBorder'] as const).map((foreground) => ({
    foreground,
    backgrounds: SURFACES,
    kind: 'ui' as const,
  })),
  { foreground: 'onAccent', backgrounds: ['accent', 'accentHover'], kind: 'text' },
  { foreground: 'onSuccess', backgrounds: ['success'], kind: 'text' },
  { foreground: 'onDanger', backgrounds: ['danger'], kind: 'text' },
  // Status text on its own tint (badges and banners). Never text on any other tint.
  { foreground: 'success', backgrounds: ['successTint'], kind: 'text' },
  { foreground: 'warning', backgrounds: ['warningTint'], kind: 'text' },
  { foreground: 'danger', backgrounds: ['dangerTint'], kind: 'text' },
  { foreground: 'info', backgrounds: ['infoTint'], kind: 'text' },
];
