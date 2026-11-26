// Map-pack builder Lambda: invoked asynchronously by the club API (never on a schedule).
// Builds one club's PMTiles pack from USGS tiles and records it; the logic lives in
// @huntclub/api. Logs only ids and sizes, never tile bodies.
import {
  buildMapPack,
  clubDataForTable,
  mapPackUploader,
  missingEnv,
  politeTileFetcher,
} from '@huntclub/api';
import { API_ENV } from '../../config/types';

const REQUIRED_ENV = [API_ENV.envName, API_ENV.tableName, API_ENV.mapPackBucket, API_ENV.webOrigin];

const env = (name: string) => process.env[name] ?? '';

/** Identifies the builder to USGS: product name and where to find us, no personal data. */
export const userAgent = (webOrigin: string) => `HuntClubMesh-MapPacks/1.0 (+${webOrigin})`;

export const handler = async (event: unknown) => {
  const missing = missingEnv(REQUIRED_ENV);
  // Throwing lets Lambda's async retry (and its failure record) see the problem.
  if (missing.length > 0) throw new Error(`not configured: missing ${missing.join(', ')}`);
  const pack = await buildMapPack(event, {
    data: clubDataForTable(env(API_ENV.tableName)),
    fetchTile: politeTileFetcher({ fetch, userAgent: userAgent(env(API_ENV.webOrigin)) }),
    putObject: mapPackUploader(env(API_ENV.mapPackBucket)),
  });
  console.log(`map pack ${pack.id} built for club ${pack.clubId}: ${pack.sizeBytes} bytes`);
  return { packId: pack.id };
};
