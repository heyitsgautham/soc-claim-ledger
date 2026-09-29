import assert from "node:assert/strict";
import path from "node:path";
import { test } from "node:test";
import { loadSubmission, submissionDir } from "@ledger/submission";
import { assess, assessLatest, loadClaimsFile } from "../src/index";

const data = path.resolve(import.meta.dirname, "../../../data/demo");

function byRef(entity: string) {
  return new Map(assessLatest(data, entity).evaluations.map((e) => [e.claim.ref, e]));
}

test("P-04's three attestations fall apart against its own records", () => {
  const e = byRef("P-04");
  assert.equal(e.get("1.1")!.status, "gap");
  assert.equal(e.get("1.1")!.matched, 84);
  assert.equal(e.get("1.1")!.population!.count, 138);
  assert.equal(e.get("1.2")!.status, "gap");
  assert.equal(Math.round((e.get("1.2")!.recomputed as { seconds: number }).seconds / 60), 60);
  assert.equal(e.get("2.1")!.status, "gap");
  assert.deepEqual(e.get("2.1")!.recomputed, { kind: "fraction", numerator: 0, denominator: 38 });
  const notes = e.get("1.1")!.evidence.find((s) => s.type === "notes");
  assert.equal(notes?.type === "notes" ? notes.cluster.size : 0, 12);
});

test("a missing export is insufficient evidence, never a gap", () => {
  const e = byRef("P-04");
  assert.equal(e.get("3.1")!.status, "insufficient_evidence");
  assert.deepEqual(e.get("3.1")!.reason, { kind: "missing_export", exports: ["threat_hunts"], quarters: ["FY27-Q1"] });
  assert.equal(byRef("G-04").get("1.1")!.status, "insufficient_evidence");
});

test("taking the escalation export away turns P-04's escalation gap into insufficient evidence", () => {
  const dir = submissionDir(data, "P-04", "FY27-Q1");
  const s = loadSubmission(dir);
  const { escalations: _e, ...records } = s.records;
  const { escalations: _m, ...exports } = s.manifest.exports;
  const stripped = { ...s, records, manifest: { ...s.manifest, exports } };
  const e = assess(loadClaimsFile(dir), [stripped]).evaluations.find((x) => x.claim.ref === "1.1")!;
  assert.equal(e.status, "insufficient_evidence");
});

test("the clean control holds on every claim", () => {
  for (const e of byRef("S-03").values()) assert.equal(e.status, "holds", `${e.claim.ref} ${e.claim.text}`);
});
