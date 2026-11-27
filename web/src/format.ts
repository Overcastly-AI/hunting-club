/** "August 1, 2027" from an ISO date. */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

/**
 * A stand's state in one word: open stands are offered at check-in in the app, closed ones are
 * hidden from it (the stand's `active` flag).
 */
export const STAND_STATUS_LABELS = { open: 'Open', closed: 'Closed' } as const;
