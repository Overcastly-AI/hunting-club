import { encodeJoinUrl, generatePartyChannelSet } from '@huntclub/mesh';
import { seededRandom } from '@huntclub/mesh/testing';
import {
  ClubApiRequestError,
  type ClubApiClient,
  type Member,
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

/** An in-memory club API with one club ("Oak Ridge"); every method is a jest mock. */
export function fakeClubApi(options: { featuresUntil?: string; offline?: boolean } = {}) {
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
    listMembers: offline(() => [member]),
    listStands: offline(() => [stand(1, 'Creek Stand'), stand(2, 'Ridge Ladder')]),
    listAreas: offline(() => []),
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
    getClubSecret: offline(() => {
      throw new ClubApiRequestError('forbidden', 403);
    }),
    listMapPacks: offline(() => []),
    requestMapPack: offline(() => {
      throw new ClubApiRequestError('forbidden', 403);
    }),
    redeemInvite: jest.fn(async (req: { token: string; displayName: string; initials: string }) => {
      if (options.offline) throw new ClubApiRequestError('network', 0);
      joined = true;
      return { ...member, displayName: req.displayName, initials: req.initials };
    }),
  } satisfies ClubApiClient;
  return api;
}

/** A session stub: signed in or not, no network. */
export function fakeSession(signedIn: boolean): ClubSession {
  return {
    isSignedIn: async () => signedIn,
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
