import type { MyClub } from '../api';
import { ClubApiRequestError } from '../apiClient';
import { chooseClub, clubsForAccount, isMyClub, isNoClubAccess } from '../clubChoice';

const A = 'user-a';
const B = 'user-b';
/** Only the fields the choice reads: the club id and the account's role. */
const club = (id: string, role: 'admin' | 'member' = 'admin') =>
  ({ club: { id }, membership: { role } }) as unknown as MyClub;
const isAdmin = (m: MyClub) => m.membership.role === 'admin';

describe('chooseClub', () => {
  it("keeps the account's own stored club while it is still theirs", () => {
    const mine = [club('c1'), club('c2')];
    expect(chooseClub(mine, A, { userId: A, clubId: 'c2' })).toEqual({ userId: A, clubId: 'c2' });
  });

  it("drops another account's stored club and picks from this account's clubs", () => {
    expect(chooseClub([club('b1')], B, { userId: A, clubId: 'a1' })).toEqual({
      userId: B,
      clubId: 'b1',
    });
    // Even when both accounts belong to the stored club, the choice is not inherited.
    expect(chooseClub([club('b1'), club('a1')], B, { userId: A, clubId: 'a1' })?.clubId).toBe('b1');
  });

  it('drops a stale stored club the account is no longer in', () => {
    expect(chooseClub([club('c1')], A, { userId: A, clubId: 'gone' })).toEqual({
      userId: A,
      clubId: 'c1',
    });
    expect(chooseClub([], A, { userId: A, clubId: 'gone' })).toBeNull();
  });

  it('only picks clubs that pass `eligible`', () => {
    const mine = [club('m1', 'member'), club('a1')];
    expect(chooseClub(mine, A, { userId: A, clubId: 'm1' }, isAdmin)?.clubId).toBe('a1');
    expect(chooseClub([club('m1', 'member')], A, null, isAdmin)).toBeNull();
  });
});

describe('isMyClub and isNoClubAccess', () => {
  it('match listed clubs and 403s only', () => {
    expect(isMyClub([club('c1')], 'c1')).toBe(true);
    expect(isMyClub([club('c1')], 'c2')).toBe(false);
    expect(isNoClubAccess(new ClubApiRequestError('forbidden', 403))).toBe(true);
    expect(isNoClubAccess(new ClubApiRequestError('not_found', 404))).toBe(false);
    expect(isNoClubAccess(new Error('403'))).toBe(false);
  });
});

describe('clubsForAccount', () => {
  const saved = [
    { id: 'a1', memberUserId: A, pendingInvite: false },
    { id: 'b1', memberUserId: B, pendingInvite: false },
    { id: 'new', memberUserId: null, pendingInvite: true },
  ];
  const ids = (userId: string | undefined) => clubsForAccount(saved, userId).map((c) => c.id);

  it("lists the account's own clubs and waiting invites, hiding other accounts' clubs", () => {
    expect(ids(A)).toEqual(['a1', 'new']);
    expect(ids(B)).toEqual(['b1', 'new']);
  });

  it('lists every saved club when signed out, and never changes the saved list', () => {
    expect(ids(undefined)).toEqual(['a1', 'b1', 'new']);
    expect(saved).toHaveLength(3);
  });
});
