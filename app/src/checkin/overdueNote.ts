import { SUN, overdueAt } from '@huntclub/core';
import type { LatLon } from '@huntclub/mesh';

import { formatClockTime } from '@huntclub/shared';
import { OVERDUE_ALERT_TEXT, type Audience } from '../domain/audience';

/**
 * When the overdue alert goes out for a check-in at `place` (sunset plus the grace time, from
 * core; or the extension, if later). Undefined while the phone does not know where.
 */
export function overdueTime(
  checkedInAt: number,
  place: LatLon | undefined,
  graceMinutes: number,
  until?: number,
): number | undefined {
  return place ? overdueAt(checkedInAt, place, graceMinutes, SUN, until) : undefined;
}

/** The overdue line, and the clock time in it (drawn in ink), when the phone knows it. */
export type OverdueNote = { text: string; time: string | null };

/**
 * The plain line above the slider: when an overdue alert would go out (sunset plus the grace
 * time, from core), "If you haven’t checked out by 5:08 PM, club members get an overdue alert.
 * That is sunset plus 30 minutes." Sunrise and sunset only: never legal shooting hours.
 */
export function overdueNote(
  checkedInAt: number,
  place: LatLon | undefined,
  graceMinutes: number,
  audience: Audience,
): OverdueNote {
  const at = overdueTime(checkedInAt, place, graceMinutes);
  const sunsetPlus = `sunset plus ${graceMinutes} minutes`;
  if (!at) {
    return {
      text: `If you haven’t checked out by ${sunsetPlus}, ${OVERDUE_ALERT_TEXT[audience]}.`,
      time: null,
    };
  }
  const time = formatClockTime(new Date(at));
  return {
    text: `If you haven’t checked out by ${time}, ${OVERDUE_ALERT_TEXT[audience]}. That is ${sunsetPlus}.`,
    time,
  };
}
