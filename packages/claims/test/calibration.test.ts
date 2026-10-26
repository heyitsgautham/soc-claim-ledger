import assert from "node:assert/strict";
import { test } from "vitest";
import { calibrate, cycleStartIso, priorPrecision, type Verdict, type VerdictValue } from "../src/index";

let n = 0;
function verdict(
  cycle: string,
  verdict: VerdictValue,
  detectors: [string, string][] = [["templated-notes", "1.0.0"]],
  pick: Verdict["pick"] = "finding",
): Verdict {
  n++;
  return {
    id: `V-${n}`,
    cycle,
    entity: "P-04",
    itemKey: `k${n}`,
    kind: "case",
    recordId: `C-${n}`,
    pick,
    detectors: detectors.map(([id, version]) => ({ id, version })) as Verdict["detectors"],
    verdict,
    examiner: "EX-01",
    recordedAt: `2026-01-0${(n % 9) + 1}T10:00:00+05:30`,
    blind: true,
  };
}

const times = (k: number, make: () => Verdict) => Array.from({ length: k }, make);

test("precision counts confirmed against rejected, and cannot-tell in neither", () => {
  const vs = [...times(3, () => verdict("FY26-Q2", "issue_confirmed")), verdict("FY26-Q2", "no_issue"), ...times(5, () => verdict("FY26-Q2", "cannot_tell"))];
  assert.equal(priorPrecision(vs, "templated-notes", "FY26-Q3"), 0.75);
});

test("only verdicts from before the cycle count, and other detectors' verdicts never do", () => {
  const vs = [verdict("FY26-Q3", "issue_confirmed"), verdict("FY26-Q2", "no_issue", [["sla-bunching", "1.0.0"]])];
  assert.equal(priorPrecision(vs, "templated-notes", "FY26-Q3"), null);
  assert.equal(priorPrecision(vs, "sla-bunching", "FY26-Q3"), 0);
});

test("a new detector version takes over once it has ten verdicts behind it", () => {
  // templated-notes 1.1.0 is current from FY26-Q4. The old version was right 1 time in 4.
  const old = [verdict("FY26-Q2", "issue_confirmed"), ...times(3, () => verdict("FY26-Q2", "no_issue"))];
  const nine = times(9, () => verdict("FY26-Q4", "issue_confirmed", [["templated-notes", "1.1.0"]]));
  assert.equal(priorPrecision([...old, ...nine], "templated-notes", "FY27-Q1"), 10 / 13);
  const ten = [...nine, verdict("FY26-Q4", "issue_confirmed", [["templated-notes", "1.1.0"]])];
  assert.equal(priorPrecision([...old, ...ten], "templated-notes", "FY27-Q1"), 1);
});

test("calibration tallies each detector by cycle, pooled, and the control picks apart", () => {
  const cycles = [
    { id: "FY26-Q2", label: "Q2 FY26" },
    { id: "FY26-Q3", label: "Q3 FY26" },
  ];
  const vs = [
    verdict("FY26-Q2", "issue_confirmed"),
    verdict("FY26-Q3", "no_issue"),
    verdict("FY26-Q3", "issue_confirmed", [], "random"),
    verdict("FY26-Q3", "no_issue", [], "counterexample"),
  ];
  const c = calibrate(vs, cycles);
  const row = c.rows.find((r) => r.detector.id === "templated-notes")!;
  assert.deepEqual(
    row.cells.map((x) => [x.cycle, x.reviewed, x.precision]),
    [
      ["FY26-Q2", 1, 1],
      ["FY26-Q3", 1, 0],
    ],
  );
  assert.deepEqual(row.pooled, { reviewed: 2, confirmed: 1, rejected: 1, precision: 0.5 });
  assert.deepEqual(c.controls, [
    { cycle: "FY26-Q2", reviewed: 0, issues: 0 },
    { cycle: "FY26-Q3", reviewed: 2, issues: 1 },
  ]);
  assert.equal(c.verdicts, 4);
  assert.equal(c.rows.length, 6);
});

test("the audit log lists verdicts and detector releases, newest first", () => {
  const c = calibrate([verdict("FY26-Q2", "issue_confirmed")], [{ id: "FY26-Q4", label: "Q4 FY26" }]);
  const sorted = [...c.audit].sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
  assert.deepEqual(
    c.audit.map((e) => e.at),
    sorted.map((e) => e.at),
  );
  assert.ok(c.audit.some((e) => e.action === "verdict_recorded" && e.detail === "issue confirmed, blind, 1 detector"));
  const release = c.audit.find((e) => e.subject === "templated-notes 1.1.0")!;
  assert.equal(release.action, "detector_released");
  assert.match(release.detail, /first used in Q4 FY26$/);
});

test("each cycle opens the month after its submission lands", () => {
  assert.equal(cycleStartIso("FY26-Q2"), "2025-11-03");
  assert.equal(cycleStartIso("FY26-Q3"), "2026-02-03");
  assert.equal(cycleStartIso("FY26-Q4"), "2026-05-03");
  assert.equal(cycleStartIso("FY27-Q1"), "2026-08-03");
  assert.equal(cycleStartIso("not a cycle"), "2026-01-01");
});
