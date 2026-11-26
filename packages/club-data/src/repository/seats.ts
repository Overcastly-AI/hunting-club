/**
 * Seat counters on the club item. `seats` counts admins + members (guests never
 * count toward the plan's member limit); `admins` counts admins (a club keeps at
 * least one). Every roster write updates them in the same transaction as the
 * member item, with conditions that enforce both rules.
 */
import type { MemberRole } from '@huntclub/shared';
import type { TxItem } from '../db';
import { keys } from '../items';

export const SEAT_ATTRS = { seats: 'seats', admins: 'admins' } as const;

const counts = (role: MemberRole) => ({
  seats: role === 'guest' ? 0 : 1,
  admins: role === 'admin' ? 1 : 0,
});

export const initialSeats = (role: MemberRole) => counts(role);

/**
 * The club-item update for a role change (`from` undefined = joining, `to`
 * undefined = leaving), or undefined when the counters don't change. Removing an
 * admin requires another admin to remain; `seatLimit` caps seats when adding one.
 */
export function seatChange(
  clubId: string,
  change: { from?: MemberRole; to?: MemberRole; seatLimit?: number },
): TxItem | undefined {
  const before = change.from ? counts(change.from) : { seats: 0, admins: 0 };
  const after = change.to ? counts(change.to) : { seats: 0, admins: 0 };
  const dSeats = after.seats - before.seats;
  const dAdmins = after.admins - before.admins;
  if (dSeats === 0 && dAdmins === 0) return undefined;
  const conditions = ['attribute_exists(#seats)'];
  const values: Record<string, number> = { ':dSeats': dSeats, ':dAdmins': dAdmins };
  if (dAdmins < 0) {
    conditions.push('#admins > :one');
    values[':one'] = 1;
  }
  if (dSeats > 0 && change.seatLimit !== undefined) {
    conditions.push('#seats < :seatLimit');
    values[':seatLimit'] = change.seatLimit;
  }
  return {
    update: keys.club(clubId),
    set: 'SET #seats = #seats + :dSeats, #admins = #admins + :dAdmins',
    condition: conditions.join(' AND '),
    names: { '#seats': SEAT_ATTRS.seats, '#admins': SEAT_ATTRS.admins },
    values,
  };
}
