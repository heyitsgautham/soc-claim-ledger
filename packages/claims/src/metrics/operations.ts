import type { Disposition } from "@ledger/submission";
import { BASIS, PCT, breakdown, closedCases, current, dispositionLabel, pct, type MetricDefinition } from "./shared";
import type { Metric } from "../schema";

// How cases are closed and how the shifts are staffed.
export const OPERATIONS_METRICS = {
  p3_false_positive_share: {
    rule: { id: "capability/false-positive-share", version: "1.0.0" },
    stakes: 0.5,
    kind: "percent",
    direction: "lower_is_better",
    tolerance: PCT,
    requires: ["cases"],
    lookbackQuarters: 1,
    method:
      "Share of closed medium-severity cases whose recorded disposition is false positive. Cases closed without a disposition are left out of both counts.",
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
              .map(([d, n]) => ({
                key: d,
                label: dispositionLabel(d as Disposition),
                count: n,
                tone: d === "false_positive" ? ("gap_soft" as const) : ("muted" as const),
              })),
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
} satisfies Partial<Record<Metric, MetricDefinition>>;
