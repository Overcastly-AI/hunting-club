/**
 * @huntclub/club-data: the club cloud data layer behind the Lambda API.
 *
 * `createClubData(options)` returns every operation bound to one table. Each
 * operation takes the calling `Actor` first and enforces the rules in authz.ts.
 */
import { type ClubDataOptions, createCtx, type Ctx } from './db';
import * as billing from './repository/billing';
import * as clubs from './repository/clubs';
import * as harvests from './repository/harvests';
import * as invites from './repository/invites';
import * as mapPacks from './repository/mapPacks';
import * as members from './repository/members';
import * as places from './repository/places';

const AREAS = places.placeOperations('area');
const STANDS = places.placeOperations('stand');

const OPERATIONS = {
  createClub: clubs.createClub,
  getClub: clubs.getClub,
  listMyClubs: clubs.listMyClubs,
  updateClub: clubs.updateClub,
  deleteClub: clubs.deleteClub,
  getClubSecret: clubs.getClubSecret,
  setClubSecret: clubs.setClubSecret,

  listMembers: members.listMembers,
  addMember: members.addMember,
  updateMemberProfile: members.updateMemberProfile,
  setMemberAccess: members.setMemberAccess,
  removeMember: members.removeMember,

  createInvite: invites.createInvite,
  listInvites: invites.listInvites,
  deleteInvite: invites.deleteInvite,
  redeemInvite: invites.redeemInvite,

  createArea: AREAS.create,
  listAreas: AREAS.list,
  updateArea: AREAS.update,
  deleteArea: AREAS.delete,

  createStand: STANDS.create,
  listStands: STANDS.list,
  updateStand: STANDS.update,
  deleteStand: STANDS.delete,

  createHarvest: harvests.createHarvest,
  listHarvests: harvests.listHarvests,
  updateHarvest: harvests.updateHarvest,
  deleteHarvest: harvests.deleteHarvest,

  createMapPack: mapPacks.createMapPack,
  listMapPacks: mapPacks.listMapPacks,
  deleteMapPack: mapPacks.deleteMapPack,

  listPlans: billing.listPlans,
  putPlan: billing.putPlan,
  getSubscription: billing.getSubscription,
  getBillableClub: billing.getBillableClub,
  applyStripeEvent: billing.applyStripeEvent,
  getStripeEvent: billing.getStripeEvent,

  seedPlans: billing.seedPlans,
};

type Operations = typeof OPERATIONS;
type Bound<F> = F extends (ctx: Ctx, ...args: infer A) => infer R ? (...args: A) => R : never;
export type ClubData = { [K in keyof Operations]: Bound<Operations[K]> };

export function createClubData(options: ClubDataOptions): ClubData {
  const ctx = createCtx(options);
  return Object.fromEntries(
    Object.entries(OPERATIONS).map(([name, op]) => [
      name,
      (...args: unknown[]) => (op as (ctx: Ctx, ...a: unknown[]) => unknown)(ctx, ...args),
    ]),
  ) as ClubData;
}

export { ANONYMOUS, SERVICE, userActor, type Actor } from './actor';
export { POLICIES, can, isActiveMembership, type Access, type Policy } from './authz';
export { DOCUMENT_CLIENT_OPTIONS, type ClubDataOptions } from './db';
export { ClubDataError, isClubDataError } from './errors';
export * from './table';
export { PLACEHOLDER_PLANS } from './plans';
export { ClubProvisionSchema, type ClubProvision } from './repository/clubs';
export type { ApplyStripeEventResult } from './repository/billing';
export type { Place } from './repository/places';
export { createTableInput } from './localTable';
