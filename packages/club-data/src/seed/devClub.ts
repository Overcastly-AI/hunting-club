/**
 * Dev-only test club for UI work ("UAT Test Club"): one admin, an entitlement 90 days
 * out, a property line, one area and three stands. Idempotent: running it again
 * updates the same club and adds only what is missing. Uses the repository functions
 * (no raw items), as the service.
 */
import { ENTITLEMENT_GRACE_DAYS, type StandType } from '@huntclub/shared';
import { SERVICE, userActor } from '../actor';
import type { ClubData } from '../index';

/** What the seed creates. Coordinates: a small property in central Illinois. */
export const UAT_CLUB = {
  name: 'UAT Test Club',
  /** Days of club features from the day the seed runs. */
  featureDays: 90,
  plan: 'club_standard',
  boundary: {
    type: 'Polygon' as const,
    coordinates: [
      [
        [-89.65, 40.1],
        [-89.63, 40.1],
        [-89.63, 40.115],
        [-89.65, 40.115],
        [-89.65, 40.1],
      ],
    ],
  },
  area: 'North Timber',
  stands: [
    { name: 'Creek Bottom', type: 'tree_stand', lat: 40.112, lon: -89.645, inArea: true },
    { name: 'Ridge Ladder', type: 'ladder', lat: 40.109, lon: -89.638, inArea: true },
    { name: 'South Field Blind', type: 'ground_blind', lat: 40.103, lon: -89.634, inArea: false },
  ] satisfies { name: string; type: StandType; lat: number; lon: number; inArea: boolean }[],
};

export interface DevSeedInput {
  /** The admin's Cognito `sub`. */
  adminSub: string;
  /** The admin's email: only seeds their display name and initials (no email is stored). */
  email: string;
  now?: Date;
}

export interface DevSeedResult {
  clubId: string;
  created: boolean;
  featuresUntil: string | undefined;
}

/** Display name and initials from an email's local part ("jane.doe@x" → "Jane Doe", "JD"). */
export function profileFromEmail(email: string) {
  const words = (email.split('@')[0] ?? '').split(/[._+-]+/).filter(Boolean);
  const displayName = words.map((w) => w[0]!.toUpperCase() + w.slice(1)).join(' ') || 'UAT Admin';
  const initials = (
    words.length > 1 ? words[0]![0]! + words[1]![0]! : displayName.slice(0, 2)
  ).toUpperCase();
  return { displayName, initials };
}

export async function seedDevClub(data: ClubData, input: DevSeedInput): Promise<DevSeedResult> {
  const now = input.now ?? new Date();
  await data.seedPlans(SERVICE);

  const mine = await data.listMyClubs(userActor(input.adminSub));
  const existing = mine.find((m) => m.club.name === UAT_CLUB.name && m.membership.role === 'admin');
  const clubId = existing
    ? (await data.updateClub(SERVICE, existing.club.id, { boundary: UAT_CLUB.boundary })).id
    : (
        await data.createClub(SERVICE, {
          club: { name: UAT_CLUB.name, boundary: UAT_CLUB.boundary },
          admin: { userId: input.adminSub, ...profileFromEmail(input.email) },
        })
      ).id;

  // featuresUntil = paidThrough + grace (entitlementFor), so pay through 90 days minus grace.
  const paid = new Date(now);
  paid.setUTCDate(paid.getUTCDate() + UAT_CLUB.featureDays - ENTITLEMENT_GRACE_DAYS);
  const paidThrough = paid.toISOString();
  await data.applyStripeEvent(SERVICE, {
    eventId: `evt_uat_seed_${now.getTime()}`,
    clubId,
    stripeCustomerId: `cus_uat_${clubId}`,
    stripeSubscriptionId: `sub_uat_${clubId}`,
    planId: UAT_CLUB.plan,
    status: 'active',
    paidThrough,
  });

  const areas = await data.listAreas(SERVICE, clubId);
  const area =
    areas.find((a) => a.name === UAT_CLUB.area) ??
    (await data.createArea(SERVICE, clubId, { name: UAT_CLUB.area, boundary: UAT_CLUB.boundary }));
  const standNames = new Set((await data.listStands(SERVICE, clubId)).map((s) => s.name));
  for (const { inArea, ...stand } of UAT_CLUB.stands) {
    if (standNames.has(stand.name)) continue;
    await data.createStand(SERVICE, clubId, { ...stand, ...(inArea ? { areaId: area.id } : {}) });
  }

  const { featuresUntil } = await data.getEntitlement(SERVICE, clubId);
  return { clubId, created: !existing, featuresUntil };
}
