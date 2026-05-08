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