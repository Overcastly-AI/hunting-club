// Tile maths and download limits live in @huntclub/shared (one source with the club
// map-pack builder); this file adds the app's download choices and wording.
import { DOWNLOAD_LIMITS, estimatePack, type BasemapId, type Bounds } from '@huntclub/shared';

export { DOWNLOAD_LIMITS, countTiles, tileXY, type Bounds } from '@huntclub/shared';

export type DetailLevel = { id: string; label: string; minZoom: number; maxZoom: number };

/** Zoom ranges offered when downloading, least to most detail. */
export const DETAIL_LEVELS: readonly DetailLevel[] = [
  { id: 'overview', label: 'Roads and creeks', minZoom: DOWNLOAD_LIMITS.minZoom, maxZoom: 12 },
  { id: 'standard', label: 'Trails and clearings', minZoom: DOWNLOAD_LIMITS.minZoom, maxZoom: 14 },
  {
    id: 'full',
    label: 'Most detail',
    minZoom: DOWNLOAD_LIMITS.minZoom,
    maxZoom: DOWNLOAD_LIMITS.maxZoom,
  },
];

export type DownloadEstimate = ReturnType<typeof estimatePack>;

/** Size estimate for downloading one basemap layer (the shared rule club packs use too). */
export function estimateDownload(
  bounds: Bounds,
  level: Pick<DetailLevel, 'minZoom' | 'maxZoom'>,
  basemap: BasemapId,
): DownloadEstimate {
  return estimatePack(bounds, level.minZoom, level.maxZoom, basemap);
}

/** Size such as "12 MB" or "800 KB". */
export function formatBytes(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  if (mb >= 10) return `${Math.round(mb)} MB`;
  if (mb >= 1) return `${mb.toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
