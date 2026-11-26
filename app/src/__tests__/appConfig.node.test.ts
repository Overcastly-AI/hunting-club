import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

/**
 * `expo prebuild` and `expo config` load app.config.ts with plain Node ESM (type stripping,
 * no bundler), so every module it reaches, including @huntclub/design and @huntclub/shared,
 * must resolve there: relative imports need their `.ts` extension. Jest's own resolver would
 * hide a missing one, so this loads the config in a separate, plain Node process.
 */
describe('app.config.ts in plain Node', () => {
  it('loads and names the app', () => {
    const script =
      "const m = await import('./app.config.ts'); process.stdout.write(JSON.stringify(m.default.name));";
    const out = execFileSync(process.execPath, ['--input-type=module', '-e', script], {
      cwd: resolve(__dirname, '../..'),
      encoding: 'utf8',
      env: { ...process.env, NODE_OPTIONS: '' },
    });
    expect(JSON.parse(out)).toEqual(expect.any(String));
  }, 60_000);
});
