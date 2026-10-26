import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { ClaimsFileSchema } from "@ledger/claims";
import { isCriticalOt, loadSubmission } from "@ledger/submission";
import { afterAll, beforeAll, test } from "vitest";
import { buildInventory, entityByCode, QUARTERS, writeClaims, writeEntity } from "../src/index";
import { TRUTH_FILE } from "../src/writer";

const demo = path.resolve(import.meta.dirname, "../../../data/demo");
let out: string;
let summaries: ReturnType<typeof writeEntity>;

beforeAll(() => {
  out = mkdtempSync(path.join(tmpdir(), "ledger-sim-"));
  summaries = writeEntity(entityByCode("G-04"), out);
});

afterAll(() => {
  rmSync(out, { recursive: true, force: true });
});

test("one folder per quarter, each a submission the loader accepts with the rows the summary reports", () => {
  assert.deepEqual(
    readdirSync(path.join(out, "G-04")).sort(),
    QUARTERS.map((q) => q.id),
  );
  for (const s of summaries) {
    const sub = loadSubmission(path.join(out, s.entity, s.quarter));
    assert.equal(sub.manifest.entity.code, "G-04");
    assert.equal(sub.manifest.quarter.id, s.quarter);
    for (const [name, rows] of Object.entries(s.rows)) assert.equal(sub.manifest.exports[name as "alerts"]?.rows, rows, `${s.quarter} ${name}`);
  }
});

test("an export the entity leaves out is absent from the folder and the manifest", () => {
  for (const s of summaries) {
    assert.equal(s.rows.escalations, undefined);
    const dir = path.join(out, "G-04", s.quarter);
    assert.equal(existsSync(path.join(dir, "escalations.ndjson.gz")), false);
    assert.equal(loadSubmission(dir).manifest.exports.escalations, undefined);
  }
});

test("the ground truth sits beside the submission but outside its manifest", () => {
  const dir = path.join(out, "G-04", "FY27-Q1");
  assert.ok(existsSync(path.join(dir, TRUTH_FILE)));
  const listed = Object.values(loadSubmission(dir).manifest.exports).map((e) => e!.file);
  assert.ok(!listed.includes(TRUTH_FILE));
});

test("the same seed writes the same bytes as the committed pipeline's data/demo", () => {
  const ref = path.join(demo, "G-04", "FY27-Q1");
  for (const f of readdirSync(ref)) {
    assert.ok(readFileSync(path.join(out, "G-04", "FY27-Q1", f)).equals(readFileSync(path.join(ref, f))), f);
  }
});

test("the claims file follows the schema and asks about OT only where critical OT assets exist", () => {
  for (const code of ["S-03", "G-04"]) {
    const e = entityByCode(code);
    const inventory = buildInventory(e);
    const claims = ClaimsFileSchema.parse(writeClaims(e, inventory, QUARTERS.at(-1)!));
    const refs = claims.claims.map((c) => c.ref);
    assert.equal(new Set(refs).size, refs.length, `${code} refs are unique`);
    const ot = claims.claims.find((c) => c.metric === "ot_critical_assets_monitored");
    const critical = inventory.assets.filter(isCriticalOt).length;
    if (critical === 0) assert.equal(ot, undefined, code);
    else assert.deepEqual(ot?.attested, { kind: "fraction", numerator: critical, denominator: critical }, code);
  }
});
