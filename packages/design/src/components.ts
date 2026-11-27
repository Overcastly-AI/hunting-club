// Component sizes and status tones from docs/UI_REDESIGN.md sections 4 to 6, shared by the
// app's components (app/src/components) and the club admin's (web/src/components/ui). Only
// the names, sizes and colour pairs are shared; each platform draws its own components.
import { sizes, space } from './sizes';
import type { ThemeColorToken } from './theme';

/** Lucide icon sizes (stroke 2): inline 16, controls 20, tab and map controls 24, empty states 48. */
export const ICON_SIZE = { sm: 16, md: 20, lg: 24, empty: 48 } as const;

/**
 * Button heights (docs/DESIGN.md): 48 in a sheet or table header, 52 normally, 64 for the one
 * big action (Check In, sign in). No size goes under the 48 px tap minimum.
 */
export const BUTTON_HEIGHT = {
  sm: sizes.minTapTarget,
  md: sizes.minTapTarget + space[1],
  lg: sizes.minTapTarget + space[4],
} as const;
export type ButtonSize = keyof typeof BUTTON_HEIGHT;

/** Side padding per button size. */
export const BUTTON_PADDING = { sm: space[4], md: space[5], lg: space[6] } as const;

/** Badge, Banner and StatusPill tones. Status is never colour alone: each has an icon and a word. */
export const STATUS_TONES = ['success', 'warning', 'danger', 'info', 'neutral'] as const;
export type StatusTone = (typeof STATUS_TONES)[number];

/**
 * Text (and icon) colour and background of each tone. The tinted pairs are in
 * THEME_CONTRAST_RULES (status text on its own tint); neutral is secondary text on raised.
 */
export const STATUS_TONE_COLORS = {
  success: { foreground: 'success', background: 'successTint' },
  warning: { foreground: 'warning', background: 'warningTint' },
  danger: { foreground: 'danger', background: 'dangerTint' },
  info: { foreground: 'info', background: 'infoTint' },
  neutral: { foreground: 'textSecondary', background: 'raised' },
} as const satisfies Record<
  StatusTone,
  { foreground: ThemeColorToken; background: ThemeColorToken }
>;
