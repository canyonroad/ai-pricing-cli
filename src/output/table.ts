import Table from "cli-table3";

const EM_DASH = "—";

export function formatPrice(price: number | null | undefined, unit: string): string {
  if (price === null || price === undefined) return EM_DASH;
  const value = `$${price.toFixed(4)}`;
  if (unit === "per_1m_tokens") return `${value} / 1M tok`;
  return `${value} / ${unit}`;
}

export function formatCell(value: unknown): string {
  if (value === null || value === undefined) return EM_DASH;
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(formatCell).join(", ");
  return JSON.stringify(value);
}

export type RenderTableOptions = {
  formatters?: Record<string, (row: Record<string, unknown>) => string>;
};

export function renderTable(
  rows: Record<string, unknown>[],
  columns: string[],
  options: RenderTableOptions = {},
): string {
  if (rows.length === 0) return "(no rows)\n";
  const table = new Table({ head: columns, style: { head: [] } });
  for (const row of rows) {
    table.push(
      columns.map((col) => {
        const fmt = options.formatters?.[col];
        return fmt ? fmt(row) : formatCell(row[col]);
      }),
    );
  }
  return `${table.toString()}\n`;
}

export function renderKeyValueTable(obj: Record<string, unknown>): string {
  const table = new Table({ head: ["field", "value"], style: { head: [] } });
  for (const [k, v] of Object.entries(obj)) {
    table.push([k, formatCell(v)]);
  }
  return `${table.toString()}\n`;
}

export function writeTable(text: string, stream: NodeJS.WriteStream = process.stdout): void {
  stream.write(text);
}