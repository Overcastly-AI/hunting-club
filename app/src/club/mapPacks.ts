/**
 * Club map packs on this phone (Milestone 12): the newest ready PMTiles archive
 * per club and tile source, downloaded while online and used by the map offline.
 * The files live in the app's documents folder; this table says which is which.
 */
import {
  type Bounds,
  type ClubApiClient,
  type MapPack,
  mapPackUrl,
  type WEB_DOMAINS,
} from '@huntclub/shared';

import type { SqlDatabase } from '../db/types';

/** A club map pack saved on this phone. */
export type LocalClubMapPack = {
  clubId: string;
  /** Tile source (BASEMAPS[...].source), e.g. "usgs-topo". */
  source: string;
  packId: string;
  bounds: Bounds;
  minZoom: number;
  maxZoom: number;
  sizeBytes: number;
  /** When the club's builder made it (ISO). */
  builtAt: string;
  /** file:// URI of the archive. */
  localUri: string;
  downloadedAt: number;
};

/** How the club sync fetches map packs: where the files go, and which cloud serves them. */
export type MapPackSync = { files: MapPackFiles; env: keyof typeof WEB_DOMAINS };

/** Saves archives to and removes them from the phone (expo-file-system in the app). */
export type MapPackFiles = {
  /** Downloads `url` as pack `packId`; resolves with the file:// URI once it is complete. */
  download(url: string, packId: string): Promise<string>;
  remove(localUri: string): Promise<void>;
};

type ReadyPack = Extract<MapPack, { status: 'ready' }>;

type Row = {
  club_id: string;
  source: string;
  pack_id: string;
  bounds: string;
  min_zoom: number;
  max_zoom: number;
  size_bytes: number;
  built_at: string;
  local_uri: string;
  downloaded_at: number;
};

const fromRow = (r: Row): LocalClubMapPack => ({
  clubId: r.club_id,
  source: r.source,
  packId: r.pack_id,
  bounds: JSON.parse(r.bounds) as Bounds,
  minZoom: r.min_zoom,
  maxZoom: r.max_zoom,
  sizeBytes: r.size_bytes,
  builtAt: r.built_at,
  localUri: r.local_uri,
  downloadedAt: r.downloaded_at,
});

export async function loadClubMapPacks(db: SqlDatabase): Promise<LocalClubMapPack[]> {
  const rows = await db.getAllAsync<Row>('SELECT * FROM club_map_packs ORDER BY club_id, source');
  return rows.map(fromRow);
}

/** The newest ready pack for each tile source. */
function newestReady(packs: readonly MapPack[]): ReadyPack[] {
  const bySource = new Map<string, ReadyPack>();
  for (const pack of packs) {
    if (pack.status !== 'ready') continue;
    const best = bySource.get(pack.source);
    if (!best || pack.builtAt > best.builtAt) bySource.set(pack.source, pack);
  }
  return [...bySource.values()];
}

/**
 * Brings this phone's copy of one club's map packs up to date: downloads the
 * newest ready pack per source when it is new or rebuilt, then removes the file
 * it replaces. Needs internet and a signed-in member; a pack that fails to
 * download keeps the one already on the phone and is tried again next sync.
 */
export async function syncClubMapPacks(
  db: SqlDatabase,
  api: ClubApiClient,
  files: MapPackFiles,
  env: keyof typeof WEB_DOMAINS,
  clubId: string,
  now: number,
): Promise<{ downloaded: string[]; failed: { packId: string; error: unknown }[] }> {
  const have = new Map(
    (await loadClubMapPacks(db))
      .filter((p) => p.clubId === clubId)
      .map((p) => [p.source, p] as const),
  );
  const downloaded: string[] = [];
  const failed: { packId: string; error: unknown }[] = [];
  for (const pack of newestReady(await api.listMapPacks(clubId))) {
    const old = have.get(pack.source);
    if (old && old.packId === pack.id && old.builtAt === pack.builtAt) continue;
    let localUri: string;
    try {
      localUri = await files.download(mapPackUrl(env, pack), pack.id);
    } catch (error) {
      failed.push({ packId: pack.id, error });
      continue;
    }
    await db.runAsync(
      `INSERT INTO club_map_packs (club_id, source, pack_id, bounds, min_zoom, max_zoom,
         size_bytes, built_at, local_uri, downloaded_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (club_id, source) DO UPDATE SET pack_id = excluded.pack_id,
         bounds = excluded.bounds, min_zoom = excluded.min_zoom, max_zoom = excluded.max_zoom,
         size_bytes = excluded.size_bytes, built_at = excluded.built_at,
         local_uri = excluded.local_uri, downloaded_at = excluded.downloaded_at`,
      clubId,
      pack.source,
      pack.id,
      JSON.stringify(pack.bounds),
      pack.minZoom,
      pack.maxZoom,
      pack.sizeBytes,
      pack.builtAt,
      localUri,
      now,
    );
    if (old && old.localUri !== localUri) await files.remove(old.localUri).catch(() => undefined);
    downloaded.push(pack.id);
  }
  return { downloaded, failed };
}
