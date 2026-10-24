import {
  closureHistogram,
  type DetectorId,
  DETECTORS,
  type EstateWindow,
  negativeSpace,
  repeatNoRemediation,
  templatedNotes,
  versionFor,
  weekendCoverage,
} from "@ledger/detect";
import { ASSET_CLASSES, type Case, LEVELS, type Submission, submissionDir } from "@ledger/submission";
import { Indexed, minutesBetween } from "../context";
import { assess, loadClaimsFile } from "../evaluate";
import type { Measure } from "../schema";
import type { ClaimEvaluation, Finding, Subjects } from "../types";
import { priorPrecision } from "./calibration";
import { drawSamples } from "./samples";
import type { Workspace } from "./workspace";
import type { DetectorRef, EntityAnalysis, Overview, Signals, SupervisoryFinding, Verdict } from "./types";

// The whole analysis for one entity in one assessment cycle: the claim ledger, the
// detectors, the findings they produce, the supervisory risk indicator and the sample
// sheet for manual review. Every figure is computed here from the submissions.

// Precision assumed for a detector before examiners have reviewed any of its flags.
export const DEFAULT_PRECISION = 0.75;

function ref(id: DetectorId, cycle: string): DetectorRef {
  return { id, version: versionFor(id, cycle).version };
}

function estate(subs: Submission[], code: string): EstateWindow {
  const head = subs[0]!;
  return {
    code,
    assets: head.records.assets ?? [],
    rules: head.records.rules ?? [],
    alerts: subs.flatMap((s) => s.records.alerts ?? []),
  };
}

export function computeSignals(ws: Workspace, entity: string, cycle: string, rulesCycle = cycle): Signals {
  const [sub] = ws.window(entity, cycle, 1);
  const ix = new Indexed(sub!);
  const cases = sub!.records.cases ?? [];
  const alerts = sub!.records.alerts ?? [];

  const closedP1 = cases.filter((c): c is Case & { closed_at: number } => c.priority === "P1" && c.closed_at !== null);
  let bunching: Signals["bunching"] = null;
  if (closedP1.length) {
    const sla = closedP1[0]!.sla_close_minutes;
    const bv = versionFor("sla-bunching", rulesCycle);
    const h = closureHistogram(
      closedP1.map((c) => minutesBetween(c.opened_at, c.closed_at)),
      sla,
      { bucketMinutes: bv.params.bucketMinutes, minRatio: bv.params.minRatio, minCount: bv.params.minCount },
    );
    const lo = h.bunching.bucket.start;
    const hi = h.bunching.bucket.end;
    const caseIds = closedP1.filter((c) => {
      const m = minutesBetween(c.opened_at, c.closed_at);
      return m >= lo && m < hi;
    });
    bunching = { ...h, caseIds: caseIds.map((c) => c.id) };
  }

  const tv = versionFor("templated-notes", rulesCycle);
  const notes = templatedNotes(
    cases.filter((c) => c.closed_at !== null).map((c) => ({ id: c.id, text: c.note, owner: c.closed_by ?? c.owner })),
    tv.params.threshold!,
    tv.params.minCluster!,
  );

  const nv = versionFor("negative-space", rulesCycle);
  const ownWindow = ws.window(entity, cycle, 2);
  const peers = ws.sectorPeers(entity).map((p) => estate(ws.window(p, cycle, 2), p));
  const grid = negativeSpace(estate(ownWindow, entity), peers, nv.params.minExpected!);
  const gapClasses = new Set(grid.rows.filter((r) => r.cells.some((c) => c.state === "negative_space")).map((r) => r.assetClass));
  const alerting = new Set(ownWindow.flatMap((s) => (s.records.alerts ?? []).map((a) => a.asset_id)));
  const silent = (sub!.records.assets ?? [])
    .filter((a) => gapClasses.has(a.asset_class) && !alerting.has(a.id))
    .sort((a, b) => (a.criticality === b.criticality ? (a.hostname < b.hostname ? -1 : 1) : a.criticality === "critical" ? -1 : 1));
  const silentAssetIds = silent.map((a) => a.id);
  const silentAssets = silent.map((a) => ({ id: a.id, hostname: a.hostname, site: a.site, criticality: a.criticality, assetClass: a.asset_class }));

  const wv = versionFor("weekend-coverage", rulesCycle);
  const weekend = weekendCoverage(alerts, cases, wv.params.minRatio!, wv.params.minAlerts!);

  const rv = versionFor("repeat-no-remediation", rulesCycle);
  const rep = repeatNoRemediation(alerts, cases, rv.params.minWeeks!, rv.params.minAutomatedShare);

  return {
    bunching,
    templatedNotes: { ...notes, detector: { id: "templated-notes", version: tv.version } },
    negativeSpace: {
      ...grid,
      detector: { id: "negative-space", version: nv.version },
      window: ownWindow.map((s) => s.manifest.quarter.id),
      silentAssetIds,
      silentAssets,
    },
    weekend: { ...weekend, detector: { id: "weekend-coverage", version: wv.version } },
    repeats: {
      detector: { id: "repeat-no-remediation", version: rv.version },
      flagged: rep.flagged,
      series: rep.series.map((s) => ({ ...s, hostname: ix.asset(s.assetId)?.hostname ?? s.assetId, ruleName: ix.rule(s.ruleId)?.name ?? s.ruleId })),
    },
  };
}

const clamp = (x: number) => Math.max(0, Math.min(1, x));

// How far out a finding is, 0 to 1. Past tolerance, each further tolerance matters less:
// 1 tolerance out is 0.2, 5 is 0.67, 10 is 0.89, 20 is 0.99.
export function extentOf(excessTolerances: number): number {
  return clamp(1 - Math.exp(-excessTolerances / 4.5));
}

function show(m: Measure): string {
  switch (m.kind) {
    case "percent":
      // Whole percentages, as the ledger shows them.
      return `${Math.round(m.value)}%`;
    case "fraction":
      return `${m.numerator} of ${m.denominator}`;
    case "count":
      return String(m.value);
    case "duration": {
      const t = Math.round(m.seconds / 60);
      return t >= 60 ? `${Math.floor(t / 60)} h ${String(t % 60).padStart(2, "0")} m` : `${t} m`;
    }
  }
}

// A one-line reading for claims that carry no finding of their own.
function plainGap(e: ClaimEvaluation): Finding {
  return [
    `${e.claim.text}: attested ${show(e.claim.attested)}, the records show ${e.recomputed ? show(e.recomputed) : "nothing"}`,
    ...(e.population ? [" across ", e.population.count, ` ${e.population.noun}.`] : ["."]),
  ];
}

function finding(
  cycle: string,
  verdicts: readonly Verdict[],
  detector: DetectorId,
  f: Omit<SupervisoryFinding, "id" | "detector" | "precision" | "weight">,
): Omit<SupervisoryFinding, "id"> {
  const precision = priorPrecision(verdicts, detector, cycle);
  return { ...f, detector: ref(detector, cycle), precision, weight: f.severity * (precision ?? DEFAULT_PRECISION) };
}

// `cycle` sets which detector versions and which prior verdicts apply.
export function computeFindings(analysis: Pick<EntityAnalysis, "assessment" | "signals">, cycle: string, verdicts: readonly Verdict[]): SupervisoryFinding[] {
  const out: Omit<SupervisoryFinding, "id">[] = [];
  const { assessment: a, signals: s } = analysis;

  for (const e of a.evaluations) {
    if (e.status !== "gap") continue;
    out.push(
      finding(cycle, verdicts, "claim-gap", {
        claimRef: e.claim.ref,
        title: `${e.claim.text}, attested ${show(e.claim.attested)}, recomputed ${e.recomputed ? show(e.recomputed) : "nothing"}`,
        statement: e.finding ?? plainGap(e),
        method: e.method,
        severity: e.stakes * extentOf(e.excess),
        subjects: e.subjects,
      }),
    );
  }

  if (s.bunching?.bunching.flagged) {
    const b = s.bunching.bunching;
    out.push(
      finding(cycle, verdicts, "sla-bunching", {
        claimRef: null,
        title: "Critical-alert closures bunch under the SLA",
        statement: [
          Math.round(b.share * 100),
          "% of critical-alert closures land in the last ",
          s.bunching.bucketMinutes,
          " minutes before the SLA, ",
          Number((b.ratio ?? 0).toFixed(1)),
          " times the rate of the hour before.",
        ],
        method: DETECTORS["sla-bunching"].question,
        severity: DETECTORS["sla-bunching"].stakes * clamp(b.share * 3),
        subjects: { cases: s.bunching.caseIds, assets: [] },
      }),
    );
  }

  if (s.templatedNotes.flagged) {
    const members = s.templatedNotes.clusters.flatMap((c) => c.members.map((m) => m.id));
    const biggest = s.templatedNotes.clusters[0]!;
    out.push(
      finding(cycle, verdicts, "templated-notes", {
        claimRef: null,
        title: "Closure notes are pasted from a template",
        statement: [
          members.length,
          " closure notes are one paragraph with the hostname changed",
          ...(s.templatedNotes.clusters.length > 1 ? [", in ", s.templatedNotes.clusters.length, " clusters"] : []),
          ", mean similarity ",
          Number(biggest.meanSimilarity.toFixed(2)),
          ".",
        ],
        method: `Cosine similarity over note tokens, clusters at ${s.templatedNotes.threshold.toFixed(2)} or above with at least five notes.`,
        severity: DETECTORS["templated-notes"].stakes * clamp(members.length / 12),
        subjects: { cases: members, assets: [] },
      }),
    );
  }

  if (s.negativeSpace.flagged) {
    const rows = s.negativeSpace.rows.filter((r) => r.cells.some((c) => c.state === "negative_space"));
    const lead = rows.sort(
      (x, y) => y.cells.filter((c) => c.state === "negative_space").length - x.cells.filter((c) => c.state === "negative_space").length,
    )[0]!;
    const expected = lead.cells.filter((c) => c.state === "negative_space").reduce((sum, c) => sum + (c.expected ?? 0), 0);
    out.push(
      finding(cycle, verdicts, "negative-space", {
        claimRef: null,
        title: `No alerts where the inventory and peers expect them`,
        statement: [
          s.negativeSpace.negativeCells,
          " asset-class and category cells are empty where peers predict alerts. The ",
          lead.assetClass === "ot" ? "OT" : lead.assetClass,
          " row should hold about ",
          Math.round(expected),
          " alerts from ",
          lead.assets,
          " assets, ",
          lead.critical,
          " of them critical, and holds none.",
        ],
        method: DETECTORS["negative-space"].question,
        severity: DETECTORS["negative-space"].stakes * clamp(s.negativeSpace.negativeCells / 4),
        subjects: { cases: [], assets: s.negativeSpace.silentAssetIds },
      }),
    );
  }

  if (s.weekend.flagged) {
    out.push(
      finding(cycle, verdicts, "weekend-coverage", {
        claimRef: null,
        title: "Weekend acknowledgement slows sharply",
        statement: [
          "Weekend alerts wait ",
          Number((s.weekend.ratio ?? 0).toFixed(1)),
          " times as long for an analyst, and ",
          s.weekend.mondayClosures,
          " weekend cases closed on Monday morning.",
        ],
        method: DETECTORS["weekend-coverage"].question,
        severity: DETECTORS["weekend-coverage"].stakes * clamp(((s.weekend.ratio ?? 1) - 1) / 4),
        subjects: { cases: s.weekend.slowestCaseIds, assets: [] },
      }),
    );
  }

  if (s.repeats.flagged) {
    const autoClosed = s.repeats.series.reduce((sum, r) => sum + r.autoClosed, 0);
    out.push(
      finding(cycle, verdicts, "repeat-no-remediation", {
        claimRef: null,
        title: "The same alerts repeat with no case",
        statement: [
          s.repeats.series.length,
          " assets raise the same alert week after week with no case opened, and automation closed ",
          autoClosed,
          " of those alerts.",
        ],
        method: DETECTORS["repeat-no-remediation"].question,
        severity: DETECTORS["repeat-no-remediation"].stakes * clamp(s.repeats.series.length / 5),
        subjects: { cases: [], assets: s.repeats.series.map((r) => r.assetId) },
      }),
    );
  }

  // Most severe first. Precision weighs a finding in the risk indicator, not in this order,
  // so a detector examiners rarely confirm cannot push a direct control failure down the list.
  return out
    .sort((x, y) => y.severity - x.severity || y.weight - x.weight || (x.claimRef ?? "z").localeCompare(y.claimRef ?? "z"))
    .map((f, i) => ({ ...f, id: `F-${String(i + 1).padStart(2, "0")}` }));
}

// Supervisory risk indicator, 0 to 100. Each finding adds its severity weighted by how
// often examiners confirmed that detector before. The curve flattens so that one more
// finding matters less once an entity is clearly in need of attention.
export function riskIndicator(findings: readonly SupervisoryFinding[]): number {
  const load = findings.reduce((sum, f) => sum + f.weight, 0);
  return Math.round(100 * (1 - Math.exp(-load / 2)));
}

// By default a cycle is analysed as it was at the time, with the detector versions and
// examiner verdicts of that cycle. `asOf` re-runs a past cycle with a later cycle's
// detectors and calibration, which is how the portfolio trend stays comparable.
export function analyseEntity(ws: Workspace, entity: string, cycle: string, verdicts: readonly Verdict[], asOf = cycle): EntityAnalysis {
  const window = ws.window(entity, cycle, 2);
  const head = window[0]!;
  const assessment = assess(loadClaimsFile(submissionDir(ws.dataDir, entity, cycle)), window, { rulesCycle: asOf });
  const signals = computeSignals(ws, entity, cycle, asOf);
  const findings = computeFindings({ assessment, signals }, asOf, verdicts);
  return {
    code: entity,
    cycle,
    cycleLabel: head.manifest.quarter.label,
    assessment,
    overview: overview(head),
    signals,
    findings,
    risk: riskIndicator(findings),
    samples: drawSamples(ws, entity, cycle, findings),
  };
}

// The quarter's estate, staff and alert count, and the first critical alert, in time order,
// that was escalated to L2 within 30 minutes and closed inside its SLA.
export function overview(sub: Submission): Overview {
  const assets = sub.records.assets ?? [];
  const classOf = new Map(assets.map((a) => [a.id, a.asset_class]));
  const alerts = sub.records.alerts ?? [];
  const alertsBy = new Map<string, number>();
  for (const a of alerts) {
    const k = classOf.get(a.asset_id);
    if (k) alertsBy.set(k, (alertsBy.get(k) ?? 0) + 1);
  }
  const otSites = new Map<string, number>();
  for (const a of assets) if (a.asset_class === "ot") otSites.set(a.site, (otSites.get(a.site) ?? 0) + 1);
  let exemplar: Overview["exemplar"] = null;
  if (sub.records.escalations && sub.records.rules) {
    const ix = new Indexed(sub);
    const p1 = (sub.records.cases ?? []).filter((c) => c.priority === "P1" && c.closed_at !== null).sort((x, y) => x.opened_at - y.opened_at);
    for (const c of p1) {
      const r = ix.caseRow(c);
      if (r.escalatedAfterMin !== null && r.escalatedAfterMin <= 30 && r.chain.length === 1 && (r.closedAfterMin ?? Infinity) <= c.sla_close_minutes) {
        exemplar = r;
        break;
      }
    }
  }
  return {
    estate: ASSET_CLASSES.map((k) => ({
      assetClass: k,
      assets: assets.filter((a) => a.asset_class === k).length,
      critical: assets.filter((a) => a.asset_class === k && a.criticality === "critical").length,
      alerts: alertsBy.get(k) ?? 0,
    })).filter((e) => e.assets > 0),
    otSites: [...otSites].map(([site, n]) => ({ site, assets: n })).sort((x, y) => (x.site < y.site ? -1 : 1)),
    analysts: LEVELS.map((level) => ({ level, count: (sub.records.analysts ?? []).filter((x) => x.level === level).length })),
    alerts: alerts.length,
    exemplar,
  };
}

export type { Subjects, Finding };
