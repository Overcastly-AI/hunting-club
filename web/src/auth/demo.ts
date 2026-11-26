import { AuthError, type AuthClient } from './types';

/** The code the demo client accepts (shown on the page in demo mode). */
export const DEMO_CODE = '123456';

/**
 * Sign-in without a user pool client: used until the web app client exists, and in
 * tests. It never talks to the network.
 */
export function demoAuthClient(): AuthClient {
  return {
    live: false,
    async requestCode(email) {
      if (!email.includes('@')) throw new AuthError('unknown_user');
      return { email, session: 'demo' };
    },
    async verifyCode(challenge, code) {
      if (code !== DEMO_CODE) throw new AuthError('wrong_code');
      return { email: challenge.email, accessToken: 'demo-token' };
    },
  };
}
