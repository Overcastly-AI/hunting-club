/**
 * The signed-in club account (app and web admin). Free users never sign in and never
 * call the backend; this only runs when someone joins a club, taps Sign in, or opens
 * the web admin. Each platform supplies where tokens live: the app's keystore
 * (expo-secure-store), the web admin's memory. Never SQLite, browser storage or logs.
 */
import type { AuthTokens, CodeChallenge, CognitoAuth } from './cognito';

export interface TokenStore {
  load(): Promise<AuthTokens | null>;
  save(tokens: AuthTokens): Promise<void>;
  clear(): Promise<void>;
}

/** Tokens held in memory only (the web admin: signing in again after a reload). */
export function memoryTokenStore(initial: AuthTokens | null = null): TokenStore {
  let value = initial;
  return {
    load: async () => value,
    save: async (tokens) => {
      value = tokens;
    },
    clear: async () => {
      value = null;
    },
  };
}

/** Refresh this long before the access token expires. */
const REFRESH_MARGIN_MS = 60_000;

export class ClubSession {
  private tokens: AuthTokens | null | undefined;

  constructor(
    private readonly auth: CognitoAuth,
    private readonly store: TokenStore,
    private readonly now: () => number = Date.now,
  ) {}

  private async current(): Promise<AuthTokens | null> {
    if (this.tokens === undefined) this.tokens = await this.store.load();
    return this.tokens;
  }

  async isSignedIn(): Promise<boolean> {
    return (await this.current()) !== null;
  }

  /** Step 1: email a one-time code (signs new people up). */
  requestCode(email: string): Promise<CodeChallenge> {
    return this.auth.requestCode(email.trim().toLowerCase());
  }

  /** Step 2: the code from the email. */
  async confirmCode(challenge: CodeChallenge, code: string): Promise<void> {
    await this.keep(await this.auth.confirmCode(challenge, code.trim()));
  }

  /** A valid access token (refreshed when close to expiry), or undefined if signed out. */
  async accessToken(): Promise<string | undefined> {
    const tokens = await this.current();
    if (!tokens) return undefined;
    if (tokens.expiresAt - REFRESH_MARGIN_MS > this.now()) return tokens.accessToken;
    return (await this.refresh()) ? this.tokens?.accessToken : undefined;
  }

  /** Refreshes the access token. False if the account must sign in again. */
  async refresh(): Promise<boolean> {
    const tokens = await this.current();
    if (!tokens) return false;
    try {
      await this.keep(await this.auth.refresh(tokens.refreshToken));
      return true;
    } catch (error) {
      // An expired or revoked refresh token means signing in again; a network error doesn't.
      if (error instanceof Error && 'code' in error && error.code === 'code_expired') {
        await this.signOutLocally();
      }
      return false;
    }
  }

  async signOut(): Promise<void> {
    const tokens = await this.current();
    await this.signOutLocally();
    if (tokens) await this.auth.revoke(tokens.refreshToken).catch(() => undefined);
  }

  private async signOutLocally() {
    this.tokens = null;
    await this.store.clear();
  }

  private async keep(tokens: AuthTokens) {
    this.tokens = tokens;
    await this.store.save(tokens);
  }
}
