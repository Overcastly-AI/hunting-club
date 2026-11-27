import { ENTITLEMENT_GRACE_DAYS } from '../api';
import type { Invite, MapPack, Member, Subscription } from '../club';
import { NEEDS_YOU_WINDOW_DAYS, inDays, needsYou, type NeedsYouInput } from '../needsYou';
import { DAY_MS, HOUR_MS } from '../time';

const NOW = Date.parse('2026-11-27T15:00:00Z');
const CLUB_ID = '00000000-0000-4000-8000-00000000c1ab';
const iso = (ms: number) => new Date(ms).toISOString();
const STAMPS = { createdAt: iso(NOW - 30 * DAY_MS), updatedAt: iso(NOW - 30 * DAY_MS) };
const BOUNDARY = {
  type: 'Polygon',
  coordinates: [
    [
      [-77.9, 40.8],
      [-77.8, 40.8],
      [-77.8, 40.7],
      [-77.9, 40.8],
    ],
  ],
} as NonNullable<NeedsYouInput['club']['boundary']>;

function subscription(over: Partial<Subscription> = {}): Subscription {
  return {
    clubId: CLUB_ID,
    stripeCustomerId: 'cus_1',
    stripeSubscriptionId: 'sub_1',
    planId: 'club',
    status: 'active',
    paidThrough: iso(NOW + 200 * DAY_MS),
    ...STAMPS,
    ...over,
  };
}

function member(n: number, over: Partial<Member> = {}): Member {
  return {
    clubId: CLUB_ID,
    userId: `user-${n}`,
    displayName: `Member ${n}`,
    initials: `M${n}`,
    role: 'member',
    ...STAMPS,
    ...over,
  };
}

function invite(n: number, over: Partial<Invite> = {}): Invite {
  return {
    id: `invite-${n}`,
    clubId: CLUB_ID,
    token: 'ab'.repeat(32),
    role: 'member',
    expiresAt: iso(NOW + 10 * DAY_MS),
    uses: 0,
    ...STAMPS,
    ...over,
  };
}

const packBase = {
  clubId: CLUB_ID,
  bounds: [-77.9, 40.7, -77.8, 40.8] as [number, number, number, number],
  minZoom: 10,
  maxZoom: 16,
  source: 'usgs-topo',
  s3Key: 'packs/x.pmtiles',
  ...STAMPS,
};
const readyPack = (id: string, over: Partial<MapPack> = {}) =>
  ({
    ...packBase,
    id,
    status: 'ready',
    sizeBytes: 1,
    builtAt: STAMPS.createdAt,
    ...over,
  }) as MapPack;
const failedPack = (id: string, over: Partial<MapPack> = {}) =>
  ({ ...packBase, id, status: 'failed', reason: 'Tiles timed out', ...over }) as MapPack;

/** A club with nothing to do: paid, a property line, a pack, nobody leaving. */
const settled = (over: Partial<NeedsYouInput> = {}): NeedsYouInput => ({
  club: { boundary: BOUNDARY },
  subscription: subscription(),
  members: [member(1)],
  invites: [],
  mapPacks: [readyPack('p1')],
  now: NOW,
  ...over,
});

const kinds = (input: NeedsYouInput) => needsYou(input).map((item) => item.kind);

describe('needsYou', () => {
  it('is empty when nothing needs the admin', () => {
    expect(needsYou(settled())).toEqual([]);
  });

  it('adds nothing for data the page has not loaded', () => {
    expect(needsYou({ club: { boundary: BOUNDARY }, now: NOW })).toEqual([]);
  });

  it('asks for the property line when the club has none, pointing to the app', () => {
    const [item] = needsYou(settled({ club: {}, mapPacks: undefined }));
    expect(item).toEqual({
      id: 'noPropertyLine',
      kind: 'noPropertyLine',
      title: 'Draw your property line',
      detail: 'Draw it in the app. Members see it on the map, and map packs need it.',
      action: 'drawPropertyLine',
    });
  });

  describe('billing', () => {
    it('asks to start the trial when the club never checked out', () => {
      expect(needsYou(settled({ subscription: null }))[0]).toMatchObject({
        kind: 'noSubscription',
        title: 'Start the free trial',
        action: 'billing',
      });
    });

    it('flags a payment that is past due with when club features close', () => {
      const paidThrough = NOW - 2 * DAY_MS;
      const [item] = needsYou(
        settled({
          subscription: subscription({ status: 'past_due', paidThrough: iso(paidThrough) }),
        }),
      );
      expect(item).toEqual({
        id: 'paymentProblem',
        kind: 'paymentProblem',
        title: 'Payment overdue',
        detail: `Club features close in ${ENTITLEMENT_GRACE_DAYS - 2} days unless it goes through.`,
        action: 'billing',
      });
    });

    it('drops the closing date once the grace period is over, or with no paid-through date', () => {
      const long = subscription({ status: 'unpaid', paidThrough: iso(NOW - 60 * DAY_MS) });
      expect(needsYou(settled({ subscription: long }))[0]).not.toHaveProperty('detail');
      const { paidThrough: _, ...noDate } = subscription({ status: 'incomplete' });
      expect(needsYou(settled({ subscription: noDate }))[0]).toMatchObject({
        title: 'Payment not finished',
      });
    });

    it('says when the subscription has ended or is paused', () => {
      expect(kinds(settled({ subscription: subscription({ status: 'canceled' }) }))).toEqual([
        'subscriptionEnded',
      ]);
      expect(
        kinds(settled({ subscription: subscription({ status: 'incomplete_expired' }) })),
      ).toEqual(['subscriptionEnded']);
      expect(kinds(settled({ subscription: subscription({ status: 'paused' }) }))).toEqual([
        'subscriptionPaused',
      ]);
    });

    it('warns when the trial ends within the window, not before', () => {
      const window = NEEDS_YOU_WINDOW_DAYS.trialEnding * DAY_MS;
      const ending = subscription({ status: 'trialing', paidThrough: iso(NOW + 2 * DAY_MS) });
      expect(needsYou(settled({ subscription: ending }))[0]).toMatchObject({
        kind: 'trialEnding',
        title: 'The free trial ends in 2 days',
      });
      const edge = subscription({ status: 'trialing', paidThrough: iso(NOW + window) });
      expect(kinds(settled({ subscription: edge }))).toEqual(['trialEnding']);
      const early = subscription({ status: 'trialing', paidThrough: iso(NOW + window + 1) });
      expect(kinds(settled({ subscription: early }))).toEqual([]);
    });

    it('says a subscription set not to renew will end', () => {
      const ending = subscription({ cancelAtPeriodEnd: true, paidThrough: iso(NOW + 9 * DAY_MS) });
      expect(needsYou(settled({ subscription: ending }))[0]).toMatchObject({
        kind: 'subscriptionEnding',
        title: 'The subscription ends in 9 days',
      });
    });

    it('ignores a paid-through date in the past or unreadable on an active plan', () => {
      for (const paidThrough of [iso(NOW - DAY_MS), 'not a date']) {
        expect(kinds(settled({ subscription: subscription({ paidThrough }) }))).toEqual([]);
      }
    });
  });

  describe('map packs', () => {
    it('asks for a pack once there is a property line and none is built or building', () => {
      expect(kinds(settled({ mapPacks: [] }))).toEqual(['noMapPack']);
      expect(kinds(settled({ mapPacks: [failedPack('f1')] }))).toEqual(['noMapPack']);
      const building = { ...packBase, id: 'b1', status: 'building', expiresAt: iso(NOW) };
      expect(kinds(settled({ mapPacks: [building as MapPack] }))).toEqual([]);
    });

    it("flags a basemap whose newest build failed, with the builder's reason", () => {
      const later = { createdAt: iso(NOW - DAY_MS) };
      const items = needsYou(
        settled({
          mapPacks: [readyPack('p1'), failedPack('f1', { source: 'usgs-imagery', ...later })],
        }),
      );
      expect(items).toEqual([
        {
          id: 'mapPackFailed:f1',
          kind: 'mapPackFailed',
          title: 'A map pack did not build',
          detail: 'Tiles timed out',
          action: 'mapPacks',
        },
      ]);
    });

    it('forgets a failure once a later build of the same basemap is ready', () => {
      const mapPacks = [failedPack('f1'), readyPack('p2', { createdAt: iso(NOW - DAY_MS) })];
      expect(kinds(settled({ mapPacks }))).toEqual([]);
    });
  });

  describe('people', () => {
    it('lists guest passes ending within the window, soonest first', () => {
      const members = [
        member(1),
        member(2, { role: 'guest', expiresAt: iso(NOW + 5 * DAY_MS), displayName: 'Cal R.' }),
        member(3, { role: 'guest', expiresAt: iso(NOW + 3 * HOUR_MS), displayName: 'Ann P.' }),
        member(4, { role: 'guest', expiresAt: iso(NOW + 30 * DAY_MS) }),
        member(5, { role: 'guest', expiresAt: iso(NOW - DAY_MS) }),
      ];
      expect(needsYou(settled({ members }))).toEqual([
        {
          id: 'guestPassEnding:user-3',
          kind: 'guestPassEnding',
          title: 'A guest pass ends within a day',
          detail: 'Ann P.',
          action: 'roster',
        },
        {
          id: 'guestPassEnding:user-2',
          kind: 'guestPassEnding',
          title: 'A guest pass ends in 5 days',
          detail: 'Cal R.',
          action: 'roster',
        },
      ]);
    });

    it('counts invites nobody has used that are still open', () => {
      const invites = [
        invite(1),
        invite(2),
        invite(3, { uses: 1 }),
        invite(4, { expiresAt: iso(NOW - HOUR_MS) }),
      ];
      expect(needsYou(settled({ invites }))).toEqual([
        {
          id: 'invitesNotUsed',
          kind: 'invitesNotUsed',
          title: '2 invites not used yet',
          detail: 'Nobody has joined with them.',
          action: 'roster',
        },
      ]);
      expect(needsYou(settled({ invites: [invite(1)] }))[0]?.title).toBe('1 invite not used yet');
    });
  });

  it('puts billing first, then setup, then people', () => {
    expect(
      kinds({
        club: {},
        subscription: subscription({ status: 'past_due' }),
        members: [member(2, { role: 'guest', expiresAt: iso(NOW + DAY_MS) })],
        invites: [invite(1)],
        mapPacks: [],
        now: NOW,
      }),
    ).toEqual(['paymentProblem', 'noPropertyLine', 'guestPassEnding', 'invitesNotUsed']);
  });
});

describe('inDays', () => {
  it('rounds to whole days and says "within a day" under one', () => {
    expect(inDays(NOW + 3 * HOUR_MS, NOW)).toBe('within a day');
    expect(inDays(NOW + DAY_MS, NOW)).toBe('in 1 day');
    expect(inDays(NOW + 2.6 * DAY_MS, NOW)).toBe('in 3 days');
  });
});
