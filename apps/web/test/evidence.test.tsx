import assert from "node:assert/strict";
import type { EvidenceSection } from "@ledger/claims/model";
import { test } from "vitest";
import { ClosureHistogram } from "@/components/evidence/closure-histogram";
import { NotesTable } from "@/components/evidence/notes-table";
import { AssetTable, CaseTable } from "@/components/evidence/record-tables";
import { Tally } from "@/components/evidence/tally";
import { entity, html, tag, text } from "./demo";

const p04 = entity("P-04").assessment;
const claim = (ref: string) => p04.evaluations.find((e) => e.claim.ref === ref)!;
function section<T extends EvidenceSection["type"]>(ref: string, type: T) {
  const s = claim(ref).evidence.find((x) => x.type === type);
  assert.ok(s, `${ref} has a ${type} section`);
  return s as Extract<EvidenceSection, { type: T }>;
}

test("the closure histogram lights the bucket under the SLA and says what share of closures it holds", () => {
  const s = section("1.1", "histogram");
  const h = s.histogram;
  const out = html(<ClosureHistogram histogram={h} title={s.title} />);
  const share = Math.round(h.bunching.share * 100);
  assert.match(out, new RegExp(`aria-label="${share}% of closures fall in the ${h.bucketMinutes} minutes before the SLA"`));
  assert.equal(out.includes('data-testid="bunching-annotation"'), h.bunching.flagged);
  assert.ok(text(<ClosureHistogram histogram={h} title={s.title} />).startsWith(`${s.title} SLA bunching`));
});

test("an unflagged histogram draws no annotation", () => {
  const h = section("1.1", "histogram").histogram;
  const calm = { ...h, bunching: { ...h.bunching, flagged: false } };
  assert.doesNotMatch(html(<ClosureHistogram histogram={calm} title="Calm" />), /bunching-annotation/);
});

test("the notes table marks only the words that differ from the central note", () => {
  const s = section("1.1", "notes");
  const out = html(<NotesTable section={s} />);
  assert.equal(out.match(/<li /g)?.length, s.cluster.members.length);
  assert.match(out, />centre</);
  const t = text(<NotesTable section={s} />);
  assert.match(t, new RegExp(`${s.cluster.size} of the ${s.compared} closure notes`));
  assert.match(t, new RegExp(`Detector ${s.detector.id} ${s.detector.version.replace(/\./g, "\\.")}`));
  // Each pasted note differs from the centre by its hostname, so few words are marked per row.
  const marked = out.match(/bg-gap-tint/g)?.length ?? 0;
  assert.ok(marked > 0 && marked <= 3 * (s.cluster.members.length - 1), String(marked));
});

test("the case table lists every case behind the claim", () => {
  const s = section("1.1", "cases");
  const out = html(<CaseTable section={s} />);
  tag(out, `case-table-${s.id}`);
  for (const r of s.rows.slice(0, 5)) tag(out, `case-${r.caseId}`);
  assert.equal(out.match(/data-testid="case-[A-Z0-9]+-[^"]*"/g)?.length, s.rows.length);
});

test("the asset table lists each critical OT asset with its site", () => {
  const s = section("2.1", "assets");
  const out = text(<AssetTable section={s} />);
  for (const r of s.rows.slice(0, 5)) {
    assert.ok(out.includes(r.hostname), r.hostname);
    assert.ok(out.includes(r.site), r.site);
  }
});

test("the tally counts every record in the breakdown", () => {
  const s = section("1.1", "breakdown");
  const out = html(<Tally section={s} />);
  tag(out, `tally-${s.id}`);
  assert.ok(text(<Tally section={s} />).includes(s.title));
});
