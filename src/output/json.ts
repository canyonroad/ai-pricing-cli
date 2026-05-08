import { ApiError } from "../api/client.js";
import { CliError } from "./errors.js";

export type SuccessEnvelope = { ok: true } & Record<string, unknown>;
export type ErrorEnvelope = {
  ok: false;
  error: { code: string; status?: number; url?: string; message: string };
};

export function buildSuccessEnvelope(response: unknown): SuccessEnvelope {
  if (response !== null && typeof response === "object" && !Array.isArray(response)) {
    return { ok: true, ...(response as Record<string, unknown>) };
  }
  return { ok: true, data: response as unknown };
}

export function buildErrorEnvelope(err: unknown): ErrorEnvelope {
  if (err instanceof ApiError) {
    return {
      ok: false,
      error: { code: err.code, status: err.status, url: err.url, message: err.message },
    };
  }
  if (err instanceof CliError) {
    return { ok: false, error: { code: "cli_error", message: err.message } };
  }
  const message = err instanceof Error ? err.message : String(err);
  return { ok: false, error: { code: "unknown", message } };
}

export function renderJson(
  envelope: SuccessEnvelope | ErrorEnvelope,
  stream: NodeJS.WriteStream = process.stdout,
): void {
  stream.write(`${JSON.stringify(envelope, null, 2)}\n`);
}
