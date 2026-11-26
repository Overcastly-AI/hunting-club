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
  DOWNLOAD_LIMITS,
  type MapPack,
  type MapPackBuild,
  MapPackBuildSchema,
  estimatePack,
  mapPackKey,
  tileUrl,
  tilesInBounds,
} from '@huntclub/shared';

/** How politely tiles are fetched from USGS (no published bulk policy: stay gentle). */
export const TILE_FETCH_POLICY = {
  /** Requests in flight at once. */
  concurrency: 4,
  /** At most this many requests start per second. */
  perSecond: 8,
  /** Retries for 429, 5xx and network errors, with doubling backoff. */
  retries: 3,
  backoffMs: 500,
} as const;

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
        throw new Error(`tile fetch failed (${status || 'network'})`);
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

/** Builds, uploads and records one club map pack. */
export async function buildMapPack(input: unknown, deps: MapPackBuilderDeps): Promise<MapPack> {
  const build: MapPackBuild = MapPackBuildSchema.parse(input);
  const { clubId, packId, basemap, bounds, minZoom, maxZoom } = build;
  // The API checked these; check again, the Lambda must never exceed the caps.
  const estimate = estimatePack(bounds, minZoom, maxZoom, basemap);
  if (estimate.overLimit) throw new Error(`map pack over the ${estimate.overLimit} limit`);

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
  if (archive.length > DOWNLOAD_LIMITS.maxBytes) throw new Error('map pack over the bytes limit');

  const key = mapPackKey(clubId, packId);
  await deps.putObject(key, archive);
  return deps.data.createMapPack(
    SERVICE,
    clubId,
    {
      bounds: [...bounds],
      minZoom,
      maxZoom,
      source: base.source,
      s3Key: key,
      sizeBytes: archive.length,
      builtAt: (deps.now?.() ?? new Date()).toISOString(),
    },
    { id: packId },
  );
}
