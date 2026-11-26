import { base64UrlDecode, CLUB_CHANNEL_NAME, channelSetWithKey } from '@huntclub/mesh';
import { ClubApiRequestError, type ClubApiClient } from '@huntclub/shared';
import type { ClubApi } from './types';

/**
 * The admin pages' view of the shared club API client: "my club" is the first club the
 * signed-in person administers (from GET /me/clubs), and every call is about that club.
 */
export function adminApi(client: ClubApiClient): ClubApi {
  let clubId: Promise<string | null> | undefined;
  const myClubId = () =>
    (clubId ??= client.listMyClubs().then(
      (clubs) => clubs.find((c) => c.membership.role === 'admin')?.club.id ?? null,
      (error: unknown) => {
        clubId = undefined; // try again next time (e.g. back online)
        throw error;
      },
    ));
  const requireClub = async () => {
    const id = await myClubId();
    if (!id) throw new Error('You do not run a club yet.');
    return id;
  };

  return {
    async getClub() {
      const id = await myClubId();
      return id ? client.getClub(id) : null;
    },
    async createClub(request) {
      const club = await client.createClub(request);
      clubId = Promise.resolve(club.id);
      return club;
    },
    listMembers: async () => client.listMembers(await requireClub()),
    createInvite: async (request) => client.createInvite(await requireClub(), request),
    async getClubChannelSet() {
      // The key never leaves this function except inside the invite link; never log it.
      const secret = await client.getClubSecret(await requireClub());
      return channelSetWithKey(base64UrlDecode(secret.channelKey), { name: CLUB_CHANNEL_NAME });
    },
    listStands: async () => client.listStands(await requireClub()),
    listAreas: async () => client.listAreas(await requireClub()),
    listPlans: async () => (await client.listPlans()).filter((plan) => plan.active),
    startCheckout: async (planId) =>
      (await client.startCheckout(await requireClub(), { planId })).url,
    async getSubscription() {
      try {
        return await client.getSubscription(await requireClub());
      } catch (error) {
        if (error instanceof ClubApiRequestError && error.code === 'not_found') return null;
        throw error;
      }
    },
  };
}
