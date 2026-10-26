import assert from "node:assert/strict";
import { cpSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { SubmissionError } from "@ledger/submission";
import { test } from "vitest";
import { assessLatest, ClaimsFileSchema, excess, holds, loadClaimsFile, type Measure, measureValue, shortfall } from "../src/index";
import { mean, minutesBetween, mode } from "../src/context";

const data = path.resolve(import.meta.dirname, "../../../data/demo");
const pct = (value: number): Measure => ({ kind: "percent", value });
const secs = (seconds: number): Measure => ({ kind: "duration", seconds });

test("every measure reads on one axis: shares in percent, durations in seconds, counts as counts", () => {
  assert.equal(measureValue(pct(61)), 61);
  assert.equal(measureValue({ kind: "fraction", numerator: 3, denominator: 4 }), 75);
  assert.equal(measureValue(secs(90)), 90);
  assert.equal(measureValue({ kind: "count", value: 12 }), 12);
});

test("a claim holds within its tolerance, in the direction that counts as better", () => {
  const points = { kind: "points", value: 2 } as const;
  assert.equal(holds(pct(95), pct(93), "higher_is_better", points), true);
  assert.equal(holds(pct(95), pct(92.9), "higher_is_better", points), false);
  assert.equal(holds(pct(95), pct(100), "higher_is_better", points), true);
  const relative = { kind: "relative", value: 0.1 } as const;
  assert.equal(holds(secs(600), secs(660), "lower_is_better", relative), true);
  assert.equal(holds(secs(600), secs(661), "lower_is_better", relative), false);
  assert.equal(holds({ kind: "count", value: 12 }, { kind: "count", value: 11 }, "higher_is_better", { kind: "exact" }), false);
  assert.equal(holds({ kind: "count", value: 12 }, { kind: "count", value: 12 }, "higher_is_better", { kind: "exact" }), true);
});

test("excess counts a miss in tolerances, so shares and times compare on one footing", () => {
  assert.equal(excess(pct(100), pct(61), "higher_is_better", { kind: "points", value: 2 }), 19.5);
  assert.equal(excess(secs(600), secs(1200), "lower_is_better", { kind: "relative", value: 0.1 }), 10);
  assert.equal(excess(pct(90), pct(95), "higher_is_better", { kind: "points", value: 2 }), 0);
  assert.equal(excess({ kind: "count", value: 12 }, { kind: "count", value: 9 }, "higher_is_better", { kind: "exact" }), 3);
});

test("shortfall is taken out of 100 for shares and out of the claim for times and counts", () => {
  assert.equal(shortfall(pct(100), pct(61), "higher_is_better"), 0.39);
  assert.equal(shortfall(secs(600), secs(900), "lower_is_better"), 0.5);
  assert.equal(shortfall(secs(600), secs(300), "lower_is_better"), 0);
  assert.equal(shortfall({ kind: "count", value: 4 }, { kind: "count", value: 3 }, "higher_is_better"), 0.25);
  assert.equal(shortfall({ kind: "count", value: 0 }, { kind: "count", value: 0 }, "higher_is_better"), 0);
});

test("mean, mode and minutesBetween handle the empty and the tied cases", () => {
  assert.equal(mean([]), 0);
  assert.equal(mean([1, 2, 6]), 3);
  assert.equal(mode([]), undefined);
  assert.equal(mode([240, 60, 240, 60]), 60);
  assert.equal(mode([30, 240, 240]), 240);
  assert.equal(minutesBetween(0, 90 * 60_000), 90);
});

test("the claims file schema refuses a share over 100, a bad ref and an empty claim list", () => {
  const file = loadClaimsFile(path.join(data, "P-04/FY27-Q1"));
  assert.equal(file.entity, "P-04");
  const first = file.claims[0]!;
  assert.equal(ClaimsFileSchema.safeParse({ ...file, claims: [{ ...first, attested: pct(101) }] }).success, false);
  assert.equal(ClaimsFileSchema.safeParse({ ...file, claims: [{ ...first, ref: "5.1" }] }).success, false);
  assert.equal(ClaimsFileSchema.safeParse({ ...file, claims: [] }).success, false);
  assert.equal(ClaimsFileSchema.safeParse({ ...file, claims: [{ ...first, metric: "made_up" }] }).success, false);
});

test("a submission with no claims file, or a broken one, is refused by file name", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "ledger-claims-"));
  try {
    assert.throws(
      () => loadClaimsFile(dir),
      (e: unknown) => e instanceof SubmissionError && /claims\.json: no self-assessment/.test(e.message),
    );
    writeFileSync(path.join(dir, "claims.json"), JSON.stringify({ schema_version: 1, entity: "P-04" }));
    assert.throws(() => loadClaimsFile(dir), /claims\.json: quarter_id/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("assessLatest takes the newest quarter by default, an earlier one on request, and refuses one never submitted", () => {
  assert.equal(assessLatest(data, "S-03").quarter.id, "FY27-Q1");
  const earlier = assessLatest(data, "S-03", "FY26-Q3");
  assert.equal(earlier.quarter.id, "FY26-Q3");
  assert.ok(earlier.window.every((w) => w.id <= "FY26-Q3"));
  assert.throws(() => assessLatest(data, "S-03", "FY20-Q1"), /no submission for S-03 FY20-Q1/);
  assert.throws(() => assessLatest(data, "Z-99"), /no submission for Z-99/);
});

test("a lookback quarter missing from disk narrows the window instead of failing", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "ledger-window-"));
  try {
    cpSync(path.join(data, "S-03/FY27-Q1"), path.join(dir, "S-03/FY27-Q1"), { recursive: true });
    const a = assessLatest(dir, "S-03");
    assert.deepEqual(
      a.window.map((w) => w.id),
      ["FY27-Q1"],
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
