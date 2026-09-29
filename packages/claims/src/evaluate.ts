import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  type ExportName,
  listQuarters,
  loadSubmission,
  type Manifest,
  type Submission,
  SubmissionError,
  submissionDir,
} from "@ledger/submission";
import { CATALOGUE } from "./catalogue";
import { Indexed } from "./context";
import { type AttestedClaim, CLAIMS_FILE, type ClaimsFile, ClaimsFileSchema, type Measure } from "./schema";
import type { ClaimEvaluation, Direction, ExportUsed, InsufficientReason, Status, Tolerance } from "./types";

// Measures compare on one axis: percentages for percents and fractions, seconds for
// durations, raw values for counts.
export function measureValue(m: Measure): number {
  switch (m.kind) {
    case "percent":
      return m.value;
    case "fraction":
      return (m.numerator / m.denominator) * 100;
    case "duration":
      return m.seconds;
    case "count":
      return m.value;
  }
}

export function holds(attested: Measure, recomputed: Measure, direction: Direction, tolerance: Tolerance): boolean {
  const a = measureValue(attested);
  const r = measureValue(recomputed);
  const slack = tolerance.kind === "points" ? tolerance.value : tolerance.kind === "relative" ? Math.abs(a) * tolerance.value : 0;
  return direction === "higher_is_better" ? r >= a - slack - 1e-9 : r <= a + slack + 1e-9;
}

// How far past the claim the records are, counted in tolerances. A 39-point miss on a
// share with a 2-point tolerance is 19.5 tolerances out. This puts shares, times and counts
// on one footing, which a raw shortfall does not: a share's shortfall is taken out of 100
// while a time's is taken out of the attested time.
export function excess(attested: Measure, recomputed: Measure, direction: Direction, tolerance: Tolerance): number {
  const a = measureValue(attested);
  const r = measureValue(recomputed);
  const adverse = direction === "higher_is_better" ? a - r : r - a;
  if (adverse <= 0) return 0;
  const unit = tolerance.kind === "points" ? tolerance.value : tolerance.kind === "relative" ? Math.abs(a) * tolerance.value : 1;
  return adverse / Math.max(unit, 1e-9);
}

// How far the records fall short of the claim, relative to the claim's own scale.
export function shortfall(attested: Measure, recomputed: Measure, direction: Direction): number {
  const a = measureValue(attested);
  const r = measureValue(recomputed);
  const adverse = direction === "higher_is_better" ? a - r : r - a;
  if (adverse <= 0) return 0;
  const scale = attested.kind === "percent" || attested.kind === "fraction" ? 100 : Math.max(Math.abs(a), 1);
  return adverse / scale;
}

function evaluateClaim(claim: AttestedClaim, window: Indexed[], rulesCycle?: string): ClaimEvaluation {
  const def = CATALOGUE[claim.metric];
  const sector = window[0]?.submission.manifest.entity.sector;
  const base = {
    claim,
    basis: (def.basis ?? []).filter((b) => !b.sectors || (sector !== undefined && b.sectors.includes(sector))).map(({ source, clause, says }) => ({ source, clause, says })),
    direction: def.direction,
    tolerance: def.tolerance,
    kind: def.kind,
    rule: def.rule,
    method: def.method,
    reference: null,
    window: window.slice(0, def.lookbackQuarters).map((ix) => ix.quarter),
  };
  const insufficient = (reason: InsufficientReason, exportsUsed: ExportUsed[] = []): ClaimEvaluation => ({
    ...base,
    status: "insufficient_evidence",
    recomputed: null,
    population: null,
    matched: null,
    finding: null,
    reason,
    shortfall: 0,
    excess: 0,
    stakes: def.stakes,
    exportsUsed,
    evidence: [],
    subjects: { cases: [], assets: [] },
  });

  if (claim.attested.kind !== def.kind) {
    throw new Error(`claim ${claim.ref} attests a ${claim.attested.kind}, metric ${claim.metric} measures a ${def.kind}`);
  }
  if (window.length < def.lookbackQuarters) {
    return insufficient({ kind: "short_window", needed: def.lookbackQuarters, available: window.length });
  }
  const used = window.slice(0, def.lookbackQuarters);

  // A claim can only be tested against exports that were submitted and declared complete.
  // Anything less and the absence of a record says nothing about the SOC.
  const missing = new Set<ExportName>();
  const partial = new Set<ExportName>();
  const missingIn = new Set<string>();
  const partialIn = new Set<string>();
  for (const ix of used) {
    for (const name of def.requires) {
      const entry = ix.submission.manifest.exports[name];
      if (!entry || !ix.has(name)) {
        missing.add(name);
        missingIn.add(ix.quarter);
      } else if (!entry.declared_complete) {
        partial.add(name);
        partialIn.add(ix.quarter);
      }
    }
  }
  if (missing.size) return insufficient({ kind: "missing_export", exports: [...missing], quarters: [...missingIn] });
  if (partial.size) return insufficient({ kind: "partial_export", exports: [...partial], quarters: [...partialIn] });

  const exportsUsed: ExportUsed[] = used.flatMap((ix) =>
    def.requires.map((name) => {
      const entry = ix.submission.manifest.exports[name]!;
      return { name, quarter: ix.quarter, rows: entry.rows, sha256: entry.sha256, declaredComplete: entry.declared_complete };
    }),
  );

  const result = def.compute({ window: used, rulesCycle });
  if ("empty" in result) return insufficient({ kind: "empty_population", noun: result.empty }, exportsUsed);

  const status: Status = holds(claim.attested, result.recomputed, def.direction, def.tolerance) ? "holds" : "gap";
  return {
    ...base,
    status,
    recomputed: result.recomputed,
    population: result.population,
    matched: result.matched,
    reference: result.reference ?? null,
    finding: result.finding ?? null,
    reason: null,
    shortfall: shortfall(claim.attested, result.recomputed, def.direction),
    excess: excess(claim.attested, result.recomputed, def.direction, def.tolerance),
    stakes: def.stakes,
    exportsUsed,
    evidence: result.evidence,
    subjects: status === "gap" ? { cases: result.subjects?.cases ?? [], assets: result.subjects?.assets ?? [] } : { cases: [], assets: [] },
  };
}

export interface Assessment {
  entity: Manifest["entity"];
  quarter: Manifest["quarter"];
  submittedOn: string;
  claimsDocument: Omit<ClaimsFile, "claims">;
  // Row counts of the attested quarter's exports, for the header.
  exports: { name: ExportName; rows: number; declaredComplete: boolean }[];
  window: { id: string; label: string }[];
  evaluations: ClaimEvaluation[];
}

// Evaluates one claims file against the submission it came with and the ones before it.
// `submissions` is newest first, and submissions[0] must be the quarter the claims attest.
export function assess(claims: ClaimsFile, submissions: Submission[], options: { rulesCycle?: string } = {}): Assessment {
  const head = submissions[0];
  if (!head) throw new Error("no submission to assess");
  if (head.manifest.quarter.id !== claims.quarter_id || head.manifest.entity.code !== claims.entity) {
    throw new Error(`claims ${claims.document_id} attest ${claims.entity} ${claims.quarter_id}, not ${head.manifest.entity.code} ${head.manifest.quarter.id}`);
  }
  const window = submissions.map((s) => new Indexed(s));
  const { claims: items, ...document } = claims;
  return {
    entity: head.manifest.entity,
    quarter: head.manifest.quarter,
    submittedOn: head.manifest.submitted_on,
    claimsDocument: document,
    exports: Object.entries(head.manifest.exports).map(([name, e]) => ({ name: name as ExportName, rows: e!.rows, declaredComplete: e!.declared_complete })),
    window: submissions.map((s) => ({ id: s.manifest.quarter.id, label: s.manifest.quarter.label })),
    evaluations: items.map((claim) => evaluateClaim(claim, window, options.rulesCycle)),
  };
}

export function loadClaimsFile(dir: string): ClaimsFile {
  const file = path.join(dir, CLAIMS_FILE);
  if (!existsSync(file)) throw new SubmissionError(`${file}: no self-assessment in this submission`);
  const parsed = ClaimsFileSchema.safeParse(JSON.parse(readFileSync(file, "utf8")));
  if (!parsed.success) {
    throw new SubmissionError(`${file}: ${parsed.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; ")}`);
  }
  return parsed.data;
}

// Loads the latest quarter of an entity from a data folder, with every earlier quarter
// available as lookback, and assesses its claims.
export function assessLatest(dataDir: string, entity: string, quarter?: string): Assessment {
  const quarters = listQuarters(dataDir, entity);
  const target = quarter ?? quarters[quarters.length - 1];
  if (!target || !quarters.includes(target)) throw new SubmissionError(`no submission for ${entity} ${quarter ?? ""} in ${dataDir}`);
  // Only load as far back as the longest lookback any metric needs.
  const depth = Math.max(...Object.values(CATALOGUE).map((d) => d.lookbackQuarters));
  const upTo = quarters.slice(0, quarters.indexOf(target) + 1).reverse().slice(0, depth);
  const submissions = upTo.map((q) => loadSubmission(submissionDir(dataDir, entity, q)));
  return assess(loadClaimsFile(submissionDir(dataDir, entity, target)), submissions);
}
