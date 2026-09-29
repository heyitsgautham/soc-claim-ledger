import { closureHistogram, templatedNotes, versionFor } from "@ledger/detect";
import { type AssetClass, type Case, type Disposition, type ExportName, isCriticalOt, type Priority } from "@ledger/submission";
import { type Indexed, mean, minutesBetween, mode } from "./context";
import type { Measure, MeasureKind, Metric } from "./schema";
import { SEVERITY, type Sector } from "@ledger/submission/constants";
import type { AssetEvidenceRow, Basis, BreakdownPart, Direction, EvidenceSection, Finding, Reference, Subjects, Tolerance } from "./types";

// The claim-to-query mapping. Each questionnaire metric names the query that
// recomputes it from the entity's own records, the exports that query needs,
// the tolerance before a difference counts as a gap, and a plain statement of method
// that travels with every finding into the drawer and the report.

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
const BASIS = {
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

const PCT = { kind: "points", value: 2 } as const;
const TEN_PERCENT = { kind: "relative", value: 0.1 } as const;

const pct = (matched: number, total: number): Measure => ({ kind: "percent", value: (matched / total) * 100 });
const seconds = (minutes: number): Measure => ({ kind: "duration", seconds: Math.round(minutes * 60) });

function current(ctx: QueryContext): Indexed {
  return ctx.window[0]!;
}

function casesOf(ix: Indexed, priority: Priority): Case[] {
  return ix.records("cases").filter((c) => c.priority === priority);
}

function closedCases(ix: Indexed, priority?: Priority): (Case & { closed_at: number })[] {
  return ix.records("cases").filter((c): c is Case & { closed_at: number } => c.closed_at !== null && (!priority || c.priority === priority));
}

// `sequence` lists each record's part key in the order the records occurred, so the
// interface can show the records arriving before it sorts them into their parts.
function breakdown(id: string, title: string, noun: string, parts: BreakdownPart[], sequence?: string[]): EvidenceSection {
  return { type: "breakdown", id, title, noun, total: parts.reduce((s, p) => s + p.count, 0), parts, ...(sequence ? { sequence } : {}) };
}

function p1ClosureHistogram(ix: Indexed): { section: EvidenceSection; sla: number; minutes: number[]; bucket: number } | null {
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

function ackStats(ix: Indexed, priority: Priority, thresholds: [number, number]): Computed | { empty: string } {
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
function assetsMonitored(
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
      { type: "assets", id: "assets", title: silent.length ? `${silent.length} ${noun} the SIEM never saw` : `All ${noun}`, rows: silent.length ? silent : rows },
    ],
  };
}

function dispositionLabel(d: Disposition | null): string {
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

export const CATALOGUE: Record<Metric, MetricDefinition> = {
  p1_escalated_to_l2_within_30m: {
    basis: [BASIS.escalationMatrix],
    rule: { id: "timeliness/p1-escalation-window", version: "1.2.0" },
    stakes: 1,
    kind: "percent",
    direction: "higher_is_better",
    tolerance: PCT,
    requires: ["cases", "escalations", "rules", "assets"],
    lookbackQuarters: 1,
    method:
      "Every critical alert triaged in the quarter, as its case, joined to the escalation export. An alert meets the claim when the first L1 to L2 escalation record on its case is no more than 30 minutes after the case opened.",
    compute(ctx) {
      const ix = current(ctx);
      const p1 = casesOf(ix, "P1");
      if (!p1.length) return { empty: "critical alerts" };
      const rows = p1.map((c) => ix.caseRow(c));
      const within = rows.filter((r) => r.escalatedAfterMin !== null && r.escalatedAfterMin <= 30);
      const late = rows.filter((r) => r.escalatedAfterMin !== null && r.escalatedAfterMin > 30);
      const none = rows.filter((r) => r.escalatedAfterMin === null);
      const hist = p1ClosureHistogram(ix);
      const sla = hist?.sla ?? 60;
      const markers = [
        { label: "30 min", minutes: 30, tone: "gap" as const },
        { label: "SLA", minutes: sla, tone: "muted" as const },
      ];
      const evidence: EvidenceSection[] = [
        breakdown(
          "escalation-outcome",
          "Where the critical alerts went",
          "critical alerts",
          [
            { key: "within", label: "Escalated within 30 min", count: within.length, tone: "evidence" },
            { key: "late", label: "Escalated after 30 min", count: late.length, tone: "gap_soft" },
            { key: "none", label: "No escalation record", count: none.length, tone: "gap" },
          ],
          [...rows]
            .sort((x, y) => x.openedAt - y.openedAt || (x.caseId < y.caseId ? -1 : 1))
            .map((r) => (r.escalatedAfterMin === null ? "none" : r.escalatedAfterMin <= 30 ? "within" : "late")),
        ),
        { type: "cases", id: "no-escalation", title: `${none.length} critical alerts with no escalation record`, tab: `No escalation record · ${none.length}`, rows: none, timelineMinutes: sla + 60, markers },
        { type: "cases", id: "late-escalation", title: `${late.length} critical alerts escalated after 30 minutes`, tab: `Escalated late · ${late.length}`, rows: late, timelineMinutes: sla + 60, markers },
      ];
      if (hist) evidence.push(hist.section);
      // Closure notes of the unescalated cases, run through the templated-notes detector.
      const tn = versionFor("templated-notes", ctx.rulesCycle ?? ix.quarter);
      const notes = templatedNotes(
        none.map((r) => ({ id: r.caseId, text: r.note, owner: r.closedBy ?? r.owner })),
        tn.params.threshold!,
        tn.params.minCluster!,
      );
      const cluster = notes.clusters[0];
      if (cluster) {
        evidence.push({
          type: "notes",
          id: "templated-notes",
          title: `${cluster.size} templated closure notes`,
          tab: `Templated notes · ${cluster.size}`,
          threshold: notes.threshold,
          compared: notes.notesCompared,
          detector: { id: "templated-notes", version: tn.version },
          cluster,
        });
      }
      return {
        subjects: { cases: [...none, ...late].map((r) => r.caseId) },
        recomputed: pct(within.length, p1.length),
        population: { count: p1.length, noun: "critical alerts" },
        matched: within.length,
        finding: none.length
          ? [
              none.length,
              " critical alerts have no escalation record at all",
              ...(late.length ? [", and ", late.length, " reached L2 late."] : ["."]),
              ...(cluster ? [" ", cluster.size, " of their closure notes are one paragraph with the hostname changed."] : []),
            ]
          : [late.length, " critical alerts reached L2 after 30 minutes."],
        evidence,
      };
    },
  },

  p1_mean_time_to_close: {
    basis: [BASIS.slas],
    rule: { id: "timeliness/p1-mean-time-to-close", version: "1.0.0" },
    stakes: 1,
    kind: "duration",
    direction: "lower_is_better",
    tolerance: TEN_PERCENT,
    requires: ["cases", "rules", "assets"],
    lookbackQuarters: 1,
    method: "Mean of closed-at minus opened-at over the triage case of every critical alert closed in the quarter, as the case export records them.",
    compute(ctx) {
      const ix = current(ctx);
      const hist = p1ClosureHistogram(ix);
      if (!hist) return { empty: "closed critical alerts" };
      const { sla, minutes, bucket } = hist;
      const closed = closedCases(ix, "P1").map((c) => ix.caseRow(c));
      const bunched = closed.filter((r) => r.closedAfterMin! >= sla - bucket && r.closedAfterMin! < sla);
      const breached = closed.filter((r) => r.closedAfterMin! >= sla);
      const markers = [{ label: "SLA", minutes: sla, tone: "muted" as const }];
      return {
        recomputed: seconds(mean(minutes)),
        population: { count: closed.length, noun: "closed critical alerts" },
        matched: null,
        reference: { label: "SLA", measure: seconds(sla) },
        subjects: { cases: [...bunched, ...breached].map((r) => r.caseId) },
        finding: [bunched.length, " of ", closed.length, ` critical alerts closed in the ${bucket} minutes before the SLA, and `, breached.length, " closed after it."],
        evidence: [
          breakdown("close-timing", "When the critical alerts closed", "closed critical alerts", [
            { key: "early", label: `More than ${bucket} min before SLA`, count: closed.length - bunched.length - breached.length, tone: "evidence" },
            { key: "bunched", label: `In the ${bucket} min before SLA`, count: bunched.length, tone: "gap" },
            { key: "breached", label: "After SLA", count: breached.length, tone: "gap_soft" },
          ]),
          { type: "cases", id: "bunched", title: `${bunched.length} critical alerts closed in the ${bucket} minutes before SLA`, tab: `Closed just under SLA · ${bunched.length}`, rows: bunched, timelineMinutes: sla + 60, markers },
          { type: "cases", id: "breached", title: `${breached.length} critical alerts closed after SLA`, tab: `Closed after SLA · ${breached.length}`, rows: breached, timelineMinutes: Math.max(sla + 60, ...breached.map((r) => r.closedAfterMin! + 15)), markers },
          hist.section,
        ],
      };
    },
  },

  p1_mean_time_to_acknowledge: {
    rule: { id: "timeliness/mean-time-to-acknowledge", version: "1.0.0" },
    stakes: 1,
    kind: "duration",
    direction: "lower_is_better",
    tolerance: TEN_PERCENT,
    requires: ["alerts"],
    lookbackQuarters: 1,
    method: "Mean of acknowledged-at minus created-at over every critical alert an analyst acknowledged in the quarter.",
    compute: (ctx) => ackStats(current(ctx), "P1", [5, 15]),
  },

  p2_closed_within_sla: {
    basis: [BASIS.slas],
    rule: { id: "timeliness/closed-within-sla", version: "1.0.0" },
    stakes: 0.75,
    kind: "percent",
    direction: "higher_is_better",
    tolerance: PCT,
    requires: ["cases"],
    lookbackQuarters: 1,
    method: "Share of closed high-severity cases whose closed-at minus opened-at is within the SLA the case record carries.",
    compute(ctx) {
      const closed = closedCases(current(ctx), "P2");
      if (!closed.length) return { empty: "closed high-severity cases" };
      const within = closed.filter((c) => minutesBetween(c.opened_at, c.closed_at) <= c.sla_close_minutes).length;
      const late = closed.filter((c) => minutesBetween(c.opened_at, c.closed_at) > c.sla_close_minutes);
      const ix = current(ctx);
      return {
        subjects: { cases: late.map((c) => c.id) },
        recomputed: pct(within, closed.length),
        population: { count: closed.length, noun: "closed high-severity cases" },
        matched: within,
        evidence: [
          breakdown("p2-sla", "High-severity closures against SLA", "closed high-severity cases", [
            { key: "within", label: "Within SLA", count: within, tone: "evidence" },
            { key: "after", label: "After SLA", count: closed.length - within, tone: "gap_soft" },
          ]),
          ...(late.length
            ? [
                {
                  type: "cases" as const,
                  id: "p2-late",
                  title: `${late.length} high-severity cases closed after SLA`,
                  rows: late.map((c) => ix.caseRow(c)),
                  timelineMinutes: Math.max(600, ...late.map((c) => minutesBetween(c.opened_at, c.closed_at) + 30)),
                  markers: [{ label: "SLA", minutes: late[0]!.sla_close_minutes, tone: "muted" as const }],
                },
              ]
            : []),
        ],
      };
    },
  },

  p2_mean_time_to_acknowledge: {
    rule: { id: "timeliness/mean-time-to-acknowledge", version: "1.0.0" },
    stakes: 0.75,
    kind: "duration",
    direction: "lower_is_better",
    tolerance: TEN_PERCENT,
    requires: ["alerts"],
    lookbackQuarters: 1,
    method: "Mean of acknowledged-at minus created-at over every high-severity alert an analyst acknowledged in the quarter.",
    compute: (ctx) => ackStats(current(ctx), "P2", [15, 60]),
  },

  p3_acknowledged_within_4h: {
    rule: { id: "timeliness/acknowledged-within", version: "1.0.0" },
    stakes: 0.5,
    kind: "percent",
    direction: "higher_is_better",
    tolerance: PCT,
    requires: ["alerts"],
    lookbackQuarters: 1,
    method: "Share of all medium-severity alerts raised in the quarter that an analyst acknowledged within 4 hours. Alerts never acknowledged count against the claim.",
    compute(ctx) {
      const alerts = current(ctx)
        .records("alerts")
        .filter((a) => a.priority === "P3");
      if (!alerts.length) return { empty: "medium-severity alerts" };
      const within = alerts.filter((a) => a.acknowledged_at !== null && minutesBetween(a.created_at, a.acknowledged_at) <= 240).length;
      const never = alerts.filter((a) => a.acknowledged_at === null).length;
      return {
        recomputed: pct(within, alerts.length),
        population: { count: alerts.length, noun: "medium-severity alerts" },
        matched: within,
        evidence: [
          breakdown("p3-ack", "Medium-severity acknowledgement", "medium-severity alerts", [
            { key: "within", label: "Within 4 h", count: within, tone: "evidence" },
            { key: "later", label: "After 4 h", count: alerts.length - within - never, tone: "gap_soft" },
            { key: "never", label: "Never acknowledged", count: never, tone: "gap" },
          ]),
        ],
      };
    },
  },

  ot_critical_assets_monitored: {
    basis: [BASIS.otMonitoring, BASIS.logs],
    rule: { id: "coverage/assets-seen-by-siem", version: "1.1.0" },
    stakes: 1,
    kind: "fraction",
    direction: "higher_is_better",
    tolerance: PCT,
    requires: ["assets", "alerts", "log_sources"],
    lookbackQuarters: 2,
    method:
      "Critical OT assets in the entity's own inventory. An asset counts as monitored if the SIEM raised any alert on it, or a log source attached to it reported on at least one day, across the last two quarterly submissions.",
    compute: (ctx) => assetsMonitored(ctx, "critical OT assets", isCriticalOt),
  },

  log_sources_reporting_daily: {
    basis: [BASIS.logs],
    rule: { id: "coverage/log-sources-reporting", version: "1.0.0" },
    stakes: 0.7,
    kind: "fraction",
    direction: "higher_is_better",
    tolerance: PCT,
    requires: ["log_sources"],
    lookbackQuarters: 1,
    method: "Log sources in the SIEM export that reported on at least 95% of the days they were expected to in the quarter.",
    compute(ctx) {
      const sources = current(ctx).records("log_sources");
      if (!sources.length) return { empty: "log sources" };
      const below = sources.filter((s) => s.days_reporting < 0.95 * s.days_expected);
      return {
        recomputed: { kind: "fraction", numerator: sources.length - below.length, denominator: sources.length },
        population: { count: sources.length, noun: "log sources" },
        matched: sources.length - below.length,
        evidence: [
          breakdown("sources", "Log source reporting", "log sources", [
            { key: "daily", label: "Reported on 95% of days or more", count: sources.length - below.length, tone: "evidence" },
            { key: "gaps", label: "Reported on fewer days", count: below.length, tone: "gap_soft" },
          ]),
          {
            type: "sources",
            id: "below",
            title: `${below.length} log sources below 95% of days`,
            rows: below.map((s) => ({ id: s.id, name: s.name, kind: s.kind, daysReporting: s.days_reporting, daysExpected: s.days_expected })),
          },
        ],
      };
    },
  },

  dmz_assets_monitored: {
    basis: [BASIS.logs],
    rule: { id: "coverage/assets-seen-by-siem", version: "1.1.0" },
    stakes: 0.8,
    kind: "fraction",
    direction: "higher_is_better",
    tolerance: PCT,
    requires: ["assets", "alerts", "log_sources"],
    lookbackQuarters: 1,
    method: "DMZ assets in the entity's own inventory that the SIEM raised an alert on, or whose log source reported on at least one day, in the quarter.",
    compute: (ctx) => assetsMonitored(ctx, "DMZ assets", (a) => a.asset_class === "dmz"),
  },

  cloud_workloads_forwarding: {
    basis: [BASIS.logs],
    rule: { id: "coverage/assets-seen-by-siem", version: "1.1.0" },
    stakes: 0.7,
    kind: "fraction",
    direction: "higher_is_better",
    tolerance: PCT,
    requires: ["assets", "alerts", "log_sources"],
    lookbackQuarters: 1,
    method: "Cloud workloads in the entity's own inventory that the SIEM raised an alert on, or whose log source reported on at least one day, in the quarter.",
    compute: (ctx) => assetsMonitored(ctx, "cloud workloads", (a) => a.asset_class === "cloud"),
  },

  threat_hunts_per_quarter: {
    rule: { id: "capability/threat-hunts", version: "1.0.0" },
    stakes: 0.5,
    kind: "count",
    direction: "higher_is_better",
    tolerance: { kind: "exact" },
    requires: ["threat_hunts"],
    lookbackQuarters: 1,
    method: "Count of hunts in the threat-hunt log the entity submitted for the quarter.",
    compute(ctx) {
      const hunts = current(ctx).records("threat_hunts");
      const by = (o: string) => hunts.filter((h) => h.outcome === o).length;
      return {
        recomputed: { kind: "count", value: hunts.length },
        population: { count: hunts.length, noun: "logged hunts" },
        matched: hunts.length,
        evidence: [
          breakdown("hunts", "Hunt outcomes", "hunts", [
            { key: "finding", label: "Finding raised", count: by("finding_raised"), tone: "evidence" },
            { key: "detection", label: "Detection improved", count: by("detection_improved"), tone: "evidence" },
            { key: "none", label: "No finding", count: by("no_finding"), tone: "muted" },
          ]),
        ],
      };
    },
  },

  p3_false_positive_share: {
    rule: { id: "capability/false-positive-share", version: "1.0.0" },
    stakes: 0.5,
    kind: "percent",
    direction: "lower_is_better",
    tolerance: PCT,
    requires: ["cases"],
    lookbackQuarters: 1,
    method: "Share of closed medium-severity cases whose recorded disposition is false positive. Cases closed without a disposition are left out of both counts.",
    compute(ctx) {
      const closed = closedCases(current(ctx), "P3").filter((c) => c.disposition !== null);
      if (!closed.length) return { empty: "closed medium-severity cases" };
      const counts = new Map<string, number>();
      for (const c of closed) counts.set(c.disposition!, (counts.get(c.disposition!) ?? 0) + 1);
      const fp = counts.get("false_positive") ?? 0;
      return {
        recomputed: pct(fp, closed.length),
        population: { count: closed.length, noun: "closed medium-severity cases" },
        matched: fp,
        evidence: [
          breakdown(
            "p3-dispositions",
            "Medium-severity dispositions",
            "closed medium-severity cases",
            [...counts.entries()]
              .sort((a, b) => b[1] - a[1])
              .map(([d, n]) => ({ key: d, label: dispositionLabel(d as Disposition), count: n, tone: d === "false_positive" ? ("gap_soft" as const) : ("muted" as const) })),
          ),
        ],
      };
    },
  },

  closed_cases_with_disposition: {
    rule: { id: "capability/disposition-recorded", version: "1.0.0" },
    stakes: 0.5,
    kind: "percent",
    direction: "higher_is_better",
    tolerance: PCT,
    requires: ["cases"],
    lookbackQuarters: 1,
    method: "Share of closed cases, of any priority, that carry a disposition code.",
    compute(ctx) {
      const closed = closedCases(current(ctx));
      if (!closed.length) return { empty: "closed cases" };
      const withCode = closed.filter((c) => c.disposition !== null).length;
      return {
        recomputed: pct(withCode, closed.length),
        population: { count: closed.length, noun: "closed cases" },
        matched: withCode,
        evidence: [
          breakdown("dispositions", "Disposition at closure", "closed cases", [
            { key: "coded", label: "Disposition recorded", count: withCode, tone: "evidence" },
            { key: "blank", label: "Closed without one", count: closed.length - withCode, tone: "gap_soft" },
          ]),
        ],
      };
    },
  },

  shifts_with_three_l1: {
    basis: [BASIS.roundTheClock, BASIS.roundTheClockPower],
    rule: { id: "staffing/shift-l1-minimum", version: "1.0.0" },
    stakes: 0.6,
    kind: "percent",
    direction: "higher_is_better",
    tolerance: PCT,
    requires: ["shifts"],
    lookbackQuarters: 1,
    method: "Share of shifts in the roster export with three or more L1 analysts listed on duty.",
    compute(ctx) {
      const shifts = current(ctx).records("shifts");
      if (!shifts.length) return { empty: "shifts" };
      const staffed = shifts.filter((s) => s.l1_on_duty.length >= 3).length;
      return {
        recomputed: pct(staffed, shifts.length),
        population: { count: shifts.length, noun: "shifts" },
        matched: staffed,
        evidence: [
          breakdown("l1-shifts", "L1 staffing per shift", "shifts", [
            { key: "staffed", label: "Three or more L1", count: staffed, tone: "evidence" },
            { key: "short", label: "Fewer than three", count: shifts.length - staffed, tone: "gap" },
          ]),
        ],
      };
    },
  },

  shifts_with_l2_on_call: {
    basis: [BASIS.roundTheClock, BASIS.roundTheClockPower],
    rule: { id: "staffing/shift-l2-on-call", version: "1.0.0" },
    stakes: 0.8,
    kind: "percent",
    direction: "higher_is_better",
    tolerance: PCT,
    requires: ["shifts"],
    lookbackQuarters: 1,
    method: "Share of shifts in the roster export with an L2 analyst named on call.",
    compute(ctx) {
      const shifts = current(ctx).records("shifts");
      if (!shifts.length) return { empty: "shifts" };
      const covered = shifts.filter((s) => s.l2_on_call !== null).length;
      return {
        recomputed: pct(covered, shifts.length),
        population: { count: shifts.length, noun: "shifts" },
        matched: covered,
        evidence: [
          breakdown("l2-shifts", "L2 on call per shift", "shifts", [
            { key: "covered", label: "L2 named on call", count: covered, tone: "evidence" },
            { key: "uncovered", label: "No L2 named", count: shifts.length - covered, tone: "gap" },
          ]),
        ],
      };
    },
  },

  l1_analysts_on_roster: {
    rule: { id: "staffing/roster-headcount", version: "1.0.0" },
    stakes: 0.6,
    kind: "count",
    direction: "higher_is_better",
    tolerance: { kind: "exact" },
    requires: ["analysts"],
    lookbackQuarters: 1,
    method: "Count of L1 analysts in the analyst roster export.",
    compute(ctx) {
      const analysts = current(ctx).records("analysts");
      const l1 = analysts.filter((a) => a.level === "L1").length;
      return {
        recomputed: { kind: "count", value: l1 },
        population: { count: analysts.length, noun: "analysts on the roster" },
        matched: l1,
        evidence: [
          breakdown("roster", "Analyst roster by level", "analysts", [
            { key: "L1", label: "L1", count: l1, tone: "evidence" },
            { key: "L2", label: "L2", count: analysts.filter((a) => a.level === "L2").length, tone: "muted" },
            { key: "L3", label: "L3", count: analysts.filter((a) => a.level === "L3").length, tone: "muted" },
          ]),
        ],
      };
    },
  },
};
