import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { Verdict } from "@ledger/claims/model";
import { afterEach, beforeEach, test, vi } from "vitest";
import { dataDir, defaultEntity, entityCodes, loadEntity, localAudit, localDir, localVerdicts, recordAudit, recordVerdict } from "@/lib/data";
import { examinerId, setting } from "@/lib/env";

const demo = path.resolve(import.meta.dirname, "../../../data/demo");
let local: string;

beforeEach(() => {
  local = mkdtempSync(path.join(tmpdir(), "ledger-local-"));
  vi.stubEnv("LEDGER_DATA_DIR", demo);
  vi.stubEnv("LEDGER_LOCAL_DIR", local);
});

afterEach(() => {
  vi.unstubAllEnvs();
  rmSync(local, { recursive: true, force: true });
});

test("a setting falls back to its default when unset, empty or blank", () => {
  vi.stubEnv("LEDGER_TEST_SETTING", undefined);
  assert.equal(setting("LEDGER_TEST_SETTING", "fallback"), "fallback");
  vi.stubEnv("LEDGER_TEST_SETTING", "");
  assert.equal(setting("LEDGER_TEST_SETTING", "fallback"), "fallback");
  vi.stubEnv("LEDGER_TEST_SETTING", "   ");
  assert.equal(setting("LEDGER_TEST_SETTING", "fallback"), "fallback");
  vi.stubEnv("LEDGER_TEST_SETTING", " set ");
  assert.equal(setting("LEDGER_TEST_SETTING", "fallback"), "set");
});

test("an empty LEDGER_EXAMINER stamps the default examiner, not a blank one", () => {
  vi.stubEnv("LEDGER_EXAMINER", "");
  assert.equal(examinerId(), "EX-02");
  vi.stubEnv("LEDGER_EXAMINER", "EX-07");
  assert.equal(examinerId(), "EX-07");
});

test("empty data and local directories resolve to the defaults under the repository", () => {
  vi.stubEnv("LEDGER_DATA_DIR", "");
  vi.stubEnv("LEDGER_LOCAL_DIR", "");
  assert.equal(path.basename(dataDir()), "demo");
  assert.equal(path.basename(path.dirname(dataDir())), "data");
  assert.equal(path.basename(localDir()), "local");
});

test("the portfolio lists every analysed entity, attention order first", () => {
  const codes = entityCodes();
  assert.equal(codes.length, 12);
  assert.equal(defaultEntity(), codes[0]);
  assert.equal(loadEntity("P-04").code, "P-04");
});

test("a missing analysis names the commands that write it", () => {
  vi.stubEnv("LEDGER_DATA_DIR", local);
  assert.throws(() => entityCodes(), /portfolio\.json is missing\. Run pnpm simulate and pnpm analyse first\./);
});

test("verdicts and audit lines append to the local directory and read back in order", () => {
  assert.deepEqual(localVerdicts(), []);
  assert.deepEqual(localAudit(), []);
  const v = { id: "V-1", entity: "P-04", verdict: "no_issue" } as Verdict;
  recordVerdict(v);
  recordVerdict({ ...v, id: "V-2" });
  recordAudit({ at: "2026-10-26T10:00:00+05:30", actor: "EX-02", action: "verdict_recorded", subject: "P-04 C1", detail: "no issue" });
  assert.deepEqual(
    localVerdicts().map((x) => x.id),
    ["V-1", "V-2"],
  );
  assert.equal(localAudit()[0]?.action, "verdict_recorded");
});
