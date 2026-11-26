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

/** How long a toast stays, in ms. */
export const TOAST_DURATION_MS = 5000;

/** How long CopyButton says "Copied", in ms. */
export const COPIED_MS = 2000;
