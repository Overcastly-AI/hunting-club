/**
 * Club map packs (Milestone 12): an on-demand Lambda builds one PMTiles archive of the
 * club's property for one basemap, from the same USGS tiles the app uses
 * (@huntclub/shared maps), and records it as the club's map pack. Admins start it
 * through POST /clubs/:clubId/map-packs; nothing runs on a schedule.
 */
import { type ClubData, SERVICE } from '@huntclub/club-data';
import { TILE_TYPE, type Tile, writePmtiles } from '@huntclub/pmtiles';
import {
  BASEMAPS,
  MAP_PACK_LIMITS,
  TILE_FETCH_POLICY,
  type MapPack,
  type MapPackBuild,
  MapPackBuildSchema,
  estimatePack,
  mapPackKey,
  tileUrl,
  tilesInBounds,
} from '@huntclub/shared';

/** A failure whose message is safe to show admins as the pack's reason. */
export class MapPackBuildError extends Error {}

/** Shown when a build fails for a reason we did not anticipate (details stay in logs). */
const UNEXPECTED = 'the build failed; try again later';

/** Fetches one tile; null when the service has no tile there (404). */
export type TileFetcher = (url: string) => Promise<Uint8Array | null>;

export interface PoliteFetchOptions {
  fetch: (
    url: string,
    init: { headers: Record<string, string> },
  ) => Promise<{
    status: number;
    arrayBuffer(): Promise<ArrayBuffer>;
  }>;
  /** Identifies us to USGS (no personal data). */
  userAgent: string;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
}

/** A fetcher that keeps to TILE_FETCH_POLICY's rate and retries transient failures. */
export function politeTileFetcher(options: PoliteFetchOptions): TileFetcher {
  const sleep = options.sleep ?? ((ms) => new Promise<void>((r) => setTimeout(r, ms)));
  const now = options.now ?? Date.now;
  const spacing = 1000 / TILE_FETCH_POLICY.perSecond;
  let nextStart = 0;
  const waitTurn = async () => {
    const at = Math.max(now(), nextStart);
    nextStart = at + spacing;
    if (at > now()) await sleep(at - now());
  };
  return async (url) => {
    for (let attempt = 0; ; attempt++) {
      await waitTurn();
      let status = 0;
      try {
        const res = await options.fetch(url, { headers: { 'user-agent': options.userAgent } });
        status = res.status;
        if (status === 200) return new Uint8Array(await res.arrayBuffer());
        if (status === 404) return null;
      } catch {
        status = 0; // network error: retry
      }
      const transient = status === 0 || status === 429 || status >= 500;
      if (!transient || attempt >= TILE_FETCH_POLICY.retries) {
        throw new MapPackBuildError(`USGS tiles could not be fetched (${status || 'network'})`);
      }
      await sleep(TILE_FETCH_POLICY.backoffMs * 2 ** attempt);
    }
  };
}

/** Runs `work` over items with at most `limit` in flight. */
async function pool<T, R>(
  items: Iterable<T>,
  limit: number,
  work: (item: T) => Promise<R>,
): Promise<R[]> {
  const queue = [...items];
  const results: R[] = [];
  const runners = Array.from({ length: Math.min(limit, queue.length) }, async () => {
    for (let item = queue.shift(); item !== undefined; item = queue.shift())
      results.push(await work(item));
  });
  await Promise.all(runners);
  return results;
}

export interface MapPackBuilderDeps {
  data: ClubData;
  fetchTile: TileFetcher;
  /** Stores the archive (S3, under packs/). */
  putObject: (key: string, body: Buffer) => Promise<void>;
  now?: () => Date;
}

/**
 * Builds, uploads and records one club map pack. Any failure marks the pack failed
 * (which frees the club for the next build) and is rethrown for the Lambda's logs.
 */
export async function buildMapPack(input: unknown, deps: MapPackBuilderDeps): Promise<MapPack> {
  const build: MapPackBuild = MapPackBuildSchema.parse(input);
  try {
    const sizeBytes = await buildArchive(build, deps);
    const builtAt = (deps.now?.() ?? new Date()).toISOString();
    return await deps.data.finishMapPack(SERVICE, build.clubId, build.packId, {
      sizeBytes,
      builtAt,
    });
  } catch (error) {
    const reason = error instanceof MapPackBuildError ? error.message : UNEXPECTED;
    await deps.data.failMapPack(SERVICE, build.clubId, build.packId, reason);
    throw error;
  }
}

/** Fetches the tiles, writes the PMTiles archive and uploads it; returns its size. */
async function buildArchive(build: MapPackBuild, deps: MapPackBuilderDeps): Promise<number> {
  const { clubId, packId, basemap, bounds, minZoom, maxZoom } = build;
  // The API checked these; check again, the Lambda must never exceed the caps.
  const estimate = estimatePack(bounds, minZoom, maxZoom, basemap, MAP_PACK_LIMITS);
  if (estimate.overLimit) {
    throw new MapPackBuildError(`the property is too big for one pack (${estimate.overLimit})`);
  }
  const fetched = await pool(
    tilesInBounds(bounds, minZoom, maxZoom),
    TILE_FETCH_POLICY.concurrency,
    async (t) => {
      const data = await deps.fetchTile(tileUrl(basemap, t.z, t.x, t.y));
      return data ? ({ ...t, data } satisfies Tile) : null;
    },
  );
  const tiles = fetched.filter((t): t is Tile => t !== null);
  const base = BASEMAPS[basemap];
  const archive = writePmtiles(tiles, {
    tileType: TILE_TYPE.jpeg,
    bounds,
    metadata: {
      name: `${base.label} map pack`,
      attribution: base.attribution,
      source: base.source,
    },
  });
  if (archive.length > MAP_PACK_LIMITS.maxBytes) {
    throw new MapPackBuildError('the property is too big for one pack (bytes)');
  }
  await deps.putObject(mapPackKey(clubId, packId), archive);
  return archive.length;
}
