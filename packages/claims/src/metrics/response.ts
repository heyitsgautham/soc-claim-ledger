import { templatedNotes, versionFor } from "@ledger/detect";
import { mean, minutesBetween } from "../context";
import type { EvidenceSection } from "../types";
import { BASIS, PCT, TEN_PERCENT, ackStats, breakdown, casesOf, closedCases, current, p1ClosureHistogram, pct, seconds, type MetricDefinition } from "./shared";
import type { Metric } from "../schema";

// How fast the SOC acknowledges, escalates and closes alerts, by priority.
export const RESPONSE_METRICS = {
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
        {
          type: "cases",
          id: "no-escalation",
          title: `${none.length} critical alerts with no escalation record`,
          tab: `No escalation record · ${none.length}`,
          rows: none,
          timelineMinutes: sla + 60,
          markers,
        },
        {
          type: "cases",
          id: "late-escalation",
          title: `${late.length} critical alerts escalated after 30 minutes`,
          tab: `Escalated late · ${late.length}`,
          rows: late,
          timelineMinutes: sla + 60,
          markers,
        },
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
        finding: [
          bunched.length,
          " of ",
          closed.length,
          ` critical alerts closed in the ${bucket} minutes before the SLA, and `,
          breached.length,
          " closed after it.",
        ],
        evidence: [
          breakdown("close-timing", "When the critical alerts closed", "closed critical alerts", [
            { key: "early", label: `More than ${bucket} min before SLA`, count: closed.length - bunched.length - breached.length, tone: "evidence" },
            { key: "bunched", label: `In the ${bucket} min before SLA`, count: bunched.length, tone: "gap" },
            { key: "breached", label: "After SLA", count: breached.length, tone: "gap_soft" },
          ]),
          {
            type: "cases",
            id: "bunched",
            title: `${bunched.length} critical alerts closed in the ${bucket} minutes before SLA`,
            tab: `Closed just under SLA · ${bunched.length}`,
            rows: bunched,
            timelineMinutes: sla + 60,
            markers,
          },
          {
            type: "cases",
            id: "breached",
            title: `${breached.length} critical alerts closed after SLA`,
            tab: `Closed after SLA · ${breached.length}`,
            rows: breached,
            timelineMinutes: Math.max(sla + 60, ...breached.map((r) => r.closedAfterMin! + 15)),
            markers,
          },
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
    method:
      "Share of all medium-severity alerts raised in the quarter that an analyst acknowledged within 4 hours. Alerts never acknowledged count against the claim.",
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
} satisfies Partial<Record<Metric, MetricDefinition>>;
