import assert from "node:assert/strict";
import path from "node:path";
import { test } from "vitest";
import { analyseEntity, drawSamples, extentOf, riskIndicator, type SupervisoryFinding, Workspace } from "../src/index";

const ws = new Workspace(path.resolve(import.meta.dirname, "../../../data/demo"));
const p04 = analyseEntity(ws, "P-04", "FY27-Q1", []);

test("extent grows with each tolerance past the claim, and each one matters less", () => {
  assert.equal(extentOf(0), 0);
  assert.equal(Number(extentOf(1).toFixed(2)), 0.2);
  assert.equal(Number(extentOf(5).toFixed(2)), 0.67);
  assert.equal(Number(extentOf(10).toFixed(2)), 0.89);
  assert.equal(Number(extentOf(20).toFixed(2)), 0.99);
});

test("the risk indicator rises with each finding and flattens toward 100", () => {
  const f = (weight: number) => ({ weight }) as SupervisoryFinding;
  assert.equal(riskIndicator([]), 0);
  assert.equal(riskIndicator([f(1)]), 39);
  assert.equal(riskIndicator([f(1), f(1)]), 63);
  assert.equal(riskIndicator([f(1), f(1), f(1), f(1), f(1), f(1)]), 95);
});

test("P-04's findings run strongest first and each one names its detector", () => {
  assert.ok(p04.findings.length >= 3);
  const weights = p04.findings.map((f) => f.weight);
  assert.deepEqual(
    weights,
    [...weights].sort((a, b) => b - a),
  );
  assert.ok(p04.findings.every((f) => f.detector.version.match(/^\d+\.\d+\.\d+$/)));
  assert.equal(new Set(p04.findings.map((f) => f.id)).size, p04.findings.length);
  assert.equal(p04.risk, riskIndicator(p04.findings));
});

test("without verdicts every detector is weighted at the default precision", () => {
  assert.ok(p04.findings.every((f) => f.precision === null));
  assert.ok(p04.findings.every((f) => Math.abs(f.weight - f.severity * 0.75) < 1e-12));
});

test("the sample sheet covers each finding before any second record, and holds back two controls", () => {
  const s = p04.samples;
  assert.equal(s.items.length, 10);
  assert.equal(new Set(s.items.map((i) => i.key)).size, 10);
  assert.deepEqual(
    s.items.map((i) => i.n),
    Array.from({ length: 10 }, (_, i) => i + 1),
  );
  const picks = s.items.map((i) => i.pick);
  assert.equal(picks.filter((p) => p === "counterexample").length, 1);
  assert.equal(picks.filter((p) => p === "random").length, 1);
  const findingsSampled = new Set(s.items.flatMap((i) => i.reasons.map((r) => r.findingId)));
  const findingsWithSubjects = p04.findings.filter((f) => Object.values(f.subjects).some((ids) => ids?.length));
  assert.ok(findingsWithSubjects.every((f) => findingsSampled.has(f.id)));
});

test("the same entity and cycle always draw the same sample", () => {
  const again = drawSamples(ws, "P-04", "FY27-Q1", p04.findings);
  assert.deepEqual(
    again.items.map((i) => i.key),
    p04.samples.items.map((i) => i.key),
  );
  assert.equal(again.seed, "sample/P-04/FY27-Q1");
});

test("the clean control raises no finding and scores zero risk", () => {
  const p01 = analyseEntity(ws, "P-01", "FY27-Q1", []);
  assert.equal(p01.findings.length, 0);
  assert.equal(p01.risk, 0);
});
