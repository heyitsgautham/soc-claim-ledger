import assert from "node:assert/strict";
import { cpSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { calibrate, cycleStartIso } from "@ledger/claims";
import { afterAll, beforeAll, test } from "vitest";
import { QUARTERS } from "../src/calendar";
import { simulateExaminers } from "../src/examiners";

// The simulated examiners on two entities: P-04, whose findings are real, and the clean control.

const demo = path.resolve(import.meta.dirname, "../../../data/demo");
let dir: string;
let verdicts: ReturnType<typeof simulateExaminers>;

beforeAll(() => {
  dir = mkdtempSync(path.join(tmpdir(), "ledger-examiners-"));
  for (const code of ["P-04", "S-03"]) cpSync(path.join(demo, code), path.join(dir, code), { recursive: true });
  verdicts = simulateExaminers(dir);
}, 60_000);

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

test("examiners review the sheets of past cycles only, the live cycle waits for a real one", () => {
  const live = QUARTERS.at(-1)!.id;
  const cycles = new Set(verdicts.map((v) => v.cycle));
  assert.ok(!cycles.has(live));
  assert.deepEqual(
    [...cycles].sort(),
    QUARTERS.slice(0, -1).map((q) => q.id),
  );
  assert.deepEqual([...new Set(verdicts.map((v) => v.entity))].sort(), ["P-04", "S-03"]);
});

test("every verdict is blind, by one of four examiners, recorded after its cycle opens", () => {
  for (const v of verdicts) {
    assert.equal(v.blind, true);
    assert.match(v.examiner, /^EX-0[1-4]$/);
    assert.ok(v.recordedAt >= cycleStartIso(v.cycle), v.id);
    assert.match(v.recordedAt, /\+05:30$/);
  }
  const ids = verdicts.map((v) => v.id);
  assert.equal(new Set(ids).size, ids.length);
});

test("the history file holds the same verdicts, oldest first", () => {
  const lines = readFileSync(path.join(dir, "verdicts/history.ndjson"), "utf8").trim().split("\n");
  assert.deepEqual(
    lines.map((l) => JSON.parse(l).id),
    verdicts.map((v) => v.id),
  );
  for (let i = 1; i < verdicts.length; i++) assert.ok(verdicts[i - 1]!.recordedAt <= verdicts[i]!.recordedAt);
});

test("the same submissions always draw the same verdicts", () => {
  assert.deepEqual(simulateExaminers(dir), verdicts);
}, 60_000);

test("examiners mostly confirm the findings on P-04, so its detectors calibrate as precise", () => {
  const p04 = verdicts.filter((v) => v.entity === "P-04" && v.pick === "finding");
  assert.ok(p04.length > 0);
  const confirmed = p04.filter((v) => v.verdict === "issue_confirmed").length;
  assert.ok(confirmed / p04.length > 0.7, `${confirmed} of ${p04.length}`);
  const c = calibrate(
    verdicts,
    QUARTERS.map((q) => ({ id: q.id, label: q.label })),
  );
  const gap = c.rows.find((r) => r.detector.id === "claim-gap")!;
  assert.ok((gap.pooled.precision ?? 0) > 0.7);
});
