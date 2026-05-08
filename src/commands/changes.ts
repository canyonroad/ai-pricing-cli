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