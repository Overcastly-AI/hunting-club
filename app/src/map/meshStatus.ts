import {
  FRESHNESS_THRESHOLDS_MS,
  describeFreshness,
  formatDuration,
  pluralize,
} from '@huntclub/shared';

import type { ThemeColorToken } from '../theme';
import type { MeshStatus } from './types';

export type MeshTone = 'ok' | 'quiet' | 'none';

/** Status dot colour token for each tone: green when heard, gold when quiet, grey with no radio. */
export const MESH_TONE_COLOR: Record<MeshTone, ThemeColorToken> = {
  ok: 'success',
  quiet: 'warning',
  none: 'textSecondary',
};

/** Second line of the mesh-down banner: nothing on the map is live. */
export const MESH_QUIET_DETAIL =
  'Hunters on the map are where they were last heard, not where they are now.';

/**
 * The mesh counts as quiet once no radio has been heard for as long as a
 * position takes to fade: nothing on the map can be trusted as live then.
 */
export const MESH_QUIET_AFTER_MS = FRESHNESS_THRESHOLDS_MS.stale;

/** The mesh status line, for example "Mesh: 3 radios · heard 12s ago". */
export function describeMeshStatus(
  status: MeshStatus,
  now: number,
): { text: string; tone: MeshTone } {
  if (!status.radioConnected) return { text: 'No radio connected', tone: 'none' };
  if (status.lastHeardAt === null) return { text: 'Mesh: no radios heard yet', tone: 'quiet' };
  const heard = describeFreshness(status.lastHeardAt, now, 'heard');
  // A last-heard time ahead of the phone's clock can't be trusted as live.
  if (heard.ageMs === null) return { text: 'Mesh: last heard time unknown', tone: 'quiet' };
  if (heard.ageMs >= MESH_QUIET_AFTER_MS)
    return { text: `No radios heard for ${formatDuration(heard.ageMs).short}`, tone: 'quiet' };
  return { text: `Mesh: ${pluralize(status.radioCount, 'radio')} · ${heard.short}`, tone: 'ok' };
}
