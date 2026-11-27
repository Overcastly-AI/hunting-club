// Where the committed sample pack archive lives (sample-pack/<key>), for the scripts and tests,
// which run from web/.
import { SAMPLE_PACK_FOLDER } from '@huntclub/shared/sample';
import { resolve } from 'node:path';
import { SAMPLE_PACK } from '../src/map/samplePack';

/** The archive's path: <web>/sample-pack/packs/sample/<id>.pmtiles. */
export const samplePackFile = (web = process.cwd()) =>
  resolve(web, SAMPLE_PACK_FOLDER, SAMPLE_PACK.s3Key);
