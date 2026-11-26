import {
  CHECK_IN_MODE_BY_KEY,
  CHECK_IN_MODE_KEYS,
  CheckInMode,
  HARVEST_SEX_BY_KEY,
  HARVEST_SEX_KEYS,
  HarvestSex,
  enumValues,
} from '../domain';

describe('domain enums', () => {
  it('check-in mode keys match the app database CHECK constraint', () => {
    expect(Object.values(CHECK_IN_MODE_KEYS)).toEqual(['stand', 'area', 'spot', 'moving']);
    for (const m of enumValues(CheckInMode)) {
      expect(CHECK_IN_MODE_BY_KEY[CHECK_IN_MODE_KEYS[m as CheckInMode]]).toBe(m);
    }
  });

  it('harvest sex keys round-trip', () => {
    for (const s of enumValues(HarvestSex)) {
      expect(HARVEST_SEX_BY_KEY[HARVEST_SEX_KEYS[s as HarvestSex]]).toBe(s);
    }
  });

  it('enumValues returns only numeric members', () => {
    expect(enumValues(CheckInMode)).toEqual([1, 2, 3, 4]);
  });
});
