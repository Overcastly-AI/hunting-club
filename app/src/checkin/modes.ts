import { CLUB_ONLY_MODES } from '@huntclub/core';
import { CheckInMode } from '@huntclub/mesh';

import { ON_THE_MOVE } from '../map/labels';

export type CheckInChoice = {
  mode: CheckInMode;
  /** Big button label. */
  label: string;
  /** Second line under it. */
  detail: string;
};

/**
 * The modes on the Check In screen, in the design's order (docs/DESIGN.md, Check In): At a stand,
 * In an area, Right here, On the move. Stands are optional: free parties get the last two.
 */
const ALL_CHOICES: readonly CheckInChoice[] = [
  { mode: CheckInMode.Stand, label: 'At a stand', detail: 'One of the club’s stands' },
  { mode: CheckInMode.Area, label: 'In an area', detail: 'A named club area' },
  {
    mode: CheckInMode.Spot,
    label: 'Right here',
    detail: 'Sitting at a spot. Give it a name if you like.',
  },
  { mode: CheckInMode.Moving, label: ON_THE_MOVE, detail: 'Walking, stalking or on a drive' },
];

/** Choices for this hunter: club-only modes (core's CLUB_ONLY_MODES) are hidden for free users. */
export function checkInChoices(club: boolean): readonly CheckInChoice[] {
  return club
    ? ALL_CHOICES
    : ALL_CHOICES.filter((choice) => !CLUB_ONLY_MODES.includes(choice.mode));
}
