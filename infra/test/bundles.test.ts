// Every Lambda entry, bundled with the esbuild settings the stacks use, must load as an
// ES module in plain Node and give bundled CommonJS code a working `require`. Guards the
// first dev deploy, where the club API failed init with "Dynamic require of fs is not
// supported".
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { buildSync } from 'esbuild';
import { LAMBDA_BUNDLING } from '../src/constructs/node-lambda';
import { lambdaEntry } from '../src/paths';

const entries = readdirSync(join(__dirname, '..', 'lambda'), { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name);

// Inside infra/ so the bundles resolve the externalised @aws-sdk packages.
const outDir = mkdtempSync(join(__dirname, '..', '.bundle-test-'));
afterAll(() => rmSync(outDir, { recursive: true, force: true }));

function runModule(code: string): string {
  return execFileSync(process.execPath, ['--input-type=module', '-e', code], {
    encoding: 'utf8',
  });
}

describe.each(entries)('Lambda bundle %s', (entry) => {
  const outfile = join(outDir, `${entry}.mjs`);

  beforeAll(() => {
    buildSync({
      entryPoints: [lambdaEntry(entry)],
      outfile,
      bundle: true,
      platform: 'node',
      format: 'esm',
      target: LAMBDA_BUNDLING.target,
      mainFields: [...LAMBDA_BUNDLING.mainFields],
      banner: { js: LAMBDA_BUNDLING.banner },
      external: [...LAMBDA_BUNDLING.externalModules],
      logLevel: 'silent',
    });
  });

  it('starts with the createRequire banner', () => {
    expect(readFileSync(outfile, 'utf8').startsWith(LAMBDA_BUNDLING.banner)).toBe(true);
  });

  it('loads as an ES module and exports a handler', () => {
    const out = runModule(
      `const m = await import(${JSON.stringify(outfile)}); process.stdout.write(typeof m.handler);`,
    );
    expect(out).toBe('function');
  });
});

it('the banner gives an ES module a working require for Node built-ins', () => {
  expect(
    runModule(`${LAMBDA_BUNDLING.banner} process.stdout.write(typeof require('fs').readFileSync);`),
  ).toBe('function');
});
