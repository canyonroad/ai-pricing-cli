import { afterEach, describe, expect, it, vi } from "vitest";
import * as client from "../../src/api/client.js";
import * as json from "../../src/output/json.js";
import * as table from "../../src/output/table.js";
import * as gpus from "../../src/commands/gpus.js";

afterEach(() => { vi.restoreAllMocks(); });

describe("gpus list", () => {
  it("calls /v1/gpus", async () => {
    const apiGet = vi.spyOn(client, "apiGet").mockResolvedValue({ data: [], limit: 50, offset: 0 });
    vi.spyOn(json, "renderJson").mockImplementation(() => undefined);
    await gpus.runList({ limit: 5 }, { json: true, timeout: 30000 });
    expect(apiGet).toHaveBeenCalledWith("/v1/gpus", { limit: 5, offset: undefined }, expect.anything());
  });

  it("renders default columns in table mode", async () => {
    vi.spyOn(client, "apiGet").mockResolvedValue({
      data: [{ sku: "h100-80", vendor: "nvidia", name: "H100 80GB", vram_gb: 80 }],
      limit: 50,
      offset: 0,
    });
    const renderTable = vi.spyOn(table, "renderTable");
    await gpus.runList({}, { table: true, timeout: 30000 });
    expect(renderTable).toHaveBeenCalledWith(expect.any(Array), ["sku", "vendor", "name", "vram_gb"]);
  });
});

describe("gpus offers", () => {
  it("calls /v1/gpus/:sku/offers", async () => {
    const apiGet = vi.spyOn(client, "apiGet").mockResolvedValue({ data: [], limit: 50, offset: 0 });
    vi.spyOn(json, "renderJson").mockImplementation(() => undefined);
    await gpus.runOffers("h100-80", {}, { json: true, timeout: 30000 });
    expect(apiGet).toHaveBeenCalledWith("/v1/gpus/h100-80/offers", { limit: undefined, offset: undefined }, expect.anything());
  });
});