import { Command, type CommanderError, Option } from "commander";
import pkg from "../package.json" with { type: "json" };
import { ApiError } from "./api/client.js";
import * as changesCmd from "./commands/changes.js";

import * as modelsCmd from "./commands/models.js";
import * as pricesCmd from "./commands/prices.js";
import * as providersCmd from "./commands/providers.js";
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
    .addOption(
      new Option("--timeout <ms>", "request timeout in ms")
        .default(30000)
        .argParser((v) => Number(v)),
    )
    .addOption(new Option("--no-color", "disable ANSI color in tables"))
    .showHelpAfterError(true)
    .exitOverride();

  providersCmd.register(program);
  modelsCmd.register(program);
  pricesCmd.register(program);
  changesCmd.register(program);

  return program;
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
    if (
      err instanceof Error &&
      (err.name === "CommanderError" || err.name === "InvalidArgumentError")
    ) {
      process.exit("exitCode" in err ? (err as CommanderError).exitCode : 1);
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
