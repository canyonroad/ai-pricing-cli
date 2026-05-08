import type { Command } from "commander";
import { type ClientOpts, apiGet } from "../api/client.js";
import type { GlobalOpts } from "../cli.js";
import { buildSuccessEnvelope, renderJson } from "../output/json.js";
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
