import { defaultRandom } from '@huntclub/mesh';
import {
  type AuthTokens,
  ClubApiRequestError,
  type ClubApiClient,
  CheckoutRequestSchema,
  ClubCreateRequestSchema,
  type CodeChallenge,
  type CognitoAuth,
  CognitoAuthError,
  emailCodeRules,
  INVITE_TOKEN_BYTES,
  BASEMAPS,
  MapPackRequestSchema,
  estimateClubPack,
  mapPackKey,
  InviteCreateSchema,
  type Area,
  type Club,
  type Harvest,
  type MapPack,
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
  harvests: Harvest[];
  mapPacks: MapPack[];
  /** False until the owner sets up Stripe prices: Checkout answers 503 not_configured. */
  paymentsConfigured?: boolean;
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

const userId = (n: number) => `3c8e1f2a-4b5d-4e6f-8a9b-0c1d2e3f4a${String(n).padStart(2, '0')}`;
const STAND_OAK = '4d9f2a3b-5c6e-4f7a-9b0c-1d2e3f4a5b02';

function harvest(
  n: number,
  member: number,
  species: string,
  sex: Harvest['sex'],
  harvestedAt: string,
  standId?: string,
): Harvest {
  return {
    id: `6a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c${String(n).padStart(2, '0')}`,
    clubId: CLUB,
    userId: userId(member),
    species,
    sex,
    shared: true,
    harvestedAt,
    ...(standId ? { standId, areaId: AREA_NORTH } : {}),
    ...(n === 1 ? { notes: '=8 point, "big" one' } : {}),
    ...timestamps,
  };
}

function packFields(n: number, source: string) {
  const id = `5e0a3b4c-6d7e-4f8a-9b0c-1d2e3f4a5b${String(n).padStart(2, '0')}`;
  return {
    id,
    clubId: CLUB,
    bounds: [-90, 40, -89.99, 40.01] as [number, number, number, number],
    minZoom: 8,
    maxZoom: 15,
    source,
    s3Key: mapPackKey(CLUB, id),
    createdAt: `2026-11-${10 + n}T12:00:00.000Z`,
    updatedAt: `2026-11-${10 + n}T12:30:00.000Z`,
  };
}

export function sampleData(): FakeClubData {
  const member = (n: number, displayName: string, initials: string, role: Member['role']) => ({
    clubId: CLUB,
    userId: userId(n),
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
      boundary: square,
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
    harvests: [
      harvest(1, 1, 'Deer', 'male', '2026-11-15T17:30:00.000Z', STAND_OAK),
      harvest(2, 2, 'Deer', 'female', '2026-11-16T13:00:00.000Z'),
      harvest(3, 2, 'deer ', 'female', '2026-11-24T22:10:00.000Z'),
      harvest(4, 3, 'Turkey', 'male', '2026-10-03T12:00:00.000Z'),
      // Not shared with the club: never in a report.
      { ...harvest(5, 1, 'Deer', 'male', '2026-11-20T12:00:00.000Z'), shared: false },
      // Out of the 2026 season.
      harvest(6, 1, 'Hog', 'unknown', '2026-03-01T12:00:00.000Z'),
      // A member who has since left the club.
      harvest(7, 9, 'Deer', 'male', '2026-12-01T15:00:00.000Z'),
    ],
    mapPacks: [
      {
        ...packFields(1, 'usgs-topo'),
        status: 'ready',
        sizeBytes: 12 * 1024 * 1024,
        builtAt: '2026-11-20T12:00:00.000Z',
      },
      {
        ...packFields(2, 'usgs-imagery'),
        status: 'failed',
        reason: 'USGS did not answer',
      },
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
    listMapPacks: async () => data.mapPacks,
    async requestMapPack(_clubId, request) {
      const { basemap } = MapPackRequestSchema.parse(request);
      // The club service's own checks: a property line, the size cap, one build at a time.
      const { boundary } = clubOrThrow();
      if (!boundary) throw new ClubApiRequestError('invalid', 400, 'draw the property line first');
      const estimate = estimateClubPack(boundary, { basemap });
      if (estimate.overLimit) throw new ClubApiRequestError('invalid', 400, 'too big');
      if (data.mapPacks.some((p) => p.status === 'building')) {
        throw new ClubApiRequestError('conflict', 409);
      }
      const n = data.mapPacks.length + 1;
      data.mapPacks.push({
        ...packFields(n, BASEMAPS[basemap].source),
        status: 'building',
        expiresAt: '2026-11-26T13:00:00.000Z',
      });
      return { packId: packFields(n, '').id, tiles: estimate.tiles, bytes: estimate.bytes };
    },
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
    listHarvests: async () => data.harvests,
    getEntitlement: async (clubId) => ({ clubId, status: 'active' }),
    getSubscription: async () => ({ subscription: data.subscription ?? null }),
    async startCheckout(clubId, request) {
      const { planId, interval } = CheckoutRequestSchema.parse(request);
      if (data.paymentsConfigured === false) {
        throw new ClubApiRequestError('not_configured', 503);
      }
      return {
        url: `https://checkout.stripe.com/c/pay/cs_test_${planId}_${interval}_${clubOrThrow().id === clubId}`,
      };
    },
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

/** The code the fake sign-in accepts for a challenge kind (its length follows emailCodeRules). */
export const testCode = (kind: CodeChallenge['kind'] = 'signIn') =>
  '2468135790'.slice(0, emailCodeRules(kind).length);

/** Cognito stand-in: emails "send" instantly and only testCode(kind) signs in. */
export function fakeCognitoAuth(kind: CodeChallenge['kind'] = 'signIn'): CognitoAuth {
  const tokens: AuthTokens = {
    accessToken: 'a',
    refreshToken: 'r',
    expiresAt: Date.now() + 3_600_000,
  };
  return {
    requestCode: async (email) =>
      kind === 'signIn' ? { kind, email, session: 's' } : { kind, email },
    async confirmCode(challenge, code) {
      if (code !== testCode(challenge.kind)) throw new CognitoAuthError('wrong_code');
      return tokens;
    },
    refresh: async () => tokens,
    revoke: async () => undefined,
  };
}
