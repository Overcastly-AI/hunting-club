import { MINUTE_MS } from '../domain/time';

/**
 * Position freshness from docs/SPEC.md, "Mesh protocol" rules: solid ring
 * under 2 min, dashed between 2 and 10 min, faded after that. These are the
 * only definitions of those thresholds.
 */
export const FRESHNESS_THRESHOLDS_MS = {
  /** Below this a position is fresh (solid ring). */
  fresh: 2 * MINUTE_MS,
  /** Below this (and not fresh) a position is stale (dashed ring); older is faded. */
  stale: 10 * MINUTE_MS,
} as const;

export type Freshness = 'fresh' | 'stale' | 'faded';

export function classifyFreshness(ageMs: number): Freshness {
  if (ageMs < FRESHNESS_THRESHOLDS_MS.fresh) return 'fresh';
  if (ageMs < FRESHNESS_THRESHOLDS_MS.stale) return 'stale';
  return 'faded';
}
