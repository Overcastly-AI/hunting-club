// Club API route paths: one definition for the Lambda router (packages/api) and the
// clients (app, web admin). `:name` segments are UUID parameters.

export const API_PATHS = {
  plans: '/plans',
  myClubs: '/me/clubs',
  clubs: '/clubs',
  club: '/clubs/:clubId',
  members: '/clubs/:clubId/members',
  member: '/clubs/:clubId/members/:userId',
  memberAccess: '/clubs/:clubId/members/:userId/access',
  invites: '/clubs/:clubId/invites',
  invite: '/clubs/:clubId/invites/:inviteId',
  redeemInvite: '/invites/redeem',
  stands: '/clubs/:clubId/stands',
  stand: '/clubs/:clubId/stands/:id',
  areas: '/clubs/:clubId/areas',
  area: '/clubs/:clubId/areas/:id',
  harvests: '/clubs/:clubId/harvests',
  harvest: '/clubs/:clubId/harvests/:id',
  mapPacks: '/clubs/:clubId/map-packs',
  secret: '/clubs/:clubId/secret',
  subscription: '/clubs/:clubId/subscription',
  entitlement: '/clubs/:clubId/entitlement',
  checkout: '/clubs/:clubId/checkout',
  billingPortal: '/clubs/:clubId/billing-portal',
} as const;

export type ApiPath = (typeof API_PATHS)[keyof typeof API_PATHS];

/** Fills `:param` segments (URI-encoded). Throws if one is missing. */
export function apiPath(template: ApiPath, params: Record<string, string> = {}): string {
  return template.replace(/:(\w+)/g, (_, name: string) => {
    const value = params[name];
    if (value === undefined) throw new Error(`missing path parameter ${name}`);
    return encodeURIComponent(value);
  });
}
