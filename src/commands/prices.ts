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