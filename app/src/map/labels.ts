import { STAND_TYPE_LABELS } from '../domain/stands';
import { describeAge, positionAge, classifyFreshness } from './freshness';
import type { HunterOnMap, HunterPlace, OpenStandOnMap } from './types';

/** Shown under a hunter who is walking. */
export const ON_THE_MOVE = 'On the move';
/** Shown under a hunter at an unnamed spot. */
export const UNNAMED_SPOT = 'Spot';
/** Shown under a club stand nobody is in. */
export const OPEN_STAND = 'Open';
/** Label beside your scent cone. */
export const YOUR_SCENT = 'Your scent';

/** The stand, spot or area name, or "On the move" (with the area if inside one). */
export function placeLabel(place: HunterPlace): string {
  switch (place.kind) {
    case 'stand':
    case 'area':
      return place.name;
    case 'spot':
      return place.name ?? UNNAMED_SPOT;
    case 'moving':
      return place.areaName ? `${ON_THE_MOVE} · ${place.areaName}` : ON_THE_MOVE;
  }
}

/** Screen-reader label, for example "Creek Stand, Dale, updated 2 minutes ago". */
export function hunterAccessibilityLabel(hunter: HunterOnMap, now: number): string {
  const age = positionAge(hunter.heardAt, now);
  const parts = [
    placeLabel(hunter.place),
    hunter.displayName,
    `updated ${describeAge(age).spoken}`,
  ];
  if (classifyFreshness(age) === 'faded') parts.push('last known position');
  return parts.join(', ');
}

/** Screen-reader label, for example "Ridge Stand, ladder stand, open". */
export function openStandAccessibilityLabel(stand: OpenStandOnMap): string {
  return `${stand.name}, ${STAND_TYPE_LABELS[stand.type].toLowerCase()}, ${OPEN_STAND.toLowerCase()}`;
}

/** Screen-reader label for your own marker. */
export function yourAccessibilityLabel(scentShown: boolean): string {
  return scentShown ? `You are here. ${YOUR_SCENT} drifts downwind` : 'You are here';
}
