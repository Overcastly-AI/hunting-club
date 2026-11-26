/**
 * Domain enums that travel over the mesh.
 *
 * Each enum has a numeric wire code (used in app-port messages) and a stable
 * string key (used in SQLite columns and the club API, e.g. `check_ins.mode`).
 *
 * CheckInMode is defined here (check-ins never reach the cloud). Harvest sex is
 * stored in the club cloud data, so its keys come from @huntclub/shared (the
 * hand-written domain enums); this file only adds the frozen wire codes.
 */
import { HARVEST_SEXES, type HarvestSex as HarvestSexKey } from '@huntclub/shared';

export { HARVEST_SEXES, type HarvestSexKey };

export enum CheckInMode {
  Stand = 1,
  Area = 2,
  Spot = 3,
  Moving = 4,
}

/** Database / JSON keys for CheckInMode (matches `check_ins.mode`). */
export const CHECK_IN_MODE_KEYS = {
  [CheckInMode.Stand]: 'stand',
  [CheckInMode.Area]: 'area',
  [CheckInMode.Spot]: 'spot',
  [CheckInMode.Moving]: 'moving',
} as const satisfies Record<CheckInMode, string>;
export type CheckInModeKey = (typeof CHECK_IN_MODE_KEYS)[CheckInMode];

/**
 * Wire codes for harvest sex, keyed by HARVEST_SEXES from @huntclub/shared.
 * These are protocol values: never renumber or reuse one. `satisfies` makes the
 * typecheck fail if a value is added to or removed from the shared enum without a
 * code here; a unit test pins the numbers.
 */
export const HARVEST_SEX_CODES = {
  unknown: 0,
  male: 1,
  female: 2,
} as const satisfies Record<HarvestSexKey, number>;
/** A harvest-sex wire code (0 = unknown, the omitted default). */
export type HarvestSex = (typeof HARVEST_SEX_CODES)[HarvestSexKey];

/** Inverts a code → key table, so the reverse mapping is derived, never retyped. */
function invert<K extends number, V extends string>(table: Record<K, V>): Record<V, K> {
  return Object.fromEntries(Object.entries(table).map(([k, v]) => [v, Number(k)])) as Record<V, K>;
}

/** Inverts a key → code table (the opposite direction of `invert`). */
function invertCodes<K extends string, V extends number>(table: Record<K, V>): Record<V, K> {
  return Object.fromEntries(Object.entries(table).map(([k, v]) => [v, k])) as Record<V, K>;
}

export const CHECK_IN_MODE_BY_KEY = invert(CHECK_IN_MODE_KEYS);
/** Wire code → database key for harvest sex. */
export const HARVEST_SEX_KEYS = invertCodes(HARVEST_SEX_CODES);

/** Values of a numeric TypeScript enum (skips the reverse-mapping keys). */
export function enumValues<E extends Record<string, string | number>>(e: E): number[] {
  return Object.values(e).filter((v): v is number => typeof v === 'number');
}

/** Spec: text messages are 200 characters max, enforced in the UI. */
export const MAX_TEXT_CHARS = 200;
