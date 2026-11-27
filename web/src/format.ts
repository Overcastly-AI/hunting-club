import { localDay } from '@huntclub/shared';

/** "August 1, 2027" from an ISO date. */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

/** The admin's own time zone: harvest days and weeks are local calendar days. */
export const TIME_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;

/** "November 15, 2026" from a calendar day, YYYY-MM-DD (no time zone shift). */
export const formatDay = (day: string) => formatDate(`${day}T00:00:00.000Z`);

/** "November 15, 2026": the admin's local calendar day of an instant (a harvest's date). */
export const formatLocalDay = (iso: string) => formatDay(localDay(iso, TIME_ZONE));
