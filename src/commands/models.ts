import type { Command } from "commander";
import { type ClientOpts, apiGet } from "../api/client.js";
import type { GlobalOpts } from "../cli.js";
import { buildSuccessEnvelope, renderJson } from "../output/json.js";
import { chooseMode } from "../output/mode.js";
import { renderKeyValueTable, renderTable, writeTable } from "../output/table.js";

const MODELS_LIST_COLUMNS = ["canonical_slug", "vendor", "family", "display_name", "status"];
const MODEL_OFFERS_COLUMNS = [
  "provider_slug",
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
  const response = await apiGet<Record<string, unknown>>(
    `/v1/models/${encodeURIComponent(slug)}`,
    undefined,
    clientOptsFrom(g),
  );
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
