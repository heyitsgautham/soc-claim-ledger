import { closureHistogram } from "@ledger/detect";
import type { AssetClass, Case, Disposition, ExportName, Priority } from "@ledger/submission";
import { type Indexed, mean, minutesBetween, mode } from "../context";
import type { Measure, MeasureKind } from "../schema";
import { SEVERITY, type Sector } from "@ledger/submission/constants";
import type { AssetEvidenceRow, Basis, BreakdownPart, Direction, EvidenceSection, Finding, Reference, Subjects, Tolerance } from "../types";

// What every metric definition is made of, and the helpers the definitions share.
// Each questionnaire metric names the query that recomputes it from the entity's own
// records, the exports that query needs, the tolerance before a difference counts as a
// gap, and a plain statement of method that travels with every finding into the drawer
// and the report.

export interface Computed {
  recomputed: Measure;
  population: { count: number; noun: string };
  matched: number | null;
  reference?: Reference;
  finding?: Finding;
  evidence: EvidenceSection[];
  // The records behind a gap, for the sample sheet.
  subjects?: Partial<Subjects>;
}

export interface QueryContext {
  // Newest first. window[0] is the quarter the claims attest.
  window: Indexed[];
  // Which cycle's detector versions to run. Defaults to the attested quarter.
  rulesCycle?: string;
}

export interface MetricDefinition {
  rule: { id: string; version: string };
  // What rides on the claim, 0 to 1. A claim about critical alerts or critical assets is 1,
  // high-severity is 0.75, medium and routine capability claims 0.5, staffing and telemetry between.
  // A gap's severity is its stakes times how far past tolerance the records are.
  stakes: number;
  kind: MeasureKind;
  direction: Direction;
  tolerance: Tolerance;
  requires: ExportName[];
  lookbackQuarters: number;
  method: string;
  // The obligations the claim reports against. A basis with sectors applies only there.
  basis?: (Basis & { sectors?: Sector[] })[];
  compute(ctx: QueryContext): Computed | { empty: string };
}

// Clauses read in the issuer's own text, see docs/research.md.
export const BASIS = {
  escalationMatrix: {
    source: "NCIIPC Guidelines for the Protection of NCII, v2.0",
    clause: "OC2 8.2.3(a)",
    says: "The incident response plan must set out a clearly demarcated escalation matrix.",
  },
  slas: {
    source: "Protected System Rules, 2018",
    clause: "Rule 4(2)(j)",
    says: "The CISO shares the entity's IT security service level agreements with NCIIPC.",
  },
  logs: {
    source: "CERT-In Directions, 28 April 2022",
    clause: "Direction (iv)",
    says: "Enable logs of all ICT systems and keep them for a rolling 180 days.",
  },
  otMonitoring: {
    source: "CEA Cyber Security in Power Sector Guidelines, 2021",
    clause: "Article 5(c)(3)",
    says: "Intrusion detection and prevention must cover both IT and OT systems.",
    sectors: ["power_energy"],
  },
  roundTheClock: {
    source: "NCIIPC Guidelines for the Protection of NCII, v2.0",
    clause: "6.3.6",
    says: "The information security division must function on a 24x7x365 basis.",
  },
  roundTheClockPower: {
    source: "CEA Cyber Security in Power Sector Guidelines, 2021",
    clause: "Article 5(b)",
    says: "The information security division must be functional on a 24x7x365 basis.",
    sectors: ["power_energy"],
  },
} satisfies Record<string, Basis & { sectors?: Sector[] }>;

export const PCT = { kind: "points", value: 2 } as const;
export const TEN_PERCENT = { kind: "relative", value: 0.1 } as const;

export const pct = (matched: number, total: number): Measure => ({ kind: "percent", value: (matched / total) * 100 });
export const seconds = (minutes: number): Measure => ({ kind: "duration", seconds: Math.round(minutes * 60) });

export function current(ctx: QueryContext): Indexed {
  return ctx.window[0]!;
}

export function casesOf(ix: Indexed, priority: Priority): Case[] {
  return ix.records("cases").filter((c) => c.priority === priority);
}

export function closedCases(ix: Indexed, priority?: Priority): (Case & { closed_at: number })[] {
  return ix.records("cases").filter((c): c is Case & { closed_at: number } => c.closed_at !== null && (!priority || c.priority === priority));
}

// `sequence` lists each record's part key in the order the records occurred, so the
// interface can show the records arriving before it sorts them into their parts.
export function breakdown(id: string, title: string, noun: string, parts: BreakdownPart[], sequence?: string[]): EvidenceSection {
  return { type: "breakdown", id, title, noun, total: parts.reduce((s, p) => s + p.count, 0), parts, ...(sequence ? { sequence } : {}) };
}

export function p1ClosureHistogram(ix: Indexed): { section: EvidenceSection; sla: number; minutes: number[]; bucket: number } | null {
  const closed = closedCases(ix, "P1");
  if (!closed.length) return null;
  const sla = mode(closed.map((c) => c.sla_close_minutes))!;
  const minutes = closed.map((c) => minutesBetween(c.opened_at, c.closed_at));
  const histogram = closureHistogram(minutes, sla);
  return {
    sla,
    minutes,
    bucket: histogram.bucketMinutes,
    section: {
      type: "histogram",
      id: "p1-closure-histogram",
      title: `Time to close, all ${closed.length} critical alerts`,
      note: "SLA bunching",
      histogram,
    },
  };
}

export function ackStats(ix: Indexed, priority: Priority, thresholds: [number, number]): Computed | { empty: string } {
  const alerts = ix.records("alerts").filter((a) => a.priority === priority);
  if (!alerts.length) return { empty: `${SEVERITY[priority]} alerts` };
  const acked = alerts.filter((a): a is typeof a & { acknowledged_at: number } => a.acknowledged_at !== null);
  const waits = acked.map((a) => minutesBetween(a.created_at, a.acknowledged_at));
  const [fast, slow] = thresholds;
  const within = waits.filter((w) => w <= fast).length;
  const middle = waits.filter((w) => w > fast && w <= slow).length;
  return {
    recomputed: seconds(mean(waits)),
    population: { count: acked.length, noun: `acknowledged ${SEVERITY[priority]} alerts` },
    matched: null,
    evidence: [
      breakdown(`${priority}-ack`, `Time to acknowledge, ${SEVERITY[priority]} alerts`, `${SEVERITY[priority]} alerts`, [
        { key: "fast", label: `Within ${fast} min`, count: within, tone: "evidence" },
        { key: "middle", label: `${fast} to ${slow} min`, count: middle, tone: "muted" },
        { key: "slow", label: `Over ${slow} min`, count: acked.length - within - middle, tone: "gap_soft" },
        { key: "never", label: "Never acknowledged", count: alerts.length - acked.length, tone: "gap" },
      ]),
    ],
  };
}

// An asset counts as monitored when anything in the SIEM saw it across the window:
// an alert raised on it, or a log source attached to it that reported at least one day.
export function assetsMonitored(
  ctx: QueryContext,
  noun: string,
  include: (a: { asset_class: AssetClass; criticality: string }) => boolean,
): Computed | { empty: string } {
  const now = current(ctx);
  const assets = now.records("assets").filter(include);
  if (!assets.length) return { empty: noun };
  const alertCount = new Map<string, number>();
  const reported = new Map<string, number>();
  const expected = new Map<string, number>();
  for (const ix of ctx.window) {
    for (const a of ix.records("alerts")) alertCount.set(a.asset_id, (alertCount.get(a.asset_id) ?? 0) + 1);
    for (const s of ix.records("log_sources")) {
      reported.set(s.id, (reported.get(s.id) ?? 0) + s.days_reporting);
      expected.set(s.id, (expected.get(s.id) ?? 0) + s.days_expected);
    }
  }
  const sourceName = new Map(now.records("log_sources").map((s) => [s.id, s.name]));
  const rows: AssetEvidenceRow[] = assets.map((a) => ({
    assetId: a.id,
    hostname: a.hostname,
    site: a.site,
    criticality: a.criticality,
    alerts: alertCount.get(a.id) ?? 0,
    logSource: a.log_source_id ? (sourceName.get(a.log_source_id) ?? a.log_source_id) : null,
    daysReporting: a.log_source_id ? (reported.get(a.log_source_id) ?? 0) : null,
    daysExpected: a.log_source_id ? (expected.get(a.log_source_id) ?? 0) : null,
  }));
  const seen = rows.filter((r) => r.alerts > 0 || (r.daysReporting ?? 0) > 0);
  const silent = rows.filter((r) => !(r.alerts > 0 || (r.daysReporting ?? 0) > 0));
  const quarters = ctx.window.length === 1 ? "this quarter" : `${ctx.window.length} quarters`;
  const across: Finding = ctx.window.length === 1 ? [" this quarter."] : [" across ", ctx.window.length, " quarterly submissions."];
  const finding: Finding =
    silent.length === assets.length
      ? ["No alert and no telemetry from any of the ", assets.length, ...across]
      : [silent.length, " of ", assets.length, " produced no alert and no telemetry", ...across];
  return {
    recomputed: { kind: "fraction", numerator: seen.length, denominator: assets.length },
    population: { count: assets.length, noun },
    matched: seen.length,
    finding,
    subjects: { assets: silent.map((r) => r.assetId) },
    evidence: [
      breakdown("monitored", `What the SIEM saw of the ${noun}, ${quarters}`, noun, [
        { key: "seen", label: "Alert or telemetry recorded", count: seen.length, tone: "evidence" },
        { key: "silent", label: "No alert and no telemetry", count: silent.length, tone: "gap" },
      ]),
      {
        type: "assets",
        id: "assets",
        title: silent.length ? `${silent.length} ${noun} the SIEM never saw` : `All ${noun}`,
        rows: silent.length ? silent : rows,
      },
    ],
  };
}

export function dispositionLabel(d: Disposition | null): string {
  switch (d) {
    case "true_positive_contained":
      return "True positive, contained";
    case "true_positive_remediated":
      return "True positive, remediated";
    case "benign_positive":
      return "Benign positive";
    case "false_positive":
      return "False positive";
    case "duplicate":
      return "Duplicate";
    case "inconclusive":
      return "Inconclusive";
    default:
      return "No disposition";
  }
}
