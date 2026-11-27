// The browser script as `vite build --mode client` bundles it (in memory): /join's is the
// only one, and it stays small (no protobuf codec, no page art).
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { build, type Rollup } from 'vite';
import { CLIENT_MODE, JOIN_SCRIPT_ENTRY } from '../../vite.config';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
/** The /join script's gzipped budget (docs/SITE_BRIEF.md: keep the JS tiny). */
const MAX_JOIN_SCRIPT_GZIP = 12_000;

async function clientChunks(): Promise<Rollup.OutputChunk[]> {
  const result = await build({
    root: ROOT,
    configFile: join(ROOT, 'vite.config.ts'),
    configLoader: 'runner',
    mode: CLIENT_MODE,
    logLevel: 'silent',
    build: { write: false, manifest: false },
  });
  const outputs = (Array.isArray(result) ? result : [result]) as Rollup.RollupOutput[];
  return outputs.flatMap((o) =>
    o.output.filter((c): c is Rollup.OutputChunk => c.type === 'chunk'),
  );
}

describe('client scripts', () => {
  let chunks: Rollup.OutputChunk[];
  beforeAll(async () => {
    chunks = await clientChunks();
  }, 60_000);

  it('are one file: the /join page script', () => {
    expect(chunks.map((c) => c.name)).toEqual(['join']);
    expect(chunks[0]!.facadeModuleId?.endsWith(JOIN_SCRIPT_ENTRY)).toBe(true);
  });

  it('keep the /join script small, with no page art or icons in it', () => {
    const join = chunks[0]!;
    expect(join.moduleIds.filter((id) => /dawn|aerial|lucide/i.test(id))).toEqual([]);
    expect(gzipSync(join.code).length).toBeLessThanOrEqual(MAX_JOIN_SCRIPT_GZIP);
  });
});
