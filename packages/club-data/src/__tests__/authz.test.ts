// The authorization rules as a matrix (no database): every policy against every
// kind of caller. The DynamoDB Local tests check the same rules end to end.
import type { Member, MemberRole } from '@huntclub/shared';
import { ANONYMOUS, SERVICE, userActor } from '../actor';
import { type Access, POLICIES, type Policy, authorize, can } from '../authz';

const NOW = new Date('2026-11-26T12:00:00.000Z');
const CLUB = '00000000-0000-4000-8000-000000000001';
const ME = '00000000-0000-4000-8000-0000000000aa';
const OTHER = '00000000-0000-4000-8000-0000000000bb';

function membership(role: MemberRole, expiresAt?: string): Member {
  return {
    clubId: CLUB,
    userId: ME,
    displayName: 'Me',
    initials: 'ME',
    role,
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    ...(expiresAt ? { expiresAt } : {}),
  };
}

const CALLERS: Record<string, Access> = {
  admin: { actor: userActor(ME), membership: membership('admin'), now: NOW },
  member: { actor: userActor(ME), membership: membership('member'), now: NOW },
  guest: {
    actor: userActor(ME),
    membership: membership('guest', '2026-11-27T00:00:00.000Z'),
    now: NOW,
  },
  expiredGuest: {
    actor: userActor(ME),
    membership: membership('guest', '2026-11-25T00:00:00.000Z'),
    now: NOW,
  },
  outsider: { actor: userActor(ME), membership: undefined, now: NOW },
  service: { actor: SERVICE, membership: undefined, now: NOW },
  anonymous: { actor: ANONYMOUS, membership: undefined, now: NOW },
};
type Caller = keyof typeof CALLERS;

const MEMBERS: Caller[] = ['admin', 'member', 'guest', 'service'];
const ADMINS: Caller[] = ['admin', 'service'];
const SERVICE_ONLY: Caller[] = ['service'];

/** Who passes each club-wide policy. */
const EXPECTED: Record<
  Exclude<
    Policy,
    'editMemberProfile' | 'removeMember' | 'readHarvest' | 'writeOwnHarvest' | 'deleteHarvest'
  >,
  Caller[]
> = {
  readClub: MEMBERS,
  updateClub: ADMINS,
  createClub: SERVICE_ONLY,
  deleteClub: SERVICE_ONLY,
  readClubSecret: ADMINS,
  writeClubSecret: ADMINS,
  readRoster: MEMBERS,
  addMember: ADMINS,
  setMemberAccess: ADMINS,
  manageInvites: ADMINS,
  readPlaces: MEMBERS,
  writePlaces: ADMINS,
  readMapPacks: MEMBERS,
  writeMapPacks: SERVICE_ONLY,
  readSubscription: ADMINS,
  writeBilling: SERVICE_ONLY,
  readStripeEvents: SERVICE_ONLY,
};

describe('club-wide policies', () => {
  it('covers every policy', () => {
    const resourcePolicies = [
      'editMemberProfile',
      'removeMember',
      'readHarvest',
      'writeOwnHarvest',
      'deleteHarvest',
    ];
    expect([...Object.keys(EXPECTED), ...resourcePolicies].sort()).toEqual(
      Object.keys(POLICIES).sort(),
    );
  });

  for (const [policy, allowed] of Object.entries(EXPECTED)) {
    for (const caller of Object.keys(CALLERS) as Caller[]) {
      const expected = allowed.includes(caller);
      it(`${policy}: ${caller} ${expected ? 'may' : 'may not'}`, () => {
        expect(can(CALLERS[caller]!, policy as keyof typeof EXPECTED)).toBe(expected);
      });
    }
  }
});

describe('resource policies', () => {
  const self = { userId: ME };
  const someoneElse = { userId: OTHER };

  it.each([
    ['member', self, true],
    ['member', someoneElse, false],
    ['admin', someoneElse, true],
    ['expiredGuest', self, false],
    ['outsider', self, false],
    ['service', someoneElse, true],
  ] as const)('editMemberProfile / removeMember: %s on %o → %s', (caller, target, expected) => {
    expect(can(CALLERS[caller]!, 'editMemberProfile', target)).toBe(expected);
    expect(can(CALLERS[caller]!, 'removeMember', target)).toBe(expected);
  });

  const harvest = (owner: string, shared: boolean) => ({ userId: owner, shared });

  it.each([
    ['member', harvest(ME, false), true],
    ['member', harvest(OTHER, true), true],
    ['member', harvest(OTHER, false), false],
    ['admin', harvest(OTHER, false), false],
    ['guest', harvest(OTHER, true), true],
    ['expiredGuest', harvest(ME, false), false],
    ['outsider', harvest(OTHER, true), false],
  ] as const)('readHarvest: %s on %o → %s', (caller, h, expected) => {
    expect(can(CALLERS[caller]!, 'readHarvest', h)).toBe(expected);
  });

  it.each([
    ['member', harvest(ME, true), true],
    ['member', harvest(OTHER, true), false],
    ['admin', harvest(OTHER, true), false],
    ['expiredGuest', harvest(ME, true), false],
  ] as const)('writeOwnHarvest: %s on %o → %s', (caller, h, expected) => {
    expect(can(CALLERS[caller]!, 'writeOwnHarvest', h)).toBe(expected);
  });

  it.each([
    ['member', harvest(ME, false), true],
    ['member', harvest(OTHER, true), false],
    ['admin', harvest(OTHER, true), true],
    ['admin', harvest(OTHER, false), false],
  ] as const)('deleteHarvest: %s on %o → %s', (caller, h, expected) => {
    expect(can(CALLERS[caller]!, 'deleteHarvest', h)).toBe(expected);
  });
});

describe('authorize', () => {
  const throwsCode = (access: Access, code: string) =>
    expect(() => authorize(access, 'readClub')).toThrow(expect.objectContaining({ code }));

  it('anonymous callers get not_authenticated', () =>
    throwsCode(CALLERS.anonymous!, 'not_authenticated'));
  it('signed-in callers without access get forbidden', () =>
    throwsCode(CALLERS.outsider!, 'forbidden'));
  it('passes silently when allowed', () => {
    expect(() => authorize(CALLERS.member!, 'readClub')).not.toThrow();
  });
});
