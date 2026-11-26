import type { FunctionUrlEvent } from '../http';

/** A Function URL event (payload 2.0) for tests. */
export function urlEvent(
  method: string,
  path: string,
  options: { body?: unknown; rawBody?: string; headers?: Record<string, string> } = {},
): FunctionUrlEvent {
  const body =
    options.rawBody ?? (options.body === undefined ? undefined : JSON.stringify(options.body));
  return {
    rawPath: path,
    headers: options.headers ?? {},
    ...(body === undefined ? {} : { body }),
    isBase64Encoded: false,
    requestContext: { http: { method } },
  };
}
