// The repo's TypeScript runner: `node <repo>/scripts/run-ts.mjs <entry.ts> [args...]`,
// run from the package directory (entry and output are relative to it). esbuild
// compiles the entry, including the @huntclub/* workspace sources, into one file in
// .run-ts/; aws-cdk-lib and constructs stay external. Used by infra (cdk.json, smoke)
// and club-data (seed:dev). No ts-node/tsx dependency needed.
import { build } from 'esbuild';
import { spawnSync } from 'node:child_process';
import { basename, join } from 'node:path';

const root = process.cwd();
const [entry, ...args] = process.argv.slice(2);
if (!entry) {
  console.error('usage: node scripts/run-ts.mjs <entry.ts> [args...]');
  process.exit(2);
}
const outfile = join(root, '.run-ts', `${basename(entry, '.ts')}.cjs`);

await build({
  entryPoints: [join(root, entry)],
  outfile,
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node22',
  external: ['aws-cdk-lib', 'constructs', 'esbuild'],
  logLevel: 'warning',
});

const result = spawnSync(process.execPath, [outfile, ...args], { stdio: 'inherit', cwd: root });
process.exit(result.status ?? 1);
