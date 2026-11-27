/**
 * The /join page's states. The page is prerendered with every state's content, and its
 * script (./main.ts) shows the one that matches the URL fragment: the copy lives in the
 * HTML, so the script stays tiny. Shared by the page and the script.
 */
export const JOIN_STATES = ['generic', 'club', 'party', 'invalid'] as const;
export type JoinState = (typeof JOIN_STATES)[number];

/** Attributes the script looks for. */
export const JOIN_HOOKS = {
  /** Space-separated states an element is shown in; hidden in every other state. */
  state: 'data-join-state',
  /** The "Open in Hunt Club Mesh" link: its href is set to the app link. */
  open: 'data-join-open',
  /** Where the invite QR code is drawn (shown on wide screens). */
  qr: 'data-join-qr',
  /** The club invite's heading: becomes "Join <club name>" when the link names the club. */
  clubName: 'data-join-club-name',
} as const;

/**
 * Shown before the script runs (and with no script). Once it runs, a page with no invite
 * says the link is missing or invalid.
 */
export const INITIAL_JOIN_STATE: JoinState = 'generic';

export const JOIN_QR_LABEL = 'Invite QR code';

/** The club invite heading when the link names the club. Set as text, never as HTML. */
export const joinClubHeading = (clubName: string) => `Join ${clubName}`;
