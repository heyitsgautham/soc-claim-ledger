import pino, { type DestinationStream, type Logger } from "pino";
import { setting } from "./env";

// The web server's log. One JSON object per line on stdout, like the API's on stderr, so
// one jq filter reads both. Routes log what an examiner did and why a request failed.

export function createLogger(destination?: DestinationStream): Logger {
  const options = {
    base: { service: "ledger-web" },
    level: setting("LOG_LEVEL", "info"),
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: { level: (label: string) => ({ level: label }) },
  };
  return destination ? pino(options, destination) : pino(options);
}

export const log = createLogger();
