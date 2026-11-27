import type { ClubSession, SignedInUser } from '@huntclub/shared';
import type { ClubApi } from './api/types';
import { createContext, useContext } from 'react';

/** Who is signed in to the admin (from the session's ID token); undefined if unknown. */
export const SignedInUserContext = createContext<SignedInUser | undefined>(undefined);

export const useSignedInUser = () => useContext(SignedInUserContext);

/**
 * Signs out and forgets everything kept for that account (its refresh token, its selected
 * club): the one place sign-out clears per-account state, so the next account to sign in on
 * this browser inherits nothing.
 */
export function signOutAndForget(session: ClubSession, api: ClubApi | undefined): Promise<void> {
  api?.forgetUser();
  return session.signOut();
}
