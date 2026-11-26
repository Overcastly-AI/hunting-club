/**
 * Who is calling. The Lambda API builds this from the verified Cognito token
 * (`user`), or uses `SERVICE` inside trusted Lambdas (Stripe webhook, provisioning,
 * map packs). It replaces Postgres roles: `user` ~ authenticated, `SERVICE` ~
 * service_role (bypasses the club rules), `ANONYMOUS` ~ anon.
 */
export type Actor =
  | { readonly kind: 'user'; readonly userId: string }
  | { readonly kind: 'service' }
  | { readonly kind: 'anonymous' };

export const SERVICE: Actor = Object.freeze({ kind: 'service' });
export const ANONYMOUS: Actor = Object.freeze({ kind: 'anonymous' });
export const userActor = (userId: string): Actor => Object.freeze({ kind: 'user', userId });
