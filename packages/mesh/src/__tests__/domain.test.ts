import {
  CHECK_IN_MODE_BY_KEY,
  CHECK_IN_MODE_KEYS,
  CheckInMode,
  HARVEST_SEXES,
  HARVEST_SEX_CODES,
  HARVEST_SEX_KEYS,
  enumValues,
} from '../domain';

describe('domain enums', () => {
  it('check-in mode keys match the app database CHECK constraint', () => {
    expect(Object.values(CHECK_IN_MODE_KEYS)).toEqual(['stand', 'area', 'spot', 'moving']);
    for (const m of enumValues(CheckInMode)) {
      expect(CHECK_IN_MODE_BY_KEY[CHECK_IN_MODE_KEYS[m as CheckInMode]]).toBe(m);
    }
  });

  it('harvest sex wire codes are frozen (changing one breaks deployed radios)', () => {
    expect(HARVEST_SEX_CODES).toEqual({ unknown: 0, male: 1, female: 2 });
  });

  it('harvest sex covers exactly HARVEST_SEXES from @huntclub/shared', () => {
    expect(Object.keys(HARVEST_SEX_CODES).sort()).toEqual([...HARVEST_SEXES].sort());
    for (const key of HARVEST_SEXES) {
      expect(HARVEST_SEX_KEYS[HARVEST_SEX_CODES[key]]).toBe(key);
    }
  });

  it('enumValues returns only numeric members', () => {
    expect(enumValues(CheckInMode)).toEqual([1, 2, 3, 4]);
  });
});
