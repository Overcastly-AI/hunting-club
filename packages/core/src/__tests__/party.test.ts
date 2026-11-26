import {
  FREE_PARTY_MAX_MEMBERS,
  PartyFullError,
  assertCanJoinParty,
  canJoinParty,
  shouldShowPartyQr,
} from '../party';

describe('party rules', () => {
  it('free parties hold 3 people', () => {
    expect(FREE_PARTY_MAX_MEMBERS).toBe(3);
    expect(canJoinParty(1)).toBe(true);
    expect(canJoinParty(2)).toBe(true);
    expect(canJoinParty(3)).toBe(false);
    expect(canJoinParty(4)).toBe(false);
  });

  it('refuses to join a full party with a clear error', () => {
    expect(() => assertCanJoinParty(2)).not.toThrow();
    expect(() => assertCanJoinParty(3)).toThrow(PartyFullError);
    expect(() => assertCanJoinParty(3)).toThrow('This party is full (3 people max)');
  });

  it('stops showing the party QR when full', () => {
    expect(shouldShowPartyQr(2)).toBe(true);
    expect(shouldShowPartyQr(3)).toBe(false);
  });

  it('supports uncapped or custom-capped groups', () => {
    expect(canJoinParty(500, null)).toBe(true);
    expect(canJoinParty(9, 10)).toBe(true);
    expect(canJoinParty(10, 10)).toBe(false);
  });
});
