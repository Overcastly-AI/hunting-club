import { FRESHNESS_THRESHOLDS_MS, positionAge } from '@huntclub/core';

import type { MeshStatus } from './types';

export type MeshTone = 'ok' | 'quiet' | 'none';

/** Second line of the mesh-down banner: nothing on the map is live. */
export const MESH_QUIET_DETAIL =
  'Hunters on the map are where they were last heard, not where they are now.';

/**
 * The mesh counts as quiet once no radio has been heard for as long as a
 * position takes to fade: nothing on the map can be trusted as live then.
 */
export const MESH_QUIET_AFTER_MS = FRESHNESS_THRESHOLDS_MS.stale;

function shortDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} hr`;
}

/** The mesh status line, for example "Mesh: 3 radios · heard 12s ago". */
export function describeMeshStatus(
  status: MeshStatus,
  now: number,
): { text: string; tone: MeshTone } {
  if (!status.radioConnected) return { text: 'No radio connected', tone: 'none' };
  if (status.lastHeardAt === null) return { text: 'Mesh: no radios heard yet', tone: 'quiet' };
  const age = positionAge(status.lastHeardAt, now);
  if (age >= MESH_QUIET_AFTER_MS)
    return { text: `No radios heard for ${shortDuration(age)}`, tone: 'quiet' };
  const radios = `${status.radioCount} radio${status.radioCount === 1 ? '' : 's'}`;
  return { text: `Mesh: ${radios} · heard ${shortDuration(age)} ago`, tone: 'ok' };
}
