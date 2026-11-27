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
  ok: 'fresh',
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

/** The mesh status in two lines (`title` over `detail`) and as one sentence (`text`). */
export type MeshStatusText = {
  /** "Mesh: 3 radios": the first line of the top plate's mesh cell. */
  title: string;
  /** "heard 12s ago": its second line; null when there is nothing more to say. */
  detail: string | null;
  /** Both lines as one sentence, "Mesh: 3 radios, heard 12s ago" (spoken, and the board). */
  text: string;
  tone: MeshTone;
};

const worded = (title: string, tone: MeshTone, detail: string | null = null): MeshStatusText => ({
  title,
  detail,
  text: detail ? `${title}, ${detail}` : title,
  tone,
});

/** The mesh status, for example "Mesh: 3 radios" over "heard 12s ago". */
export function describeMeshStatus(mesh: MeshStatus, now: number): MeshStatusText {
  if (!mesh.radioConnected) return worded('No radio connected', 'none');
  if (mesh.lastHeardAt === null) return worded('Mesh: no radios heard yet', 'quiet');
  const heard = describeFreshness(mesh.lastHeardAt, now, 'heard');
  // A last-heard time ahead of the phone's clock can't be trusted as live.
  if (heard.ageMs === null) return worded('Mesh: last heard time unknown', 'quiet');
  if (heard.ageMs >= MESH_QUIET_AFTER_MS)
    return worded(`No radios heard for ${formatDuration(heard.ageMs).short}`, 'quiet');
  return worded(`Mesh: ${pluralize(mesh.radioCount, 'radio')}`, 'ok', heard.short);
}
