import { defaultRandom, generatePartyChannelSet, type ChannelSet } from '@huntclub/mesh';
import {
  ClubCreateSchema,
  INVITE_TOKEN_BYTES,
  InviteCreateSchema,
  type Area,
  type Club,
  type Member,
  type Stand,
  type Subscription,
} from '@huntclub/shared';
import type { ClubApi } from './types';

/** Sample club for the skeleton pages until the real client is wired in. */
export interface MockData {
  club: Club | null;
  members: Member[];
  stands: Stand[];
  areas: Area[];
  subscription: Subscription | null;
}

const CLUB = '0b9c4b6e-6a43-4c55-9a1e-2f6a8f0c1a01';
const AREA_NORTH = '1f0c5c1a-2f4b-4b7e-8d2a-7c1e0a5b9d02';
const AREA_CREEK = '2a7d9e3b-5c6f-4e1a-9b8c-0d2e4f6a8b03';
const T = '2026-11-01T12:00:00.000Z';
const timestamps = { createdAt: T, updatedAt: T };
const square = {
  type: 'Polygon' as const,
  coordinates: [
    [
      [-90, 40],
      [-90, 40.01],
      [-89.99, 40.01],
      [-90, 40],
    ],
  ],
};

export function sampleData(): MockData {
  const member = (n: number, displayName: string, initials: string, role: Member['role']) => ({
    clubId: CLUB,
    userId: `3c8e1f2a-4b5d-4e6f-8a9b-0c1d2e3f4a${String(n).padStart(2, '0')}`,
    displayName,
    initials,
    role,
    ...timestamps,
  });
  const stand = (n: number, name: string, type: Stand['type'], areaId: string, active = true) => ({
    id: `4d9f2a3b-5c6e-4f7a-9b0c-1d2e3f4a5b${String(n).padStart(2, '0')}`,
    clubId: CLUB,
    meshId: n,
    name,
    type,
    areaId,
    lat: 40.005,
    lon: -89.995,
    active,
    ...timestamps,
  });
  return {
    club: {
      id: CLUB,
      name: 'Oak Ridge Hunt Club',
      acreage: 640,
      region: 'US',
      overdueGraceMinutes: 30,
      ...timestamps,
    },
    members: [
      member(1, 'Dale Morgan', 'DM', 'admin'),
      member(2, 'Ruth Keller', 'RK', 'member'),
      { ...member(3, 'Sam Ortiz', 'SO', 'guest'), expiresAt: '2026-12-31T00:00:00.000Z' },
    ],
    areas: [
      {
        id: AREA_NORTH,
        clubId: CLUB,
        meshId: 1,
        name: 'North 40',
        boundary: square,
        active: true,
        ...timestamps,
      },
      {
        id: AREA_CREEK,
        clubId: CLUB,
        meshId: 2,
        name: 'Creek Bottom',
        boundary: square,
        active: true,
        ...timestamps,
      },
    ],
    stands: [
      stand(1, 'Creek Stand', 'tree_stand', AREA_CREEK),
      stand(2, 'Big Oak Ladder', 'ladder', AREA_NORTH),
      stand(3, 'Field Blind', 'ground_blind', AREA_NORTH, false),
    ],
    subscription: {
      clubId: CLUB,
      stripeCustomerId: 'cus_sample',
      stripeSubscriptionId: 'sub_sample',
      planId: 'club_standard',
      status: 'active',
      paidThrough: '2027-08-01T00:00:00.000Z',
      ...timestamps,
    },
  };
}

const hex = (bytes: Uint8Array) =>
  Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');

/** An in-memory ClubApi over sample (or test-supplied) data; inputs go through the shared schemas. */
export function mockClubApi(data: MockData = sampleData()): ClubApi {
  let channelSet: ChannelSet | undefined;
  return {
    async getClub() {
      return data.club;
    },
    async createClub(request) {
      const now = new Date().toISOString();
      data.club = {
        id: crypto.randomUUID(),
        ...ClubCreateSchema.parse(request.club),
        createdAt: now,
        updatedAt: now,
      };
      data.subscription = null;
      return data.club;
    },
    async listMembers() {
      return data.members;
    },
    async createInvite(request) {
      if (!data.club) throw new Error('No club');
      const now = new Date();
      const grant = InviteCreateSchema.parse(request);
      return {
        id: crypto.randomUUID(),
        clubId: data.club.id,
        token: hex(defaultRandom(INVITE_TOKEN_BYTES)),
        uses: 0,
        ...grant,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      };
    },
    async getClubChannelSet() {
      // The real club key comes from the club secret; the mock makes one per session.
      channelSet ??= generatePartyChannelSet({ random: defaultRandom, name: 'Club' });
      return channelSet;
    },
    async listStands() {
      return data.stands;
    },
    async listAreas() {
      return data.areas;
    },
    async getSubscription() {
      return data.subscription;
    },
  };
}
