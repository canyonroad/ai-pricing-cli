import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const CLI = resolve(__dirname, "..", "dist", "cli.js");

function run(args: string[], env: Record<string, string> = {}): { stdout: string; code: number } {
  try {
    const stdout = execFileSync("node", [CLI, ...args], {
      encoding: "utf8",
      env: { ...process.env, ...env },
    });
    return { stdout, code: 0 };
  } catch (err) {
    const e = err as { status?: number; stdout?: string };
    return { stdout: e.stdout ?? "", code: e.status ?? 1 };
  }
}

describe("cli smoke", () => {
  it("prints the version", () => {
    const { stdout, code } = run(["--version"]);
    expect(code).toBe(0);
    expect(stdout.trim()).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("emits a JSON error envelope when piped (stdout not a TTY) and the host is unreachable", () => {
    const { stdout, code } = run(["providers", "list"], {
      AI_PRICING_BASE_URL: "http://127.0.0.1:1",
    });
    const env = JSON.parse(stdout);
    expect(env.ok).toBe(false);
    expect(env.error.code).toBe("network");
    expect(code).toBe(5);
  });
});
