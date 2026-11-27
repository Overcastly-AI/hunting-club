import { STAND_STATUS_LABELS } from '@huntclub/shared';
import { Badge } from './ui';

/**
 * A stand's check-in status as a badge: "Available" (offered at check-in in the app) or "Closed"
 * (hidden from it; the stand's `active` flag). One drawing for the stands table and the map.
 */
export function StandStatus(props: { active: boolean }) {
  return props.active ? (
    <Badge tone="success">{STAND_STATUS_LABELS.open}</Badge>
  ) : (
    <Badge tone="neutral">{STAND_STATUS_LABELS.closed}</Badge>
  );
}
