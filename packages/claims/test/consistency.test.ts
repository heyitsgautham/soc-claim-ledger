import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { listEntities } from "@ledger/submission";
import type { EntityAnalysis } from "../src/index";

// Two screens must never disagree about the same inventory. The ledger's claim 2.1 and
// the negative-space OT row both count critical OT assets, and this test holds them equal
// for every entity, against the attestation as well.

const data = path.resolve(import.meta.dirname, "../../../data/demo");

test("the ledger and the negative-space grid count the same critical OT assets", () => {
  let checked = 0;
  for (const code of listEntities(data)) {
    const a = JSON.parse(readFileSync(path.join(data, "derived/entities", `${code}.json`), "utf8")) as EntityAnalysis;
    const ot = a.signals.negativeSpace.rows.find((r) => r.assetClass === "ot");
    const claim = a.assessment.evaluations.find((e) => e.claim.metric === "ot_critical_assets_monitored");
    if (!ot) {
      assert.equal(claim, undefined, `${code} has a critical OT claim but no OT assets`);
      continue;
    }
    assert.ok(claim, `${code} lists OT assets but its questionnaire has no OT claim`);
    assert.equal(claim.recomputed?.kind, "fraction");
    assert.equal(claim.recomputed?.kind === "fraction" ? claim.recomputed.denominator : -1, ot.critical, `${code} ledger against grid`);
    assert.equal(claim.claim.attested.kind === "fraction" ? claim.claim.attested.denominator : -1, ot.critical, `${code} attestation against grid`);
    checked++;
  }
  assert.ok(checked >= 5);
});

test("P-04's grid says 58 OT assets of which 38 are critical, as the ledger's 38", () => {
  const a = JSON.parse(readFileSync(path.join(data, "derived/entities/P-04.json"), "utf8")) as EntityAnalysis;
  const ot = a.signals.negativeSpace.rows.find((r) => r.assetClass === "ot")!;
  assert.deepEqual([ot.assets, ot.critical], [58, 38]);
  const f = a.findings.find((x) => x.detector.id === "negative-space")!;
  assert.ok(f.statement.includes(38), "the negative-space finding names the 38 critical assets");
});

test("findings run most severe first, and P-04's escalation gap sits at the top", () => {
  const a = JSON.parse(readFileSync(path.join(data, "derived/entities/P-04.json"), "utf8")) as EntityAnalysis;
  const sev = a.findings.map((f) => f.severity);
  assert.deepEqual(sev, [...sev].sort((x, y) => y - x), "findings are in severity order");
  const i = a.findings.findIndex((f) => f.claimRef === "1.1");
  assert.ok(i >= 0 && i <= 1, `claim 1.1 ranks ${i + 1}, expected first or second`);
  assert.ok(a.findings[i]!.severity >= 0.9, "a 39-point miss on a P1 control is severe");
  const detectorOnly = a.findings.filter((f) => f.detector.id !== "claim-gap").map((f) => f.severity);
  assert.ok(detectorOnly.every((s) => s <= a.findings[i]!.severity), "no behavioural signal outranks the direct control failure");
});
