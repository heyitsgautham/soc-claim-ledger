import assert from "node:assert/strict";
import type { AuditEntry } from "@ledger/claims/model";
import { test } from "vitest";
import { AuditLog } from "@/components/calibration/audit-log";
import { CalibrationTable } from "@/components/calibration/calibration-table";
import { calibration, html, text } from "./demo";

const c = calibration();
const current = c.cycles.at(-1)!.id;

test("one row per detector and one cell per cycle, the current cycle marked in progress", () => {
  const out = html(<CalibrationTable calibration={c} current={current} />);
  for (const r of c.rows) for (const cell of r.cells) assert.match(out, new RegExp(`data-testid="precision-${r.detector.id}-${cell.cycle}"`));
  assert.equal(out.match(/, in progress/g)?.length, 1);
});

test("precision reads as a whole percent, below half in the gap colour, and an empty cell says why", () => {
  const row = c.rows[0]!;
  const cells = row.cells.map((cell, i) => ({ ...cell, precision: [0.873, 0.4, null, null][i] ?? null, reviewed: 3 }));
  const one = { ...c, rows: [{ ...row, cells }] };
  const out = html(<CalibrationTable calibration={one} current={row.cells.at(-1)!.cycle} />);
  assert.match(out, /text-ink">87</);
  assert.match(out, /text-gap">40</);
  assert.match(out, /not flagged/);
  assert.match(out, /awaiting verdicts/);
});

test("a new detector version is boxed in the cycle it first ran", () => {
  const tn = c.rows.find((r) => r.detector.id === "templated-notes")!;
  const out = html(<CalibrationTable calibration={{ ...c, rows: [tn] }} current={current} />);
  assert.match(out, /border border-ink[^"]*">v1\.1\.0</);
  assert.doesNotMatch(out, /border border-ink[^"]*">v1\.0\.0</);
});

test("the audit log lists entries as given, highlights fresh ones and never system lines", () => {
  const entries: AuditEntry[] = [
    { at: "2026-10-26T10:05:00+05:30", actor: "EX-02", action: "verdict_recorded", subject: "P-04 C-1", detail: "no issue" },
    { at: "2026-10-26T10:04:00+05:30", actor: "SYSTEM", action: "detector_released", subject: "templated-notes 1.1.0", detail: "threshold 0.95" },
    { at: "2026-10-01T09:00:00+05:30", actor: "EX-01", action: "report_exported", subject: "P-04 SR-P04.pdf", detail: "6 pages" },
  ];
  const out = html(<AuditLog entries={entries} highlightSince="2026-10-26T10:00:00+05:30" />);
  assert.equal(out.match(/anim-settle/g)?.length, 1);
  assert.match(text(<AuditLog entries={entries} highlightSince={null} />), /2026-10-26 10:05 EX-02 Verdict P-04 C-1 no issue 2026-10-26 10:04 SYSTEM Release/);
  assert.doesNotMatch(html(<AuditLog entries={entries} highlightSince={null} />), /anim-settle/);
});
