import assert from "node:assert/strict";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { gzipSync } from "node:zlib";
import { test } from "vitest";
import {
  AlertSchema,
  CaseSchema,
  classCounts,
  decodeExport,
  EXPORT_NAMES,
  encodeExport,
  isCriticalOt,
  listEntities,
  listQuarters,
  loadSubmission,
  ManifestSchema,
  RECORD_SCHEMAS,
  RuleSchema,
  SubmissionError,
  sha256,
  ShiftSchema,
  submissionDir,
} from "../src/index";

const data = path.resolve(import.meta.dirname, "../../../data/demo");
const demo = path.join(data, "P-04/FY27-Q1");

const alert = {
  id: "A-1",
  created_at: "2026-04-01T09:30:00+05:30",
  rule_id: "R-1",
  priority: "P1",
  asset_id: "H-1",
  acknowledged_at: null,
  acknowledged_by: null,
  case_id: null,
};

test("a timestamp with an offset becomes epoch milliseconds, the same instant in any zone", () => {
  const ist = AlertSchema.parse(alert);
  const utc = AlertSchema.parse({ ...alert, created_at: "2026-04-01T04:00:00Z" });
  assert.equal(ist.created_at, Date.UTC(2026, 3, 1, 4, 0));
  assert.equal(ist.created_at, utc.created_at);
  assert.equal(ist.acknowledged_at, null);
});

test("a timestamp without an offset is refused, so no record is read in the wrong zone", () => {
  const r = AlertSchema.safeParse({ ...alert, created_at: "2026-04-01T09:30:00" });
  assert.equal(r.success, false);
  assert.deepEqual(r.error?.issues[0]?.path, ["created_at"]);
});

test("enums and counts hold: an unknown priority, a zero alert count and a bad technique are refused", () => {
  assert.equal(AlertSchema.safeParse({ ...alert, priority: "P5" }).success, false);
  const c = {
    id: "C-1",
    priority: "P2",
    opened_at: "2026-04-01T10:00:00+05:30",
    rule_id: "R-1",
    asset_id: "H-1",
    alert_count: 1,
    owner: "L1-01",
    playbook_id: null,
    sla_close_minutes: 240,
    closed_at: null,
    closed_by: null,
    disposition: null,
    note: "",
  };
  assert.equal(CaseSchema.safeParse(c).success, true);
  assert.equal(CaseSchema.safeParse({ ...c, alert_count: 0 }).success, false);
  assert.equal(CaseSchema.safeParse({ ...c, sla_close_minutes: 0 }).success, false);
  assert.equal(CaseSchema.safeParse({ ...c, disposition: "resolved" }).success, false);
  const rule = { id: "R-1", name: "Office macro spawns shell", technique: "T1204.002", tactic: "execution", priority: "P2", asset_classes: ["endpoint"] };
  assert.equal(RuleSchema.safeParse(rule).success, true);
  assert.equal(RuleSchema.safeParse({ ...rule, technique: "T12" }).success, false);
  assert.equal(RuleSchema.safeParse({ ...rule, asset_classes: [] }).success, false);
});

test("a shift keeps its roster and accepts an empty on-call slot", () => {
  const s = ShiftSchema.parse({
    id: "S-1",
    date: "2026-04-04",
    shift: "C",
    starts_at: "2026-04-04T22:00:00+05:30",
    ends_at: "2026-04-05T06:00:00+05:30",
    l1_on_duty: ["L1-01", "L1-02"],
    l2_on_call: null,
    l3_on_call: "L3-01",
  });
  assert.equal(s.ends_at - s.starts_at, 8 * 3600_000);
  assert.deepEqual(s.l1_on_duty, ["L1-01", "L1-02"]);
  assert.equal(ShiftSchema.safeParse({ ...s, shift: "D" }).success, false);
});

test("every export name has a record schema", () => {
  assert.deepEqual(Object.keys(RECORD_SCHEMAS).sort(), [...EXPORT_NAMES].sort());
});

test("the demo manifest passes, and a wrong schema version, entity code or digest does not", () => {
  const manifest = JSON.parse(readFileSync(path.join(demo, "manifest.json"), "utf8"));
  assert.equal(ManifestSchema.safeParse(manifest).success, true);
  assert.equal(ManifestSchema.safeParse({ ...manifest, schema_version: 2 }).success, false);
  assert.equal(ManifestSchema.safeParse({ ...manifest, entity: { ...manifest.entity, code: "P-4" } }).success, false);
  const cases = { ...manifest.exports.cases, sha256: "ABC" };
  assert.equal(ManifestSchema.safeParse({ ...manifest, exports: { ...manifest.exports, cases } }).success, false);
});

test("sha256 is the hex digest of the bytes", () => {
  assert.equal(sha256(Buffer.from("abc")), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
});

test("a line that is not JSON is refused with its number, and blank lines are skipped", () => {
  const bad = gzipSync('{"id":"L1-01","level":"L1","joined_on":"2021-03-01"}\n\n{oops\n');
  assert.throws(() => decodeExport("analysts", bad, "analysts.ndjson.gz"), /analysts\.ndjson\.gz: line 3 is not valid JSON$/);
  assert.deepEqual(decodeExport("analysts", encodeExport<"analysts">([]), "empty"), []);
});

function copyDemo(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "ledger-sub-"));
  cpSync(demo, dir, { recursive: true });
  return dir;
}

test("a folder with no manifest, or a manifest that breaks the schema, is not a submission", () => {
  const empty = mkdtempSync(path.join(tmpdir(), "ledger-sub-"));
  try {
    assert.throws(
      () => loadSubmission(empty),
      (e: unknown) => e instanceof SubmissionError && /no manifest, not a submission folder/.test(e.message),
    );
    writeFileSync(path.join(empty, "manifest.json"), JSON.stringify({ schema_version: 1 }));
    assert.throws(() => loadSubmission(empty), /entity/);
  } finally {
    rmSync(empty, { recursive: true, force: true });
  }
});

test("an export the manifest lists but the folder lacks is refused by name", () => {
  const dir = copyDemo();
  try {
    rmSync(path.join(dir, "shifts.ndjson.gz"));
    assert.throws(() => loadSubmission(dir), /shifts\.ndjson\.gz: listed in the manifest but missing on disk/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a row count that differs from the manifest is refused even when the digest matches", () => {
  const dir = copyDemo();
  try {
    const manifest = JSON.parse(readFileSync(path.join(dir, "manifest.json"), "utf8"));
    manifest.exports.analysts.rows += 1;
    writeFileSync(path.join(dir, "manifest.json"), JSON.stringify(manifest));
    assert.throws(() => loadSubmission(dir), /analysts\.ndjson\.gz: \d+ rows, the manifest declares \d+/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("entities and quarters are listed in order, skipping folders that are not submissions", () => {
  const entities = listEntities(data);
  assert.equal(entities.length, 12);
  assert.deepEqual(entities, [...entities].sort());
  assert.ok(!entities.includes("derived"));
  const quarters = listQuarters(data, "P-04");
  assert.equal(quarters.at(-1), "FY27-Q1");
  assert.deepEqual(quarters, [...quarters].sort());
  assert.deepEqual(listQuarters(data, "Z-99"), []);
  assert.deepEqual(listEntities(path.join(data, "nowhere")), []);
  assert.equal(submissionDir(data, "P-04", "FY27-Q1"), demo);
});

test("asset counts come from one place, by class, with criticals counted apart", () => {
  const counts = classCounts([
    { asset_class: "ot", criticality: "critical" },
    { asset_class: "ot", criticality: "high" },
    { asset_class: "cloud", criticality: "standard" },
  ]);
  assert.deepEqual(counts.ot, { total: 2, critical: 1 });
  assert.deepEqual(counts.cloud, { total: 1, critical: 0 });
  assert.deepEqual(counts.dmz, { total: 0, critical: 0 });
  assert.equal(isCriticalOt({ asset_class: "ot", criticality: "critical" }), true);
  assert.equal(isCriticalOt({ asset_class: "datacentre", criticality: "critical" }), false);
});
