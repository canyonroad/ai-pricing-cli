import { afterEach, describe, expect, it, vi } from "vitest";
import * as client from "../../src/api/client.js";
import * as health from "../../src/commands/health.js";
import * as json from "../../src/output/json.js";
import * as table from "../../src/output/table.js";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("health", () => {
  it("calls /_health", async () => {
    const apiGet = vi.spyOn(client, "apiGet").mockResolvedValue({ ok: true });
    vi.spyOn(json, "renderJson").mockImplementation(() => undefined);
    await health.runHealth({ json: true, timeout: 30000 });
    expect(apiGet).toHaveBeenCalledWith("/_health", undefined, expect.anything());
  });

  it("renders the body as a key/value table", async () => {
    vi.spyOn(client, "apiGet").mockResolvedValue({ ok: true, version: "abc" });
    const renderKv = vi.spyOn(table, "renderKeyValueTable");
    await health.runHealth({ table: true, timeout: 30000 });
    expect(renderKv).toHaveBeenCalledWith({ ok: true, version: "abc" });
  });
});
