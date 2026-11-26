/**
 * Stand types from docs/SPEC.md. These strings match the `stands.type` CHECK
 * constraint in the local database.
 */
export const STAND_TYPES = ['tree_stand', 'ladder', 'ground_blind'] as const;
export type StandType = (typeof STAND_TYPES)[number];

/** Words shown and read aloud for each stand type. */
export const STAND_TYPE_LABELS: Record<StandType, string> = {
  tree_stand: 'Tree stand',
  ladder: 'Ladder stand',
  ground_blind: 'Ground blind',
};
