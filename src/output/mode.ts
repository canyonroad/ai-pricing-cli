export type OutputMode = "json" | "table";

export type ModeFlags = {
  json?: boolean;
  table?: boolean;
};

export function chooseMode(flags: ModeFlags, isTty: boolean): OutputMode {
  if (flags.json) return "json";
  if (flags.table) return "table";
  return isTty ? "table" : "json";
}