/**
 * Domain enums that travel over the mesh. This is their single source of
 * truth: the app's database and UI import these instead of retyping them.
 *
 * Each enum has a numeric wire code (used in app-port messages) and a stable
 * string key (used in SQLite / Supabase columns, e.g. `check_ins.mode`).
 */

export enum CheckInMode {
  Stand = 1,
  Area = 2,
  Spot = 3,
  Moving = 4,
}

export enum HarvestSex {
  Unknown = 0,
  Male = 1,
  Female = 2,
}

/** Database / JSON keys for CheckInMode (matches `check_ins.mode`). */
export const CHECK_IN_MODE_KEYS = {
  [CheckInMode.Stand]: 'stand',
  [CheckInMode.Area]: 'area',
  [CheckInMode.Spot]: 'spot',
  [CheckInMode.Moving]: 'moving',
} as const satisfies Record<CheckInMode, string>;
export type CheckInModeKey = (typeof CHECK_IN_MODE_KEYS)[CheckInMode];

/** Database / JSON keys for HarvestSex. */
export const HARVEST_SEX_KEYS = {
  [HarvestSex.Unknown]: 'unknown',
  [HarvestSex.Male]: 'male',
  [HarvestSex.Female]: 'female',
} as const satisfies Record<HarvestSex, string>;
export type HarvestSexKey = (typeof HARVEST_SEX_KEYS)[HarvestSex];

/** Inverts a code → key table, so the reverse mapping is derived, never retyped. */
function invert<K extends number, V extends string>(table: Record<K, V>): Record<V, K> {
  return Object.fromEntries(Object.entries(table).map(([k, v]) => [v, Number(k)])) as Record<V, K>;
}

export const CHECK_IN_MODE_BY_KEY = invert(CHECK_IN_MODE_KEYS);
export const HARVEST_SEX_BY_KEY = invert(HARVEST_SEX_KEYS);

/** Values of a numeric TypeScript enum (skips the reverse-mapping keys). */
export function enumValues<E extends Record<string, string | number>>(e: E): number[] {
  return Object.values(e).filter((v): v is number => typeof v === 'number');
}

/** Spec: text messages are 200 characters max, enforced in the UI. */
export const MAX_TEXT_CHARS = 200;
