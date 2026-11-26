import { clubFeaturesOpen } from '../entitlement';

describe('clubFeaturesOpen', () => {
  const entitlement = { clubId: 'c1', clubName: 'Pine Ridge Club', expiresAt: 1_000 };

  it('is closed for free users (no entitlement)', () => {
    expect(clubFeaturesOpen(null, 0)).toBe(false);
  });

  it('is open until the entitlement expires, then freezes', () => {
    expect(clubFeaturesOpen(entitlement, 999)).toBe(true);
    expect(clubFeaturesOpen(entitlement, 1_000)).toBe(false);
  });
});
