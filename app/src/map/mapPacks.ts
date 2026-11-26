import type { SqlDatabase } from '../db/types';
import type { Bounds } from './tiles';

export const MAP_PACK_STATUSES = ['downloading', 'complete', 'failed'] as const;
export type MapPackStatus = (typeof MAP_PACK_STATUSES)[number];

/** A downloaded (or downloading) map area, from the `map_packs` table. */
export type MapPack = {
  /** The MapLibre offline pack ID. */
  id: string;
  name: string;
  bounds: Bounds;
  minZoom: number;
  maxZoom: number;
  /** Basemap source, for example "usgs-topo". */
  source: string;
  sizeBytes: number | null;
  tileCount: number | null;
  status: MapPackStatus;
  createdAt: number;
  downloadedAt: number | null;
};

type MapPackRow = {
  id: string;
  name: string;
  bounds: string;
  min_zoom: number;
  max_zoom: number;
  source: string;
  size_bytes: number | null;
  tile_count: number | null;
  status: MapPackStatus;
  created_at: number;
  downloaded_at: number | null;
};

function fromRow(row: MapPackRow): MapPack {
  return {
    id: row.id,
    name: row.name,
    bounds: JSON.parse(row.bounds) as Bounds,
    minZoom: row.min_zoom,
    maxZoom: row.max_zoom,
    source: row.source,
    sizeBytes: row.size_bytes,
    tileCount: row.tile_count,
    status: row.status,
    createdAt: row.created_at,
    downloadedAt: row.downloaded_at,
  };
}

export async function insertMapPack(db: SqlDatabase, pack: MapPack): Promise<void> {
  await db.runAsync(
    `INSERT INTO map_packs
       (id, name, bounds, min_zoom, max_zoom, source, size_bytes, tile_count, status, created_at, downloaded_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    pack.id,
    pack.name,
    JSON.stringify(pack.bounds),
    pack.minZoom,
    pack.maxZoom,
    pack.source,
    pack.sizeBytes,
    pack.tileCount,
    pack.status,
    pack.createdAt,
    pack.downloadedAt,
  );
}

export type MapPackProgress = Pick<MapPack, 'status' | 'sizeBytes' | 'tileCount' | 'downloadedAt'>;

export async function updateMapPackProgress(
  db: SqlDatabase,
  id: string,
  progress: MapPackProgress,
): Promise<void> {
  await db.runAsync(
    `UPDATE map_packs SET status = ?, size_bytes = ?, tile_count = ?, downloaded_at = ? WHERE id = ?`,
    progress.status,
    progress.sizeBytes,
    progress.tileCount,
    progress.downloadedAt,
    id,
  );
}

/** Newest first. */
export async function listMapPacks(db: SqlDatabase): Promise<MapPack[]> {
  const rows = await db.getAllAsync<MapPackRow>(
    `SELECT id, name, bounds, min_zoom, max_zoom, source, size_bytes, tile_count, status, created_at, downloaded_at
     FROM map_packs ORDER BY created_at DESC, id`,
  );
  return rows.map(fromRow);
}

export async function deleteMapPack(db: SqlDatabase, id: string): Promise<void> {
  await db.runAsync(`DELETE FROM map_packs WHERE id = ?`, id);
}
