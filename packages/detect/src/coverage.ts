import type { Alert, Case } from "@ledger/submission";

// Two operational signals that a quarterly KPI average hides.

const IST = 330 * 60_000;
const MINUTE = 60_000;

function weekday(ms: number): number {
  return new Date(ms + IST).getUTCDay();
}

function isWeekend(ms: number): boolean {
  const d = weekday(ms);
  return d === 0 || d === 6;
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

// Weekend coverage. Median time to acknowledge P2 and P3 alerts at the weekend against
// weekdays. Automation acknowledgements are left out, only analysts count.
export interface WeekendCoverageResult {
  weekdayMedianMin: number;
  weekendMedianMin: number;
  weekendAlerts: number;
  ratio: number | null;
  mondayClosures: number; // weekend-opened cases closed on Monday morning
  weekendCases: number;
  slowestCaseIds: string[];
  flagged: boolean;
}

export function weekendCoverage(alerts: readonly Alert[], cases: readonly Case[], minRatio: number, minAlerts: number): WeekendCoverageResult {
  const weekday: number[] = [];
  const weekend: number[] = [];
  for (const a of alerts) {
    if ((a.priority !== "P2" && a.priority !== "P3") || a.acknowledged_at === null || a.acknowledged_by?.startsWith("SOAR")) continue;
    const wait = (a.acknowledged_at - a.created_at) / MINUTE;
    (isWeekend(a.created_at) ? weekend : weekday).push(wait);
  }
  const wd = median(weekday);
  const we = median(weekend);
  const ratio = wd > 0 ? we / wd : null;
  const weekendCases = cases.filter((c) => isWeekend(c.opened_at) && c.closed_at !== null);
  const monday = weekendCases.filter((c) => {
    const d = new Date(c.closed_at! + IST);
    return d.getUTCDay() === 1 && d.getUTCHours() >= 9 && d.getUTCHours() < 12;
  });
  const slowest = [...weekendCases].sort((a, b) => b.closed_at! - b.opened_at - (a.closed_at! - a.opened_at)).slice(0, 12);
  return {
    weekdayMedianMin: wd,
    weekendMedianMin: we,
    weekendAlerts: weekend.length,
    ratio,
    mondayClosures: monday.length,
    weekendCases: weekendCases.length,
    slowestCaseIds: slowest.map((c) => c.id),
    flagged: ratio !== null && ratio >= minRatio && weekend.length >= minAlerts,
  };
}

// Repeat without remediation. The same rule on the same asset in many distinct weeks,
// closed by automation each time, with no case ever opened for it, means the SOC is
// closing the symptom and never the cause. Noisy hosts that analysts do look at are not
// flagged, which keeps ordinary repeat noise out.
export interface RepeatSeries {
  assetId: string;
  ruleId: string;
  alerts: number;
  weeks: number;
  autoClosed: number;
  firstAt: number;
  lastAt: number;
}

export interface RepeatResult {
  series: RepeatSeries[];
  flagged: boolean;
}

export function repeatNoRemediation(alerts: readonly Alert[], cases: readonly Case[], minWeeks: number, minAutomatedShare = 0.5): RepeatResult {
  const withCase = new Set(cases.map((c) => `${c.asset_id}|${c.rule_id}`));
  const groups = new Map<string, Alert[]>();
  for (const a of alerts) {
    if (a.priority === "P4") continue;
    const k = `${a.asset_id}|${a.rule_id}`;
    const g = groups.get(k) ?? [];
    g.push(a);
    groups.set(k, g);
  }
  const series: RepeatSeries[] = [];
  for (const [k, g] of groups) {
    if (withCase.has(k)) continue;
    const weeks = new Set(g.map((a) => Math.floor((a.created_at + IST) / (7 * 24 * 60 * MINUTE))));
    if (weeks.size < minWeeks) continue;
    const [assetId, ruleId] = k.split("|") as [string, string];
    const autoClosed = g.filter((a) => a.acknowledged_by?.startsWith("SOAR")).length;
    if (autoClosed < g.length * minAutomatedShare) continue;
    series.push({
      assetId,
      ruleId,
      alerts: g.length,
      weeks: weeks.size,
      autoClosed,
      firstAt: Math.min(...g.map((a) => a.created_at)),
      lastAt: Math.max(...g.map((a) => a.created_at)),
    });
  }
  series.sort((a, b) => b.weeks - a.weeks || b.alerts - a.alerts || (a.assetId < b.assetId ? -1 : 1));
  return { series, flagged: series.length > 0 };
}
