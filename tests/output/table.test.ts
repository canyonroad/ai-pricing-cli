import { describe, expect, it } from "vitest";
import {
  formatCell,
  formatPrice,
  renderKeyValueTable,
  renderTable,
} from "../../src/output/table.js";

describe("formatPrice", () => {
  it("formats per_1m_tokens prices as '$X.XXXX / 1M tok'", () => {
    expect(formatPrice(0.015, "per_1m_tokens")).toBe("$0.0150 / 1M tok");
    expect(formatPrice(15, "per_1m_tokens")).toBe("$15.0000 / 1M tok");
  });

  it("falls back to '$X.XXXX / <unit>' for other units", () => {
    expect(formatPrice(1.5, "per_image")).toBe("$1.5000 / per_image");
  });

  it("returns an em dash when price is null/undefined", () => {
    expect(formatPrice(null, "per_1m_tokens")).toBe("—");
    expect(formatPrice(undefined, "per_1m_tokens")).toBe("—");
  });
});

describe("formatCell", () => {
  it("renders null/undefined as em dash", () => {
    expect(formatCell(null)).toBe("—");
    expect(formatCell(undefined)).toBe("—");
  });

  it("renders booleans as 'true'/'false'", () => {
    expect(formatCell(true)).toBe("true");
    expect(formatCell(false)).toBe("false");
  });

  it("renders numbers and strings as-is", () => {
    expect(formatCell(42)).toBe("42");
    expect(formatCell("hi")).toBe("hi");
  });

  it("renders arrays joined by ', '", () => {
    expect(formatCell(["a", "b", "c"])).toBe("a, b, c");
  });

  it("renders objects as JSON", () => {
    expect(formatCell({ k: 1 })).toBe('{"k":1}');
  });
});

describe("renderTable", () => {
  it("renders a table with the given columns and rows", () => {
    const out = renderTable(
      [
        { slug: "anthropic", name: "Anthropic", active: true },
        { slug: "openai", name: "OpenAI", active: true },
      ],
      ["slug", "name", "active"],
    );
    expect(out).toContain("slug");
    expect(out).toContain("anthropic");
    expect(out).toContain("OpenAI");
    expect(out).toContain("true");
  });

  it("returns the literal string '(no rows)\\n' for empty input", () => {
    expect(renderTable([], ["slug"])).toBe("(no rows)\n");
  });

  it("renders missing keys as the em dash", () => {
    const out = renderTable([{ slug: "x" }], ["slug", "missing"]);
    expect(out).toContain("—");
  });
});

describe("renderKeyValueTable", () => {
  it("renders one row per key", () => {
    const out = renderKeyValueTable({ slug: "anthropic", active: true, notes: null });
    expect(out).toContain("slug");
    expect(out).toContain("anthropic");
    expect(out).toContain("active");
    expect(out).toContain("true");
    expect(out).toContain("notes");
    expect(out).toContain("—");
  });
});
