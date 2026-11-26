// Test helpers shared by the app, web and package tests. Not for production code.
import type { SignedInUser } from './cognito';

/** An unsigned JWT carrying `sub` and `email`, as Cognito's ID token does. */
export function fakeIdToken(user: SignedInUser): string {
  const part = (value: object) =>
    btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${part({ alg: 'none' })}.${part({ sub: user.userId, ...(user.email ? { email: user.email } : {}) })}.`;
}
