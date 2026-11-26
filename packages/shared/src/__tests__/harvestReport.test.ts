import type { Harvest } from '../club';
import {
  HARVEST_SEX_LABELS,
  defaultSeason,
  harvestReport,
  isSeason,
  localDay,
  weekStart,
} from '../harvestReport';

const ISO = '2026-11-01T00:00:00.000Z';
let n = 0;
const harvest = (over: Partial<Harvest>): Harvest => ({
  id: `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`,
  clubId: '00000000-0000-4000-8000-0000000000c1',
  userId: 'user-a',
  species: 'Deer',
  sex: 'male',
  shared: true,
  harvestedAt: '2026-11-15T17:00:00.000Z',
  createdAt: ISO,
  updatedAt: ISO,
  ...over,
});

const SEASON = { from: '2026-09-01', to: '2026-12-31' };
const CHICAGO = 'America/Chicago';

describe('calendar days', () => {
  it('uses the local day in the given time zone', () => {
    // 03:00 UTC on 1 September is still 31 August in Chicago.
    expect(localDay('2026-09-01T03:00:00.000Z', CHICAGO)).toBe('2026-08-31');
    expect(localDay('2026-09-01T03:00:00.000Z', 'UTC')).toBe('2026-09-01');
  });

  it('starts weeks on Sunday', () => {
    expect(weekStart('2026-11-15')).toBe('2026-11-15'); // a Sunday
    expect(weekStart('2026-11-21')).toBe('2026-11-15'); // the Saturday after
    expect(weekStart('2027-01-01')).toBe('2026-12-27'); // across the new year
  });

  it('defaults to the September–January season under way, or the last one', () => {
    expect(defaultSeason('2026-11-26')).toEqual({ from: '2026-09-01', to: '2027-01-31' });
    expect(defaultSeason('2027-01-10')).toEqual({ from: '2026-09-01', to: '2027-01-31' });
    expect(defaultSeason('2027-06-01')).toEqual({ from: '2026-09-01', to: '2027-01-31' });
  });

  it('accepts only ordered, valid seasons', () => {
    expect(isSeason(SEASON)).toBe(true);
    expect(isSeason({ from: '2026-12-31', to: '2026-09-01' })).toBe(false);
    expect(isSeason({ from: '', to: '2026-09-01' })).toBe(false);
  });
});

describe('harvest report', () => {
  const harvests = [
    harvest({ species: 'Deer', sex: 'male', userId: 'a', harvestedAt: '2026-11-15T17:00:00Z' }),
    harvest({ species: 'deer ', sex: 'female', userId: 'b', harvestedAt: '2026-11-16T13:00:00Z' }),
    harvest({ species: 'Turkey', sex: 'male', userId: 'b', harvestedAt: '2026-10-03T12:00:00Z' }),
    harvest({ shared: false, userId: 'a', harvestedAt: '2026-11-20T12:00:00Z' }), // private
    harvest({ userId: 'a', harvestedAt: '2026-03-01T12:00:00Z' }), // before the season
    harvest({ userId: 'a', harvestedAt: '2026-09-01T03:00:00Z' }), // 31 Aug in Chicago
  ];
  const report = harvestReport(harvests, SEASON, CHICAGO);

  it('counts only shared harvests taken on a season day, oldest first', () => {
    expect(report.total).toBe(3);
    expect(report.harvests.map((h) => h.species)).toEqual(['Turkey', 'Deer', 'deer ']);
  });

  it('groups species ignoring case and spaces, most first', () => {
    expect(report.bySpecies.map((r) => [r.label, r.count])).toEqual([
      ['Deer', 2],
      ['Turkey', 1],
    ]);
  });

  it('counts every sex, including none', () => {
    expect(report.bySex).toEqual({ male: 2, female: 1, unknown: 0 });
    expect(Object.keys(HARVEST_SEX_LABELS)).toEqual(Object.keys(report.bySex));
  });

  it('counts by member, most first', () => {
    expect(report.byMember.map((r) => [r.key, r.count])).toEqual([
      ['b', 2],
      ['a', 1],
    ]);
  });

  it('lists every week of the season, including empty ones', () => {
    expect(report.byWeek[0]).toEqual({ key: '2026-08-30', label: '2026-08-30', count: 0 });
    expect(report.byWeek.at(-1)!.key).toBe('2026-12-27');
    expect(report.byWeek.find((w) => w.key === '2026-11-15')!.count).toBe(2);
    expect(report.byWeek.find((w) => w.key === '2026-09-27')!.count).toBe(1); // 3 Oct
    expect(report.byWeek.reduce((sum, w) => sum + w.count, 0)).toBe(3);
  });
});
