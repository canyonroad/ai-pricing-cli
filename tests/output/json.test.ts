import { describe, expect, it } from "vitest";
import { ApiError } from "../../src/api/client.js";
import { CliError } from "../../src/output/errors.js";
import { buildErrorEnvelope, buildSuccessEnvelope } from "../../src/output/json.js";

describe("buildSuccessEnvelope", () => {
  it("spreads server response and adds ok:true", () => {
    const env = buildSuccessEnvelope({ data: [{ slug: "anthropic" }], limit: 50, offset: 0 });
    expect(env).toEqual({ ok: true, data: [{ slug: "anthropic" }], limit: 50, offset: 0 });
  });

  it("preserves a server-supplied meta block", () => {
    const env = buildSuccessEnvelope({ data: [], meta: { ms: 12, reads: 3 } });
    expect(env).toEqual({ ok: true, data: [], meta: { ms: 12, reads: 3 } });
  });

  it("works for filter-style responses (no `data` key)", () => {
    const env = buildSuccessEnvelope({ providers: ["a", "b"], families: ["x"] });
    expect(env).toEqual({ ok: true, providers: ["a", "b"], families: ["x"] });
  });

  it("works for non-object responses by wrapping under `data`", () => {
    const env = buildSuccessEnvelope([1, 2, 3]);
    expect(env).toEqual({ ok: true, data: [1, 2, 3] });
  });
});

describe("buildErrorEnvelope", () => {
  it("converts an ApiError to the standard envelope", () => {
    const err = new ApiError({ code: "not_found", status: 404, url: "https://x/y", message: "nope" });
    expect(buildErrorEnvelope(err)).toEqual({
      ok: false,
      error: { code: "not_found", status: 404, url: "https://x/y", message: "nope" },
    });
  });

  it("converts a CliError to the standard envelope with code 'cli_error'", () => {
    expect(buildErrorEnvelope(new CliError("bad flag"))).toEqual({
      ok: false,
      error: { code: "cli_error", message: "bad flag" },
    });
  });

  it("converts an unknown error to code 'unknown'", () => {
    expect(buildErrorEnvelope(new Error("???"))).toEqual({
      ok: false,
      error: { code: "unknown", message: "???" },
    });
  });
});