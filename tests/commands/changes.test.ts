import { afterEach, describe, expect, it, vi } from "vitest";
import * as client from "../../src/api/client.js";
import * as json from "../../src/output/json.js";
import * as table from "../../src/output/table.js";
import * as changes from "../../src/commands/changes.js";

afterEach(() => { vi.restoreAllMocks(); });

describe("changes recent", () => {
  it("calls /v1/changes/recent with --limit", async () => {
    const apiGet = vi.spyOn(client, "apiGet").mockResolvedValue({ changes: [] });
    vi.spyOn(json, "renderJson").mockImplementation(() => undefined);
    await changes.runRecent({ limit: 10 }, { json: true, timeout: 30000 });
    expect(apiGet).toHaveBeenCalledWith("/v1/changes/recent", { limit: 10 }, expect.anything());
  });

  it("renders the changes array in table mode using a price-delta formatter", async () => {
    vi.spyOn(client, "apiGet").mockResolvedValue({
      changes: [
        {
          observed_at: "2026-05-08",
          provider_slug: "anthropic",
          canonical_slug: "claude-opus-4",
          metric: "input_token",
          old_price: 1.0,
          new_price: 1.5,
        },
      ],
    });
    const renderTable = vi.spyOn(table, "renderTable");
    await changes.runRecent({}, { table: true, timeout: 30000 });
    const [rows, columns, options] = renderTable.mock.calls[0]!;
    expect(rows).toHaveLength(1);
    expect(columns).toContain("price_change");
    expect(options?.formatters?.price_change?.(rows![0]!)).toBe("$1.0000 → $1.5000");
  });

  it("emits {ok:true, changes} envelope in JSON mode", async () => {
    vi.spyOn(client, "apiGet").mockResolvedValue({ changes: [{ x: 1 }] });
    const renderJson = vi.spyOn(json, "renderJson").mockImplementation(() => undefined);
    await changes.runRecent({}, { json: true, timeout: 30000 });
    expect(renderJson).toHaveBeenCalledWith({ ok: true, changes: [{ x: 1 }] });
  });
});