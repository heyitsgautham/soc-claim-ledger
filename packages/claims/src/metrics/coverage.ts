import { isCriticalOt } from "@ledger/submission";
import { BASIS, PCT, assetsMonitored, breakdown, current, type MetricDefinition } from "./shared";
import type { Metric } from "../schema";

// What the SIEM can see: assets, log sources, cloud workloads, and the hunts run over them.
export const COVERAGE_METRICS = {
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
} satisfies Partial<Record<Metric, MetricDefinition>>;
