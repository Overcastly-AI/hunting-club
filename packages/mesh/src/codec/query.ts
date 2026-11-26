import { ChannelUrlError } from './channelUrlError';

/** Tiny query parser (React Native's URL/URLSearchParams support is incomplete). */
export function parseQuery(query: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const part of query.split('&')) {
    if (!part) continue;
    const eq = part.indexOf('=');
    const k = eq < 0 ? part : part.slice(0, eq);
    const v = eq < 0 ? '' : part.slice(eq + 1);
    try {
      out.set(decodeURIComponent(k), decodeURIComponent(v.replace(/\+/g, ' ')));
    } catch {
      throw new ChannelUrlError('Link is not correctly encoded');
    }
  }
  return out;
}
