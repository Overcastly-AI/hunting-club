// Component sizes in px (docs/UI_REDESIGN.md sections 4 to 6), shared by the components
// and their stylesheets. The tap minimum itself is the design token sizes.minTapTarget.
import { sizes, space } from '@huntclub/design';

/** Lucide icon sizes: stroke 2, colour currentColor. */
export const ICON = { sm: 16, md: 20, lg: 24, empty: 48 } as const;

/** Button heights. No size goes under the 48 px tap minimum (coordinator decision). */
export const BUTTON_HEIGHT = {
  sm: sizes.minTapTarget,
  md: sizes.minTapTarget,
  lg: sizes.minTapTarget + space[2],
} as const;
export type ButtonSize = keyof typeof BUTTON_HEIGHT;

/** Side padding per button size. */
export const BUTTON_PADDING = { sm: space[4], md: space[6], lg: space[8] } as const;

/** Initials avatars. */
export const AVATAR = { sm: 32, md: 40, lg: 48 } as const;
export type AvatarSize = keyof typeof AVATAR;

/** DataTable body rows. */
export const TABLE_ROW_HEIGHT = 56;

/** The phone tab bar (P2 shell); toasts sit above it. */
export const MOBILE_TAB_BAR_HEIGHT = 64;

/** How long a toast stays, in ms. */
export const TOAST_DURATION_MS = 5000;

/** How long CopyButton says "Copied", in ms. */
export const COPIED_MS = 2000;
