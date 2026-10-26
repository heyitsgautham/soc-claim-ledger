import assert from "node:assert/strict";
import { Writable } from "node:stream";
import { afterEach, test, vi } from "vitest";
import { createLogger } from "@/lib/log";

function capture() {
  const lines: string[] = [];
  const stream = new Writable({
    write(chunk, _enc, done) {
      lines.push(...String(chunk).split("\n").filter(Boolean));
      done();
    },
  });
  return { stream, entries: () => lines.map((l) => JSON.parse(l) as Record<string, unknown>) };
}

afterEach(() => {
  vi.unstubAllEnvs();
});

test("a line is one JSON object with the level as a word, an ISO time and the service", () => {
  const { stream, entries } = capture();
  createLogger(stream).info({ entity: "P-04", pages: 6 }, "report exported");
  const [e] = entries();
  assert.equal(e?.level, "info");
  assert.equal(e?.service, "ledger-web");
  assert.equal(e?.msg, "report exported");
  assert.equal(e?.entity, "P-04");
  assert.equal(e?.pages, 6);
  assert.match(String(e?.time), /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
});

test("an error logs its type, message and stack", () => {
  const { stream, entries } = capture();
  createLogger(stream).error({ err: new TypeError("no chromium") }, "report export failed");
  const err = entries()[0]?.err as { type: string; message: string; stack: string };
  assert.equal(err.type, "TypeError");
  assert.equal(err.message, "no chromium");
  assert.match(err.stack, /TypeError: no chromium/);
});

test("LOG_LEVEL sets the threshold, and an empty one means info", () => {
  vi.stubEnv("LOG_LEVEL", "warn");
  const quiet = capture();
  const log = createLogger(quiet.stream);
  log.info("hidden");
  log.warn("shown");
  assert.deepEqual(
    quiet.entries().map((e) => e.msg),
    ["shown"],
  );
  vi.stubEnv("LOG_LEVEL", "");
  assert.equal(createLogger(capture().stream).level, "info");
});
