// Lambda Function URL plumbing (payload format 2.0), shared by both handlers.
// No AWS types dependency: only the fields we read.

export interface FunctionUrlEvent {
  readonly rawPath?: string;
  readonly headers?: Readonly<Record<string, string | undefined>>;
  readonly body?: string;
  readonly isBase64Encoded?: boolean;
  readonly requestContext?: { readonly http?: { readonly method?: string } };
}

export interface FunctionUrlResult {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}

export type Handler = (event: FunctionUrlEvent) => Promise<FunctionUrlResult>;

export function jsonResponse(statusCode: number, body?: unknown): FunctionUrlResult {
  return {
    statusCode,
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? '' : JSON.stringify(body),
  };
}

/** Names of required environment variables that are unset or empty. */
export function missingEnv(names: readonly string[]): string[] {
  return names.filter((name) => !process.env[name]);
}

/** The exact request bytes (Stripe signs these; never re-serialize). */
export function rawBody(event: FunctionUrlEvent): Buffer {
  return Buffer.from(event.body ?? '', event.isBase64Encoded ? 'base64' : 'utf8');
}

export const methodOf = (event: FunctionUrlEvent) =>
  (event.requestContext?.http?.method ?? 'GET').toUpperCase();

/** Function URLs lower-case header names. */
export const headerOf = (event: FunctionUrlEvent, name: string) =>
  event.headers?.[name.toLowerCase()];

/** The bearer token, or undefined when the header is missing or malformed. */
export function bearerToken(event: FunctionUrlEvent): string | undefined {
  return /^Bearer (\S+)$/.exec(headerOf(event, 'authorization') ?? '')?.[1];
}

/**
 * Builds the real handler once per container, on first use, so a cold start reads
 * configuration and secrets once. A failed build is retried on the next request.
 */
export function lazyHandler(build: () => Promise<Handler>): Handler {
  let built: Promise<Handler> | undefined;
  return async (event) => {
    built ??= build().catch((error: unknown) => {
      built = undefined;
      throw error;
    });
    return (await built)(event);
  };
}

/** One structured log line. Never pass bodies, tokens or keys. */
export function logLine(fields: Record<string, unknown>) {
  console.log(JSON.stringify(fields));
}
