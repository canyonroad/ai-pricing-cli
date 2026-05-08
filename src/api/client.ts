import pkg from "../../package.json" with { type: "json" };

const DEFAULT_BASE_URL = "https://ai-pricing.fyi";
const DEFAULT_TIMEOUT_MS = 30_000;

export type ApiErrorCode =
  | "not_found"
  | "rate_limited"
  | "http_error"
  | "network"
  | "timeout"
  | "parse_error";

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status?: number;
  readonly url: string;
  readonly body?: unknown;

  constructor(opts: {
    code: ApiErrorCode;
    status?: number;
    url: string;
    message: string;
    body?: unknown;
  }) {
    super(opts.message);
    this.name = "ApiError";
    this.code = opts.code;
    this.status = opts.status;
    this.url = opts.url;
    this.body = opts.body;
  }
}

export type ClientOpts = {
  baseUrl?: string;
  timeoutMs?: number;
  userAgent?: string;
};

export type QueryValue = string | number | boolean | undefined;

function resolveBaseUrl(opt?: string): string {
  const raw = opt ?? process.env.AI_PRICING_BASE_URL ?? DEFAULT_BASE_URL;
  return raw.endsWith("/") ? raw.slice(0, -1) : raw;
}

function buildUrl(baseUrl: string, path: string, query?: Record<string, QueryValue>): string {
  const url = `${baseUrl}${path}`;
  if (!query) return url;
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined) continue;
    params.append(k, String(v));
  }
  const qs = params.toString();
  return qs ? `${url}?${qs}` : url;
}

export async function apiGet<T>(
  path: string,
  query?: Record<string, QueryValue>,
  opts: ClientOpts = {},
): Promise<T> {
  const baseUrl = resolveBaseUrl(opts.baseUrl);
  const url = buildUrl(baseUrl, path, query);
  const userAgent = opts.userAgent ?? `ai-pricing-cli/${pkg.version}`;
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json", "User-Agent": userAgent },
      signal: ac.signal,
    });

    let body: unknown;
    let bodyText: string;
    try {
      bodyText = await res.text();
      body = bodyText.length === 0 ? undefined : JSON.parse(bodyText);
    } catch {
      throw new ApiError({
        code: "parse_error",
        status: res.status,
        url,
        message: `Failed to parse JSON response from ${url}`,
      });
    }

    if (!res.ok) {
      const code: ApiErrorCode =
        res.status === 404 ? "not_found" : res.status === 429 ? "rate_limited" : "http_error";
      const message =
        (typeof body === "object" &&
        body !== null &&
        "error" in body &&
        typeof (body as { error: unknown }).error === "string"
          ? (body as { error: string }).error
          : null) ?? `HTTP ${res.status} from ${url}`;
      throw new ApiError({ code, status: res.status, url, message, body });
    }

    return body as T;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if (err instanceof Error && err.name === "AbortError") {
      throw new ApiError({
        code: "timeout",
        url,
        message: `Request to ${url} timed out after ${timeoutMs}ms`,
      });
    }
    const message = err instanceof Error ? err.message : String(err);
    throw new ApiError({ code: "network", url, message: `Network error: ${message}` });
  } finally {
    clearTimeout(timer);
  }
}
