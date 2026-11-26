import { buildVersion } from '../../build-version';
import { BUILD_ID_GLOBAL, BUILD_VERSION_FILE, newerBuildIsLive } from '../buildVersion';

const served = (body: unknown, ok = true) =>
  vi.fn(async () => ({ ok, json: async () => body }) as Response) as unknown as typeof fetch;

describe('newerBuildIsLive', () => {
  it('is true only when the server has another build', async () => {
    expect(await newerBuildIsLive('a', served({ buildId: 'b' }))).toBe(true);
    expect(await newerBuildIsLive('a', served({ buildId: 'a' }))).toBe(false);
  });

  it('asks for the version file past every cache', async () => {
    const fetchFn = served({ buildId: 'a' });
    await newerBuildIsLive('a', fetchFn);
    expect(fetchFn).toHaveBeenCalledWith(`/${BUILD_VERSION_FILE}`, { cache: 'no-store' });
  });

  it.each([
    ['no build id in the bundle (dev, tests)', undefined, served({ buildId: 'b' })],
    ['no version file', 'a', served({}, false)],
    ['a bad body', 'a', served(null)],
    [
      'offline',
      'a',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch');
      }) as unknown as typeof fetch,
    ],
  ])('is false with %s', async (_name, current, fetchFn) => {
    expect(await newerBuildIsLive(current, fetchFn)).toBe(false);
  });
});

describe('buildVersion plugin', () => {
  it('defines the bundle id and writes the same id to the version file', () => {
    const plugin = buildVersion('build-1');
    const config = (plugin.config as () => { define: Record<string, string> })();
    expect(config.define[BUILD_ID_GLOBAL]).toBe(JSON.stringify('build-1'));
    const emitFile = vi.fn();
    (plugin.generateBundle as unknown as (this: { emitFile: typeof emitFile }) => void).call({
      emitFile,
    });
    expect(emitFile).toHaveBeenCalledWith({
      type: 'asset',
      fileName: BUILD_VERSION_FILE,
      source: JSON.stringify({ buildId: 'build-1' }),
    });
  });
});
