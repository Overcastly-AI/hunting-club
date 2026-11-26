/**
 * A tab opened before a deploy keeps running the old bundle, and the old lazy
 * page chunks stay on the CDN, so in-app navigation can show an old page
 * until a reload. Each build writes its id to BUILD_VERSION_FILE (served
 * no-cache) and into the bundle; on navigation the page compares them and
 * reloads when a newer build is live.
 */
export const BUILD_VERSION_FILE = 'version.json';
/** Name of the bundle constant the build-version Vite plugin defines. */
export const BUILD_ID_GLOBAL = '__HUNTCLUB_BUILD_ID__';

declare const __HUNTCLUB_BUILD_ID__: string | undefined;

/** This bundle's build id (undefined outside a Vite build). */
export function bundleBuildId(): string | undefined {
  return typeof __HUNTCLUB_BUILD_ID__ === 'string' ? __HUNTCLUB_BUILD_ID__ : undefined;
}

/**
 * True when the server has a different build from this bundle. Any failure
 * (offline, dev server without the file, bad JSON) counts as not stale.
 */
export async function newerBuildIsLive(
  current: string | undefined,
  fetchFn: typeof fetch = fetch,
): Promise<boolean> {
  if (!current) return false;
  try {
    const res = await fetchFn(`/${BUILD_VERSION_FILE}`, { cache: 'no-store' });
    if (!res.ok) return false;
    const body: unknown = await res.json();
    const id = (body as { buildId?: unknown } | null)?.buildId;
    return typeof id === 'string' && id !== current;
  } catch {
    return false;
  }
}
