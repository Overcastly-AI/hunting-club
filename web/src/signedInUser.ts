import type { SignedInUser } from '@huntclub/shared';
import { createContext, useContext } from 'react';

/** Who is signed in to the admin (from the session's ID token); undefined if unknown. */
export const SignedInUserContext = createContext<SignedInUser | undefined>(undefined);

export const useSignedInUser = () => useContext(SignedInUserContext);
