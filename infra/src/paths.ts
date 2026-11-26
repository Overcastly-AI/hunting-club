import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

/**
 * The infra/ folder (the one holding cdk.json). Found by walking up from this file so
 * paths work both from the TypeScript sources (tests) and from the esbuild bundle that
 * `cdk synth` runs (infra/cdk.out/.app).
 */
export function infraRoot(start = __dirname): string {
  for (let dir = start; ; dir = dirname(dir)) {
    if (existsSync(join(dir, 'cdk.json'))) return dir;
    if (dirname(dir) === dir) throw new Error(`cdk.json not found above ${start}`);
  }
}

/** Lambda handler sources: infra/lambda/<name>/index.ts. */
export const lambdaEntry = (name: string) => join(infraRoot(), 'lambda', name, 'index.ts');

/** The built web admin page. `cdk synth` needs it: `npm run build -w @huntclub/web`. */
export const webDistPath = () => join(infraRoot(), '..', 'web', 'dist');

/** The built public site. `cdk synth` needs it: `npm run build -w @huntclub/site`. */
export const siteDistPath = () => join(infraRoot(), '..', 'site', 'dist');
