# ai-pricing CLI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a TypeScript CLI named `ai-pricing` that wraps the public read API of `https://ai-pricing.fyi`, with subcommand-per-resource layout, auto TTY/JSON output, JSON-envelope errors, and stable exit codes.

**Architecture:** Three layers with hard boundaries — `api/client.ts` (HTTP, no output), `output/*` (rendering, no HTTP), `commands/*` (thin adapters). Native `fetch` for HTTP, `commander` for the CLI surface, `cli-table3` for tables, `tsup` to build a single ESM file with a shebang, `vitest` for tests, `biome` for lint/format.

**Tech Stack:** TypeScript, Node 20+, ESM, commander, cli-table3, tsup, vitest, biome.

**Working directory:** `/home/eran/work/ai-pricing-cli` (already a git repo with the spec committed).

**Spec:** `docs/superpowers/specs/2026-05-08-ai-pricing-cli-design.md`.

---

## File map

Files created during this plan:

- `package.json` — bin entry, scripts, deps
- `tsconfig.json`, `tsup.config.ts`, `vitest.config.ts`, `biome.json`, `.gitignore`
- `src/cli.ts` — commander root, common flags, subcommand registration, top-level error handler
- `src/api/client.ts` — `apiGet`, `ApiError`
- `src/api/types.ts` — `Provider`, `Model`, `PriceRow`, `Change`, `ListResponse`
- `src/output/mode.ts` — `chooseMode(opts, isTty)`
- `src/output/json.ts` — `renderJson`, `renderJsonError`
- `src/output/table.ts` — `renderTable`, `renderKeyValueTable`, `formatPrice`
- `src/output/errors.ts` — `CliError`, `exitCodeFor`, `handleError`
- `src/commands/providers.ts` — `list`, `get`, `offers`
- `src/commands/models.ts` — `list`, `get`, `offers`
- `src/commands/prices.ts` — `current`, `history`, `filters`
- `src/commands/changes.ts` — `recent`
- `src/commands/gpus.ts` — `list`, `offers`
- `src/commands/health.ts` — `health`
- `tests/api/client.test.ts`
- `tests/output/mode.test.ts`
- `tests/output/json.test.ts`
- `tests/output/table.test.ts`
- `tests/output/errors.test.ts`
- `tests/commands/providers.test.ts`, `models.test.ts`, `prices.test.ts`, `changes.test.ts`, `gpus.test.ts`, `health.test.ts`
- `tests/smoke.test.ts`
- `README.md`

---

### Task 1: Project scaffold

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `tsup.config.ts`
- Create: `vitest.config.ts`
- Create: `biome.json`
- Create: `.gitignore`
- Create: `src/cli.ts`
- Test: `tests/smoke.test.ts` (placeholder; smoke logic comes later)

- [ ] **Step 1: Write the failing test**

Create `tests/smoke.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

describe("cli smoke", () => {
  it("prints the version", () => {
    const cli = resolve(__dirname, "..", "dist", "cli.js");
    const out = execFileSync("node", [cli, "--version"], { encoding: "utf8" });
    expect(out.trim()).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — npm not initialized yet (or, after init, FAIL because `dist/cli.js` does not exist).

- [ ] **Step 3: Create scaffold**

Create `package.json`:

```json
{
  "name": "ai-pricing",
  "version": "0.1.0",
  "description": "CLI for the ai-pricing.fyi public API",
  "type": "module",
  "engines": { "node": ">=20" },
  "bin": { "ai-pricing": "dist/cli.js" },
  "files": ["dist", "README.md"],
  "scripts": {
    "build": "tsup",
    "dev": "tsup --watch",
    "typecheck": "tsc --noEmit",
    "lint": "biome check .",
    "format": "biome format --write .",
    "test": "vitest run",
    "test:watch": "vitest",
    "prepublishOnly": "npm run typecheck && npm run lint && npm test && npm run build"
  },
  "dependencies": {
    "cli-table3": "^0.6.5",
    "commander": "^12.1.0"
  },
  "devDependencies": {
    "@biomejs/biome": "^1.9.4",
    "@types/node": "^22.10.0",
    "tsup": "^8.3.5",
    "typescript": "^5.7.2",
    "vitest": "^2.1.8"
  }
}
```

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "noEmit": true,
    "types": ["node"]
  },
  "include": ["src/**/*", "tests/**/*", "*.config.ts"]
}
```

Create `tsup.config.ts`:

```ts
import { defineConfig } from "tsup";

export default defineConfig({
  entry: { cli: "src/cli.ts" },
  format: ["esm"],
  target: "node20",
  outDir: "dist",
  clean: true,
  banner: { js: "#!/usr/bin/env node" },
  shims: false,
  sourcemap: false,
});
```

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
  },
});
```

Create `biome.json`:

```json
{
  "$schema": "https://biomejs.dev/schemas/1.9.4/schema.json",
  "files": { "ignore": ["dist", "node_modules", "coverage"] },
  "formatter": { "enabled": true, "indentStyle": "space", "indentWidth": 2, "lineWidth": 100 },
  "linter": {
    "enabled": true,
    "rules": { "recommended": true, "style": { "noNonNullAssertion": "off" } }
  },
  "organizeImports": { "enabled": true }
}
```

Create `.gitignore`:

```
node_modules
dist
coverage
.DS_Store
*.log
```

Create `src/cli.ts`:

```ts
import { Command } from "commander";
import pkg from "../package.json" with { type: "json" };

const program = new Command();
program.name("ai-pricing").description(pkg.description).version(pkg.version);
program.parse(process.argv);
```

The `import ... with { type: "json" }` form is the Node 20+ ESM JSON import. It works under tsup, which inlines the JSON at build time.

- [ ] **Step 4: Install and build**

Run:

```bash
npm install
npm run build
npm test
```

Expected: install succeeds, `dist/cli.js` is produced, smoke test PASSES (prints `0.1.0`).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: scaffold ai-pricing CLI project"
```

---

### Task 2: API client — URL composition

**Files:**
- Create: `src/api/types.ts`
- Create: `src/api/client.ts`
- Create: `tests/api/client.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/api/client.test.ts`:

```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/api/client.test.ts`
Expected: FAIL — module `../../src/api/client.js` does not exist.

- [ ] **Step 3: Implement the client**

Create `src/api/types.ts`:

```ts
export type Provider = {
  id: number;
  slug: string;
  name: string;
  website_url: string | null;
  docs_url: string | null;
  pricing_url: string | null;
  active: boolean;
  notes: string | null;
  icon_url: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
};

export type Model = {
  id: number;
  canonical_slug: string;
  vendor: string;
  family: string | null;
  model_name: string;
  display_name: string | null;
  status: string | null;
  open_weights: boolean;
  context_window: number | null;
  release_date: string | null;
};

export type PriceRow = {
  offer_id: number;
  provider_slug: string;
  provider_name: string;
  canonical_slug: string;
  display_name: string | null;
  family: string | null;
  metric: string;
  unit: string;
  currency: string;
  batch_flag: 0 | 1;
  tier_key: string | null;
  price_numeric: number;
  latest_observed_at: string | null;
};

export type Change = {
  observed_at: string;
  provider_slug: string;
  canonical_slug: string;
  metric: string;
  old_price: number | null;
  new_price: number | null;
};

export type ListResponse<T> = { data: T[]; limit: number; offset: number };
```

Create `src/api/client.ts`:

```ts
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

  constructor(opts: { code: ApiErrorCode; status?: number; url: string; message: string; body?: unknown }) {
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
        (typeof body === "object" && body !== null && "error" in body && typeof (body as { error: unknown }).error === "string"
          ? (body as { error: string }).error
          : null) ?? `HTTP ${res.status} from ${url}`;
      throw new ApiError({ code, status: res.status, url, message, body });
    }

    return body as T;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if (err instanceof Error && err.name === "AbortError") {
      throw new ApiError({ code: "timeout", url, message: `Request to ${url} timed out after ${timeoutMs}ms` });
    }
    const message = err instanceof Error ? err.message : String(err);
    throw new ApiError({ code: "network", url, message: `Network error: ${message}` });
  } finally {
    clearTimeout(timer);
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/api/client.test.ts`
Expected: PASS — all 10 tests.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(api): add fetch client with URL composition and base-URL resolution"
```

---

### Task 3: API client — error mapping

**Files:**
- Modify: `tests/api/client.test.ts` (append)

- [ ] **Step 1: Append failing tests**

Append to `tests/api/client.test.ts`:

```ts
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
```

- [ ] **Step 2: Run tests**

Run: `npm test -- tests/api/client.test.ts`
Expected: PASS — all error-mapping tests pass against the existing implementation from Task 2.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "test(api): cover error mapping"
```

---

### Task 4: Output mode resolution

**Files:**
- Create: `src/output/mode.ts`
- Create: `tests/output/mode.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/output/mode.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { chooseMode } from "../../src/output/mode.js";

describe("chooseMode", () => {
  it("forces json when --json is set", () => {
    expect(chooseMode({ json: true }, true)).toBe("json");
    expect(chooseMode({ json: true }, false)).toBe("json");
  });

  it("forces table when --table is set and --json is not", () => {
    expect(chooseMode({ table: true }, false)).toBe("table");
  });

  it("--json wins over --table when both are set", () => {
    expect(chooseMode({ json: true, table: true }, true)).toBe("json");
  });

  it("returns table when stdout is a TTY and no flags", () => {
    expect(chooseMode({}, true)).toBe("table");
  });

  it("returns json when stdout is not a TTY and no flags", () => {
    expect(chooseMode({}, false)).toBe("json");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/output/mode.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `src/output/mode.ts`:

```ts
export type OutputMode = "json" | "table";

export type ModeFlags = {
  json?: boolean;
  table?: boolean;
};

export function chooseMode(flags: ModeFlags, isTty: boolean): OutputMode {
  if (flags.json) return "json";
  if (flags.table) return "table";
  return isTty ? "table" : "json";
}
```

- [ ] **Step 4: Run tests**

Run: `npm test -- tests/output/mode.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(output): add mode resolution"
```

---

### Task 5: Errors module + exit codes

**Files:**
- Create: `src/output/errors.ts`
- Create: `tests/output/errors.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/output/errors.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { ApiError } from "../../src/api/client.js";
import { CliError, exitCodeFor } from "../../src/output/errors.js";

describe("exitCodeFor", () => {
  it("returns 2 for not_found", () => {
    expect(exitCodeFor(new ApiError({ code: "not_found", url: "x", message: "" }))).toBe(2);
  });

  it("returns 3 for rate_limited", () => {
    expect(exitCodeFor(new ApiError({ code: "rate_limited", url: "x", message: "" }))).toBe(3);
  });

  it("returns 4 for http_error and parse_error", () => {
    expect(exitCodeFor(new ApiError({ code: "http_error", url: "x", message: "" }))).toBe(4);
    expect(exitCodeFor(new ApiError({ code: "parse_error", url: "x", message: "" }))).toBe(4);
  });

  it("returns 5 for network and timeout", () => {
    expect(exitCodeFor(new ApiError({ code: "network", url: "x", message: "" }))).toBe(5);
    expect(exitCodeFor(new ApiError({ code: "timeout", url: "x", message: "" }))).toBe(5);
  });

  it("returns 1 for CliError and unknown errors", () => {
    expect(exitCodeFor(new CliError("bad flag"))).toBe(1);
    expect(exitCodeFor(new Error("???"))).toBe(1);
  });
});

describe("CliError", () => {
  it("is throwable with a message", () => {
    const err = new CliError("nope");
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe("nope");
    expect(err.name).toBe("CliError");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/output/errors.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `src/output/errors.ts`:

```ts
import { ApiError } from "../api/client.js";

export class CliError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CliError";
  }
}

export function exitCodeFor(err: unknown): number {
  if (err instanceof ApiError) {
    switch (err.code) {
      case "not_found":
        return 2;
      case "rate_limited":
        return 3;
      case "http_error":
      case "parse_error":
        return 4;
      case "network":
      case "timeout":
        return 5;
    }
  }
  return 1;
}
```

- [ ] **Step 4: Run tests**

Run: `npm test -- tests/output/errors.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(output): add CliError and exit-code mapping"
```

---

### Task 6: JSON output (success + error envelope)

**Files:**
- Create: `src/output/json.ts`
- Create: `tests/output/json.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/output/json.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { ApiError } from "../../src/api/client.js";
import { CliError } from "../../src/output/errors.js";
import { buildErrorEnvelope, buildSuccessEnvelope } from "../../src/output/json.js";

describe("buildSuccessEnvelope", () => {
  it("spreads server response and adds ok:true", () => {
    const env = buildSuccessEnvelope({ data: [{ slug: "anthropic" }], limit: 50, offset: 0 });
    expect(env).toEqual({ ok: true, data: [{ slug: "anthropic" }], limit: 50, offset: 0 });
  });

  it("preserves a server-supplied meta block", () => {
    const env = buildSuccessEnvelope({ data: [], meta: { ms: 12, reads: 3 } });
    expect(env).toEqual({ ok: true, data: [], meta: { ms: 12, reads: 3 } });
  });

  it("works for filter-style responses (no `data` key)", () => {
    const env = buildSuccessEnvelope({ providers: ["a", "b"], families: ["x"] });
    expect(env).toEqual({ ok: true, providers: ["a", "b"], families: ["x"] });
  });

  it("works for non-object responses by wrapping under `data`", () => {
    const env = buildSuccessEnvelope([1, 2, 3]);
    expect(env).toEqual({ ok: true, data: [1, 2, 3] });
  });
});

describe("buildErrorEnvelope", () => {
  it("converts an ApiError to the standard envelope", () => {
    const err = new ApiError({ code: "not_found", status: 404, url: "https://x/y", message: "nope" });
    expect(buildErrorEnvelope(err)).toEqual({
      ok: false,
      error: { code: "not_found", status: 404, url: "https://x/y", message: "nope" },
    });
  });

  it("converts a CliError to the standard envelope with code 'cli_error'", () => {
    expect(buildErrorEnvelope(new CliError("bad flag"))).toEqual({
      ok: false,
      error: { code: "cli_error", message: "bad flag" },
    });
  });

  it("converts an unknown error to code 'unknown'", () => {
    expect(buildErrorEnvelope(new Error("???"))).toEqual({
      ok: false,
      error: { code: "unknown", message: "???" },
    });
  });
});
```

- [ ] **Step 2: Run tests**

Run: `npm test -- tests/output/json.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `src/output/json.ts`:

```ts
import { ApiError } from "../api/client.js";
import { CliError } from "./errors.js";

export type SuccessEnvelope = { ok: true } & Record<string, unknown>;
export type ErrorEnvelope = {
  ok: false;
  error: { code: string; status?: number; url?: string; message: string };
};

export function buildSuccessEnvelope(response: unknown): SuccessEnvelope {
  if (response !== null && typeof response === "object" && !Array.isArray(response)) {
    return { ok: true, ...(response as Record<string, unknown>) };
  }
  return { ok: true, data: response as unknown };
}

export function buildErrorEnvelope(err: unknown): ErrorEnvelope {
  if (err instanceof ApiError) {
    return {
      ok: false,
      error: { code: err.code, status: err.status, url: err.url, message: err.message },
    };
  }
  if (err instanceof CliError) {
    return { ok: false, error: { code: "cli_error", message: err.message } };
  }
  const message = err instanceof Error ? err.message : String(err);
  return { ok: false, error: { code: "unknown", message } };
}

export function renderJson(envelope: SuccessEnvelope | ErrorEnvelope, stream: NodeJS.WriteStream = process.stdout): void {
  stream.write(`${JSON.stringify(envelope, null, 2)}\n`);
}
```

- [ ] **Step 4: Run tests**

Run: `npm test -- tests/output/json.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(output): add JSON envelope builders"
```

---

### Task 7: Table output

**Files:**
- Create: `src/output/table.ts`
- Create: `tests/output/table.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/output/table.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  formatPrice,
  formatCell,
  renderKeyValueTable,
  renderTable,
} from "../../src/output/table.js";

describe("formatPrice", () => {
  it("formats per_1m_tokens prices as '$X.XXXX / 1M tok'", () => {
    expect(formatPrice(0.015, "per_1m_tokens")).toBe("$0.0150 / 1M tok");
    expect(formatPrice(15, "per_1m_tokens")).toBe("$15.0000 / 1M tok");
  });

  it("falls back to '$X.XXXX / <unit>' for other units", () => {
    expect(formatPrice(1.5, "per_image")).toBe("$1.5000 / per_image");
  });

  it("returns an em dash when price is null/undefined", () => {
    expect(formatPrice(null, "per_1m_tokens")).toBe("—");
    expect(formatPrice(undefined, "per_1m_tokens")).toBe("—");
  });
});

describe("formatCell", () => {
  it("renders null/undefined as em dash", () => {
    expect(formatCell(null)).toBe("—");
    expect(formatCell(undefined)).toBe("—");
  });

  it("renders booleans as 'true'/'false'", () => {
    expect(formatCell(true)).toBe("true");
    expect(formatCell(false)).toBe("false");
  });

  it("renders numbers and strings as-is", () => {
    expect(formatCell(42)).toBe("42");
    expect(formatCell("hi")).toBe("hi");
  });

  it("renders arrays joined by ', '", () => {
    expect(formatCell(["a", "b", "c"])).toBe("a, b, c");
  });

  it("renders objects as JSON", () => {
    expect(formatCell({ k: 1 })).toBe('{"k":1}');
  });
});

describe("renderTable", () => {
  it("renders a table with the given columns and rows", () => {
    const out = renderTable(
      [
        { slug: "anthropic", name: "Anthropic", active: true },
        { slug: "openai", name: "OpenAI", active: true },
      ],
      ["slug", "name", "active"],
    );
    expect(out).toContain("slug");
    expect(out).toContain("anthropic");
    expect(out).toContain("OpenAI");
    expect(out).toContain("true");
  });

  it("returns the literal string '(no rows)\\n' for empty input", () => {
    expect(renderTable([], ["slug"])).toBe("(no rows)\n");
  });

  it("renders missing keys as the em dash", () => {
    const out = renderTable([{ slug: "x" }], ["slug", "missing"]);
    expect(out).toContain("—");
  });
});

describe("renderKeyValueTable", () => {
  it("renders one row per key", () => {
    const out = renderKeyValueTable({ slug: "anthropic", active: true, notes: null });
    expect(out).toContain("slug");
    expect(out).toContain("anthropic");
    expect(out).toContain("active");
    expect(out).toContain("true");
    expect(out).toContain("notes");
    expect(out).toContain("—");
  });
});
```

- [ ] **Step 2: Run tests**

Run: `npm test -- tests/output/table.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `src/output/table.ts`:

```ts
import Table from "cli-table3";

const EM_DASH = "—";

export function formatPrice(price: number | null | undefined, unit: string): string {
  if (price === null || price === undefined) return EM_DASH;
  const value = `$${price.toFixed(4)}`;
  if (unit === "per_1m_tokens") return `${value} / 1M tok`;
  return `${value} / ${unit}`;
}

export function formatCell(value: unknown): string {
  if (value === null || value === undefined) return EM_DASH;
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(formatCell).join(", ");
  return JSON.stringify(value);
}

export type RenderTableOptions = {
  formatters?: Record<string, (row: Record<string, unknown>) => string>;
};

export function renderTable(
  rows: Record<string, unknown>[],
  columns: string[],
  options: RenderTableOptions = {},
): string {
  if (rows.length === 0) return "(no rows)\n";
  const table = new Table({ head: columns, style: { head: [] } });
  for (const row of rows) {
    table.push(
      columns.map((col) => {
        const fmt = options.formatters?.[col];
        return fmt ? fmt(row) : formatCell(row[col]);
      }),
    );
  }
  return `${table.toString()}\n`;
}

export function renderKeyValueTable(obj: Record<string, unknown>): string {
  const table = new Table({ head: ["field", "value"], style: { head: [] } });
  for (const [k, v] of Object.entries(obj)) {
    table.push([k, formatCell(v)]);
  }
  return `${table.toString()}\n`;
}

export function writeTable(text: string, stream: NodeJS.WriteStream = process.stdout): void {
  stream.write(text);
}
```

- [ ] **Step 4: Run tests**

Run: `npm test -- tests/output/table.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(output): add table and key-value renderers"
```

---

### Task 8: Commander root + common flags + error handler

**Files:**
- Modify: `src/cli.ts`
- Create: `tests/cli.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/cli.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

const CLI = resolve(__dirname, "..", "dist", "cli.js");

function run(args: string[], env: Record<string, string> = {}): { stdout: string; stderr: string; code: number } {
  try {
    const stdout = execFileSync("node", [CLI, ...args], {
      encoding: "utf8",
      env: { ...process.env, ...env, AI_PRICING_BASE_URL: env.AI_PRICING_BASE_URL ?? "http://127.0.0.1:1" },
    });
    return { stdout, stderr: "", code: 0 };
  } catch (err) {
    const e = err as { status?: number; stdout?: string; stderr?: string };
    return { stdout: e.stdout ?? "", stderr: e.stderr ?? "", code: e.status ?? 1 };
  }
}

describe("cli root", () => {
  it("prints --help with the registered subcommands", () => {
    const { stdout, code } = run(["--help"]);
    expect(code).toBe(0);
    expect(stdout).toContain("providers");
    expect(stdout).toContain("models");
    expect(stdout).toContain("prices");
    expect(stdout).toContain("changes");
    expect(stdout).toContain("gpus");
    expect(stdout).toContain("health");
  });

  it("exits 1 on unknown commands", () => {
    const { code } = run(["nonsense"]);
    expect(code).toBe(1);
  });
});
```

This test depends on subcommands being registered. We will register stubs in this task and replace each stub in subsequent tasks.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run build && npm test -- tests/cli.test.ts`
Expected: FAIL — subcommands not yet registered.

- [ ] **Step 3: Implement**

Replace `src/cli.ts`:

```ts
import { Command, Option } from "commander";
import pkg from "../package.json" with { type: "json" };
import { ApiError } from "./api/client.js";
import { CliError, exitCodeFor } from "./output/errors.js";
import { buildErrorEnvelope, renderJson } from "./output/json.js";
import { chooseMode } from "./output/mode.js";

export type GlobalOpts = {
  json?: boolean;
  table?: boolean;
  baseUrl?: string;
  timeout?: number;
  noColor?: boolean;
};

export function getGlobalOpts(cmd: Command): GlobalOpts {
  return cmd.optsWithGlobals() as GlobalOpts;
}

function buildProgram(): Command {
  const program = new Command();
  program
    .name("ai-pricing")
    .description("CLI for the ai-pricing.fyi public API")
    .version(pkg.version)
    .addOption(new Option("--json", "force JSON output"))
    .addOption(new Option("--table", "force table output"))
    .addOption(new Option("--base-url <url>", "override base URL").env("AI_PRICING_BASE_URL"))
    .addOption(new Option("--timeout <ms>", "request timeout in ms").default(30000).argParser((v) => Number(v)))
    .addOption(new Option("--no-color", "disable ANSI color in tables"))
    .showHelpAfterError(true)
    .exitOverride();

  // Subcommand stubs — replaced in later tasks.
  program.command("providers").description("Provider commands").action(() => stubAction("providers"));
  program.command("models").description("Model commands").action(() => stubAction("models"));
  program.command("prices").description("Price commands").action(() => stubAction("prices"));
  program.command("changes").description("Recent price changes").action(() => stubAction("changes"));
  program.command("gpus").description("GPU compute pricing").action(() => stubAction("gpus"));
  program.command("health").description("Liveness check").action(() => stubAction("health"));

  return program;
}

function stubAction(name: string): never {
  throw new CliError(`subcommand '${name}' not implemented yet`);
}

export function reportError(err: unknown, opts: GlobalOpts): void {
  const mode = chooseMode({ json: opts.json, table: opts.table }, Boolean(process.stdout.isTTY));
  if (mode === "json") {
    renderJson(buildErrorEnvelope(err), process.stdout);
  } else {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`Error: ${message}\n`);
  }
}

async function main(): Promise<void> {
  const program = buildProgram();
  try {
    await program.parseAsync(process.argv);
  } catch (err) {
    if (err instanceof Error && (err.name === "CommanderError" || err.name === "InvalidArgumentError")) {
      // commander already printed help/usage to stderr.
      process.exit(1);
    }
    if (err instanceof ApiError || err instanceof CliError || err instanceof Error) {
      reportError(err, program.opts() as GlobalOpts);
      process.exit(exitCodeFor(err));
    }
    process.stderr.write(`Unknown failure: ${String(err)}\n`);
    process.exit(1);
  }
}

main();
```

- [ ] **Step 4: Run tests**

Run: `npm run build && npm test -- tests/cli.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(cli): wire up commander root with global flags and error handler"
```

---

### Task 9: providers commands

**Files:**
- Create: `src/commands/providers.ts`
- Modify: `src/cli.ts` (replace the providers stub)
- Create: `tests/commands/providers.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/commands/providers.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import * as client from "../../src/api/client.js";
import * as json from "../../src/output/json.js";
import * as table from "../../src/output/table.js";
import * as providers from "../../src/commands/providers.js";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("providers list", () => {
  it("calls /v1/providers with active and pagination flags", async () => {
    const apiGet = vi.spyOn(client, "apiGet").mockResolvedValue({ data: [], limit: 50, offset: 0 });
    const writeJson = vi.spyOn(json, "renderJson").mockImplementation(() => undefined);
    await providers.runList({ active: "true", limit: 5, offset: 10 }, { json: true, baseUrl: "http://x", timeout: 30000 });
    expect(apiGet).toHaveBeenCalledWith(
      "/v1/providers",
      { active: "true", limit: 5, offset: 10 },
      { baseUrl: "http://x", timeoutMs: 30000 },
    );
    expect(writeJson).toHaveBeenCalledOnce();
  });

  it("renders the table when mode is table", async () => {
    vi.spyOn(client, "apiGet").mockResolvedValue({
      data: [{ slug: "anthropic", name: "Anthropic", active: true, pricing_url: "u" }],
      limit: 50,
      offset: 0,
    });
    const renderTable = vi.spyOn(table, "renderTable");
    await providers.runList({}, { table: true, timeout: 30000 });
    expect(renderTable).toHaveBeenCalledWith(
      [{ slug: "anthropic", name: "Anthropic", active: true, pricing_url: "u" }],
      ["slug", "name", "active", "pricing_url"],
    );
  });
});

describe("providers get", () => {
  it("calls /v1/providers/:slug and renders a key/value table", async () => {
    vi.spyOn(client, "apiGet").mockResolvedValue({ slug: "anthropic", name: "Anthropic", active: true });
    const renderKv = vi.spyOn(table, "renderKeyValueTable");
    await providers.runGet("anthropic", { table: true, timeout: 30000 });
    expect(renderKv).toHaveBeenCalledWith({ slug: "anthropic", name: "Anthropic", active: true });
  });
});

describe("providers offers", () => {
  it("calls /v1/providers/:slug/offers", async () => {
    const apiGet = vi.spyOn(client, "apiGet").mockResolvedValue({ data: [], limit: 50, offset: 0 });
    await providers.runOffers("anthropic", { limit: 10 }, { json: true, timeout: 30000 });
    expect(apiGet).toHaveBeenCalledWith("/v1/providers/anthropic/offers", { limit: 10, offset: undefined }, expect.anything());
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/commands/providers.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `src/commands/providers.ts`:

```ts
import { Command } from "commander";
import { apiGet, type ClientOpts } from "../api/client.js";
import type { GlobalOpts } from "../cli.js";
import { renderJson, buildSuccessEnvelope } from "../output/json.js";
import { chooseMode } from "../output/mode.js";
import { renderKeyValueTable, renderTable, writeTable } from "../output/table.js";

const PROVIDERS_LIST_COLUMNS = ["slug", "name", "active", "pricing_url"];
const PROVIDER_OFFERS_COLUMNS = [
  "provider_offer_key",
  "canonical_slug",
  "metric",
  "unit",
  "price_numeric",
  "batch_flag",
  "latest_observed_at",
];

function clientOptsFrom(g: GlobalOpts): ClientOpts {
  return { baseUrl: g.baseUrl, timeoutMs: g.timeout };
}

function mode(g: GlobalOpts): "json" | "table" {
  return chooseMode({ json: g.json, table: g.table }, Boolean(process.stdout.isTTY));
}

export type ListFlags = { active?: string; limit?: number; offset?: number };
export type OffersFlags = { limit?: number; offset?: number };

export async function runList(flags: ListFlags, g: GlobalOpts): Promise<void> {
  const response = await apiGet<{ data: Record<string, unknown>[]; limit: number; offset: number }>(
    "/v1/providers",
    { active: flags.active, limit: flags.limit, offset: flags.offset },
    clientOptsFrom(g),
  );
  if (mode(g) === "json") {
    renderJson(buildSuccessEnvelope(response));
  } else {
    writeTable(renderTable(response.data, PROVIDERS_LIST_COLUMNS));
  }
}

export async function runGet(slug: string, g: GlobalOpts): Promise<void> {
  const response = await apiGet<Record<string, unknown>>(`/v1/providers/${encodeURIComponent(slug)}`, undefined, clientOptsFrom(g));
  if (mode(g) === "json") {
    renderJson(buildSuccessEnvelope(response));
  } else {
    writeTable(renderKeyValueTable(response));
  }
}

export async function runOffers(slug: string, flags: OffersFlags, g: GlobalOpts): Promise<void> {
  const response = await apiGet<{ data: Record<string, unknown>[]; limit: number; offset: number }>(
    `/v1/providers/${encodeURIComponent(slug)}/offers`,
    { limit: flags.limit, offset: flags.offset },
    clientOptsFrom(g),
  );
  if (mode(g) === "json") {
    renderJson(buildSuccessEnvelope(response));
  } else {
    writeTable(renderTable(response.data, PROVIDER_OFFERS_COLUMNS));
  }
}

export function register(parent: Command): void {
  const cmd = parent.command("providers").description("Provider commands");

  cmd
    .command("list")
    .description("List providers")
    .option("--active <bool>", "filter by active flag (true|false)")
    .option("--limit <n>", "page size", (v) => Number(v))
    .option("--offset <n>", "page offset", (v) => Number(v))
    .action(async (opts, c: Command) => {
      await runList(opts, c.optsWithGlobals() as GlobalOpts);
    });

  cmd
    .command("get <slug>")
    .description("Get one provider by slug")
    .action(async (slug, _opts, c: Command) => {
      await runGet(slug, c.optsWithGlobals() as GlobalOpts);
    });

  cmd
    .command("offers <slug>")
    .description("List offers for a provider")
    .option("--limit <n>", "page size", (v) => Number(v))
    .option("--offset <n>", "page offset", (v) => Number(v))
    .action(async (slug, opts, c: Command) => {
      await runOffers(slug, opts, c.optsWithGlobals() as GlobalOpts);
    });
}
```

- [ ] **Step 4: Replace the providers stub in `src/cli.ts`**

In `src/cli.ts`, replace the `providers` stub registration with a call to the module's `register` function. Specifically, change this block in `buildProgram`:

```ts
program.command("providers").description("Provider commands").action(() => stubAction("providers"));
```

to:

```ts
import * as providersCmd from "./commands/providers.js";
// ...inside buildProgram(), replace the old stub with:
providersCmd.register(program);
```

Move the `import * as providersCmd from "./commands/providers.js";` line to the top of the file with the other imports.

- [ ] **Step 5: Run tests**

Run: `npm run build && npm test`
Expected: PASS — providers tests pass, root CLI test still passes.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(cmd): add providers list/get/offers"
```

---

### Task 10: models commands

**Files:**
- Create: `src/commands/models.ts`
- Modify: `src/cli.ts`
- Create: `tests/commands/models.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/commands/models.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import * as client from "../../src/api/client.js";
import * as json from "../../src/output/json.js";
import * as table from "../../src/output/table.js";
import * as models from "../../src/commands/models.js";

afterEach(() => { vi.restoreAllMocks(); });

describe("models list", () => {
  it("calls /v1/models with vendor, family, and limit", async () => {
    const apiGet = vi.spyOn(client, "apiGet").mockResolvedValue({ data: [], limit: 50, offset: 0 });
    vi.spyOn(json, "renderJson").mockImplementation(() => undefined);
    await models.runList({ vendor: "anthropic", family: "claude", limit: 5 }, { json: true, timeout: 30000 });
    expect(apiGet).toHaveBeenCalledWith(
      "/v1/models",
      { vendor: "anthropic", family: "claude", limit: 5 },
      expect.anything(),
    );
  });

  it("renders default columns in table mode", async () => {
    vi.spyOn(client, "apiGet").mockResolvedValue({
      data: [{ canonical_slug: "claude-opus-4", vendor: "anthropic", family: "opus", display_name: "Claude Opus 4", status: "active" }],
      limit: 50,
      offset: 0,
    });
    const renderTable = vi.spyOn(table, "renderTable");
    await models.runList({}, { table: true, timeout: 30000 });
    expect(renderTable).toHaveBeenCalledWith(
      expect.any(Array),
      ["canonical_slug", "vendor", "family", "display_name", "status"],
    );
  });
});

describe("models get", () => {
  it("calls /v1/models/:slug", async () => {
    const apiGet = vi.spyOn(client, "apiGet").mockResolvedValue({ canonical_slug: "claude-opus-4" });
    vi.spyOn(table, "renderKeyValueTable").mockReturnValue("");
    await models.runGet("claude-opus-4", { table: true, timeout: 30000 });
    expect(apiGet).toHaveBeenCalledWith("/v1/models/claude-opus-4", undefined, expect.anything());
  });
});

describe("models offers", () => {
  it("calls /v1/models/:slug/offers", async () => {
    const apiGet = vi.spyOn(client, "apiGet").mockResolvedValue({ data: [], limit: 50, offset: 0 });
    vi.spyOn(json, "renderJson").mockImplementation(() => undefined);
    await models.runOffers("claude-opus-4", {}, { json: true, timeout: 30000 });
    expect(apiGet).toHaveBeenCalledWith("/v1/models/claude-opus-4/offers", { limit: undefined, offset: undefined }, expect.anything());
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/commands/models.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `src/commands/models.ts`:

```ts
import { Command } from "commander";
import { apiGet, type ClientOpts } from "../api/client.js";
import type { GlobalOpts } from "../cli.js";
import { renderJson, buildSuccessEnvelope } from "../output/json.js";
import { chooseMode } from "../output/mode.js";
import { renderKeyValueTable, renderTable, writeTable } from "../output/table.js";

const MODELS_LIST_COLUMNS = ["canonical_slug", "vendor", "family", "display_name", "status"];
const MODEL_OFFERS_COLUMNS = ["provider_slug", "metric", "unit", "price_numeric", "batch_flag", "latest_observed_at"];

function clientOptsFrom(g: GlobalOpts): ClientOpts {
  return { baseUrl: g.baseUrl, timeoutMs: g.timeout };
}
function mode(g: GlobalOpts): "json" | "table" {
  return chooseMode({ json: g.json, table: g.table }, Boolean(process.stdout.isTTY));
}

export type ListFlags = { vendor?: string; family?: string; limit?: number };
export type OffersFlags = { limit?: number; offset?: number };

export async function runList(flags: ListFlags, g: GlobalOpts): Promise<void> {
  const response = await apiGet<{ data: Record<string, unknown>[]; limit: number; offset: number }>(
    "/v1/models",
    { vendor: flags.vendor, family: flags.family, limit: flags.limit },
    clientOptsFrom(g),
  );
  if (mode(g) === "json") {
    renderJson(buildSuccessEnvelope(response));
  } else {
    writeTable(renderTable(response.data, MODELS_LIST_COLUMNS));
  }
}

export async function runGet(slug: string, g: GlobalOpts): Promise<void> {
  const response = await apiGet<Record<string, unknown>>(`/v1/models/${encodeURIComponent(slug)}`, undefined, clientOptsFrom(g));
  if (mode(g) === "json") {
    renderJson(buildSuccessEnvelope(response));
  } else {
    writeTable(renderKeyValueTable(response));
  }
}

export async function runOffers(slug: string, flags: OffersFlags, g: GlobalOpts): Promise<void> {
  const response = await apiGet<{ data: Record<string, unknown>[]; limit: number; offset: number }>(
    `/v1/models/${encodeURIComponent(slug)}/offers`,
    { limit: flags.limit, offset: flags.offset },
    clientOptsFrom(g),
  );
  if (mode(g) === "json") {
    renderJson(buildSuccessEnvelope(response));
  } else {
    writeTable(renderTable(response.data, MODEL_OFFERS_COLUMNS));
  }
}

export function register(parent: Command): void {
  const cmd = parent.command("models").description("Model commands");

  cmd
    .command("list")
    .description("List canonical models")
    .option("--vendor <slug>", "filter by vendor")
    .option("--family <name>", "filter by family")
    .option("--limit <n>", "page size", (v) => Number(v))
    .action(async (opts, c: Command) => {
      await runList(opts, c.optsWithGlobals() as GlobalOpts);
    });

  cmd
    .command("get <canonical_slug>")
    .description("Get one model by canonical slug")
    .action(async (slug, _opts, c: Command) => {
      await runGet(slug, c.optsWithGlobals() as GlobalOpts);
    });

  cmd
    .command("offers <canonical_slug>")
    .description("List offers for a canonical model across providers")
    .option("--limit <n>", "page size", (v) => Number(v))
    .option("--offset <n>", "page offset", (v) => Number(v))
    .action(async (slug, opts, c: Command) => {
      await runOffers(slug, opts, c.optsWithGlobals() as GlobalOpts);
    });
}
```

- [ ] **Step 4: Replace the models stub in `src/cli.ts`**

Add the import:

```ts
import * as modelsCmd from "./commands/models.js";
```

Replace the `models` stub line in `buildProgram`:

```ts
program.command("models").description("Model commands").action(() => stubAction("models"));
```

with:

```ts
modelsCmd.register(program);
```

- [ ] **Step 5: Run tests**

Run: `npm run build && npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(cmd): add models list/get/offers"
```

---

### Task 11: prices commands

**Files:**
- Create: `src/commands/prices.ts`
- Modify: `src/cli.ts`
- Create: `tests/commands/prices.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/commands/prices.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import * as client from "../../src/api/client.js";
import * as json from "../../src/output/json.js";
import * as table from "../../src/output/table.js";
import * as prices from "../../src/commands/prices.js";

afterEach(() => { vi.restoreAllMocks(); });

const SAMPLE_ROW = {
  provider_slug: "anthropic",
  canonical_slug: "claude-haiku-3",
  metric: "input_token",
  unit: "per_1m_tokens",
  price_numeric: 0.25,
  batch_flag: 0,
  tier_key: null,
  latest_observed_at: "2026-05-08T18:31:23.613Z",
};

describe("prices current", () => {
  it("calls /v1/prices/current with all filter flags", async () => {
    const apiGet = vi.spyOn(client, "apiGet").mockResolvedValue({ data: [], limit: 50, offset: 0 });
    vi.spyOn(json, "renderJson").mockImplementation(() => undefined);
    await prices.runCurrent(
      {
        query: "claude",
        provider: "anthropic",
        model: "claude-opus-4",
        family: "claude",
        metric: "input_token",
        billingBasis: "per_token",
        billingTier: "tier-1",
        limit: 5,
        offset: 0,
      },
      { json: true, timeout: 30000 },
    );
    expect(apiGet).toHaveBeenCalledWith(
      "/v1/prices/current",
      {
        q: "claude",
        provider: "anthropic",
        model: "claude-opus-4",
        family: "claude",
        metric: "input_token",
        billing_basis: "per_token",
        billing_tier: "tier-1",
        limit: 5,
        offset: 0,
      },
      expect.anything(),
    );
  });

  it("renders the price column using formatPrice in table mode", async () => {
    vi.spyOn(client, "apiGet").mockResolvedValue({ data: [SAMPLE_ROW], limit: 50, offset: 0 });
    const renderTable = vi.spyOn(table, "renderTable");
    await prices.runCurrent({}, { table: true, timeout: 30000 });
    const [, columns, options] = renderTable.mock.calls[0]!;
    expect(columns).toContain("price");
    expect(options?.formatters?.price?.(SAMPLE_ROW)).toBe("$0.2500 / 1M tok");
  });
});

describe("prices history", () => {
  it("calls /v1/prices/history with the same filters as current", async () => {
    const apiGet = vi.spyOn(client, "apiGet").mockResolvedValue({ data: [], limit: 50, offset: 0 });
    vi.spyOn(json, "renderJson").mockImplementation(() => undefined);
    await prices.runHistory({ provider: "anthropic" }, { json: true, timeout: 30000 });
    expect(apiGet).toHaveBeenCalledWith(
      "/v1/prices/history",
      expect.objectContaining({ provider: "anthropic" }),
      expect.anything(),
    );
  });
});

describe("prices filters", () => {
  it("calls /v1/prices/filters and renders a key-value table from a non-{data} payload", async () => {
    vi.spyOn(client, "apiGet").mockResolvedValue({ providers: ["a"], families: ["x"] });
    const renderKv = vi.spyOn(table, "renderKeyValueTable");
    await prices.runFilters({ query: "claude" }, { table: true, timeout: 30000 });
    expect(renderKv).toHaveBeenCalledWith({ providers: ["a"], families: ["x"] });
  });

  it("emits the response under a JSON envelope with top-level keys", async () => {
    vi.spyOn(client, "apiGet").mockResolvedValue({ providers: ["a"], families: ["x"] });
    const renderJson = vi.spyOn(json, "renderJson").mockImplementation(() => undefined);
    await prices.runFilters({}, { json: true, timeout: 30000 });
    expect(renderJson).toHaveBeenCalledWith({ ok: true, providers: ["a"], families: ["x"] });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/commands/prices.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `src/commands/prices.ts`:

```ts
import { Command } from "commander";
import { apiGet, type ClientOpts } from "../api/client.js";
import type { GlobalOpts } from "../cli.js";
import { renderJson, buildSuccessEnvelope } from "../output/json.js";
import { chooseMode } from "../output/mode.js";
import { formatPrice, renderKeyValueTable, renderTable, writeTable } from "../output/table.js";

const PRICES_CURRENT_COLUMNS = [
  "provider_slug",
  "canonical_slug",
  "metric",
  "unit",
  "price",
  "batch_flag",
  "tier_key",
  "latest_observed_at",
];

const PRICES_HISTORY_COLUMNS = ["provider_slug", "canonical_slug", "metric", "price", "observed_at"];

function clientOptsFrom(g: GlobalOpts): ClientOpts {
  return { baseUrl: g.baseUrl, timeoutMs: g.timeout };
}
function mode(g: GlobalOpts): "json" | "table" {
  return chooseMode({ json: g.json, table: g.table }, Boolean(process.stdout.isTTY));
}

export type CurrentFlags = {
  query?: string;
  provider?: string;
  model?: string;
  family?: string;
  metric?: string;
  billingBasis?: string;
  billingTier?: string;
  limit?: number;
  offset?: number;
};

export type FiltersFlags = {
  query?: string;
  provider?: string;
  model?: string;
  family?: string;
};

function pricesQuery(flags: CurrentFlags) {
  return {
    q: flags.query,
    provider: flags.provider,
    model: flags.model,
    family: flags.family,
    metric: flags.metric,
    billing_basis: flags.billingBasis,
    billing_tier: flags.billingTier,
    limit: flags.limit,
    offset: flags.offset,
  };
}

const priceFormatters = {
  price: (row: Record<string, unknown>) =>
    formatPrice(
      typeof row.price_numeric === "number" ? row.price_numeric : null,
      typeof row.unit === "string" ? row.unit : "",
    ),
};

export async function runCurrent(flags: CurrentFlags, g: GlobalOpts): Promise<void> {
  const response = await apiGet<{ data: Record<string, unknown>[]; limit: number; offset: number }>(
    "/v1/prices/current",
    pricesQuery(flags),
    clientOptsFrom(g),
  );
  if (mode(g) === "json") {
    renderJson(buildSuccessEnvelope(response));
  } else {
    writeTable(renderTable(response.data, PRICES_CURRENT_COLUMNS, { formatters: priceFormatters }));
  }
}

export async function runHistory(flags: CurrentFlags, g: GlobalOpts): Promise<void> {
  const response = await apiGet<{ data: Record<string, unknown>[]; limit: number; offset: number }>(
    "/v1/prices/history",
    pricesQuery(flags),
    clientOptsFrom(g),
  );
  if (mode(g) === "json") {
    renderJson(buildSuccessEnvelope(response));
  } else {
    writeTable(renderTable(response.data, PRICES_HISTORY_COLUMNS, { formatters: priceFormatters }));
  }
}

export async function runFilters(flags: FiltersFlags, g: GlobalOpts): Promise<void> {
  const response = await apiGet<Record<string, unknown>>(
    "/v1/prices/filters",
    {
      q: flags.query,
      provider: flags.provider,
      model: flags.model,
      family: flags.family,
    },
    clientOptsFrom(g),
  );
  if (mode(g) === "json") {
    renderJson(buildSuccessEnvelope(response));
  } else {
    writeTable(renderKeyValueTable(response));
  }
}

export function register(parent: Command): void {
  const cmd = parent.command("prices").description("Price commands");

  const currentCmd = cmd
    .command("current")
    .description("Current per-token prices")
    .option("-q, --query <q>", "free-text search")
    .option("--provider <slug>", "filter by provider slug")
    .option("--model <slug>", "filter by canonical model slug")
    .option("--family <name>", "filter by family")
    .option("--metric <m>", "filter by metric")
    .option("--billing-basis <b>", "filter by billing basis")
    .option("--billing-tier <t>", "filter by billing tier")
    .option("--limit <n>", "page size", (v) => Number(v))
    .option("--offset <n>", "page offset", (v) => Number(v));
  currentCmd.action(async (opts, c: Command) => {
    await runCurrent(opts, c.optsWithGlobals() as GlobalOpts);
  });

  const historyCmd = cmd
    .command("history")
    .description("Price snapshots over time")
    .option("-q, --query <q>", "free-text search")
    .option("--provider <slug>", "filter by provider slug")
    .option("--model <slug>", "filter by canonical model slug")
    .option("--family <name>", "filter by family")
    .option("--metric <m>", "filter by metric")
    .option("--billing-basis <b>", "filter by billing basis")
    .option("--billing-tier <t>", "filter by billing tier")
    .option("--limit <n>", "page size", (v) => Number(v))
    .option("--offset <n>", "page offset", (v) => Number(v));
  historyCmd.action(async (opts, c: Command) => {
    await runHistory(opts, c.optsWithGlobals() as GlobalOpts);
  });

  cmd
    .command("filters")
    .description("Enumerate valid filter values for prices/current")
    .option("-q, --query <q>", "scope to matching price rows")
    .option("--provider <slug>", "scope dropdowns to a provider")
    .option("--model <slug>", "scope dropdowns to a model")
    .option("--family <name>", "scope dropdowns to a family")
    .action(async (opts, c: Command) => {
      await runFilters(opts, c.optsWithGlobals() as GlobalOpts);
    });
}
```

- [ ] **Step 4: Replace the prices stub in `src/cli.ts`**

Add `import * as pricesCmd from "./commands/prices.js";` to the imports, then replace the `prices` stub line with `pricesCmd.register(program);`.

- [ ] **Step 5: Run tests**

Run: `npm run build && npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(cmd): add prices current/history/filters"
```

---

### Task 12: changes recent

**Files:**
- Create: `src/commands/changes.ts`
- Modify: `src/cli.ts`
- Create: `tests/commands/changes.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/commands/changes.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import * as client from "../../src/api/client.js";
import * as json from "../../src/output/json.js";
import * as table from "../../src/output/table.js";
import * as changes from "../../src/commands/changes.js";

afterEach(() => { vi.restoreAllMocks(); });

describe("changes recent", () => {
  it("calls /v1/changes/recent with --limit", async () => {
    const apiGet = vi.spyOn(client, "apiGet").mockResolvedValue({ changes: [] });
    vi.spyOn(json, "renderJson").mockImplementation(() => undefined);
    await changes.runRecent({ limit: 10 }, { json: true, timeout: 30000 });
    expect(apiGet).toHaveBeenCalledWith("/v1/changes/recent", { limit: 10 }, expect.anything());
  });

  it("renders the changes array in table mode using a price-delta formatter", async () => {
    vi.spyOn(client, "apiGet").mockResolvedValue({
      changes: [
        {
          observed_at: "2026-05-08",
          provider_slug: "anthropic",
          canonical_slug: "claude-opus-4",
          metric: "input_token",
          old_price: 1.0,
          new_price: 1.5,
        },
      ],
    });
    const renderTable = vi.spyOn(table, "renderTable");
    await changes.runRecent({}, { table: true, timeout: 30000 });
    const [rows, columns, options] = renderTable.mock.calls[0]!;
    expect(rows).toHaveLength(1);
    expect(columns).toContain("price_change");
    expect(options?.formatters?.price_change?.(rows![0]!)).toBe("$1.0000 → $1.5000");
  });

  it("emits {ok:true, changes} envelope in JSON mode", async () => {
    vi.spyOn(client, "apiGet").mockResolvedValue({ changes: [{ x: 1 }] });
    const renderJson = vi.spyOn(json, "renderJson").mockImplementation(() => undefined);
    await changes.runRecent({}, { json: true, timeout: 30000 });
    expect(renderJson).toHaveBeenCalledWith({ ok: true, changes: [{ x: 1 }] });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/commands/changes.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `src/commands/changes.ts`:

```ts
import { Command } from "commander";
import { apiGet, type ClientOpts } from "../api/client.js";
import type { GlobalOpts } from "../cli.js";
import { renderJson, buildSuccessEnvelope } from "../output/json.js";
import { chooseMode } from "../output/mode.js";
import { renderTable, writeTable } from "../output/table.js";

const CHANGES_COLUMNS = ["observed_at", "provider_slug", "canonical_slug", "metric", "price_change"];

function clientOptsFrom(g: GlobalOpts): ClientOpts {
  return { baseUrl: g.baseUrl, timeoutMs: g.timeout };
}
function mode(g: GlobalOpts): "json" | "table" {
  return chooseMode({ json: g.json, table: g.table }, Boolean(process.stdout.isTTY));
}

const formatters = {
  price_change: (row: Record<string, unknown>) => {
    const fmt = (n: unknown) => (typeof n === "number" ? `$${n.toFixed(4)}` : "—");
    return `${fmt(row.old_price)} → ${fmt(row.new_price)}`;
  },
};

export type RecentFlags = { limit?: number };

export async function runRecent(flags: RecentFlags, g: GlobalOpts): Promise<void> {
  const response = await apiGet<{ changes: Record<string, unknown>[] }>(
    "/v1/changes/recent",
    { limit: flags.limit },
    clientOptsFrom(g),
  );
  if (mode(g) === "json") {
    renderJson(buildSuccessEnvelope(response));
  } else {
    writeTable(renderTable(response.changes, CHANGES_COLUMNS, { formatters }));
  }
}

export function register(parent: Command): void {
  const cmd = parent.command("changes").description("Recent price-change events");
  cmd
    .command("recent")
    .description("List recent price changes")
    .option("--limit <n>", "page size", (v) => Number(v))
    .action(async (opts, c: Command) => {
      await runRecent(opts, c.optsWithGlobals() as GlobalOpts);
    });
}
```

- [ ] **Step 4: Replace the changes stub in `src/cli.ts`**

Add `import * as changesCmd from "./commands/changes.js";` then swap the stub for `changesCmd.register(program);`.

- [ ] **Step 5: Run tests**

Run: `npm run build && npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(cmd): add changes recent"
```

---

### Task 13: gpus commands

**Files:**
- Create: `src/commands/gpus.ts`
- Modify: `src/cli.ts`
- Create: `tests/commands/gpus.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/commands/gpus.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import * as client from "../../src/api/client.js";
import * as json from "../../src/output/json.js";
import * as table from "../../src/output/table.js";
import * as gpus from "../../src/commands/gpus.js";

afterEach(() => { vi.restoreAllMocks(); });

describe("gpus list", () => {
  it("calls /v1/gpus", async () => {
    const apiGet = vi.spyOn(client, "apiGet").mockResolvedValue({ data: [], limit: 50, offset: 0 });
    vi.spyOn(json, "renderJson").mockImplementation(() => undefined);
    await gpus.runList({ limit: 5 }, { json: true, timeout: 30000 });
    expect(apiGet).toHaveBeenCalledWith("/v1/gpus", { limit: 5, offset: undefined }, expect.anything());
  });

  it("renders default columns in table mode", async () => {
    vi.spyOn(client, "apiGet").mockResolvedValue({
      data: [{ sku: "h100-80", vendor: "nvidia", name: "H100 80GB", vram_gb: 80 }],
      limit: 50,
      offset: 0,
    });
    const renderTable = vi.spyOn(table, "renderTable");
    await gpus.runList({}, { table: true, timeout: 30000 });
    expect(renderTable).toHaveBeenCalledWith(expect.any(Array), ["sku", "vendor", "name", "vram_gb"]);
  });
});

describe("gpus offers", () => {
  it("calls /v1/gpus/:sku/offers", async () => {
    const apiGet = vi.spyOn(client, "apiGet").mockResolvedValue({ data: [], limit: 50, offset: 0 });
    vi.spyOn(json, "renderJson").mockImplementation(() => undefined);
    await gpus.runOffers("h100-80", {}, { json: true, timeout: 30000 });
    expect(apiGet).toHaveBeenCalledWith("/v1/gpus/h100-80/offers", { limit: undefined, offset: undefined }, expect.anything());
  });
});
```

- [ ] **Step 2: Run tests**

Run: `npm test -- tests/commands/gpus.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

Create `src/commands/gpus.ts`:

```ts
import { Command } from "commander";
import { apiGet, type ClientOpts } from "../api/client.js";
import type { GlobalOpts } from "../cli.js";
import { renderJson, buildSuccessEnvelope } from "../output/json.js";
import { chooseMode } from "../output/mode.js";
import { renderTable, writeTable } from "../output/table.js";

const GPUS_LIST_COLUMNS = ["sku", "vendor", "name", "vram_gb"];
const GPUS_OFFERS_COLUMNS = ["provider_slug", "region", "unit", "price_numeric", "observed_at"];

function clientOptsFrom(g: GlobalOpts): ClientOpts {
  return { baseUrl: g.baseUrl, timeoutMs: g.timeout };
}
function mode(g: GlobalOpts): "json" | "table" {
  return chooseMode({ json: g.json, table: g.table }, Boolean(process.stdout.isTTY));
}

export type ListFlags = { limit?: number; offset?: number };
export type OffersFlags = { limit?: number; offset?: number };

export async function runList(flags: ListFlags, g: GlobalOpts): Promise<void> {
  const response = await apiGet<{ data: Record<string, unknown>[]; limit: number; offset: number }>(
    "/v1/gpus",
    { limit: flags.limit, offset: flags.offset },
    clientOptsFrom(g),
  );
  if (mode(g) === "json") {
    renderJson(buildSuccessEnvelope(response));
  } else {
    writeTable(renderTable(response.data, GPUS_LIST_COLUMNS));
  }
}

export async function runOffers(sku: string, flags: OffersFlags, g: GlobalOpts): Promise<void> {
  const response = await apiGet<{ data: Record<string, unknown>[]; limit: number; offset: number }>(
    `/v1/gpus/${encodeURIComponent(sku)}/offers`,
    { limit: flags.limit, offset: flags.offset },
    clientOptsFrom(g),
  );
  if (mode(g) === "json") {
    renderJson(buildSuccessEnvelope(response));
  } else {
    writeTable(renderTable(response.data, GPUS_OFFERS_COLUMNS));
  }
}

export function register(parent: Command): void {
  const cmd = parent.command("gpus").description("GPU compute pricing");
  cmd
    .command("list")
    .description("List GPU SKUs")
    .option("--limit <n>", "page size", (v) => Number(v))
    .option("--offset <n>", "page offset", (v) => Number(v))
    .action(async (opts, c: Command) => {
      await runList(opts, c.optsWithGlobals() as GlobalOpts);
    });
  cmd
    .command("offers <sku>")
    .description("List offers for a GPU SKU")
    .option("--limit <n>", "page size", (v) => Number(v))
    .option("--offset <n>", "page offset", (v) => Number(v))
    .action(async (sku, opts, c: Command) => {
      await runOffers(sku, opts, c.optsWithGlobals() as GlobalOpts);
    });
}
```

- [ ] **Step 4: Replace the gpus stub in `src/cli.ts`**

Add `import * as gpusCmd from "./commands/gpus.js";` and swap the stub for `gpusCmd.register(program);`.

- [ ] **Step 5: Run tests**

Run: `npm run build && npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(cmd): add gpus list/offers"
```

---

### Task 14: health command

**Files:**
- Create: `src/commands/health.ts`
- Modify: `src/cli.ts`
- Create: `tests/commands/health.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/commands/health.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import * as client from "../../src/api/client.js";
import * as json from "../../src/output/json.js";
import * as table from "../../src/output/table.js";
import * as health from "../../src/commands/health.js";

afterEach(() => { vi.restoreAllMocks(); });

describe("health", () => {
  it("calls /_health", async () => {
    const apiGet = vi.spyOn(client, "apiGet").mockResolvedValue({ ok: true });
    vi.spyOn(json, "renderJson").mockImplementation(() => undefined);
    await health.runHealth({ json: true, timeout: 30000 });
    expect(apiGet).toHaveBeenCalledWith("/_health", undefined, expect.anything());
  });

  it("renders the body as a key/value table", async () => {
    vi.spyOn(client, "apiGet").mockResolvedValue({ ok: true, version: "abc" });
    const renderKv = vi.spyOn(table, "renderKeyValueTable");
    await health.runHealth({ table: true, timeout: 30000 });
    expect(renderKv).toHaveBeenCalledWith({ ok: true, version: "abc" });
  });
});
```

- [ ] **Step 2: Run tests**

Run: `npm test -- tests/commands/health.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

Create `src/commands/health.ts`:

```ts
import { Command } from "commander";
import { apiGet, type ClientOpts } from "../api/client.js";
import type { GlobalOpts } from "../cli.js";
import { renderJson, buildSuccessEnvelope } from "../output/json.js";
import { chooseMode } from "../output/mode.js";
import { renderKeyValueTable, writeTable } from "../output/table.js";

function clientOptsFrom(g: GlobalOpts): ClientOpts {
  return { baseUrl: g.baseUrl, timeoutMs: g.timeout };
}
function mode(g: GlobalOpts): "json" | "table" {
  return chooseMode({ json: g.json, table: g.table }, Boolean(process.stdout.isTTY));
}

export async function runHealth(g: GlobalOpts): Promise<void> {
  const response = await apiGet<Record<string, unknown>>("/_health", undefined, clientOptsFrom(g));
  if (mode(g) === "json") {
    renderJson(buildSuccessEnvelope(response));
  } else {
    writeTable(renderKeyValueTable(response));
  }
}

export function register(parent: Command): void {
  parent
    .command("health")
    .description("Liveness check")
    .action(async (_opts, c: Command) => {
      await runHealth(c.optsWithGlobals() as GlobalOpts);
    });
}
```

- [ ] **Step 4: Replace the health stub in `src/cli.ts`**

Add `import * as healthCmd from "./commands/health.js";` and swap the stub for `healthCmd.register(program);`.

After this task `src/cli.ts` should no longer contain any stub registrations. The `stubAction` helper can be deleted.

- [ ] **Step 5: Run tests**

Run: `npm run build && npm test`
Expected: PASS — all unit tests + smoke tests pass.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(cmd): add health"
```

---

### Task 15: Live smoke test (opt-in) and end-to-end JSON envelope check

**Files:**
- Modify: `tests/smoke.test.ts`

- [ ] **Step 1: Replace the placeholder smoke test**

Replace `tests/smoke.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

const CLI = resolve(__dirname, "..", "dist", "cli.js");
const RUN_LIVE = process.env.RUN_SMOKE === "1";

function run(args: string[], env: Record<string, string> = {}): { stdout: string; code: number } {
  try {
    const stdout = execFileSync("node", [CLI, ...args], {
      encoding: "utf8",
      env: { ...process.env, ...env },
    });
    return { stdout, code: 0 };
  } catch (err) {
    const e = err as { status?: number; stdout?: string };
    return { stdout: e.stdout ?? "", code: e.status ?? 1 };
  }
}

describe("cli smoke", () => {
  it("prints the version", () => {
    const { stdout, code } = run(["--version"]);
    expect(code).toBe(0);
    expect(stdout.trim()).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("emits a JSON error envelope when piped (stdout not a TTY) and the host is unreachable", () => {
    const { stdout, code } = run(["providers", "list"], { AI_PRICING_BASE_URL: "http://127.0.0.1:1" });
    const env = JSON.parse(stdout);
    expect(env.ok).toBe(false);
    expect(env.error.code).toBe("network");
    expect(code).toBe(5);
  });

  it.runIf(RUN_LIVE)("hits the live /_health endpoint and prints a JSON envelope", () => {
    const { stdout, code } = run(["health", "--json"]);
    const env = JSON.parse(stdout);
    expect(env.ok).toBe(true);
    expect(code).toBe(0);
  });
});
```

- [ ] **Step 2: Run unit + offline smoke tests**

Run: `npm run build && npm test`
Expected: PASS — live test is skipped because `RUN_SMOKE` is not set.

- [ ] **Step 3: Optionally run the live test**

Run: `RUN_SMOKE=1 npm test -- tests/smoke.test.ts`
Expected: PASS — `/_health` returns 200 with `{ok: true}`.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "test: add offline + opt-in live smoke tests"
```

---

### Task 16: README

**Files:**
- Create: `README.md`

- [ ] **Step 1: Write the README**

Create `README.md`:

````markdown
# ai-pricing

CLI for the public read API at https://ai-pricing.fyi.

Both human-friendly (pretty tables on a TTY) and agent-friendly (JSON envelope when piped, stable exit codes, structured errors).

## Install

```bash
npm i -g ai-pricing
# or one-shot
npx ai-pricing providers list
```

Requires Node 20+.

## Usage

```bash
ai-pricing providers list
ai-pricing providers get anthropic
ai-pricing models list --vendor anthropic
ai-pricing prices current --provider anthropic --metric input_token --limit 10
ai-pricing prices history --model claude-opus-4
ai-pricing prices filters --provider anthropic
ai-pricing changes recent --limit 20
ai-pricing gpus list
ai-pricing health
```

## Output

- Stdout is a TTY → pretty table.
- Stdout is piped or redirected → JSON envelope.
- `--json` and `--table` force a mode. `--json` wins if both are passed.

JSON success envelope spreads the server response under `ok: true`:

```json
{ "ok": true, "data": [ /* ... */ ], "limit": 50, "offset": 0 }
```

JSON error envelope:

```json
{ "ok": false, "error": { "code": "not_found", "status": 404, "url": "...", "message": "..." } }
```

## Exit codes

| Code | Cause |
|------|-------|
| 0 | Success |
| 1 | CLI / argument error |
| 2 | not_found (HTTP 404) |
| 3 | rate_limited (HTTP 429) |
| 4 | other HTTP / parse error |
| 5 | network / timeout |

## Configuration

- `--base-url <url>` or `AI_PRICING_BASE_URL` — override the API base (default: `https://ai-pricing.fyi`). Env var is intended for debugging.
- `--timeout <ms>` — request timeout (default 30000).
- `--no-color` or `NO_COLOR=1` — disable ANSI in tables.

## Development

```bash
npm install
npm run build
npm test
npm run typecheck
npm run lint
```

Live smoke against the deployed API:

```bash
RUN_SMOKE=1 npm test -- tests/smoke.test.ts
```

## License

Source available; no formal license declared yet.
````

- [ ] **Step 2: Final check**

Run: `npm run typecheck && npm run lint && npm run build && npm test`
Expected: all green.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "docs: add README"
```

---

## Self-review

- **Spec coverage:** every section of the design doc maps to a task — scaffold (1), API client URL/headers (2), API client errors (3), mode resolution (4), errors module + exit codes (5), JSON envelope (6), table renderer (7), commander root + global flags (8), each command group (9–14), opt-in smoke (15), README (16). The `--columns` / `--all-columns` override flags in the spec are NOT implemented in this plan — they are deferred. (Default columns per command are wired through.)
- **Placeholder scan:** no TBDs, every step has concrete code or commands, no "similar to Task N" shortcuts.
- **Type/name consistency:** `apiGet`, `ApiError`, `CliError`, `chooseMode`, `renderJson`, `buildSuccessEnvelope`, `buildErrorEnvelope`, `renderTable`, `renderKeyValueTable`, `formatPrice`, `formatCell`, `writeTable`, `register`, `runList`/`runGet`/`runOffers`/`runCurrent`/`runHistory`/`runFilters`/`runRecent`/`runHealth`, `GlobalOpts` — used identically across all tasks. `clientOptsFrom`/`mode` helpers are duplicated per command file (acceptable for clarity; can be extracted later if duplication grows).
- **Spec gap noted:** `--columns` / `--all-columns` flags are intentionally deferred. Add as a follow-up task if needed.
