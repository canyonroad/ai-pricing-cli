import { afterEach, describe, expect, it, vi } from "vitest";
import * as client from "../../src/api/client.js";
import * as json from "../../src/output/json.js";
import * as table from "../../src/output/table.js";
import * as prices from "../../src/commands/prices.js";

afterEach(() => { vi.restoreAllMocks(); });

const SAMPLE_ROW = {
  provider_slug: "anthropic",
  canonical_slug: "claude-haiku-3",
  metric: "input_token",
  unit: "per_1m_tokens",
  price_numeric: 0.25,
  batch_flag: 0,
  tier_key: null,
  latest_observed_at: "2026-05-08T18:31:23.613Z",
};

describe("prices current", () => {
  it("calls /v1/prices/current with all filter flags", async () => {
    const apiGet = vi.spyOn(client, "apiGet").mockResolvedValue({ data: [], limit: 50, offset: 0 });
    vi.spyOn(json, "renderJson").mockImplementation(() => undefined);
    await prices.runCurrent(
      {
        query: "claude",
        provider: "anthropic",
        model: "claude-opus-4",
        family: "claude",
        metric: "input_token",
        billingBasis: "per_token",
        billingTier: "tier-1",
        limit: 5,
        offset: 0,
      },
      { json: true, timeout: 30000 },
    );
    expect(apiGet).toHaveBeenCalledWith(
      "/v1/prices/current",
      {
        q: "claude",
        provider: "anthropic",
        model: "claude-opus-4",
        family: "claude",
        metric: "input_token",
        billing_basis: "per_token",
        billing_tier: "tier-1",
        limit: 5,
        offset: 0,
      },
      expect.anything(),
    );
  });

  it("renders the price column using formatPrice in table mode", async () => {
    vi.spyOn(client, "apiGet").mockResolvedValue({ data: [SAMPLE_ROW], limit: 50, offset: 0 });
    const renderTable = vi.spyOn(table, "renderTable");
    await prices.runCurrent({}, { table: true, timeout: 30000 });
    const [, columns, options] = renderTable.mock.calls[0]!;
    expect(columns).toContain("price");
    expect(options?.formatters?.price?.(SAMPLE_ROW)).toBe("$0.2500 / 1M tok");
  });
});

describe("prices history", () => {
  it("calls /v1/prices/history with the same filters as current", async () => {
    const apiGet = vi.spyOn(client, "apiGet").mockResolvedValue({ data: [], limit: 50, offset: 0 });
    vi.spyOn(json, "renderJson").mockImplementation(() => undefined);
    await prices.runHistory({ provider: "anthropic" }, { json: true, timeout: 30000 });
    expect(apiGet).toHaveBeenCalledWith(
      "/v1/prices/history",
      expect.objectContaining({ provider: "anthropic" }),
      expect.anything(),
    );
  });
});

describe("prices filters", () => {
  it("calls /v1/prices/filters and renders a key-value table from a non-{data} payload", async () => {
    vi.spyOn(client, "apiGet").mockResolvedValue({ providers: ["a"], families: ["x"] });
    const renderKv = vi.spyOn(table, "renderKeyValueTable");
    await prices.runFilters({ query: "claude" }, { table: true, timeout: 30000 });
    expect(renderKv).toHaveBeenCalledWith({ providers: ["a"], families: ["x"] });
  });

  it("emits the response under a JSON envelope with top-level keys", async () => {
    vi.spyOn(client, "apiGet").mockResolvedValue({ providers: ["a"], families: ["x"] });
    const renderJson = vi.spyOn(json, "renderJson").mockImplementation(() => undefined);
    await prices.runFilters({}, { json: true, timeout: 30000 });
    expect(renderJson).toHaveBeenCalledWith({ ok: true, providers: ["a"], families: ["x"] });
  });
});