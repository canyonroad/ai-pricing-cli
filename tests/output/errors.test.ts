import { describe, expect, it } from "vitest";
import { ApiError } from "../../src/api/client.js";
import { CliError, exitCodeFor } from "../../src/output/errors.js";

describe("exitCodeFor", () => {
  it("returns 2 for not_found", () => {
    expect(exitCodeFor(new ApiError({ code: "not_found", url: "x", message: "" }))).toBe(2);
  });

  it("returns 3 for rate_limited", () => {
    expect(exitCodeFor(new ApiError({ code: "rate_limited", url: "x", message: "" }))).toBe(3);
  });

  it("returns 4 for http_error and parse_error", () => {
    expect(exitCodeFor(new ApiError({ code: "http_error", url: "x", message: "" }))).toBe(4);
    expect(exitCodeFor(new ApiError({ code: "parse_error", url: "x", message: "" }))).toBe(4);
  });

  it("returns 5 for network and timeout", () => {
    expect(exitCodeFor(new ApiError({ code: "network", url: "x", message: "" }))).toBe(5);
    expect(exitCodeFor(new ApiError({ code: "timeout", url: "x", message: "" }))).toBe(5);
  });

  it("returns 1 for CliError and unknown errors", () => {
    expect(exitCodeFor(new CliError("bad flag"))).toBe(1);
    expect(exitCodeFor(new Error("???"))).toBe(1);
  });
});

describe("CliError", () => {
  it("is throwable with a message", () => {
    const err = new CliError("nope");
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe("nope");
    expect(err.name).toBe("CliError");
  });
});