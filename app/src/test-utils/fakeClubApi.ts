import { encodeJoinUrl, generatePartyChannelSet } from '@huntclub/mesh';
import { seededRandom } from '@huntclub/mesh/testing';
import {
  BASEMAPS,
  ClubApiRequestError,
  type ClubApiClient,
  type MapPack,
  mapPackKey,
  type Member,
  type MemberProfileUpdate,
  MemberProfileUpdateSchema,
  type Stand,
  type ClubSession,
} from '@huntclub/shared';

import type { SecureStorage } from '../storage/secure';

export const CLUB_ID = '00000000-0000-4000-8000-00000000c1ab';
export const USER_ID = '00000000-0000-4000-8000-0000000000aa';
export const INVITE_TOKEN = 'ab'.repeat(32);
const ISO = '2026-11-26T00:00:00.000Z';

/** A Club QR code link as the admin's app builds it (the mesh package's one builder). */
export function clubJoinUrl(clubId = CLUB_ID, inviteToken = INVITE_TOKEN): string {
  return encodeJoinUrl({
    channelSet: generatePartyChannelSet({ random: seededRandom(7), name: 'Club' }),
    target: { kind: 'club', clubId, inviteToken },
  });
}

export const partyJoinUrl = () =>
  encodeJoinUrl({
    channelSet: generatePartyChannelSet({ random: seededRandom(8) }),
    target: { kind: 'party', partyId: 'p1' },
  });

export function stand(meshId: number, name: string): Stand {
  return {
    id: `00000000-0000-4000-8000-${String(meshId).padStart(12, '0')}`,
    clubId: CLUB_ID,
    meshId,
    name,
    type: 'ladder',
    lat: 40,
    lon: -90,
    active: true,
    createdAt: ISO,
    updatedAt: ISO,
  };
}

/** A club map pack as the API lists it: ready unless `over` says otherwise. */
export function mapPack(id: string, over: Partial<MapPack> = {}): MapPack {
  return {
    id,
    clubId: CLUB_ID,
    bounds: [-94.1, 45.9, -93.9, 46.1],
    minZoom: 10,
    maxZoom: 16,
    source: BASEMAPS.topo.source,
    s3Key: mapPackKey(CLUB_ID, id),
    status: 'ready',
    sizeBytes: 48_000_000,
    builtAt: '2026-11-20T08:00:00.000Z',
    createdAt: ISO,
    updatedAt: ISO,
    ...over,
  } as MapPack;
}

/** An in-memory club API with one club ("Oak Ridge"); every method is a jest mock. */
export function fakeClubApi(
  options: { featuresUntil?: string; offline?: boolean; mapPacks?: () => MapPack[] } = {},
) {
  const member: Member = {
    clubId: CLUB_ID,
    userId: USER_ID,
    displayName: 'Max',
    initials: 'MX',
    role: 'member',
    createdAt: ISO,
    updatedAt: ISO,
  };
  let joined = false;
  const offline = <T>(value: () => T) =>
    jest.fn(async () => {
      if (options.offline) throw new ClubApiRequestError('network', 0);
      return value();
    });
  const club = {
    id: CLUB_ID,
    name: 'Oak Ridge',
    region: 'US',
    overdueGraceMinutes: 30,
    createdAt: ISO,
    updatedAt: ISO,
  };
  const api = {
    listPlans: offline(() => []),
    listMyClubs: offline(() => (joined ? [{ club, membership: member }] : [])),
    createClub: offline(() => {
      throw new ClubApiRequestError('forbidden', 403);
    }),
    getClub: offline(() => club),
    updateClub: offline(() => {
      throw new ClubApiRequestError('forbidden', 403);
    }),
    listMembers: offline(() => [member]),
    listStands: offline(() => [stand(1, 'Creek Stand'), stand(2, 'Ridge Ladder')]),
    listAreas: offline(() => []),
    // The app reads stands and areas; only the web admin edits them.
    createStand: offline(() => {
      throw new ClubApiRequestError('forbidden', 403);
    }),
    updateStand: offline(() => {
      throw new ClubApiRequestError('forbidden', 403);
    }),
    deleteStand: offline(() => {
      throw new ClubApiRequestError('forbidden', 403);
    }),
    createArea: offline(() => {
      throw new ClubApiRequestError('forbidden', 403);
    }),
    updateArea: offline(() => {
      throw new ClubApiRequestError('forbidden', 403);
    }),
    deleteArea: offline(() => {
      throw new ClubApiRequestError('forbidden', 403);
    }),
    listHarvests: offline(() => []),
    listInvites: offline(() => []),
    createInvite: offline(() => {
      throw new ClubApiRequestError('forbidden', 403);
    }),
    getEntitlement: offline(() => ({
      clubId: CLUB_ID,
      status: 'active' as const,
      ...(options.featuresUntil ? { featuresUntil: options.featuresUntil } : {}),
    })),
    getSubscription: offline(() => {
      throw new ClubApiRequestError('forbidden', 403);
    }),
    startCheckout: offline(() => {
      throw new ClubApiRequestError('forbidden', 403);
    }),
    openBillingPortal: offline(() => {
      throw new ClubApiRequestError('forbidden', 403);
    }),
    getClubSecret: offline(() => {
      throw new ClubApiRequestError('forbidden', 403);
    }),
    listMapPacks: offline(() => options.mapPacks?.() ?? []),
    requestMapPack: offline(() => {
      throw new ClubApiRequestError('forbidden', 403);
    }),
    updateMemberProfile: jest.fn(
      async (_clubId: string, _userId: string, patch: MemberProfileUpdate) => {
        if (options.offline) throw new ClubApiRequestError('network', 0);
        Object.assign(member, MemberProfileUpdateSchema.parse(patch));
        return member;
      },
    ),
    redeemInvite: jest.fn(async (req: { token: string; displayName: string; initials: string }) => {
      if (options.offline) throw new ClubApiRequestError('network', 0);
      joined = true;
      return { ...member, displayName: req.displayName, initials: req.initials };
    }),
  } satisfies ClubApiClient;
  return api;
}

/** A session stub: signed in (as `userId`, USER_ID by default) or not, no network. */
export function fakeSession(signedIn: boolean, userId: string = USER_ID): ClubSession {
  return {
    isSignedIn: async () => signedIn,
    user: async () => (signedIn ? { userId } : undefined),
    accessToken: async () => (signedIn ? 'token' : undefined),
    refresh: async () => signedIn,
    requestCode: jest.fn(),
    confirmCode: jest.fn(),
    signOut: jest.fn(async () => undefined),
  } as unknown as ClubSession;
}

/** An in-memory stand-in for the app's secure storage (keystore). */
export function memorySecureStorage(): SecureStorage & { items: Map<string, string> } {
  const items = new Map<string, string>();
  return {
    items,
    get: async (key) => items.get(key) ?? null,
    set: async (key, value) => void items.set(key, value),
    delete: async (key) => void items.delete(key),
  };
}
