/**
 * Position freshness from docs/SPEC.md, "Mesh protocol" rules: solid ring
 * under 2 min, dashed between 2 and 10 min, faded after that. These are the
 * only definitions of those thresholds.
 */
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export const FRESHNESS_THRESHOLDS_MS = {
  /** Below this a position is fresh (solid ring). */
  fresh: 2 * MINUTE,
  /** Below this (and not fresh) a position is stale (dashed ring); older is faded. */
  stale: 10 * MINUTE,
} as const;

export type Freshness = 'fresh' | 'stale' | 'faded';

/** Age of a position in ms; a timestamp from the future counts as just heard. */
export function positionAge(heardAt: number, now: number): number {
  return Math.max(0, now - heardAt);
}

export function classifyFreshness(ageMs: number): Freshness {
  if (ageMs < FRESHNESS_THRESHOLDS_MS.fresh) return 'fresh';
  if (ageMs < FRESHNESS_THRESHOLDS_MS.stale) return 'stale';
  return 'faded';
}

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? '' : 's'}`;
}

/**
 * How long ago something was heard, in short form for the map ("2 min ago")
 * and spoken form for screen readers ("2 minutes ago").
 */
export function describeAge(ageMs: number): { short: string; spoken: string } {
  const age = Math.max(0, ageMs);
  if (age < MINUTE) return { short: 'Just now', spoken: 'just now' };
  if (age < HOUR) {
    const minutes = Math.floor(age / MINUTE);
    return { short: `${minutes} min ago`, spoken: `${plural(minutes, 'minute')} ago` };
  }
  if (age < DAY) {
    const hours = Math.floor(age / HOUR);
    return { short: `${hours} hr ago`, spoken: `${plural(hours, 'hour')} ago` };
  }
  const days = Math.floor(age / DAY);
  return { short: `${plural(days, 'day')} ago`, spoken: `${plural(days, 'day')} ago` };
}
