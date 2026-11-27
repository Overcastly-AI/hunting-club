// The browser scripts as `vite build --mode client` bundles them (in memory): the header
// menu's and /join's, and they stay small (no protobuf codec, no page art).
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { build, type Rollup } from 'vite';
import { CLIENT_MODE, JOIN_SCRIPT_ENTRY, MENU_SCRIPT_ENTRY } from '../../vite.config';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
/** The /join script's gzipped budget (docs/SITE_BRIEF.md: keep the JS tiny). */
const MAX_JOIN_SCRIPT_GZIP = 12_000;
/** The menu script is on every page: a few hundred bytes. */
const MAX_MENU_SCRIPT_GZIP = 1_000;

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
  const chunk = (name: string) => chunks.find((c) => c.name === name)!;
  beforeAll(async () => {
    chunks = await clientChunks();
  }, 60_000);

  it('are two files: the header menu script and the /join page script', () => {
    expect(chunks.map((c) => c.name).sort()).toEqual(['join', 'menu']);
    expect(chunk('join').facadeModuleId?.endsWith(JOIN_SCRIPT_ENTRY)).toBe(true);
    expect(chunk('menu').facadeModuleId?.endsWith(MENU_SCRIPT_ENTRY)).toBe(true);
  });

  it('keep the /join script small, with no page art or icons in it', () => {
    const join = chunk('join');
    expect(join.moduleIds.filter((id) => /dawn|aerial|lucide/i.test(id))).toEqual([]);
    expect(gzipSync(join.code).length).toBeLessThanOrEqual(MAX_JOIN_SCRIPT_GZIP);
  });

  it('keep the menu script tiny, with nothing but the menu in it', () => {
    const menu = chunk('menu');
    expect(menu.moduleIds.filter((id) => !/\/src\/menu\//.test(id))).toEqual([]);
    expect(gzipSync(menu.code).length).toBeLessThanOrEqual(MAX_MENU_SCRIPT_GZIP);
  });
});
