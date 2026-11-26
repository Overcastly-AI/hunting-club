// The slice of `fetch` the shared clients use. Injected, so the same code runs in
// React Native, the browser and Node tests without DOM type dependencies.

export interface HttpResponse {
  readonly status: number;
  text(): Promise<string>;
}

export type FetchLike = (
  url: string,
  init: { method: string; headers: Record<string, string>; body?: string },
) => Promise<HttpResponse>;

/** Parses a JSON body; empty bodies are undefined. */
export async function readJson(res: HttpResponse): Promise<unknown> {
  const text = await res.text();
  return text ? (JSON.parse(text) as unknown) : undefined;
}
