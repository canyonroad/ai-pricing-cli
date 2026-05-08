import { describe, expect, it } from "vitest";
import { chooseMode } from "../../src/output/mode.js";

describe("chooseMode", () => {
  it("forces json when --json is set", () => {
    expect(chooseMode({ json: true }, true)).toBe("json");
    expect(chooseMode({ json: true }, false)).toBe("json");
  });

  it("forces table when --table is set and --json is not", () => {
    expect(chooseMode({ table: true }, false)).toBe("table");
  });

  it("--json wins over --table when both are set", () => {
    expect(chooseMode({ json: true, table: true }, true)).toBe("json");
  });

  it("returns table when stdout is a TTY and no flags", () => {
    expect(chooseMode({}, true)).toBe("table");
  });

  it("returns json when stdout is not a TTY and no flags", () => {
    expect(chooseMode({}, false)).toBe("json");
  });
});
