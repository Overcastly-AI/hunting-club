import type { FetchLike } from '../http';

/** A scripted fetch: each call takes the next response and records the request. */
export function scriptedFetch(responses: { status: number; body?: unknown }[]) {
  const calls: { url: string; method: string; headers: Record<string, string>; body?: unknown }[] =
    [];
  const fetch: FetchLike = async (url, init) => {
    calls.push({ url, ...init, ...(init.body ? { body: JSON.parse(init.body) as unknown } : {}) });
    const next = responses.shift();
    if (!next) throw new Error('offline');
    return {
      status: next.status,
      text: async () => (next.body === undefined ? '' : JSON.stringify(next.body)),
    };
  };
  return { fetch, calls };
}
