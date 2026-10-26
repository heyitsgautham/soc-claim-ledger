import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, test, vi } from "vitest";
import { GET } from "@/app/api/health/route";
import { log } from "@/lib/log";
import pkg from "../package.json";

const demo = path.resolve(import.meta.dirname, "../../../data/demo");

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

test("health is ok with the version, the cycle and the entity count when the analysis is on disk", async () => {
  vi.stubEnv("LEDGER_DATA_DIR", demo);
  const res = GET();
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.status, "ok");
  assert.equal(body.version, pkg.version);
  assert.match(body.cycle, /^FY\d{2}-Q[1-4]$/);
  assert.equal(body.entities, 12);
});

test("health is a 503 that names the missing analysis, and logs it", async () => {
  const empty = mkdtempSync(path.join(tmpdir(), "ledger-health-"));
  vi.stubEnv("LEDGER_DATA_DIR", empty);
  const error = vi.spyOn(log, "error").mockImplementation(() => undefined);
  try {
    const res = GET();
    assert.equal(res.status, 503);
    const body = await res.json();
    assert.equal(body.status, "unavailable");
    assert.match(body.detail, /portfolio\.json is missing\. Run pnpm simulate and pnpm analyse first\./);
    assert.equal(error.mock.calls.length, 1);
  } finally {
    rmSync(empty, { recursive: true, force: true });
  }
});
