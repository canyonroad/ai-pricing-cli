# ai-pricing CLI — design

Date: 2026-05-08

## Purpose

A TypeScript CLI named `ai-pricing` that wraps the public read API of the
ai-pricing service (`https://ai-pricing.fyi`). The CLI must be both
**human-friendly** (pretty tables on a terminal) and **agent-friendly**
(stable JSON envelope when piped, structured errors, deterministic exit
codes).

## Scope

Read-only coverage of the public `/v1/*` API:

- providers, models, prices/current, prices/history, prices/filters,
  changes/recent, gpus, `_health`.
- No admin / `/internal/v1/*` endpoints.
- No write operations.
- No client-side caching.

## Non-goals

- No interactive UI / TUI.
- No automatic pagination across pages — the `--limit`/`--offset` flags
  pass through to the server, one request per invocation.
- No client-side schema validation; the CLI passes the API response
  through verbatim in JSON mode.

## Architecture

```
ai-pricing-cli/
  package.json          # bin: { ai-pricing: dist/cli.js }, type: module, engines.node >= 20
  tsconfig.json
  tsup.config.ts        # entry: src/cli.ts, format: esm, shebang via banner
  vitest.config.ts
  biome.json
  src/
    cli.ts              # commander root, registers subcommands, parses argv
    api/
      client.ts         # fetch wrapper: base-URL, query-string, error normalization
      types.ts          # Provider, Model, PriceRow, Change — typed for table columns
    commands/
      providers.ts      # list / get / offers
      models.ts         # list / get / offers
      prices.ts         # current / history / filters
      changes.ts        # recent
      gpus.ts           # list / offers
      health.ts         # _health
    output/
      mode.ts           # decide json vs table from TTY + flags
      table.ts          # renderTable(rows, columns) using cli-table3
      json.ts           # renderJson(envelope) → stdout
      errors.ts         # CliError, formatError(mode), exit-code mapping
  tests/
    api/client.test.ts
    output/mode.test.ts
    output/table.test.ts
    output/json.test.ts
    commands/*.test.ts  # one per command, mocks the client
    smoke.test.ts       # skipped by default; live hit to /_health when RUN_SMOKE=1
```

### Boundaries

- `api/client.ts` knows nothing about output. Returns parsed JSON or
  throws `ApiError`.
- `output/*` knows nothing about HTTP. Operates on plain values.
- Each `commands/*.ts` is a thin adapter: parses flags, calls the
  client, picks columns for table mode, hands result to the output
  layer. Each command file is small and independently testable.
- Tests mock the client at the function boundary. No live HTTP in CI.

### Toolchain

- **CLI framework:** `commander` — mature, nested subcommand help is
  clean (`ai-pricing prices current --help`), small.
- **Table renderer:** `cli-table3` — Unicode box drawing, ASCII fallback
  via option, column alignment.
- **HTTP:** native `fetch` (Node 20+).
- **Build:** `tsup` (single-file ESM with shebang banner).
- **Test:** `vitest` (matches parent project).
- **Lint/format:** `biome` (matches parent project).

## API client

`src/api/client.ts` exports:

```ts
type ClientOpts = { baseUrl?: string; timeoutMs?: number; userAgent?: string };

class ApiError extends Error {
  code: 'not_found' | 'rate_limited' | 'http_error' | 'network' | 'timeout' | 'parse_error';
  status?: number;     // HTTP status if a response was received
  url: string;         // resolved request URL (with query string)
  body?: unknown;      // parsed JSON error body if the server returned one
}

async function apiGet<T>(
  path: string,
  query?: Record<string, string | number | boolean | undefined>,
  opts?: ClientOpts,
): Promise<T>;
```

### Behavior

- **Base URL resolution order:** `opts.baseUrl` → `AI_PRICING_BASE_URL`
  env → `https://ai-pricing.fyi`.
- **Query-string building:** drops `undefined` values, URL-encodes the
  rest. Booleans serialized as `true`/`false`. No client-side validation
  of filter values.
- **Headers:** `Accept: application/json`,
  `User-Agent: ai-pricing-cli/<version>`.
- **Timeout:** 30 s default via `AbortController`; overridable via
  `--timeout`.
- **Error mapping:**
  - HTTP 404 → `code: 'not_found'`
  - HTTP 429 → `code: 'rate_limited'`
  - other non-2xx → `code: 'http_error'`
  - fetch reject (DNS, connection refused) → `code: 'network'`
  - abort due to timeout → `code: 'timeout'`
  - non-JSON / malformed body → `code: 'parse_error'`
  - The server's JSON error body (if present) is preserved on
    `ApiError.body`.
- **Return value:** parsed JSON body verbatim. No remapping of
  `{data, limit, offset}` or `{providers, families, ...}` envelopes.

### Why no Zod

The CLI is a pass-through; if the server adds a field we want it to
surface in `--json` mode. Static types in `types.ts` are best-effort and
cover only the columns we render in tables.

## Commands & flags

### Common (root) flags

Inherited by every subcommand:

```
--json              Force JSON output (overrides TTY detection)
--table             Force table output
--base-url <url>    Override base URL (env: AI_PRICING_BASE_URL)
--timeout <ms>      Override request timeout (default 30000)
--no-color          Disable ANSI color in tables
-h, --help          Per-command help with usage examples
-V, --version
```

### Subcommand → endpoint map

| Command | Path | Notable flags |
|---|---|---|
| `providers list` | `/v1/providers` | `--active <bool>` `--limit <n>` `--offset <n>` |
| `providers get <slug>` | `/v1/providers/:slug` | — |
| `providers offers <slug>` | `/v1/providers/:slug/offers` | `--limit` `--offset` |
| `models list` | `/v1/models` | `--vendor <slug>` `--family <name>` `--limit` |
| `models get <canonical_slug>` | `/v1/models/:canonical_slug` | — |
| `models offers <canonical_slug>` | `/v1/models/:canonical_slug/offers` | `--limit` `--offset` |
| `prices current` | `/v1/prices/current` | `-q, --query <q>` `--provider <slug>` `--model <slug>` `--family <name>` `--metric <m>` `--billing-basis <b>` `--billing-tier <t>` `--limit` `--offset` |
| `prices history` | `/v1/prices/history` | same shape as `current` |
| `prices filters` | `/v1/prices/filters` | `-q, --query <q>` `--provider` `--model` `--family` |
| `changes recent` | `/v1/changes/recent` | `--limit` |
| `gpus list` | `/v1/gpus` | `--limit` `--offset` |
| `gpus offers <sku>` | `/v1/gpus/:sku/offers` | `--limit` `--offset` |
| `health` | `/_health` | — |

### Default table columns

`--json` returns the full server payload; these only apply in table mode.

- `providers list`: `slug`, `name`, `active`, `pricing_url`
- `providers get`: vertical key/value table (one row per field)
- `providers offers`: `provider_offer_key`, `canonical_slug`, `metric`, `unit`, `price`, `batch`, `observed_at`
- `models list`: `canonical_slug`, `vendor`, `family`, `display_name`, `status`
- `models get`: vertical key/value table
- `models offers`: `provider_slug`, `metric`, `unit`, `price`, `batch`, `observed_at`
- `prices current`: `provider_slug`, `canonical_slug`, `metric`, `unit`, `price`, `batch_flag`, `tier_key`, `latest_observed_at`
- `prices history`: `provider_slug`, `canonical_slug`, `metric`, `price`, `observed_at`
- `prices filters`: vertical, one row per filter key, value cells join the array values with ', '
- `changes recent`: `observed_at`, `provider_slug`, `canonical_slug`, `metric`, `old_price → new_price`
- `gpus list`: `sku`, `vendor`, `name`, `vram_gb`
- `gpus offers`: `provider_slug`, `region`, `unit`, `price`, `observed_at`
- `health`: vertical key/value

### Column override flags

Available on every list/offers command in table mode:

- `--columns col1,col2,...` — override default columns (only keys
  present in the API response are rendered; unknown keys produce
  `(missing)`).
- `--all-columns` — render every key the server returned.

## Output, errors, exit codes

### Mode resolution (`src/output/mode.ts`)

1. `--json` flag → `json`
2. `--table` flag → `table`
3. `process.stdout.isTTY === true` → `table`
4. Otherwise → `json`

`--no-color` and `NO_COLOR` env disable ANSI in table mode but do not
change the chosen mode. `CI` env is not special-cased — most CIs are
non-TTY anyway and naturally land on JSON.

### JSON envelope

Always wraps the server response. Shape:

```jsonc
// Success — passes through whatever the server returned, plus ok + meta.
{
  "ok": true,
  "data": [ /* when the server returned {data: ...} */ ],
  "limit": 50, "offset": 0,                  // passed through when present
  "meta": { "url": "https://ai-pricing.fyi/v1/providers?limit=50", "ms": 124 }
}
```

For endpoints that do not use a `data` envelope (e.g. `/v1/prices/filters`
returns `{providers, families, ...}`, `/v1/changes/recent` returns
`{changes}`), the envelope spreads the top-level keys alongside `ok` and
`meta` instead of forcing them under `data`. Rule: **server response
+ `ok` + `meta`**.

```jsonc
// Error
{
  "ok": false,
  "error": {
    "code": "not_found",
    "status": 404,
    "message": "Provider not found",
    "url": "https://ai-pricing.fyi/v1/providers/does-not-exist"
  }
}
```

### Table mode

- `cli-table3` with the Unicode box style. ASCII fallback when
  `--no-color`/`NO_COLOR` is set.
- Numbers right-aligned. Prices formatted as `$0.0150 / 1M tok` from
  `price_numeric` + `unit`.
- `null` rendered as dim `—`.
- Long URLs truncated with `…` to terminal width; full value available
  via `--json`.
- Empty result → prints `(no rows)` to stderr, exit 0.

### Errors

- **JSON mode:** error envelope on stdout, non-zero exit.
- **Table mode:** red `Error: <message>` on stderr (no JSON), non-zero
  exit.
- `--help` and `--version` always exit 0 and bypass mode logic.

### Exit codes

| Code | Cause |
|---|---|
| 0 | Success |
| 1 | Generic CLI failure (commander argument errors, validation) |
| 2 | `not_found` (HTTP 404) |
| 3 | `rate_limited` (HTTP 429) |
| 4 | `http_error` (other non-2xx) |
| 5 | `network` / `timeout` |

Stable codes let an agent branch on `$?` without parsing JSON.

## Distribution

- Standalone npm package, name `ai-pricing`, published with the `bin`
  field set so `npx ai-pricing ...` and `npm i -g ai-pricing` both work.
- ESM-only, `"type": "module"`, `engines.node >= 20`.
- `tsup` builds `src/cli.ts` to `dist/cli.js` with a `#!/usr/bin/env node`
  banner.
- `prepublishOnly` script runs typecheck + tests + build.

## Testing

Vitest, mirroring the parent project's setup.

- `tests/api/client.test.ts` — `vi.stubGlobal('fetch', ...)` to assert:
  URL composition, headers, base-URL precedence, error code mapping
  (404 → `not_found`, 429 → `rate_limited`, network reject → `network`,
  abort → `timeout`, non-JSON body → `parse_error`), preservation of
  the server's JSON error body on `ApiError.body`.
- `tests/output/mode.test.ts` — given flag combinations and a fake
  `isTTY`, returns the right mode.
- `tests/output/table.test.ts` — snapshots for representative rows;
  verifies `null` rendering, price formatting, `--columns` override,
  `--all-columns`.
- `tests/output/json.test.ts` — envelope shape for `{data: [...]}`
  endpoints, for filter-style `{providers, families, ...}` endpoints,
  and for the error case.
- `tests/commands/*.test.ts` — one file per command. Mocks `apiGet`,
  asserts (a) the right path/query was requested, (b) success path
  renders the right columns / JSON shape, (c) error path produces the
  right exit code + envelope.
- `tests/smoke.test.ts` — skipped by default; runs only when
  `RUN_SMOKE=1`. Hits `https://ai-pricing.fyi/_health`. Not part of CI.

`npm run typecheck`, `npm run lint`, and `npm test` are the three
gates.

## Open questions

None at this point.
