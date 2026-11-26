import {
  OfflineManager,
  type OfflinePack,
  type OfflinePackStatus,
} from '@maplibre/maplibre-react-native';

import type { SqlDatabase } from '../db/types';
import { writeDocument } from '../storage/documents';
import { BASEMAPS, basemapBySource, basemapStyle, type BasemapId } from './basemaps';
import {
  deleteMapPack,
  insertMapPack,
  listMapPacks,
  updateMapPackProgress,
  type MapPack,
  type MapPackProgress,
} from './mapPacks';
import { DOWNLOAD_LIMITS, type Bounds, type DetailLevel } from './tiles';

/**
 * Offline map downloads with MapLibre's offline pack manager. Tiles come
 * straight from USGS; nothing goes through our backend.
 *
 * MapLibre's offline packs need a style URL, so each basemap's style is
 * written to the app's documents folder and referenced by file:// URL. The
 * live map uses the same style object, so its tile URLs hit the downloaded tiles.
 */
const STYLE_FOLDER = 'map-styles';

let configured = false;
function configure() {
  if (configured) return;
  OfflineManager.setTileCountLimit(DOWNLOAD_LIMITS.maxTiles);
  configured = true;
}

function offlineStyleUrl(basemap: BasemapId): Promise<string> {
  return writeDocument(
    STYLE_FOLDER,
    `${BASEMAPS[basemap].source}.json`,
    JSON.stringify(basemapStyle(basemap)),
  );
}

export type DownloadProgress = {
  packId: string;
  basemap: BasemapId;
  percentage: number;
  done: boolean;
  failed: boolean;
};

const FAILED: MapPackProgress = {
  status: 'failed',
  sizeBytes: null,
  tileCount: null,
  downloadedAt: null,
};

function progressFromStatus(status: OfflinePackStatus): MapPackProgress {
  const complete = status.state === 'complete';
  return {
    status: complete ? 'complete' : 'downloading',
    sizeBytes: status.completedResourceSize,
    tileCount: status.completedTileCount,
    downloadedAt: complete ? Date.now() : null,
  };
}

/**
 * Listeners that keep a pack's row up to date. They wait for `ready` (the row
 * being inserted) so an early event can never update a row that isn't there yet.
 */
function watchPack(
  db: SqlDatabase,
  basemap: BasemapId,
  ready: Promise<unknown>,
  onProgress?: (progress: DownloadProgress) => void,
) {
  const progress = async (pack: OfflinePack, status: OfflinePackStatus) => {
    await ready;
    const done = status.state === 'complete';
    onProgress?.({ packId: pack.id, basemap, percentage: status.percentage, done, failed: false });
    if (done) await updateMapPackProgress(db, pack.id, progressFromStatus(status));
  };
  const error = async (pack: OfflinePack) => {
    await ready;
    onProgress?.({ packId: pack.id, basemap, percentage: 0, done: true, failed: true });
    await updateMapPackProgress(db, pack.id, FAILED);
  };
  return {
    progress: (pack: OfflinePack, status: OfflinePackStatus) => void progress(pack, status),
    error: (pack: OfflinePack) => void error(pack),
  };
}

export type DownloadRequest = {
  name: string;
  bounds: Bounds;
  level: Pick<DetailLevel, 'minZoom' | 'maxZoom'>;
  basemaps: readonly BasemapId[];
};

/** Starts one offline pack per basemap layer and records each in `map_packs`. */
export async function startDownload(
  db: SqlDatabase,
  request: DownloadRequest,
  onProgress?: (progress: DownloadProgress) => void,
): Promise<string[]> {
  configure();
  const ids: string[] = [];
  for (const basemap of request.basemaps) {
    let markReady: () => void = () => undefined;
    const ready = new Promise<void>((resolve) => (markReady = resolve));
    const listeners = watchPack(db, basemap, ready, onProgress);
    const pack = await OfflineManager.createPack(
      {
        mapStyle: await offlineStyleUrl(basemap),
        bounds: request.bounds,
        minZoom: request.level.minZoom,
        maxZoom: request.level.maxZoom,
        metadata: { name: request.name, source: BASEMAPS[basemap].source },
      },
      listeners.progress,
      listeners.error,
    );
    const row: MapPack = {
      id: pack.id,
      name: request.name,
      bounds: request.bounds,
      minZoom: request.level.minZoom,
      maxZoom: request.level.maxZoom,
      source: BASEMAPS[basemap].source,
      sizeBytes: null,
      tileCount: null,
      status: 'downloading',
      createdAt: Date.now(),
      downloadedAt: null,
    };
    await insertMapPack(db, row);
    markReady();
    ids.push(pack.id);
  }
  return ids;
}

/** Removes the downloaded tiles and the row. */
export async function deleteDownload(db: SqlDatabase, packId: string): Promise<void> {
  try {
    await OfflineManager.deletePack(packId);
  } catch {
    // Already gone from MapLibre's store; still remove our row.
  }
  await deleteMapPack(db, packId);
}

/**
 * After a restart, picks up downloads that were still running: finished ones
 * are marked complete, unfinished ones resume, and ones MapLibre no longer
 * knows about are marked failed.
 */
export async function resumeDownloads(
  db: SqlDatabase,
  onProgress?: (progress: DownloadProgress) => void,
): Promise<void> {
  configure();
  const downloading = (await listMapPacks(db)).filter((pack) => pack.status === 'downloading');
  for (const row of downloading) {
    const basemap = basemapBySource(row.source)?.id;
    let pack: OfflinePack;
    try {
      pack = await OfflineManager.getPack(row.id);
    } catch {
      await updateMapPackProgress(db, row.id, FAILED);
      continue;
    }
    const status = await pack.status();
    if (status.state === 'complete' || !basemap) {
      await updateMapPackProgress(db, row.id, progressFromStatus(status));
      continue;
    }
    const listeners = watchPack(db, basemap, Promise.resolve(), onProgress);
    await OfflineManager.addListener(row.id, listeners.progress, listeners.error);
    await pack.resume();
  }
}
