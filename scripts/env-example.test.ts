import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "vitest";

// .env.example is the one place a new clone learns what it can configure.
// This test reads every tracked TypeScript and Python file for the variables it reads
// and fails when one is missing from .env.example, or when .env.example lists one
// that nothing reads any more.

const ROOT = path.resolve(import.meta.dirname, "..");

// The ways the code reads a variable: process.env.X, process.env["X"], the web app's
// setting("X", ...), os.environ.get("X"), os.environ["X"] and the API's _setting("X").
const READS = [
  /process\.env\.([A-Z][A-Z0-9_]*)/g,
  /process\.env\[["']([A-Z][A-Z0-9_]*)["']\]/g,
  /\b_?setting\(["']([A-Z][A-Z0-9_]*)["']/g,
  /os\.environ(?:\.get)?[([]["']([A-Z][A-Z0-9_]*)["']/g,
  /os\.getenv\(["']([A-Z][A-Z0-9_]*)["']/g,
];

// Variables the runtime sets itself, which nobody configures.
const SET_BY_RUNTIME = new Set(["NEXT_RUNTIME", "NODE_ENV"]);

// Unit tests stub made-up variables to exercise the readers, so they are not readers themselves.
const isUnitTest = (f: string) => /(^|\/)tests?\//.test(f);

function variablesRead(source: string): string[] {
  const found = new Set<string>();
  for (const re of READS) for (const m of source.matchAll(re)) found.add(m[1]!);
  return [...found];
}

function variablesListed(example: string): string[] {
  return example
    .split("\n")
    .map((l) => /^([A-Z][A-Z0-9_]*)=/.exec(l.trim())?.[1])
    .filter((v): v is string => !!v);
}

function readByCode(): Map<string, string[]> {
  const files = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "*.ts", "*.tsx", "*.py"], { cwd: ROOT, encoding: "utf8" })
    .split("\n")
    .filter((f) => f && !isUnitTest(f) && f !== "scripts/env-example.test.ts");
  const where = new Map<string, string[]>();
  for (const f of files) {
    for (const v of variablesRead(readFileSync(path.join(ROOT, f), "utf8"))) where.set(v, [...(where.get(v) ?? []), f]);
  }
  return where;
}

test("the readers find each way the code reads a variable", () => {
  const src = [
    'const a = process.env.LEDGER_A ?? "";',
    'const b = process.env["LEDGER_B"];',
    'return setting("LEDGER_C", path.join(root(), "x"));',
    'os.environ.get("LEDGER_D", "")',
    'os.environ["LEDGER_E"]',
    'value = _setting("LEDGER_F")',
    'os.getenv("LEDGER_G")',
    "const lower = process.env.toString();",
  ].join("\n");
  assert.deepEqual(variablesRead(src).sort(), ["LEDGER_A", "LEDGER_B", "LEDGER_C", "LEDGER_D", "LEDGER_E", "LEDGER_F", "LEDGER_G"]);
  assert.deepEqual(variablesListed("# LEDGER_X=1\nLEDGER_Y=\n  LEDGER_Z=http://a=b\nnot a line"), ["LEDGER_Y", "LEDGER_Z"]);
});

test(".env.example lists every variable the code reads, and nothing else", () => {
  const read = readByCode();
  const listed = new Set(variablesListed(readFileSync(path.join(ROOT, ".env.example"), "utf8")));
  const missing = [...read].filter(([v]) => !listed.has(v) && !SET_BY_RUNTIME.has(v)).map(([v, files]) => `${v} (read in ${files.join(", ")})`);
  assert.deepEqual(missing, [], `add these to .env.example: ${missing.join("; ")}`);
  const stale = [...listed].filter((v) => !read.has(v));
  assert.deepEqual(stale, [], `nothing reads these any more, drop them from .env.example: ${stale.join(", ")}`);
});
