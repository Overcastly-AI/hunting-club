/**
 * Every key a client keeps a secret under, in one place (letters, digits, ".", "-" and
 * "_" only). The app stores these in the phone's keystore; the web admin keeps only its
 * refresh token, in browser storage. Never log the values.
 */
export const SECURE_KEYS = {
  partyJoinLink: 'party.joinLink',
  /** Club sign-in tokens (Cognito access + refresh), JSON. App keystore. */
  clubAuthTokens: 'club.authTokens',
  /** The Club QR code link of the club this phone hunts with (holds the club channel key). */
  clubJoinLink: 'club.joinLink',
  /**
   * Web admin only: the Cognito refresh token, in localStorage, so a reload, deep link or
   * invite link keeps the admin signed in (owner decision 2026-11-26). Cleared on sign-out.
   */
  webClubRefreshToken: 'huntclub.club.refreshToken',
} as const;
export type SecureKey = (typeof SECURE_KEYS)[keyof typeof SECURE_KEYS];
