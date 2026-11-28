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

/**
 * The admin shell (docs/DESIGN.md "Admin, My club"): the desktop rail with words, the tablet
 * rail of icons over short words, the phone's top bar; and My club's side panel.
 */
export const SHELL = {
  sidebarWidth: 232,
  railWidth: 88,
  topBarHeight: 56,
  contentMaxWidth: 1120,
  /** The logo mark in the rail and top bar. */
  logo: 28,
  /** The Billing warning dot. */
  dot: 10,
  /** My club's panel beside the map on desktop (Needs you). */
  sidePanelWidth: 400,
  /** Map heights where the map is not the whole page (phones, beside a table). */
  phoneMapHeight: 580,
  insetMapHeight: 360,
  insetMapHeightPhone: 280,
  /** Sign-in: the sample map's band above the form on a phone (short, so the email field shows on an SE). */
  signInMapHeightPhone: 200,
  /** Sign-in, from the tablet width up: room the form's plate covers (its width and margins), kept clear of the map. */
  signInDoorRoom: 520,
} as const;

/** How long a toast stays, in ms. */
export const TOAST_DURATION_MS = 5000;

/** How long CopyButton says "Copied", in ms. */
export const COPIED_MS = 2000;
