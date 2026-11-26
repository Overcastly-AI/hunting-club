import type { ChannelSet } from '@huntclub/mesh';
import type {
  Area,
  Club,
  ClubCreateRequest,
  Invite,
  InviteCreate,
  Plan,
  Member,
  Stand,
  Subscription,
} from '@huntclub/shared';

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
  /** Plans on sale (active only). */
  listPlans(): Promise<readonly Plan[]>;
  /** Starts Stripe Checkout for the club; resolves to the Stripe page to open. */
  startCheckout(planId: string): Promise<string>;
}
