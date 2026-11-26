import { STAND_TYPE_ICON_NAMES, STAND_TYPES } from '../enums';

describe('STAND_TYPE_ICON_NAMES', () => {
  it('names a Lucide icon for every stand type and nothing else', () => {
    expect(Object.keys(STAND_TYPE_ICON_NAMES).sort()).toEqual([...STAND_TYPES].sort());
    for (const type of STAND_TYPES) {
      expect(STAND_TYPE_ICON_NAMES[type]).toMatch(/^[A-Z][A-Za-z0-9]+$/);
    }
  });

  it('gives each stand type its own icon', () => {
    const names = STAND_TYPES.map((type) => STAND_TYPE_ICON_NAMES[type]);
    expect(new Set(names).size).toBe(STAND_TYPES.length);
  });
});
