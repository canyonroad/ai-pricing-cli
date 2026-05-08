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