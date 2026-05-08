import { afterEach, describe, expect, it, vi } from "vitest";
import * as client from "../../src/api/client.js";
import * as json from "../../src/output/json.js";
import * as table from "../../src/output/table.js";
import * as providers from "../../src/commands/providers.js";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("providers list", () => {
  it("calls /v1/providers with active and pagination flags", async () => {
    const apiGet = vi.spyOn(client, "apiGet").mockResolvedValue({ data: [], limit: 50, offset: 0 });
    const writeJson = vi.spyOn(json, "renderJson").mockImplementation(() => undefined);
    await providers.runList({ active: "true", limit: 5, offset: 10 }, { json: true, baseUrl: "http://x", timeout: 30000 });
    expect(apiGet).toHaveBeenCalledWith(
      "/v1/providers",
      { active: "true", limit: 5, offset: 10 },
      { baseUrl: "http://x", timeoutMs: 30000 },
    );
    expect(writeJson).toHaveBeenCalledOnce();
  });

  it("renders the table when mode is table", async () => {
    vi.spyOn(client, "apiGet").mockResolvedValue({
      data: [{ slug: "anthropic", name: "Anthropic", active: true, pricing_url: "u" }],
      limit: 50,
      offset: 0,
    });
    const renderTable = vi.spyOn(table, "renderTable");
    await providers.runList({}, { table: true, timeout: 30000 });
    expect(renderTable).toHaveBeenCalledWith(
      [{ slug: "anthropic", name: "Anthropic", active: true, pricing_url: "u" }],
      ["slug", "name", "active", "pricing_url"],
    );
  });
});

describe("providers get", () => {
  it("calls /v1/providers/:slug and renders a key/value table", async () => {
    vi.spyOn(client, "apiGet").mockResolvedValue({ slug: "anthropic", name: "Anthropic", active: true });
    const renderKv = vi.spyOn(table, "renderKeyValueTable");
    await providers.runGet("anthropic", { table: true, timeout: 30000 });
    expect(renderKv).toHaveBeenCalledWith({ slug: "anthropic", name: "Anthropic", active: true });
  });
});

describe("providers offers", () => {
  it("calls /v1/providers/:slug/offers", async () => {
    const apiGet = vi.spyOn(client, "apiGet").mockResolvedValue({ data: [], limit: 50, offset: 0 });
    await providers.runOffers("anthropic", { limit: 10 }, { json: true, timeout: 30000 });
    expect(apiGet).toHaveBeenCalledWith("/v1/providers/anthropic/offers", { limit: 10, offset: undefined }, expect.anything());
  });
});