import { DAY_MS, HOUR_MS, MINUTE_MS } from '@huntclub/core';

/** How long ago something happened, in words. Freshness rules live in @huntclub/core. */

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? '' : 's'}`;
}

/**
 * How long ago something was heard, in short form for the map ("2 min ago")
 * and spoken form for screen readers ("2 minutes ago").
 */
export function describeAge(ageMs: number): { short: string; spoken: string } {
  const age = Math.max(0, ageMs);
  if (age < MINUTE_MS) return { short: 'Just now', spoken: 'just now' };
  if (age < HOUR_MS) {
    const minutes = Math.floor(age / MINUTE_MS);
    return { short: `${minutes} min ago`, spoken: `${plural(minutes, 'minute')} ago` };
  }
  if (age < DAY_MS) {
    const hours = Math.floor(age / HOUR_MS);
    return { short: `${hours} hr ago`, spoken: `${plural(hours, 'hour')} ago` };
  }
  const days = Math.floor(age / DAY_MS);
  return { short: `${plural(days, 'day')} ago`, spoken: `${plural(days, 'day')} ago` };
}
