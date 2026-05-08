import { ApiError } from "../api/client.js";

export class CliError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CliError";
  }
}

export function exitCodeFor(err: unknown): number {
  if (err instanceof ApiError) {
    switch (err.code) {
      case "not_found":
        return 2;
      case "rate_limited":
        return 3;
      case "http_error":
      case "parse_error":
        return 4;
      case "network":
      case "timeout":
        return 5;
    }
  }
  return 1;
}
