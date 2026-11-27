import { SUN, overdueAt } from '@huntclub/core';
import type { LatLon } from '@huntclub/mesh';

import { formatClockTime } from '@huntclub/shared';
import { OVERDUE_ALERT_TEXT, type Audience } from '../domain/audience';

/**
 * The plain note under the check-in choices: when an overdue alert would go
 * out (sunset plus the grace time, from core). Never legal shooting hours.
 */
export function overdueNote(
  checkedInAt: number,
  place: LatLon | undefined,
  graceMinutes: number,
  audience: Audience,
): string {
  const at = place ? overdueAt(checkedInAt, place, graceMinutes, SUN) : undefined;
  const when = at
    ? `by ${formatClockTime(new Date(at))} (${graceMinutes} min after sunset)`
    : `${graceMinutes} minutes after sunset`;
  return `If you haven’t checked out ${when}, ${OVERDUE_ALERT_TEXT[audience]}.`;
}
