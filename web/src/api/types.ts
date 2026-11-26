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
 * What the admin pages need from the club API. Every entity is the shared wire type from
 * @huntclub/shared (never a local copy). api/admin.ts implements it over the shared
 * typed client (createClubApiClient).
 */
export interface ClubApi {
  getClub(): Promise<Club | null>;
  createClub(request: ClubCreateRequest): Promise<Club>;
  listMembers(): Promise<readonly Member[]>;
  createInvite(request: InviteCreate): Promise<Invite>;
  /** The club radio channel an invite QR carries (from the club secret). */
  getClubChannelSet(): Promise<ChannelSet>;
  listStands(): Promise<readonly Stand[]>;
  listAreas(): Promise<readonly Area[]>;
  getSubscription(): Promise<Subscription | null>;
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
