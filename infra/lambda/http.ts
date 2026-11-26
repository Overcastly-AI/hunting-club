// Small helpers shared by the Function URL handlers (no AWS types dependency).

export interface FunctionUrlEvent {
  readonly headers?: Readonly<Record<string, string | undefined>>;
  readonly requestContext?: { readonly http?: { readonly method?: string } };
}

export interface FunctionUrlResult {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}

export function jsonResponse(statusCode: number, body: unknown): FunctionUrlResult {
  return {
    statusCode,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  };
}

/** Names of required environment variables that are unset or empty. */
export function missingEnv(names: readonly string[]): string[] {
  return names.filter((name) => !process.env[name]);
}
