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