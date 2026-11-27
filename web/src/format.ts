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
 * A stand's state: open stands are offered at check-in in the app ("Available"), closed ones
 * are hidden from it (the stand's `active` flag). Who sits in a stand travels only over the
 * mesh, never to the club service, so the web never knows it and never says "In use by".
 */
export const STAND_STATUS_LABELS = { open: 'Available', closed: 'Closed' } as const;
