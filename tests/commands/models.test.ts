import { afterEach, describe, expect, it, vi } from "vitest";
import * as client from "../../src/api/client.js";
import * as json from "../../src/output/json.js";
import * as table from "../../src/output/table.js";
import * as models from "../../src/commands/models.js";

afterEach(() => { vi.restoreAllMocks(); });

describe("models list", () => {
  it("calls /v1/models with vendor, family, and limit", async () => {
    const apiGet = vi.spyOn(client, "apiGet").mockResolvedValue({ data: [], limit: 50, offset: 0 });
    vi.spyOn(json, "renderJson").mockImplementation(() => undefined);
    await models.runList({ vendor: "anthropic", family: "claude", limit: 5 }, { json: true, timeout: 30000 });
    expect(apiGet).toHaveBeenCalledWith(
      "/v1/models",
      { vendor: "anthropic", family: "claude", limit: 5 },
      expect.anything(),
    );
  });

  it("renders default columns in table mode", async () => {
    vi.spyOn(client, "apiGet").mockResolvedValue({
      data: [{ canonical_slug: "claude-opus-4", vendor: "anthropic", family: "opus", display_name: "Claude Opus 4", status: "active" }],
      limit: 50,
      offset: 0,
    });
    const renderTable = vi.spyOn(table, "renderTable");
    await models.runList({}, { table: true, timeout: 30000 });
    expect(renderTable).toHaveBeenCalledWith(
      expect.any(Array),
      ["canonical_slug", "vendor", "family", "display_name", "status"],
    );
  });
});

describe("models get", () => {
  it("calls /v1/models/:slug", async () => {
    const apiGet = vi.spyOn(client, "apiGet").mockResolvedValue({ canonical_slug: "claude-opus-4" });
    vi.spyOn(table, "renderKeyValueTable").mockReturnValue("");
    await models.runGet("claude-opus-4", { table: true, timeout: 30000 });
    expect(apiGet).toHaveBeenCalledWith("/v1/models/claude-opus-4", undefined, expect.anything());
  });
});

describe("models offers", () => {
  it("calls /v1/models/:slug/offers", async () => {
    const apiGet = vi.spyOn(client, "apiGet").mockResolvedValue({ data: [], limit: 50, offset: 0 });
    vi.spyOn(json, "renderJson").mockImplementation(() => undefined);
    await models.runOffers("claude-opus-4", {}, { json: true, timeout: 30000 });
    expect(apiGet).toHaveBeenCalledWith("/v1/models/claude-opus-4/offers", { limit: undefined, offset: undefined }, expect.anything());
  });
});