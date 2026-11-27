/**
 * "Needs you" on the admin's My club: the to-dos the club admin should act
 * on, worked out from what the club API already returns (the club, members,
 * subscription, invites and map packs). Pure: the page passes what it loaded
 * and `now`. A list it didn't load (undefined) adds nothing, so a page that
 * is still loading never shows a false to-do.
 */
import { entitlementFor } from './api';
import { SUBSCRIPTION_STATUS_LABELS } from './enums';
import type { Club, Invite, MapPack, Member, Subscription } from './club';
import { pluralize } from './freshness';
import { DAY_MS } from './time';

/** How far ahead an ending trial or guest pass becomes a to-do. */
export const NEEDS_YOU_WINDOW_DAYS = { trialEnding: 3, guestPassEnding: 7 } as const;

/** Where the admin goes to deal with it (the page maps these to its routes). */
export type NeedsYouAction = 'billing' | 'roster' | 'mapPacks' | 'drawPropertyLine';

export type NeedsYouKind =
  | 'paymentProblem'
  | 'subscriptionEnded'
  | 'subscriptionPaused'
  | 'noSubscription'
  | 'trialEnding'
  | 'subscriptionEnding'
  | 'noPropertyLine'
  | 'noMapPack'
  | 'mapPackFailed'
  | 'guestPassEnding'
  | 'invitesNotUsed';

export type NeedsYouItem = {
  /** Stable React key. */
  id: string;
  kind: NeedsYouKind;
  title: string;
  detail?: string;
  action: NeedsYouAction;
};

export type NeedsYouInput = {
  club: Pick<Club, 'boundary'>;
  /** null: the club has never started Checkout. undefined: not loaded. */
  subscription?: Subscription | null | undefined;
  members?: readonly Member[] | undefined;
  /** The club's invites (ClubApiClient.listInvites). */
  invites?: readonly Invite[] | undefined;
  mapPacks?: readonly MapPack[] | undefined;
  now: number;
};

/** "in 3 days", or "within a day". */
export function inDays(at: number, now: number): string {
  const left = at - now;
  if (left < DAY_MS) return 'within a day';
  return `in ${pluralize(Math.round(left / DAY_MS), 'day')}`;
}

const time = (iso: string | undefined) => (iso === undefined ? NaN : Date.parse(iso));

function billingItems(subscription: Subscription | null | undefined, now: number): NeedsYouItem[] {
  if (subscription === undefined) return [];
  if (subscription === null) {
    return [
      {
        id: 'noSubscription',
        kind: 'noSubscription',
        title: 'Start the free trial',
        detail: 'Club stands, areas and the property line reach members once the club is paid for.',
        action: 'billing',
      },
    ];
  }
  const paidThrough = time(subscription.paidThrough);
  switch (subscription.status) {
    case 'past_due':
    case 'unpaid':
    case 'incomplete': {
      const until = time(entitlementFor(subscription.clubId, subscription).featuresUntil);
      const closes =
        until > now ? `Club features close ${inDays(until, now)} unless it goes through.` : null;
      return [
        {
          id: 'paymentProblem',
          kind: 'paymentProblem',
          title: SUBSCRIPTION_STATUS_LABELS[subscription.status],
          ...(closes ? { detail: closes } : {}),
          action: 'billing',
        },
      ];
    }
    case 'canceled':
    case 'incomplete_expired':
      return [
        {
          id: 'subscriptionEnded',
          kind: 'subscriptionEnded',
          title: 'The club subscription has ended',
          detail: 'Mesh and safety features keep working. Club features need a subscription.',
          action: 'billing',
        },
      ];
    case 'paused':
      return [
        {
          id: 'subscriptionPaused',
          kind: 'subscriptionPaused',
          title: 'The club subscription is paused',
          action: 'billing',
        },
      ];
    case 'trialing':
    case 'active': {
      if (!(paidThrough > now)) return [];
      if (subscription.cancelAtPeriodEnd) {
        return [
          {
            id: 'subscriptionEnding',
            kind: 'subscriptionEnding',
            title: `The subscription ends ${inDays(paidThrough, now)}`,
            detail: 'It was set not to renew.',
            action: 'billing',
          },
        ];
      }
      const window = NEEDS_YOU_WINDOW_DAYS.trialEnding * DAY_MS;
      if (subscription.status === 'trialing' && paidThrough - now <= window) {
        return [
          {
            id: 'trialEnding',
            kind: 'trialEnding',
            title: `The free trial ends ${inDays(paidThrough, now)}`,
            detail: 'Billing starts then.',
            action: 'billing',
          },
        ];
      }
      return [];
    }
  }
}

function mapPackItems(
  club: Pick<Club, 'boundary'>,
  packs: readonly MapPack[] | undefined,
): NeedsYouItem[] {
  if (!club.boundary || packs === undefined) return [];
  if (!packs.some((pack) => pack.status !== 'failed')) {
    return [
      {
        id: 'noMapPack',
        kind: 'noMapPack',
        title: 'Build a map pack',
        detail: 'Members get the property on their phones for use with no signal.',
        action: 'mapPacks',
      },
    ];
  }
  // For each basemap, only its newest pack counts: a later build replaces a failed one.
  const newest = new Map<string, MapPack>();
  for (const pack of packs) {
    const seen = newest.get(pack.source);
    if (!seen || time(pack.createdAt) > time(seen.createdAt)) newest.set(pack.source, pack);
  }
  return [...newest.values()]
    .filter((pack) => pack.status === 'failed')
    .map((pack) => ({
      id: `mapPackFailed:${pack.id}`,
      kind: 'mapPackFailed' as const,
      title: 'A map pack did not build',
      ...(pack.status === 'failed' ? { detail: pack.reason } : {}),
      action: 'mapPacks' as const,
    }));
}

function guestPassItems(members: readonly Member[] | undefined, now: number): NeedsYouItem[] {
  const window = NEEDS_YOU_WINDOW_DAYS.guestPassEnding * DAY_MS;
  return (members ?? [])
    .filter((member) => {
      const ends = time(member.expiresAt);
      return member.role === 'guest' && ends > now && ends - now <= window;
    })
    .sort((a, b) => time(a.expiresAt) - time(b.expiresAt))
    .map((member) => ({
      id: `guestPassEnding:${member.userId}`,
      kind: 'guestPassEnding' as const,
      title: `A guest pass ends ${inDays(time(member.expiresAt), now)}`,
      detail: member.displayName,
      action: 'roster' as const,
    }));
}

function inviteItems(invites: readonly Invite[] | undefined, now: number): NeedsYouItem[] {
  const waiting = (invites ?? []).filter(
    (invite) => invite.uses === 0 && time(invite.expiresAt) > now,
  );
  if (waiting.length === 0) return [];
  return [
    {
      id: 'invitesNotUsed',
      kind: 'invitesNotUsed',
      title: `${pluralize(waiting.length, 'invite')} not used yet`,
      detail: 'Nobody has joined with them.',
      action: 'roster',
    },
  ];
}

/** The admin's to-dos, most urgent first (billing, then setup, then people). */
export function needsYou(input: NeedsYouInput): NeedsYouItem[] {
  const { club, now } = input;
  return [
    ...billingItems(input.subscription, now),
    ...(club.boundary
      ? []
      : [
          {
            id: 'noPropertyLine',
            kind: 'noPropertyLine' as const,
            title: 'Draw your property line',
            detail: 'Draw it on the club map. Members see it in the app, and map packs need it.',
            action: 'drawPropertyLine' as const,
          },
        ]),
    ...mapPackItems(club, input.mapPacks),
    ...guestPassItems(input.members, now),
    ...inviteItems(input.invites, now),
  ];
}
