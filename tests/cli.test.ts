import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const CLI = resolve(__dirname, "..", "dist", "cli.js");

function run(
  args: string[],
  env: Record<string, string> = {},
): { stdout: string; stderr: string; code: number } {
  try {
    const stdout = execFileSync("node", [CLI, ...args], {
      encoding: "utf8",
      env: {
        ...process.env,
        ...env,
        AI_PRICING_BASE_URL: env.AI_PRICING_BASE_URL ?? "http://127.0.0.1:1",
      },
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
  });

  it("exits 1 on unknown commands", () => {
    const { code } = run(["nonsense"]);
    expect(code).toBe(1);
  });
});
