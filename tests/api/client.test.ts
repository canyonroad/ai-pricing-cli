import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, apiGet } from "../../src/api/client.js";

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.AI_PRICING_BASE_URL;
});

function mockFetch(response: { status?: number; body?: unknown; headers?: Record<string, string> }) {
  const status = response.status ?? 200;
  const headers = new Headers(response.headers ?? { "content-type": "application/json" });
  const body = JSON.stringify(response.body ?? {});
  const fn = vi.fn(async () => new Response(body, { status, headers }));
  vi.stubGlobal("fetch", fn);
  return fn;
}

describe("apiGet — URL composition", () => {
  it("uses the default base URL when no override", async () => {
    const fn = mockFetch({ body: { data: [] } });
    await apiGet("/v1/providers");
    expect(fn.mock.calls[0]?.[0]).toBe("https://ai-pricing.fyi/v1/providers");
  });

  it("uses opts.baseUrl when provided", async () => {
    const fn = mockFetch({ body: {} });
    await apiGet("/v1/providers", undefined, { baseUrl: "http://localhost:8787" });
    expect(fn.mock.calls[0]?.[0]).toBe("http://localhost:8787/v1/providers");
  });

  it("uses AI_PRICING_BASE_URL when opts.baseUrl is absent", async () => {
    process.env.AI_PRICING_BASE_URL = "https://example.test";
    const fn = mockFetch({ body: {} });
    await apiGet("/v1/providers");
    expect(fn.mock.calls[0]?.[0]).toBe("https://example.test/v1/providers");
  });

  it("opts.baseUrl wins over the env var", async () => {
    process.env.AI_PRICING_BASE_URL = "https://env.test";
    const fn = mockFetch({ body: {} });
    await apiGet("/v1/providers", undefined, { baseUrl: "https://opts.test" });
    expect(fn.mock.calls[0]?.[0]).toBe("https://opts.test/v1/providers");
  });

  it("trims a trailing slash from the base URL", async () => {
    const fn = mockFetch({ body: {} });
    await apiGet("/v1/providers", undefined, { baseUrl: "http://localhost:8787/" });
    expect(fn.mock.calls[0]?.[0]).toBe("http://localhost:8787/v1/providers");
  });

  it("encodes query parameters and drops undefined values", async () => {
    const fn = mockFetch({ body: {} });
    await apiGet("/v1/prices/current", { provider: "anthropic", limit: 5, missing: undefined, batch: true });
    const url = fn.mock.calls[0]?.[0] as string;
    expect(url).toContain("provider=anthropic");
    expect(url).toContain("limit=5");
    expect(url).toContain("batch=true");
    expect(url).not.toContain("missing");
  });

  it("URL-encodes characters in query values", async () => {
    const fn = mockFetch({ body: {} });
    await apiGet("/v1/prices/current", { q: "claude opus & friends" });
    const url = fn.mock.calls[0]?.[0] as string;
    expect(url).toContain("q=claude+opus+%26+friends");
  });

  it("sends Accept and User-Agent headers", async () => {
    const fn = mockFetch({ body: {} });
    await apiGet("/v1/providers");
    const init = fn.mock.calls[0]?.[1] as RequestInit;
    const headers = new Headers(init.headers);
    expect(headers.get("accept")).toBe("application/json");
    expect(headers.get("user-agent")).toMatch(/^ai-pricing-cli\/\d+\.\d+\.\d+$/);
  });

  it("returns the parsed JSON body verbatim", async () => {
    mockFetch({ body: { data: [{ slug: "anthropic" }], limit: 1, offset: 0 } });
    const out = await apiGet<{ data: { slug: string }[] }>("/v1/providers");
    expect(out).toEqual({ data: [{ slug: "anthropic" }], limit: 1, offset: 0 });
  });
});

describe("ApiError class", () => {
  it("is throwable and carries code, status, url", () => {
    const err = new ApiError({ code: "not_found", status: 404, url: "https://x/y", message: "nope" });
    expect(err).toBeInstanceOf(Error);
    expect(err.code).toBe("not_found");
    expect(err.status).toBe(404);
    expect(err.url).toBe("https://x/y");
    expect(err.message).toBe("nope");
  });
});

describe("apiGet — error mapping", () => {
  it("maps HTTP 404 to code 'not_found'", async () => {
    mockFetch({ status: 404, body: { error: "Provider not found" } });
    await expect(apiGet("/v1/providers/nope")).rejects.toMatchObject({
      code: "not_found",
      status: 404,
      message: "Provider not found",
    });
  });

  it("maps HTTP 429 to code 'rate_limited'", async () => {
    mockFetch({ status: 429, body: { error: "Slow down" } });
    await expect(apiGet("/v1/providers")).rejects.toMatchObject({
      code: "rate_limited",
      status: 429,
    });
  });

  it("maps other non-2xx to code 'http_error'", async () => {
    mockFetch({ status: 500, body: { error: "boom" } });
    await expect(apiGet("/v1/providers")).rejects.toMatchObject({
      code: "http_error",
      status: 500,
    });
  });

  it("preserves the server JSON error body on ApiError.body", async () => {
    mockFetch({ status: 400, body: { error: "Bad input", detail: "x" } });
    await expect(apiGet("/v1/providers")).rejects.toMatchObject({
      code: "http_error",
      body: { error: "Bad input", detail: "x" },
    });
  });

  it("falls back to a synthetic message when no error string is in the body", async () => {
    mockFetch({ status: 503, body: {} });
    await expect(apiGet("/v1/providers")).rejects.toMatchObject({
      code: "http_error",
      message: expect.stringContaining("HTTP 503"),
    });
  });

  it("maps a non-JSON body to 'parse_error'", async () => {
    const fn = vi.fn(async () => new Response("<html>500</html>", { status: 500, headers: { "content-type": "text/html" } }));
    vi.stubGlobal("fetch", fn);
    await expect(apiGet("/v1/providers")).rejects.toMatchObject({ code: "parse_error", status: 500 });
  });

  it("maps fetch reject to 'network'", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("getaddrinfo ENOTFOUND"); }));
    await expect(apiGet("/v1/providers")).rejects.toMatchObject({ code: "network" });
  });

  it("maps abort/timeout to 'timeout'", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => {
      const err = new Error("aborted");
      err.name = "AbortError";
      throw err;
    }));
    await expect(apiGet("/v1/providers", undefined, { timeoutMs: 10 })).rejects.toMatchObject({
      code: "timeout",
    });
  });
});