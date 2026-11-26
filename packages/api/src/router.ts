import { idSchema } from '@huntclub/shared';

export type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface Route<C> {
  method: Method;
  /** e.g. `/clubs/:clubId/stands/:id`. Every `:param` must be a UUID. */
  path: string;
  /** `public` routes run without a token (only the plan list). */
  access?: 'public';
  /** Status for success (default 200; 204 sends no body). */
  status?: number;
  handle(ctx: C, params: Record<string, string>): Promise<unknown>;
}

export type Match<C> =
  | { route: Route<C>; params: Record<string, string> }
  | { route?: undefined; methodNotAllowed: boolean };

/** Finds the route for a request; params that aren't UUIDs don't match. */
export function matchRoute<C>(routes: readonly Route<C>[], method: string, path: string): Match<C> {
  const parts = path.replace(/\/+$/, '').split('/');
  let pathMatched = false;
  for (const route of routes) {
    const pattern = route.path.split('/');
    if (pattern.length !== parts.length) continue;
    const params: Record<string, string> = {};
    const ok = pattern.every((seg, i) => {
      const part = parts[i]!;
      if (!seg.startsWith(':')) return seg === part;
      params[seg.slice(1)] = part;
      return idSchema.safeParse(part).success;
    });
    if (!ok) continue;
    if (route.method === method) return { route, params };
    pathMatched = true;
  }
  return { methodNotAllowed: pathMatched };
}
