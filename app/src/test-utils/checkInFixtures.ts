import type { CheckInRadio } from '../checkin/CheckInRadio';
import type { ClubStand } from '../checkin/placement';

/** Where the phone is in the Check In tests. */
export const CHECK_IN_HERE = { lat: 46, lon: -94 };

/** Three club stands north of CHECK_IN_HERE: Oak Ridge nearest, Creek Stand taken, Pond Box farthest. */
export const CLUB_STANDS: readonly ClubStand[] = [
  { meshId: 2, name: 'Pond Box', type: 'ground_blind', position: { lat: 46.005, lon: -94 } },
  {
    meshId: 3,
    name: 'Creek Stand',
    type: 'ladder',
    position: { lat: 46.002, lon: -94 },
    occupiedBy: 'Dale B.',
  },
  { meshId: 1, name: 'Oak Ridge', type: 'ladder', position: { lat: 46.003, lon: -94 } },
];

/**
 * A radio for the Check In tab with nobody checked in: a club member's (stands and an area)
 * or a free party's. `checkIn` is a mock so tests can see what was sent.
 */
export function checkInRadio(audience: 'club' | 'party'): CheckInRadio {
  return {
    audience,
    graceMinutes: 30,
    checkIns: {
      current: null,
      on: () => () => undefined,
      checkIn: jest.fn(() => ({ result: new Promise(() => undefined) })),
    },
    ...(audience === 'club'
      ? { club: { stands: CLUB_STANDS, areas: [{ meshId: 9, name: 'North 40' }] } }
      : {}),
  } as unknown as CheckInRadio;
}
