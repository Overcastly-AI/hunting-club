/**
 * Check-in modes from docs/SPEC.md, "Ways to hunt". These strings match the
 * `check_ins.mode` CHECK constraint in the local database.
 */
export const CHECK_IN_MODES = ['stand', 'area', 'spot', 'moving'] as const;
export type CheckInMode = (typeof CHECK_IN_MODES)[number];
