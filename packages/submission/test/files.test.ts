import assert from "node:assert/strict";
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "vitest";
import { decodeExport, encodeExport, loadSubmission, SubmissionError } from "../src/index";

const demo = path.resolve(import.meta.dirname, "../../../data/demo/P-04/FY27-Q1");

test("an export survives encode and decode, and the same rows give the same bytes", () => {
  const rows = [{ id: "L1-01", level: "L1" as const, joined_on: "2021-03-01" }];
  const a = encodeExport<"analysts">(rows);
  const b = encodeExport<"analysts">(rows);
  assert.deepEqual(a, b);
  assert.deepEqual(decodeExport("analysts", a, "test"), rows);
});

test("a row that breaks the schema is refused with its line number", () => {
  const bytes = encodeExport<"analysts">([{ id: "L1-01", level: "L9" as never, joined_on: "2021-03-01" }]);
  assert.throws(() => decodeExport("analysts", bytes, "analysts.ndjson.gz"), /line 1 fails the analysts schema at level/);
});

test("the loader refuses a file whose SHA-256 does not match the manifest", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "ledger-"));
  cpSync(demo, dir, { recursive: true });
  const file = path.join(dir, "analysts.ndjson.gz");
  writeFileSync(file, Buffer.concat([readFileSync(file), Buffer.from([0])]));
  assert.throws(
    () => loadSubmission(dir),
    (e: unknown) => e instanceof SubmissionError && /does not match the manifest/.test(e.message),
  );
});

test("the demo submission loads and every declared row count matches", () => {
  const s = loadSubmission(demo);
  for (const [name, entry] of Object.entries(s.manifest.exports)) {
    assert.equal((s.records as Record<string, unknown[]>)[name]?.length, entry!.rows, name);
  }
});
