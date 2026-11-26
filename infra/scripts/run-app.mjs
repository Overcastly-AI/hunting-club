// Runs the CDK app (bin/app.ts) for `cdk synth`. esbuild compiles the TypeScript app,
// including the @huntclub/shared workspace sources, into one file; aws-cdk-lib and
// constructs stay external. No ts-node/tsx dependency needed.
import { build } from 'esbuild';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outfile = join(root, 'cdk.out', '.app', 'app.cjs');

await build({
  entryPoints: [join(root, 'bin', 'app.ts')],
  outfile,
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node22',
  external: ['aws-cdk-lib', 'constructs', 'esbuild'],
  logLevel: 'warning',
});

const result = spawnSync(process.execPath, [outfile], { stdio: 'inherit', cwd: root });
process.exit(result.status ?? 1);
