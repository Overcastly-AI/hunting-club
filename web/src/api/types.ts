import type { ChannelSet } from '@huntclub/mesh';
import type {
  Area,
  Club,
  ClubCreateRequest,
  Harvest,
  Invite,
  InviteCreate,
  MapPack,
  MapPackRequestResponse,
  Plan,
  Member,
  MemberProfileUpdate,
  Polygon,
  Stand,
  Subscription,
  BasemapId,
  BillingInterval,
} from '@huntclub/shared';

/**
 * The signed-in person runs no club yet (GET /me/clubs lists none they administer), so
 * there is nothing to ask the club API about. Pages show "Create your club first".
 */
export class NoClubError extends Error {
  constructor() {
    super('No club yet');
    this.name = 'NoClubError';
  }
}

/**
 * The club API refused the selected club to this account (403) and the account administers
 * no other club: e.g. it was removed, or another account chose the club on this browser.
 * The choice is already dropped; pages say "You don't have access to this club".
 */
export class NoClubAccessError extends Error {
  constructor() {
    super('No access to this club');
    this.name = 'NoClubAccessError';
  }
}

/**
 * What the admin pages need from the club API. Every entity is the shared wire type from
 * @huntclub/shared (never a local copy). api/admin.ts implements it over the shared
 * typed client (createClubApiClient).
 */
export interface ClubApi {
  getClub(): Promise<Club | null>;
  /** Forgets everything kept for the signed-in account (its selected club). On sign-out. */
  forgetUser(): void;
  createClub(request: ClubCreateRequest): Promise<Club>;
  /** Admins: saves the club's property line (the shared rule checks it first); resolves to the club. */
  savePropertyLine(boundary: Polygon): Promise<Club>;
  listMembers(): Promise<readonly Member[]>;
  /** The signed-in person's own name and initials in the club (any member may change theirs). */
  updateMyProfile(patch: MemberProfileUpdate): Promise<Member>;
  /**
   * The signed-in person's own membership of the club (name, initials), from GET /me/clubs,
   * which the club lookup already loads: no extra call. Null when they have no club.
   */
  getMyMembership(): Promise<Member | null>;
  /** The club's invites, used or not (for Needs you on My club). */
  listInvites(): Promise<readonly Invite[]>;
  createInvite(request: InviteCreate): Promise<Invite>;
  /** The club radio channel an invite QR carries (from the club secret). */
  getClubChannelSet(): Promise<ChannelSet>;
  listStands(): Promise<readonly Stand[]>;
  listAreas(): Promise<readonly Area[]>;
  getSubscription(): Promise<Subscription | null>;
  /** Stripe's customer portal URL for the club's subscription (admins only). */
  openBillingPortal(): Promise<string>;
  /** Harvests in the club the admin may see (theirs, plus everyone's shared ones). */
  listHarvests(): Promise<readonly Harvest[]>;
  /** The club's offline map packs (of its property line). */
  listMapPacks(): Promise<readonly MapPack[]>;
  /** Starts building a pack of the property for one basemap; resolves to the estimate. */
  requestMapPack(basemap: BasemapId): Promise<MapPackRequestResponse>;
  /** Plans on sale (active only). */
  listPlans(): Promise<readonly Plan[]>;
  /** Starts Stripe Checkout (with the free trial) for the club; resolves to the Stripe page to open. */
  startCheckout(planId: string, interval: BillingInterval): Promise<string>;
}
