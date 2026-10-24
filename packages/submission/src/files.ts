import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { gunzipSync, gzipSync } from "node:zlib";
import { EXPORT_NAMES, type ExportName } from "./constants";
import { type ExportEntry, type Manifest, ManifestSchema, RECORD_SCHEMAS, type RecordInput, type RecordOf } from "./schema";

// On disk a submission is one folder per entity per quarter.
//
//   data/demo/P-04/FY27-Q1/manifest.json
//   data/demo/P-04/FY27-Q1/alerts.ndjson.gz
//   data/demo/P-04/FY27-Q1/claims.json
//
// Each export is gzipped NDJSON, the manifest lists what was submitted with a row count
// and a SHA-256 of the file, and the loader refuses any file that does not match.

export const MANIFEST_FILE = "manifest.json";

export class SubmissionError extends Error {
  override name = "SubmissionError";
}

export type Records = { [N in ExportName]?: RecordOf<N>[] };

export interface Submission {
  dir: string;
  manifest: Manifest;
  records: Records;
}

export function exportFileName(name: ExportName): string {
  return `${name}.ndjson.gz`;
}

export function sha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

// Node writes gzip headers with a zero mtime, so the same rows always give the same bytes and hash.
export function encodeExport<N extends ExportName>(rows: RecordInput<N>[]): Buffer {
  const text = rows.map((row) => JSON.stringify(row)).join("\n") + (rows.length ? "\n" : "");
  return gzipSync(Buffer.from(text, "utf8"), { level: 9 });
}

export function decodeExport<N extends ExportName>(name: N, bytes: Buffer, source: string): RecordOf<N>[] {
  const schema = RECORD_SCHEMAS[name];
  const lines = gunzipSync(bytes).toString("utf8").split("\n");
  const rows: RecordOf<N>[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    let raw: unknown;
    try {
      raw = JSON.parse(line);
    } catch {
      throw new SubmissionError(`${source}: line ${i + 1} is not valid JSON`);
    }
    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      throw new SubmissionError(`${source}: line ${i + 1} fails the ${name} schema at ${issue?.path.join(".") || "(root)"}: ${issue?.message}`);
    }
    rows.push(parsed.data as RecordOf<N>);
  }
  return rows;
}

function readManifest(dir: string): Manifest {
  const file = path.join(dir, MANIFEST_FILE);
  if (!existsSync(file)) throw new SubmissionError(`${file}: no manifest, not a submission folder`);
  const parsed = ManifestSchema.safeParse(JSON.parse(readFileSync(file, "utf8")));
  if (!parsed.success) {
    throw new SubmissionError(`${file}: ${parsed.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; ")}`);
  }
  return parsed.data;
}

function loadExport<N extends ExportName>(dir: string, name: N, entry: ExportEntry): RecordOf<N>[] {
  const file = path.join(dir, entry.file);
  if (!existsSync(file)) throw new SubmissionError(`${file}: listed in the manifest but missing on disk`);
  const bytes = readFileSync(file);
  const digest = sha256(bytes);
  if (digest !== entry.sha256) {
    throw new SubmissionError(`${file}: SHA-256 ${digest} does not match the manifest's ${entry.sha256}`);
  }
  const rows = decodeExport(name, bytes, file);
  if (rows.length !== entry.rows) {
    throw new SubmissionError(`${file}: ${rows.length} rows, the manifest declares ${entry.rows}`);
  }
  return rows;
}

const cache = new Map<string, Submission>();

// Loads and validates every export the manifest lists. Results are cached per folder,
// because a submission never changes once it is on disk.
export function loadSubmission(dir: string): Submission {
  const key = path.resolve(dir);
  const hit = cache.get(key);
  if (hit) return hit;

  const manifest = readManifest(key);
  const records: Records = {};
  for (const name of EXPORT_NAMES) {
    const entry = manifest.exports[name];
    if (!entry) continue;
    // The cast is safe because loadExport is generic over the same name.
    (records as Record<ExportName, unknown>)[name] = loadExport(key, name, entry);
  }
  const submission: Submission = { dir: key, manifest, records };
  cache.set(key, submission);
  return submission;
}

export function listEntities(dataDir: string): string[] {
  if (!existsSync(dataDir)) return [];
  return readdirSync(dataDir)
    .filter((name) => /^[A-Z]-\d{2}$/.test(name) && statSync(path.join(dataDir, name)).isDirectory())
    .sort();
}

// Quarter ids sort correctly as strings, FY26-Q4 before FY27-Q1.
export function listQuarters(dataDir: string, entity: string): string[] {
  const dir = path.join(dataDir, entity);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => /^FY\d{2}-Q[1-4]$/.test(name) && existsSync(path.join(dir, name, MANIFEST_FILE)))
    .sort();
}

export function submissionDir(dataDir: string, entity: string, quarter: string): string {
  return path.join(dataDir, entity, quarter);
}
