import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import { buildInventory, entityByCode, QUARTERS, simulateQuarter } from "../src/index";

const digest = (x: unknown) => createHash("sha256").update(JSON.stringify(x)).digest("hex");

test("the same seed gives the same quarter, row for row", () => {
  const e = entityByCode("S-03");
  const q = QUARTERS.at(-1)!;
  assert.equal(digest(simulateQuarter(e, buildInventory(e), q)), digest(simulateQuarter(e, buildInventory(e), q)));
});

test("P-04's findings emerge from its behaviour, not from inserted rows", () => {
  const e = entityByCode("P-04");
  const out = simulateQuarter(e, buildInventory(e), QUARTERS.at(-1)!);
  const p1 = out.cases.filter((c) => c.priority === "P1");
  const escalated = new Set(out.escalations.filter((x) => x.to_level === "L2").map((x) => x.case_id));
  assert.equal(p1.length, 138);
  assert.equal(p1.filter((c) => !escalated.has(c.id)).length, 47);
  const ot = buildInventory(e).assets.filter((a) => a.asset_class === "ot");
  assert.ok(ot.every((a) => a.log_source_id === null));
  assert.ok(!out.alerts.some((a) => ot.some((o) => o.id === a.asset_id)));
});

test("the claims file comes from the intended process, whatever the simulation did", () => {
  const e = entityByCode("P-04");
  const out = simulateQuarter(e, buildInventory(e), QUARTERS.at(-1)!);
  assert.ok(out.truth.some((t) => t.labels.includes("skipped_l2")));
  assert.equal(e.intended.p1EscalationWithin30Pct, 100);
});
