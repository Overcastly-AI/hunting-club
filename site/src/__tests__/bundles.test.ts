// The browser scripts as `vite build --mode client` bundles them (in memory): the /join page
// never carries the dawn scene, and the home hero's pause script stays small.
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { build, type Rollup } from 'vite';
import { CLIENT_MODE, DAWN_SCRIPT_ENTRY, JOIN_SCRIPT_ENTRY } from '../../vite.config';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
/** The pause script's gzipped budget: the button only, never the scene. */
const MAX_DAWN_SCRIPT_GZIP = 2_000;

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
  const entry = (file: string) => {
    const chunk = chunks.find((c) => c.facadeModuleId?.endsWith(file));
    if (!chunk) throw new Error(`No chunk for ${file}`);
    return chunk;
  };

  it('are two self-contained files, with nothing shared between them', () => {
    expect(chunks.map((c) => c.name).sort()).toEqual(['dawn', 'join']);
  });

  it('keep the dawn scene out of the /join bundle', () => {
    const join = entry(JOIN_SCRIPT_ENTRY);
    expect(join.moduleIds.filter((id) => /dawn/i.test(id))).toEqual([]);
    expect(join.code).not.toMatch(/dawnSprites|dawn-pause|dawn--paused/);
  });

  it('give the home hero only the pause button, not the scene', () => {
    const dawn = entry(DAWN_SCRIPT_ENTRY);
    expect(dawn.moduleIds.filter((id) => /dawnScene|dawnSprites/.test(id))).toEqual([]);
    expect(gzipSync(dawn.code).length).toBeLessThanOrEqual(MAX_DAWN_SCRIPT_GZIP);
  });
});
