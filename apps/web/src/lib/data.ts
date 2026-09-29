import "server-only";
import { existsSync, mkdirSync, readFileSync, appendFileSync } from "node:fs";
import path from "node:path";
import type { AuditEntry, Calibration, EntityAnalysis, Portfolio, Verdict } from "@ledger/claims/model";

// The interface renders what `pnpm analyse` wrote to data/demo/derived. It computes
// nothing itself, so every number on screen traces back to the analysis of the records.
// Live examiner work, verdicts and report exports, goes to data/local.

function root(): string {
  return path.resolve(process.cwd(), "../..");
}

export function dataDir(): string {
  return process.env.LEDGER_DATA_DIR ?? path.join(root(), "data/demo");
}

export function localDir(): string {
  return process.env.LEDGER_LOCAL_DIR ?? path.join(root(), "data/local");
}

function readJson<T>(file: string): T {
  if (!existsSync(file)) throw new Error(`${file} is missing. Run pnpm simulate and pnpm analyse first.`);
  return JSON.parse(readFileSync(file, "utf8")) as T;
}

export function loadPortfolio(): Portfolio {
  return readJson<Portfolio>(path.join(dataDir(), "derived/portfolio.json"));
}

export function entityCodes(): string[] {
  return loadPortfolio().entries.map((e) => e.code);
}

export function loadEntity(code: string): EntityAnalysis {
  return readJson<EntityAnalysis>(path.join(dataDir(), "derived/entities", `${code}.json`));
}

export function loadCalibrationHistory(): Calibration {
  return readJson<Calibration>(path.join(dataDir(), "derived/calibration.json"));
}

export function verdictHistory(): Verdict[] {
  const file = path.join(dataDir(), "verdicts/history.ndjson");
  if (!existsSync(file)) return [];
  return readFileSync(file, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l) as Verdict);
}

function readLines<T>(name: string): T[] {
  const file = path.join(localDir(), name);
  if (!existsSync(file)) return [];
  return readFileSync(file, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l) as T);
}

function appendLine(name: string, row: unknown) {
  mkdirSync(localDir(), { recursive: true });
  appendFileSync(path.join(localDir(), name), `${JSON.stringify(row)}\n`);
}

export function localVerdicts(): Verdict[] {
  return readLines<Verdict>("verdicts.ndjson");
}

export function recordVerdict(v: Verdict) {
  appendLine("verdicts.ndjson", v);
}

export function localAudit(): AuditEntry[] {
  return readLines<AuditEntry>("audit.ndjson");
}

export function recordAudit(e: AuditEntry) {
  appendLine("audit.ndjson", e);
}

// The entity the entity-scoped screens open on when none is chosen: the top of the
// attention order.
export function defaultEntity(): string {
  return loadPortfolio().entries[0]!.code;
}
