// Dev-only: the admin over the tests' in-memory club API, for screenshots and design review
// (/app/?demo=<scenario>). Only the kit build and `vite dev` include it (Root.tsx); production
// builds drop it. Signed in as the sample admin unless the scenario says otherwise.
import { ClubSession, DAY_MS, memoryTokenStore, type Member } from '@huntclub/shared';
import { adminApi } from '../api/admin';
import type { ClubApi } from '../api/types';
import type { WebClubServices } from '../cloud';
import { samplePack } from '../map/samplePack';
import {
  fakeClubClient,
  fakeCognitoAuth,
  fakeTokens,
  sampleData,
  type FakeClubData,
} from '../testing/fakeClubApi';

export const DEMO_SCENARIOS = [
  'trial',
  'active',
  'ending',
  'pastDue',
  'canceled',
  'none',
  'noPlans',
  'noClub',
  'signedOut',
  'loading',
  'alone',
] as const;
export type DemoScenario = (typeof DEMO_SCENARIOS)[number];

export const isDemoScenario = (value: string | null): value is DemoScenario =>
  (DEMO_SCENARIOS as readonly (string | null)[]).includes(value);

const iso = (at: number) => new Date(at).toISOString();

/** More of a club than the tests need: people with radios, a guest whose pass ends soon. */
function demoData(scenario: DemoScenario, now: number): FakeClubData {
  const data = sampleData();
  // The admin's row as the pattern, without their radio.
  const { nodeId: _radio, ...first } = data.members[0]!;
  const person = (
    n: number,
    displayName: string,
    initials: string,
    extra: Partial<Member> = {},
  ) => ({
    ...first,
    userId: `${first.userId.slice(0, -2)}${String(n).padStart(2, '0')}`,
    displayName,
    initials,
    role: 'member' as const,
    ...extra,
  });
  data.members.push(
    person(11, 'Marcus Webb', 'MW', { nodeId: 0x5a11c0de }),
    person(12, 'Tom Avery', 'TA', { nodeId: 0x7a0400f3 }),
    person(13, 'June Hadley', 'JH', { role: 'admin', nodeId: 0x1f2e3d4c }),
    person(14, 'Lena Suggs', 'LS'),
    person(15, 'Cal Reed', 'CR', { role: 'guest', expiresAt: iso(now + 3 * DAY_MS) }),
  );
  data.invites.push({
    id: '7b2c3d4e-5f6a-4b7c-8d9e-0f1a2b3c4d01',
    clubId: data.club!.id,
    token: '0f'.repeat(16),
    role: 'member',
    uses: 0,
    expiresAt: iso(now + 10 * DAY_MS),
    createdAt: iso(now - DAY_MS),
    updatedAt: iso(now - DAY_MS),
  });
  // A ready aerial pack, drawn under My club's plan (scripts/shoot.ts serves its archive).
  data.mapPacks.push(samplePack(data.club!.id));
  const sub = data.subscription!;
  switch (scenario) {
    case 'trial':
      data.subscription = {
        ...sub,
        status: 'trialing',
        interval: 'year',
        paidThrough: iso(now + 2 * DAY_MS),
      };
      break;
    case 'active':
      data.subscription = { ...sub, interval: 'year' };
      break;
    case 'ending':
      data.subscription = {
        ...sub,
        interval: 'month',
        cancelAtPeriodEnd: true,
        paidThrough: iso(now + 12 * DAY_MS),
      };
      break;
    case 'pastDue':
      data.subscription = {
        ...sub,
        status: 'past_due',
        interval: 'month',
        paidThrough: iso(now - 2 * DAY_MS),
      };
      break;
    case 'canceled':
      data.subscription = {
        ...sub,
        status: 'canceled',
        interval: 'year',
        paidThrough: iso(now - 20 * DAY_MS),
      };
      break;
    case 'none':
      data.subscription = null;
      break;
    case 'noPlans':
      data.subscription = null;
      data.plans = [];
      break;
    case 'noClub':
      data.club = null;
      break;
    case 'signedOut':
    case 'loading':
      break;
    case 'alone':
      // Only the signed-in admin: the roster's empty state.
      data.members = data.members.slice(0, 1);
      break;
  }
  return data;
}

/** The club service never answering: every page stays in its loading state (`loading`). */
function neverAnswers(api: ClubApi): ClubApi {
  return new Proxy(api, { get: () => () => new Promise(() => undefined) });
}

export function demoServices(scenario: DemoScenario, now = Date.now()): WebClubServices {
  const store = memoryTokenStore(scenario === 'signedOut' ? null : fakeTokens());
  const api = adminApi(fakeClubClient(demoData(scenario, now)));
  return {
    session: new ClubSession(fakeCognitoAuth(), store),
    api: scenario === 'loading' ? neverAnswers(api) : api,
  };
}
