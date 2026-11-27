import {
  chooseClub,
  ClubApiRequestError,
  isNoClubAccess,
  type ClubApiClient,
  type ClubChoice,
  type ClubSession,
  type Member,
  type MyClub,
} from '@huntclub/shared';
import { NoClubAccessError, NoClubError, type ClubApi } from './types';

const administers = (m: MyClub) => m.membership.role === 'admin';

/**
 * The admin pages' view of the shared club API client: "my club" is the first club the
 * signed-in person administers (from GET /me/clubs), and every call is about that club.
 * The choice is keyed to the signed-in account (the session's Cognito sub), so after a
 * sign-out another account never inherits it; forgetUser() drops it on sign-out. A 403 on
 * the club drops the choice and falls back to the account's own clubs (NoClubAccessError
 * when it has none).
 */
export function adminApi(client: ClubApiClient, session?: Pick<ClubSession, 'user'>): ClubApi {
  const currentUser = async () => (await session?.user())?.userId;
  let choice: ClubChoice | null = null;
  let lookup: { userId: string | undefined; clubId: Promise<string | null> } | undefined;
  // The signed-in person's membership per club, as GET /me/clubs (or their own update) gave it.
  const memberships = new Map<string, Member>();
  const rememberMine = (mine: readonly MyClub[]) => {
    for (const m of mine) memberships.set(m.club.id, m.membership);
  };
  const forget = () => {
    choice = null;
    lookup = undefined;
    memberships.clear();
  };
  const myClubId = async (): Promise<string | null> => {
    const userId = await currentUser();
    if (!lookup || lookup.userId !== userId) {
      const stored = choice;
      const clubId: Promise<string | null> = client.listMyClubs().then(
        (mine) => {
          rememberMine(mine);
          choice = chooseClub(mine, userId, stored, administers);
          return choice?.clubId ?? null;
        },
        (error: unknown) => {
          if (lookup?.clubId === clubId) lookup = undefined; // try again next time (e.g. back online)
          throw error;
        },
      );
      lookup = { userId, clubId };
    }
    return lookup.clubId;
  };
  /**
   * Runs `call` on the chosen club. On a 403 the choice is dropped; a read (`retry`) then runs
   * again on the account's own club, if it has one. A change never moves to another club.
   */
  const onClub = async <T>(
    id: string,
    call: (clubId: string) => Promise<T>,
    retry = true,
  ): Promise<T> => {
    try {
      return await call(id);
    } catch (error) {
      if (!isNoClubAccess(error)) throw error;
      forget();
      const next = retry ? await myClubId() : null;
      if (!next || next === id) {
        forget();
        throw new NoClubAccessError();
      }
      return call(next);
    }
  };
  const withClub = async <T>(call: (clubId: string) => Promise<T>, retry = true): Promise<T> => {
    const id = await myClubId();
    if (!id) throw new NoClubError();
    return onClub(id, call, retry);
  };
  /** A change (property line, stand, area, invite, map pack, Checkout, billing portal): never retried on another club. */
  const changeClub = <T>(call: (clubId: string) => Promise<T>) => withClub(call, false);

  return {
    async getClub() {
      const id = await myClubId();
      return id ? onClub(id, (clubId) => client.getClub(clubId)) : null;
    },
    async createClub(request) {
      const club = await client.createClub(request);
      const userId = await currentUser();
      choice = { userId, clubId: club.id };
      lookup = { userId, clubId: Promise.resolve(club.id) };
      return club;
    },
    forgetUser: forget,
    savePropertyLine: (boundary) => changeClub((id) => client.updateClub(id, { boundary })),
    listMembers: () => withClub((id) => client.listMembers(id)),
    async updateMyProfile(patch) {
      const userId = await currentUser();
      // Only reachable signed in; without a session there is no one to rename.
      if (!userId) throw new ClubApiRequestError('forbidden', 403);
      const member = await changeClub((id) => client.updateMemberProfile(id, userId, patch));
      memberships.set(member.clubId, member);
      return member;
    },
    async getMyMembership() {
      const id = await myClubId();
      if (!id) return null;
      // Known from the club lookup, except just after createClub: then one fresh lookup.
      if (!memberships.has(id)) rememberMine(await client.listMyClubs());
      return memberships.get(id) ?? null;
    },
    createInvite: (request) => changeClub((id) => client.createInvite(id, request)),
    async getClubChannelSet() {
      // The key never leaves this function except inside the invite link; never log it.
      const [secret, { base64UrlDecode, CLUB_CHANNEL_NAME, channelSetWithKey }] = await Promise.all(
        [
          withClub((id) => client.getClubSecret(id)),
          import('@huntclub/mesh'), // the protobuf codec loads only when an invite is made
        ],
      );
      return channelSetWithKey(base64UrlDecode(secret.channelKey), { name: CLUB_CHANNEL_NAME });
    },
    listInvites: () => withClub((id) => client.listInvites(id)),
    listStands: () => withClub((id) => client.listStands(id)),
    listAreas: () => withClub((id) => client.listAreas(id)),
    createStand: (stand) => changeClub((id) => client.createStand(id, stand)),
    updateStand: (standId, patch) => changeClub((id) => client.updateStand(id, standId, patch)),
    deleteStand: (standId) => changeClub((id) => client.deleteStand(id, standId)),
    createArea: (area) => changeClub((id) => client.createArea(id, area)),
    updateArea: (areaId, patch) => changeClub((id) => client.updateArea(id, areaId, patch)),
    deleteArea: (areaId) => changeClub((id) => client.deleteArea(id, areaId)),
    listHarvests: () => withClub((id) => client.listHarvests(id)),
    listMapPacks: () => withClub((id) => client.listMapPacks(id)),
    requestMapPack: (basemap) => changeClub((id) => client.requestMapPack(id, { basemap })),
    listPlans: async () => (await client.listPlans()).filter((plan) => plan.active),
    startCheckout: async (planId, interval) =>
      (await changeClub((id) => client.startCheckout(id, { planId, interval }))).url,
    getSubscription: async () => (await withClub((id) => client.getSubscription(id))).subscription,
    openBillingPortal: async () => (await changeClub((id) => client.openBillingPortal(id))).url,
  };
}
