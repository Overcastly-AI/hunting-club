/**
 * Position freshness from docs/SPEC.md, "Mesh protocol" rules: solid ring
 * under 2 min, dashed between 2 and 10 min, faded after that. These are the
 * only definitions of those thresholds (the map, the board and mesh-down
 * warnings all use them).
 */
import { MINUTE_MS } from './config';

export const FRESHNESS_THRESHOLDS_MS = {
  /** Below this a position is fresh (solid ring). */
  fresh: 2 * MINUTE_MS,
  /** Below this (and not fresh) a position is stale (dashed ring); older is faded. */
  stale: 10 * MINUTE_MS,
} as const;

export type Freshness = 'fresh' | 'stale' | 'faded';

/** Age of a position in ms; a timestamp from the future counts as just heard. */
export function positionAge(heardAt: number, now: number): number {
  return Math.max(0, now - heardAt);
}

export function classifyFreshness(ageMs: number): Freshness {
  if (ageMs < FRESHNESS_THRESHOLDS_MS.fresh) return 'fresh';
  if (ageMs < FRESHNESS_THRESHOLDS_MS.stale) return 'stale';
  return 'faded';
}
