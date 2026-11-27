// Web-only component sizes in px, shared by the components and their stylesheets. Sizes
// both platforms use (icons, buttons) are ICON_SIZE, BUTTON_HEIGHT and BUTTON_PADDING in
// @huntclub/design.

/** Initials avatars. */
export const AVATAR = { sm: 32, md: 40, lg: 48 } as const;
export type AvatarSize = keyof typeof AVATAR;

/** DataTable body rows. */
export const TABLE_ROW_HEIGHT = 56;

/** The phone tab bar (P2 shell); toasts sit above it. */
export const MOBILE_TAB_BAR_HEIGHT = 64;

/** The admin shell (docs/UI_REDESIGN.md section 5): desktop sidebar, tablet rail, phone top bar. */
export const SHELL = {
  sidebarWidth: 240,
  railWidth: 72,
  topBarHeight: 56,
  contentMaxWidth: 1120,
  /** The logo mark in the sidebar, rail and top bar. */
  logo: 32,
  /** The Billing warning dot. */
  dot: 10,
} as const;

/** How long a toast stays, in ms. */
export const TOAST_DURATION_MS = 5000;

/** How long CopyButton says "Copied", in ms. */
export const COPIED_MS = 2000;
