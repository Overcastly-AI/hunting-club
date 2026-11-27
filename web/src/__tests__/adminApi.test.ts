import { NoClubError } from '../api/types';
import { decodeChannelSet, encodeChannelSet } from '@huntclub/mesh';
import {
  AreaSchema,
  ClubApiRequestError,
  ClubSchema,
  ClubSecretResponseSchema,
  InviteSchema,
  MapPackSchema,
  MemberSchema,
  PlanSchema,
  StandSchema,
  SubscriptionSchema,
} from '@huntclub/shared';
import { adminApi } from '../api/admin';
import { fakeClubClient, sampleData } from '../testing/fakeClubApi';

// The fake stands in for the real club API, so its data must be valid shared wire types.
describe('fake club API data', () => {
  it('matches the shared schemas', async () => {
    const data = sampleData();
    expect(() => ClubSchema.parse(data.club)).not.toThrow();
    for (const m of data.members) expect(() => MemberSchema.parse(m)).not.toThrow();
    for (const s of data.stands) expect(() => StandSchema.parse(s)).not.toThrow();
    for (const m of data.mapPacks) expect(() => MapPackSchema.parse(m)).not.toThrow();
    for (const p of data.plans) expect(() => PlanSchema.parse(p)).not.toThrow();
    for (const a of data.areas) expect(() => AreaSchema.parse(a)).not.toThrow();
    expect(() => SubscriptionSchema.parse(data.subscription)).not.toThrow();
    const secret = await fakeClubClient(data).getClubSecret(data.club!.id);
    expect(() => ClubSecretResponseSchema.parse(secret)).not.toThrow();
  });
});

describe('admin API over the shared client', () => {
  it('finds the club the signed-in person administers', async () => {
    const data = sampleData();
    const client = fakeClubClient(data);
    const listMyClubs = vi.spyOn(client, 'listMyClubs');
    const api = adminApi(client);
    expect((await api.getClub())?.id).toBe(data.club!.id);
    expect(await api.listStands()).toHaveLength(3);
    expect(listMyClubs).toHaveBeenCalledTimes(1); // the club id is looked up once
  });

  it('has no club (and no club calls) when the person runs none', async () => {
    const api = adminApi(fakeClubClient({ ...sampleData(), club: null }));
    expect(await api.getClub()).toBeNull();
    await expect(api.listMembers()).rejects.toBeInstanceOf(NoClubError);
  });

  it('creates a club, then works with it', async () => {
    const api = adminApi(fakeClubClient({ ...sampleData(), club: null }));
    const club = await api.createClub({
      club: { name: 'Pine Hollow' },
      admin: { displayName: 'Pat Lane', initials: 'PL' },
    });
    expect(ClubSchema.parse(club)).toMatchObject({ name: 'Pine Hollow', region: 'US' });
    expect((await api.getClub())?.name).toBe('Pine Hollow');
    expect(await api.getSubscription()).toBeNull(); // { subscription: null } until Checkout
  });

  it('makes invites for its club, valid against the shared schema', async () => {
    const data = sampleData();
    const invite = await adminApi(fakeClubClient(data)).createInvite({
      role: 'member',
      expiresAt: '2027-01-01T00:00:00.000Z',
    });
    expect(InviteSchema.parse(invite).clubId).toBe(data.club!.id);
  });

  it('lists the invites of its own club, valid against the shared schema', async () => {
    const data = sampleData();
    const api = adminApi(fakeClubClient(data));
    expect(await api.listInvites()).toEqual([]);
    const made = await api.createInvite({ role: 'guest', expiresAt: '2027-01-01T00:00:00.000Z' });
    const invites = await api.listInvites();
    expect(invites.map((invite) => InviteSchema.parse(invite).id)).toEqual([made.id]);
  });

  it('builds the club radio channel from the club secret key', async () => {
    const data = sampleData();
    const client = fakeClubClient(data);
    const secret = await client.getClubSecret(data.club!.id);
    const channelSet = await adminApi(client).getClubChannelSet();
    const settings = decodeChannelSet(encodeChannelSet(channelSet)).settings[0]!;
    expect(settings.name).toBe('Club');
    expect(btoa(String.fromCharCode(...settings.psk))).toBe(secret.channelKey);
  });

  it('offers only active plans and starts Checkout for its own club', async () => {
    const api = adminApi(fakeClubClient());
    expect((await api.listPlans()).map((p) => p.id)).toEqual(['club_standard']);
    expect(await api.startCheckout('club_standard', 'month')).toBe(
      'https://checkout.stripe.com/c/pay/cs_test_club_standard_month_true',
    );
  });

  it('lists and requests map packs for its own club', async () => {
    const data = sampleData();
    const client = fakeClubClient(data);
    const request = vi.spyOn(client, 'requestMapPack');
    const api = adminApi(client);
    expect(await api.listMapPacks()).toHaveLength(2);
    expect((await api.requestMapPack('aerial')).tiles).toBeGreaterThan(0);
    expect(request).toHaveBeenCalledWith(data.club!.id, { basemap: 'aerial' });
  });

  it('passes other errors through', async () => {
    const client = fakeClubClient();
    vi.spyOn(client, 'getSubscription').mockRejectedValue(
      new ClubApiRequestError('forbidden', 403),
    );
    await expect(adminApi(client).getSubscription()).rejects.toMatchObject({ code: 'forbidden' });
  });
});
