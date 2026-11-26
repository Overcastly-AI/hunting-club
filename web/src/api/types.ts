import type { ChannelSet } from '@huntclub/mesh';
import type {
  Area,
  Club,
  ClubCreateRequest,
  Invite,
  InviteCreate,
  Member,
  Stand,
  Subscription,
} from '@huntclub/shared';

/**
 * What the admin pages need from the club API. Every entity is the shared wire type from
 * @huntclub/shared (never a local copy); the real client (shared, from #29) and the mock
 * both implement this.
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
}
