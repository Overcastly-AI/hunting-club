// Builds the sample property's aerial map pack (src/map/samplePack.ts) with the real map-pack
// builder from USGS, and writes it where it is committed: sample-pack/<key>. infra's Web stack
// deploys that folder to the bucket, so the sign-in backdrop needs no manual upload. Run it only
// when the sample property changes, and give the pack a new SAMPLE_PACK_ID then (packs are
// cached for a year).
//
//   cd web && NODE_USE_ENV_PROXY=1 node ../scripts/run-ts.mjs scripts/sample-pack.ts
import { SAMPLE_PACK_OWNER } from '@huntclub/shared/sample';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { buildMapPack, politeTileFetcher } from '../../packages/api/src/mapPackBuilder';
import { samplePack, samplePackBuild } from '../src/map/samplePack';
import { samplePackFile } from './samplePackFile';

/**
 * The builder takes a club id (a UUID); the archive's bytes do not depend on it (only the key the
 * builder would upload to does, and that upload is replaced by the committed file).
 */
const BUILD_CLUB_ID = '00000000-0000-0000-0000-000000000000';

async function main() {
  const pack = samplePack(SAMPLE_PACK_OWNER);
  let archive: Buffer | undefined;
  // Only the builder's two writes are needed: there is no pack row to update.
  const data = {
    finishMapPack: async () => pack,
    failMapPack: async () => pack,
  } as unknown as Parameters<typeof buildMapPack>[1]['data'];
  await buildMapPack(samplePackBuild(BUILD_CLUB_ID), {
    data,
    fetchTile: politeTileFetcher({ fetch, userAgent: 'HuntClubMesh-sample-pack' }),
    putObject: async (_key, body) => {
      archive = body;
    },
  });
  if (!archive) throw new Error('The map-pack builder wrote no archive');
  const file = samplePackFile();
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, archive);
  console.log(`${file}: ${archive.length} bytes`);
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
