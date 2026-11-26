import type { MemberRole, StandType, SubscriptionStatus } from '@huntclub/shared';

// View models for the admin pages. The real club API (after #17) will return these;
// enum-like fields use the shared domain types, never local string unions.

export interface Club {
  readonly id: string;
  readonly name: string;
  readonly acreage: number | null;
}

export interface Member {
  readonly id: string;
  readonly displayName: string;
  readonly initials: string;
  readonly role: MemberRole;
  /** ISO date; guests only. */
  readonly expiresAt: string | null;
}

export interface Stand {
  readonly id: string;
  readonly name: string;
  readonly type: StandType;
  readonly areaName: string | null;
  readonly active: boolean;
}

export interface Area {
  readonly id: string;
  readonly name: string;
  readonly standCount: number;
}

export interface Billing {
  readonly planName: string;
  readonly status: SubscriptionStatus;
  /** ISO date. */
  readonly paidThrough: string | null;
}

export interface Invite {
  /** The https join link a QR code carries (built with @huntclub/mesh encodeJoinUrl). */
  readonly joinUrl: string;
  /** ISO date. */
  readonly expiresAt: string;
}

/** What the admin pages need from the club API. */
export interface ClubApi {
  getClub(): Promise<Club | null>;
  createClub(name: string): Promise<Club>;
  listMembers(): Promise<readonly Member[]>;
  createInvite(): Promise<Invite>;
  listStands(): Promise<readonly Stand[]>;
  listAreas(): Promise<readonly Area[]>;
  getBilling(): Promise<Billing | null>;
}
