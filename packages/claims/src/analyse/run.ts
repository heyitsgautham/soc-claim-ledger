import { mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { analyseEntity } from "./analyse";
import { Workspace } from "./workspace";
import { calibrate } from "./calibration";
import type { EntityAnalysis, Portfolio, PortfolioEntry, Verdict } from "./types";

// Runs the analysis for every entity and every cycle on disk and writes what the
// interface renders into data/demo/derived. Each cycle's risk uses only verdicts that
// examiners had recorded before that cycle, so the trend is what the tool would have
// said at the time.

export const DERIVED_DIR = "derived";
export const VERDICT_HISTORY = path.join("verdicts", "history.ndjson");

export function readVerdicts(file: string): Verdict[] {
  if (!existsSync(file)) return [];
  return readFileSync(file, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l) as Verdict);
}

export function analyseCycle(ws: Workspace, cycle: string, verdicts: readonly Verdict[], asOf = cycle): EntityAnalysis[] {
  return ws.entities.filter((e) => ws.quarters(e).includes(cycle)).map((e) => analyseEntity(ws, e, cycle, verdicts, asOf));
}

export interface RunSummary {
  cycle: string;
  entities: number;
  verdicts: number;
}

export function runAnalysis(dataDir: string): RunSummary {
  const started = process.cpuUsage();
  const ws = new Workspace(dataDir);
  const verdicts = readVerdicts(path.join(dataDir, VERDICT_HISTORY));
  const cycles = [...new Set(ws.entities.flatMap((e) => ws.quarters(e)))].sort();
  const current = cycles.at(-1)!;

  const byCycle = new Map<string, EntityAnalysis[]>();
  // Every cycle re-run with today's detectors and calibration, so the trend compares like with like.
  for (const c of cycles) byCycle.set(c, analyseCycle(ws, c, verdicts, current));
  const now = byCycle.get(current)!;
  const label = (c: string) => byCycle.get(c)?.[0]?.cycleLabel ?? c;

  const out = path.join(dataDir, DERIVED_DIR);
  rmSync(out, { recursive: true, force: true });
  mkdirSync(path.join(out, "entities"), { recursive: true });
  for (const a of now) writeFileSync(path.join(out, "entities", `${a.code}.json`), JSON.stringify(a));

  let alerts = 0;
  let casesTotal = 0;
  let submissions = 0;
  for (const e of ws.entities) {
    for (const q of ws.quarters(e)) {
      const m = ws.submission(e, q).manifest;
      submissions++;
      alerts += m.exports.alerts?.rows ?? 0;
      casesTotal += m.exports.cases?.rows ?? 0;
    }
  }

  const entries: Omit<PortfolioEntry, "rank">[] = now.map((a) => {
    const trend = cycles.map((c) => ({ cycle: c, label: label(c), risk: byCycle.get(c)!.find((x) => x.code === a.code)?.risk ?? 0 }));
    const ev = a.assessment.evaluations;
    const missing = [
      ...new Set(ev.flatMap((e) => (e.reason && (e.reason.kind === "missing_export" || e.reason.kind === "partial_export") ? e.reason.exports : []))),
    ];
    return {
      code: a.code,
      sector: a.assessment.entity.sector,
      description: a.assessment.entity.description,
      sites: a.assessment.entity.sites,
      risk: a.risk,
      previousRisk: trend.length > 1 ? trend[trend.length - 2]!.risk : null,
      trend,
      gaps: ev.filter((e) => e.status === "gap").length,
      insufficient: ev.filter((e) => e.status === "insufficient_evidence").length,
      holds: ev.filter((e) => e.status === "holds").length,
      missingExports: missing,
      findings: a.findings.length,
      reasons: a.findings.slice(0, 2).map((f) => ({ detector: f.detector, title: f.title, statement: f.statement, weight: f.weight })),
      signals: [...new Set(a.findings.map((f) => f.detector.id))],
    };
  });
  entries.sort((x, y) => y.risk - x.risk || y.gaps - x.gaps || y.insufficient - x.insufficient || (x.code < y.code ? -1 : 1));
  const portfolio: Portfolio = {
    cycle: current,
    cycleLabel: label(current),
    generatedFrom: { entities: ws.entities.length, submissions, alerts, cases: casesTotal },
    // ponytail: processor time, not wall clock, so a busy machine does not inflate it. The analysis is single-threaded.
    analysedInSeconds: cpuSeconds(started),
    entries: entries.map((e, i) => ({ ...e, rank: i + 1 })),
  };
  writeFileSync(path.join(out, "portfolio.json"), JSON.stringify(portfolio));

  const calibration = calibrate(
    verdicts,
    cycles.map((c) => ({ id: c, label: label(c) })),
  );
  writeFileSync(path.join(out, "calibration.json"), JSON.stringify(calibration));

  return { cycle: current, entities: now.length, verdicts: verdicts.length };
}

function cpuSeconds(since: NodeJS.CpuUsage): number {
  const { user, system } = process.cpuUsage(since);
  return Math.round((user + system) / 100_000) / 10;
}
