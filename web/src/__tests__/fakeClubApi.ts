import { defaultRandom } from '@huntclub/mesh';
import {
  type AuthTokens,
  ClubApiRequestError,
  type ClubApiClient,
  ClubCreateRequestSchema,
  type CognitoAuth,
  CognitoAuthError,
  INVITE_TOKEN_BYTES,
  InviteCreateSchema,
  type Area,
  type Club,
  type Member,
  type Plan,
  type Stand,
  type Subscription,
} from '@huntclub/shared';

/** A sample club the fake club API serves (valid shared wire types: see adminApi.test). */
export interface FakeClubData {
  club: Club | null;
  members: Member[];
  stands: Stand[];
  areas: Area[];
  subscription: Subscription | null;
  plans: Plan[];
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

export function sampleData(): FakeClubData {
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
    plans: [
      { id: 'club_standard', name: 'Club', active: true, ...timestamps },
      { id: 'club_legacy', name: 'Old club plan', active: false, ...timestamps },
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
const base64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));

/**
 * The shared ClubApiClient over in-memory data: the pages run the real adapter
 * (api/admin.ts) against it. Inputs go through the shared schemas, as the server's do.
 */
export function fakeClubClient(data: FakeClubData = sampleData()): ClubApiClient {
  const channelKey = base64(defaultRandom(32));
  const admin = () => data.members.find((m) => m.role === 'admin')!;
  const clubOrThrow = () => {
    if (!data.club) throw new ClubApiRequestError('not_found', 404);
    return data.club;
  };
  return {
    listPlans: async () => data.plans,
    listMyClubs: async () => (data.club ? [{ club: data.club, membership: admin() }] : []),
    async createClub(request) {
      const { club, admin: profile } = ClubCreateRequestSchema.parse(request);
      const now = new Date().toISOString();
      data.club = { id: crypto.randomUUID(), ...club, createdAt: now, updatedAt: now };
      data.members = [
        {
          clubId: data.club.id,
          userId: crypto.randomUUID(),
          role: 'admin',
          ...profile,
          createdAt: now,
          updatedAt: now,
        },
      ];
      data.subscription = null;
      return data.club;
    },
    getClub: async () => clubOrThrow(),
    listMembers: async () => data.members,
    async createInvite(clubId, request) {
      const now = new Date().toISOString();
      return {
        id: crypto.randomUUID(),
        clubId,
        token: hex(defaultRandom(INVITE_TOKEN_BYTES)),
        uses: 0,
        ...InviteCreateSchema.parse(request),
        createdAt: now,
        updatedAt: now,
      };
    },
    listStands: async () => data.stands,
    listAreas: async () => data.areas,
    getEntitlement: async (clubId) => ({ clubId, status: 'active' }),
    async getSubscription() {
      if (!data.subscription) throw new ClubApiRequestError('not_found', 404);
      return data.subscription;
    },
    startCheckout: async (clubId, { planId }) => ({
      url: `https://checkout.stripe.com/c/pay/cs_test_${planId}_${clubOrThrow().id === clubId}`,
    }),
    getClubSecret: async (clubId) => ({
      clubId,
      channelKey,
      keyVersion: 1,
      createdAt: clubOrThrow().createdAt,
      updatedAt: clubOrThrow().updatedAt,
    }),
    redeemInvite: async () => {
      throw new ClubApiRequestError('forbidden', 403);
    },
  };
}

/** The code the fake sign-in accepts. */
export const TEST_CODE = '246810';

/** Cognito stand-in: emails "send" instantly and only TEST_CODE signs in. */
export function fakeCognitoAuth(): CognitoAuth {
  const tokens: AuthTokens = {
    accessToken: 'a',
    refreshToken: 'r',
    expiresAt: Date.now() + 3_600_000,
  };
  return {
    requestCode: async (email) => ({ kind: 'signIn', email, session: 's' }),
    async confirmCode(_challenge, code) {
      if (code !== TEST_CODE) throw new CognitoAuthError('wrong_code');
      return tokens;
    },
    refresh: async () => tokens,
    revoke: async () => undefined,
  };
}
