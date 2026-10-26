import assert from "node:assert/strict";
import { test } from "vitest";
import type { Alert, Case } from "@ledger/submission";
import { repeatNoRemediation, weekendCoverage } from "../src/index";

const MIN = 60_000;
// A wall-clock time in IST as epoch milliseconds. 1 April 2026 is a Wednesday,
// 4 and 5 April are the weekend, and 6 April is a Monday.
const ist = (day: number, hour = 12, minute = 0) => Date.UTC(2026, 3, day, hour, minute) - 330 * MIN;

let n = 0;
function alert(at: number, waitMin: number | null, extra: Partial<Alert> = {}): Alert {
  n++;
  return {
    id: `AL-${n}`,
    created_at: at,
    rule_id: "R-1",
    priority: "P2",
    asset_id: "A-1",
    acknowledged_at: waitMin === null ? null : at + waitMin * MIN,
    acknowledged_by: "L1-01",
    case_id: null,
    ...extra,
  };
}

function kase(id: string, opened: number, closed: number | null, extra: Partial<Case> = {}): Case {
  return {
    id,
    priority: "P2",
    opened_at: opened,
    rule_id: "R-1",
    asset_id: "A-1",
    alert_count: 1,
    owner: "L1-01",
    playbook_id: null,
    sla_close_minutes: 240,
    closed_at: closed,
    closed_by: closed === null ? null : "L1-01",
    disposition: null,
    note: "",
    ...extra,
  } as Case;
}

const weekdays = Array.from({ length: 5 }, (_, i) => alert(ist(1, 10 + i), 10));
const weekends = Array.from({ length: 5 }, (_, i) => alert(ist(4, 10 + i), 30));

test("weekend acknowledgements three times slower than weekdays are flagged", () => {
  const r = weekendCoverage([...weekdays, ...weekends], [], 2, 5);
  assert.equal(r.weekdayMedianMin, 10);
  assert.equal(r.weekendMedianMin, 30);
  assert.equal(r.ratio, 3);
  assert.equal(r.weekendAlerts, 5);
  assert.equal(r.flagged, true);
});

test("automation, P1 alerts and unacknowledged alerts do not move the medians", () => {
  const noise = [alert(ist(1, 9), 0, { acknowledged_by: "SOAR-1" }), alert(ist(5, 9), 900, { priority: "P1" }), alert(ist(5, 10), null)];
  const r = weekendCoverage([...weekdays, ...weekends, ...noise], [], 2, 5);
  assert.equal(r.weekdayMedianMin, 10);
  assert.equal(r.weekendMedianMin, 30);
  assert.equal(r.weekendAlerts, 5);
});

test("a slow weekend on too few alerts is not flagged", () => {
  const r = weekendCoverage([...weekdays, ...weekends.slice(0, 2)], [], 2, 5);
  assert.equal(r.ratio, 3);
  assert.equal(r.flagged, false);
});

test("with no weekday baseline there is no ratio and no flag", () => {
  const r = weekendCoverage(weekends, [], 2, 1);
  assert.equal(r.weekdayMedianMin, 0);
  assert.equal(r.ratio, null);
  assert.equal(r.flagged, false);
});

test("weekend cases closed on Monday morning are counted, slowest first", () => {
  const cases = [
    kase("C-mon-10", ist(4, 22), ist(6, 10)), // 36 h
    kase("C-mon-14", ist(5, 8), ist(6, 14)), // 30 h, closed after noon
    kase("C-sat", ist(4, 9), ist(4, 11)),
    kase("C-open", ist(5, 9), null),
    kase("C-wed", ist(1, 9), ist(6, 10)),
  ];
  const r = weekendCoverage([], cases, 2, 5);
  assert.equal(r.weekendCases, 3);
  assert.equal(r.mondayClosures, 1);
  assert.deepEqual(r.slowestCaseIds, ["C-mon-10", "C-mon-14", "C-sat"]);
});

const week = 7 * 24 * 60 * MIN;
function series(asset: string, rule: string, weeks: number, by = "SOAR-1", priority: Alert["priority"] = "P3"): Alert[] {
  return Array.from({ length: weeks }, (_, i) => alert(ist(1) + i * week, 1, { asset_id: asset, rule_id: rule, acknowledged_by: by, priority }));
}

test("the same rule on the same asset, auto-closed across many weeks with no case, is flagged", () => {
  const r = repeatNoRemediation([...series("A-1", "R-1", 4), ...series("A-2", "R-2", 6)], [], 4);
  assert.equal(r.flagged, true);
  assert.deepEqual(
    r.series.map((s) => [s.assetId, s.ruleId, s.weeks, s.alerts, s.autoClosed]),
    [
      ["A-2", "R-2", 6, 6, 6],
      ["A-1", "R-1", 4, 4, 4],
    ],
  );
  assert.equal(r.series[1]!.lastAt - r.series[1]!.firstAt, 3 * week);
});

test("a repeat that analysts opened a case for, or handled themselves, is not flagged", () => {
  const withCase = repeatNoRemediation(series("A-1", "R-1", 5), [kase("C-1", ist(2), ist(2, 14))], 4);
  assert.equal(withCase.flagged, false);
  const byAnalyst = repeatNoRemediation(series("A-1", "R-1", 5, "L1-02"), [], 4);
  assert.equal(byAnalyst.flagged, false);
});

test("short runs and P4 noise are left out", () => {
  assert.equal(repeatNoRemediation(series("A-1", "R-1", 3), [], 4).flagged, false);
  assert.equal(repeatNoRemediation(series("A-1", "R-1", 8, "SOAR-1", "P4"), [], 4).flagged, false);
});
