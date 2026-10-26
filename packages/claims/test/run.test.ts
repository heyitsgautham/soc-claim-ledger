import assert from "node:assert/strict";
import { cpSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, test } from "vitest";
import type { Calibration, EntityAnalysis, Portfolio, Verdict } from "../src/index";
import { readVerdicts, runAnalysis } from "../src/analyse/run";

// The whole pipeline on three entities: the escalation-gap entity, the one that left an
// export out and the clean control, with the demo's examiner history.

const demo = path.resolve(import.meta.dirname, "../../../data/demo");
let dir: string;
let summary: ReturnType<typeof runAnalysis>;
const read = <T>(p: string) => JSON.parse(readFileSync(path.join(dir, "derived", p), "utf8")) as T;

beforeAll(() => {
  dir = mkdtempSync(path.join(tmpdir(), "ledger-run-"));
  for (const code of ["P-04", "G-04", "S-03"]) cpSync(path.join(demo, code), path.join(dir, code), { recursive: true });
  cpSync(path.join(demo, "verdicts"), path.join(dir, "verdicts"), { recursive: true });
  writeFileSync(path.join(dir, "derived-stale.txt"), "not touched");
  summary = runAnalysis(dir);
}, 60_000);

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

test("the run reports the newest cycle, the entities analysed and the verdicts it read", () => {
  assert.equal(summary.cycle, "FY27-Q1");
  assert.equal(summary.entities, 3);
  assert.equal(summary.verdicts, readVerdicts(path.join(demo, "verdicts/history.ndjson")).length);
  assert.ok(summary.verdicts > 0);
});

test("one analysis file per entity, and the portfolio ranks them by risk with the control last", () => {
  assert.deepEqual(readdirSync(path.join(dir, "derived/entities")).sort(), ["G-04.json", "P-04.json", "S-03.json"]);
  const p = read<Portfolio>("portfolio.json");
  assert.deepEqual(
    p.entries.map((e) => e.rank),
    [1, 2, 3],
  );
  assert.equal(p.entries[0]!.code, "P-04");
  assert.equal(p.entries.at(-1)!.code, "S-03");
  assert.equal(p.entries.at(-1)!.risk, 0);
  for (let i = 1; i < p.entries.length; i++) assert.ok(p.entries[i - 1]!.risk >= p.entries[i]!.risk);
});

test("each entry carries a four-cycle trend, its previous risk and the exports it left out", () => {
  const p = read<Portfolio>("portfolio.json");
  const g04 = p.entries.find((e) => e.code === "G-04")!;
  assert.deepEqual(
    g04.trend.map((t) => t.cycle),
    ["FY26-Q2", "FY26-Q3", "FY26-Q4", "FY27-Q1"],
  );
  assert.equal(g04.previousRisk, g04.trend[2]!.risk);
  assert.deepEqual(g04.missingExports, ["escalations"]);
  assert.ok(g04.insufficient >= 1);
  const p04 = read<EntityAnalysis>("entities/P-04.json");
  assert.equal(p.entries[0]!.gaps, p04.assessment.evaluations.filter((e) => e.status === "gap").length);
});

test("the portfolio totals every submission, alert and case on disk", () => {
  const p = read<Portfolio>("portfolio.json");
  assert.equal(p.generatedFrom.entities, 3);
  assert.equal(p.generatedFrom.submissions, 12);
  let alerts = 0;
  for (const code of ["P-04", "G-04", "S-03"]) {
    for (const q of readdirSync(path.join(dir, code))) {
      alerts += JSON.parse(readFileSync(path.join(dir, code, q, "manifest.json"), "utf8")).exports.alerts.rows;
    }
  }
  assert.equal(p.generatedFrom.alerts, alerts);
  assert.ok(p.analysedInSeconds >= 0);
});

test("calibration covers every cycle, and the run rewrites derived/ without touching anything else", () => {
  const c = read<Calibration>("calibration.json");
  assert.deepEqual(
    c.cycles.map((x) => x.id),
    ["FY26-Q2", "FY26-Q3", "FY26-Q4", "FY27-Q1"],
  );
  assert.equal(readFileSync(path.join(dir, "derived-stale.txt"), "utf8"), "not touched");
  writeFileSync(path.join(dir, "derived", "leftover.json"), "{}");
  runAnalysis(dir);
  assert.equal(existsSync(path.join(dir, "derived", "leftover.json")), false);
}, 60_000);

test("a missing verdict history reads as none, and blank lines are skipped", () => {
  assert.deepEqual(readVerdicts(path.join(dir, "nowhere.ndjson")), []);
  const f = path.join(dir, "v.ndjson");
  writeFileSync(f, `${JSON.stringify({ id: "V-1" })}\n\n${JSON.stringify({ id: "V-2" })}\n`);
  assert.deepEqual(
    readVerdicts(f).map((v: Pick<Verdict, "id">) => v.id),
    ["V-1", "V-2"],
  );
});
