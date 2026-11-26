// Runs one TypeScript entry point of this package with Node: `node scripts/run-ts.mjs
// <entry.ts> [args...]`. esbuild compiles it, including the @huntclub/* workspace
// sources, into one file; aws-cdk-lib and constructs stay external. Used for the CDK
// app (cdk.json) and the dev smoke check. No ts-node/tsx dependency needed.
import { build } from 'esbuild';
import { spawnSync } from 'node:child_process';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const [entry, ...args] = process.argv.slice(2);
if (!entry) {
  console.error('usage: node scripts/run-ts.mjs <entry.ts> [args...]');
  process.exit(2);
}
const outfile = join(root, 'cdk.out', '.app', `${basename(entry, '.ts')}.cjs`);

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
