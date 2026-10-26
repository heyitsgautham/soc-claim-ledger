import assert from "node:assert/strict";
import { test } from "vitest";
import { EntityHeader } from "@/components/ledger/entity-header";
import { LedgerTable } from "@/components/ledger/ledger-table";
import { int } from "@/lib/format";
import { entity, html, tag, text } from "./demo";

const p04 = entity("P-04").assessment;
const g04 = entity("G-04").assessment;
const count = (a: typeof p04, s: string) => a.evaluations.filter((e) => e.status === s).length;

test("the header reads the gaps out of every attested figure, and what cannot be tested", () => {
  const t = text(<EntityHeader assessment={p04} />);
  assert.match(t, new RegExp(`${count(p04, "gap")} of ${p04.evaluations.length} attested figures do not hold against P-04's own records\\.`));
  assert.match(
    t,
    new RegExp(`${count(p04, "insufficient_evidence")} cannot be tested from this submission\\. ${count(p04, "holds")} hold within tolerance\\.`),
  );
  assert.ok(t.includes(p04.claimsDocument.document_id));
  assert.ok(t.includes(`${int(p04.exports.find((x) => x.name === "alerts")!.rows)} alerts`));
  assert.match(tag(html(<EntityHeader assessment={p04} />), "view-signed"), /href="\/entities\/P-04\/check"/);
});

test("an export the entity left out is not counted in the header", () => {
  const t = text(<EntityHeader assessment={g04} />);
  assert.doesNotMatch(t, /escalations/);
  assert.match(t, /alerts · [\d,]+ cases · [\d,]+ assets/);
});

test("the ledger groups claims by status, gaps first, with a row per claim", () => {
  const out = html(<LedgerTable evaluations={p04.evaluations} selected={null} onOpen={() => {}} />);
  const groups = [...out.matchAll(/data-testid="ledger-group-([a-z_]+)"/g)].map((m) => m[1]);
  assert.equal(groups[0], "gap");
  assert.deepEqual([...new Set(groups)], groups);
  for (const e of p04.evaluations) tag(out, `ledger-row-${e.claim.ref}`);
});

test("a claim that cannot be recomputed says so in its row's label", () => {
  const out = html(<LedgerTable evaluations={g04.evaluations} selected={null} onOpen={() => {}} />);
  const row = tag(out, "ledger-row-1.1");
  assert.match(row, /Cannot be recomputed\. Open evidence\./);
  const groups = [...out.matchAll(/data-testid="ledger-group-([a-z_]+)"/g)].map((m) => m[1]);
  assert.ok(groups.includes("insufficient_evidence"));
  assert.ok(!groups.includes("gap"));
});
