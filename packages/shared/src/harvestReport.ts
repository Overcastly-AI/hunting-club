// Season summaries of the harvests members shared with their club: one rule for the
// web admin (and the app later). Dates are the hunter's local calendar days in a
// given time zone, never legal shooting hours.
import type { Harvest } from './club';
import { HARVEST_SEXES, type HarvestSex } from './enums';

/** Plain words for harvest sex (app and web admin). */
export const HARVEST_SEX_LABELS: Record<HarvestSex, string> = {
  male: 'Male',
  female: 'Female',
  unknown: 'Not sure',
};

/** A season the admin picks: first and last calendar day, inclusive (YYYY-MM-DD). */
export interface Season {
  from: string;
  to: string;
}

export interface CountRow {
  /** Grouping key: species in lower case, a user id, or a week start (YYYY-MM-DD). */
  key: string;
  /** Shown text: the species as first written; same as key for the others. */
  label: string;
  count: number;
}

export interface HarvestReport {
  season: Season;
  /** The shared harvests in the season, oldest first. */
  harvests: Harvest[];
  total: number;
  bySpecies: CountRow[];
  bySex: Record<HarvestSex, number>;
  byMember: CountRow[];
  /** Every week of the season (Sunday start), including weeks with none. */
  byWeek: CountRow[];
}

const DAY_MS = 86_400_000;

/** The calendar day (YYYY-MM-DD) of an instant in a time zone. */
export function localDay(iso: string, timeZone: string): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso));
}

const dayNumber = (day: string) => Date.parse(`${day}T00:00:00Z`) / DAY_MS;
const dayString = (n: number) => new Date(n * DAY_MS).toISOString().slice(0, 10);

/** The Sunday that starts a calendar day's week (YYYY-MM-DD). */
export function weekStart(day: string): string {
  const n = dayNumber(day);
  return dayString(n - new Date(n * DAY_MS).getUTCDay());
}

/**
 * The default season: 1 September to 31 January, the one under way (or the last one,
 * from February to August). The admin changes it to their state's dates.
 */
export function defaultSeason(today: string): Season {
  const [year, month] = today.split('-').map(Number) as [number, number];
  const start = month >= 9 ? year : year - 1;
  return { from: `${start}-09-01`, to: `${start + 1}-01-31` };
}

/** True when the season's days are valid and in order. */
export function isSeason(season: Season): boolean {
  const from = dayNumber(season.from);
  const to = dayNumber(season.to);
  return Number.isFinite(from) && Number.isFinite(to) && from <= to;
}

function countBy(
  harvests: readonly Harvest[],
  keyOf: (h: Harvest) => string,
  labelOf: (h: Harvest) => string,
): CountRow[] {
  const rows = new Map<string, CountRow>();
  for (const h of harvests) {
    const key = keyOf(h);
    const row = rows.get(key) ?? { key, label: labelOf(h), count: 0 };
    row.count++;
    rows.set(key, row);
  }
  return [...rows.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

/**
 * The season summary. Only harvests shared with the club count (an admin's own
 * private ones are left out), and only those taken on a day within the season.
 */
export function harvestReport(
  all: readonly Harvest[],
  season: Season,
  timeZone: string,
): HarvestReport {
  const from = dayNumber(season.from);
  const to = dayNumber(season.to);
  const harvests = all
    .filter((h) => h.shared)
    .filter((h) => {
      const day = dayNumber(localDay(h.harvestedAt, timeZone));
      return day >= from && day <= to;
    })
    .sort((a, b) => Date.parse(a.harvestedAt) - Date.parse(b.harvestedAt));

  const bySex = Object.fromEntries(HARVEST_SEXES.map((s) => [s, 0])) as Record<HarvestSex, number>;
  for (const h of harvests) bySex[h.sex]++;

  const weekCounts = new Map<string, number>();
  for (const h of harvests) {
    const week = weekStart(localDay(h.harvestedAt, timeZone));
    weekCounts.set(week, (weekCounts.get(week) ?? 0) + 1);
  }
  const byWeek: CountRow[] = [];
  for (let n = dayNumber(weekStart(season.from)); n <= to; n += 7) {
    const week = dayString(n);
    byWeek.push({ key: week, label: week, count: weekCounts.get(week) ?? 0 });
  }

  return {
    season,
    harvests,
    total: harvests.length,
    bySpecies: countBy(
      harvests,
      (h) => h.species.trim().toLowerCase(),
      (h) => h.species.trim(),
    ),
    bySex,
    byMember: countBy(
      harvests,
      (h) => h.userId,
      (h) => h.userId,
    ),
    byWeek,
  };
}
