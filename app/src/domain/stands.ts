import type { StandType } from '@huntclub/shared';

/** Words shown and read aloud for each stand type (types come from the SQL enum via @huntclub/shared). */
export const STAND_TYPE_LABELS: Record<StandType, string> = {
  tree_stand: 'Tree stand',
  ladder: 'Ladder stand',
  ground_blind: 'Ground blind',
};
