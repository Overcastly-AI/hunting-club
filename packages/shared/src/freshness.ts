/**
 * Position freshness from docs/SPEC.md, "Mesh protocol" rules: solid ring
 * under 2 min, dashed between 2 and 10 min, faded after that. These are the
 * only definitions of those thresholds and of the "2 min ago" wording (the
 * app's map, board and mesh line, the web admin and the site legend all use
 * them). @huntclub/core re-exports them for the phone's domain logic.
 */
import { DAY_MS, HOUR_MS, MINUTE_MS, SECOND_MS } from './time';

export const FRESHNESS_THRESHOLDS_MS = {
  /** Below this a position is fresh (solid ring). */
  fresh: 2 * MINUTE_MS,
  /** Below this (and not fresh) a position is stale (dashed ring); older is faded. */
  stale: 10 * MINUTE_MS,
} as const;

/**
 * A heard time up to this far ahead of the phone's clock is ordinary skew
 * (the sender's GPS clock against the phone's) and counts as just now. Further
 * ahead, nobody can say how old it is, so it is never shown as live.
 */
export const CLOCK_SKEW_TOLERANCE_MS = MINUTE_MS;

/** fresh: heard just now; stale: not heard just now; faded: an old, last known position. */
export type Freshness = 'fresh' | 'stale' | 'faded';

/** Time since `heardAt` in ms (a position, a forecast fetch); a timestamp from the future counts as just now. */
export function positionAge(heardAt: number, now: number): number {
  return Math.max(0, now - heardAt);
}

export function classifyFreshness(ageMs: number): Freshness {
  if (ageMs < FRESHNESS_THRESHOLDS_MS.fresh) return 'fresh';
  if (ageMs < FRESHNESS_THRESHOLDS_MS.stale) return 'stale';
  return 'faded';
}

/** A short form for the screen ("2 min") and a spoken form for screen readers ("2 minutes"). */
export type Wording = { short: string; spoken: string };

/** "1 minute", "2 minutes". */
export const pluralize = (count: number, word: string) =>
  `${count} ${word}${count === 1 ? '' : 's'}`;

/** A length of time: "12s", "2 min", "3 hr", "2 days" (negative counts as 0). */
export function formatDuration(ms: number): Wording {
  const span = Math.max(0, ms);
  if (span < MINUTE_MS) {
    const seconds = Math.floor(span / SECOND_MS);
    return { short: `${seconds}s`, spoken: pluralize(seconds, 'second') };
  }
  if (span < HOUR_MS) {
    const minutes = Math.floor(span / MINUTE_MS);
    return { short: `${minutes} min`, spoken: pluralize(minutes, 'minute') };
  }
  if (span < DAY_MS) {
    const hours = Math.floor(span / HOUR_MS);
    return { short: `${hours} hr`, spoken: pluralize(hours, 'hour') };
  }
  const days = Math.floor(span / DAY_MS);
  return { short: pluralize(days, 'day'), spoken: pluralize(days, 'day') };
}

/**
 * How long ago something happened: "2 min ago" ("2 minutes ago" spoken).
 * Under a minute it is "Just now", or "12s ago" with `seconds`.
 */
export function describeAge(ageMs: number, options: { seconds?: boolean } = {}): Wording {
  if (!options.seconds && ageMs < MINUTE_MS) return { short: 'Just now', spoken: 'just now' };
  const span = formatDuration(ageMs);
  return { short: `${span.short} ago`, spoken: `${span.spoken} ago` };
}

/** A position or radio that has never been heard (no time at all). */
export const NOT_HEARD: Wording = { short: 'Not heard yet', spoken: 'not heard yet' };
/** A heard time too far in the future to trust (see CLOCK_SKEW_TOLERANCE_MS). */
export const TIME_UNKNOWN: Wording = { short: 'Time unknown', spoken: 'time unknown' };

export type FreshnessView = Wording & {
  freshness: Freshness;
  /** ms since heard; null when there is no time or it can't be trusted. */
  ageMs: number | null;
};

/**
 * The one reading of a member's position or a radio's last-heard time, for
 * the freshness ring and its plate.
 *
 * - `ago` (default): "2 min ago", "Just now", for marker plates and lists.
 * - `heard`: "heard 12s ago", to the second, for the mesh line.
 *
 * No time (null, 0, NaN) is faded and "Not heard yet". A time from the future
 * within CLOCK_SKEW_TOLERANCE_MS is just now; further ahead it is stale and
 * "Time unknown", so a radio with a wrong clock never looks live.
 */
export function describeFreshness(
  heardAt: number | null | undefined,
  now: number,
  style: 'ago' | 'heard' = 'ago',
): FreshnessView {
  if (heardAt === null || heardAt === undefined || !Number.isFinite(heardAt) || heardAt <= 0) {
    return { freshness: 'faded', ageMs: null, ...NOT_HEARD };
  }
  if (heardAt - now > CLOCK_SKEW_TOLERANCE_MS) {
    return { freshness: 'stale', ageMs: null, ...TIME_UNKNOWN };
  }
  const ageMs = positionAge(heardAt, now);
  const freshness = classifyFreshness(ageMs);
  if (style === 'ago') return { freshness, ageMs, ...describeAge(ageMs) };
  const ago = describeAge(ageMs, { seconds: true });
  return { freshness, ageMs, short: `heard ${ago.short}`, spoken: `heard ${ago.spoken}` };
}
