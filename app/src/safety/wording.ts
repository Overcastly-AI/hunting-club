import type { HelpState, SelfPromptEvent } from '@huntclub/core';
import type { LatLon } from '@huntclub/mesh';

import { formatClockTime } from '../conditions/clock';
import { OVERDUE_ALERT_TEXT, type Audience } from '../domain/audience';
import { distanceAndDirection } from '../map/geo';
import { placeLabel } from '../map/labels';
import type { IncomingAlert } from './alerts';

/**
 * Safety wording. Plain, calm, and never like an emergency call: no "SOS",
 * "emergency" or "911" except in the settings note that tells people to call 911 themselves.
 */

export const ASK_FOR_A_HAND = 'Ask for a Hand';

/** Shown in settings (docs/SPEC.md "Safety"); one source, shared with the Terms. */
export { SAFETY_NOTE } from '@huntclub/shared';

/** "Dale", "Dale and Sam", "Dale, Sam and Joe". */
export function listNames(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

const times = (n: number) => (n === 1 ? 'once' : n === 2 ? 'twice' : `${n} times`);

/** Our own Ask for a Hand, as a title and a detail line. */
export function helpProgress(
  state: HelpState,
  nameOf: (node: number) => string,
  audience: Audience,
): { title: string; detail: string } {
  const seen = listNames(state.acknowledgedBy.map(nameOf));
  const who = audience === 'club' ? 'club members' : 'your party';
  switch (state.status) {
    case 'sending':
      return {
        title: `Asking ${who} for a hand`,
        detail: `Sent ${times(state.attempts)}. It keeps trying until someone sees it.`,
      };
    case 'acknowledged':
      return { title: `Seen by ${seen}`, detail: 'They know where you are.' };
    case 'cancelled':
      return {
        title: 'Stopped asking',
        detail: seen ? `Seen by ${seen}.` : 'Nobody had seen it yet.',
      };
  }
}

/** Title and detail for someone else's help request or overdue alert. */
export function incomingAlertText(
  alert: IncomingAlert,
  me: LatLon | undefined,
): { title: string; detail: string } {
  const title =
    alert.kind === 'help'
      ? `${alert.name} is asking for a hand`
      : `${alert.name} hasn’t checked out`;
  const where = [
    alert.place ? placeLabel(alert.place) : undefined,
    alert.pin && me ? distanceAndDirection(me, alert.pin) : undefined,
  ].filter(Boolean);
  const detail = where.length ? where.join(' · ') : 'Location not known';
  return { title, detail };
}

/** The "Still out?" prompt at our own deadline. */
export function selfPromptText(
  prompt: SelfPromptEvent,
  graceMinutes: number,
  audience: Audience,
): string {
  return `It’s ${graceMinutes} minutes past sunset. If you don’t answer by ${formatClockTime(
    new Date(prompt.alertAt),
  )}, ${OVERDUE_ALERT_TEXT[audience]}.`;
}
