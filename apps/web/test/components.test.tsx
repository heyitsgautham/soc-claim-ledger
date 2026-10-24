import assert from "node:assert/strict";
import { test } from "node:test";
import type { ClaimEvaluation } from "@ledger/claims/model";
import { renderToStaticMarkup } from "react-dom/server";
import { FindingText } from "@/components/finding-text";
import { GapTrack } from "@/components/ledger/gap-track";
import { StatusMark } from "@/components/ledger/status-mark";
import { Quantity } from "@/components/quantity";
import { parts } from "@/lib/format";
import { frac, mins, pct, row } from "./fixtures";

// The components render on the server, so their markup is what a static render gives.
const html = (el: React.ReactElement) => renderToStaticMarkup(el);
const text = (el: React.ReactElement) => html(el).replace(/<[^>]+>/g, "");

test("each status reads in words, not only in colour", () => {
  assert.equal(text(<StatusMark status="gap" />), "Gap");
  assert.equal(text(<StatusMark status="holds" />), "Holds");
  assert.equal(text(<StatusMark status="insufficient_evidence" />), "Insufficient evidence");
  assert.match(html(<StatusMark status="insufficient_evidence" />), /border-dashed/);
  assert.match(html(<StatusMark status="holds" />), /<svg[^>]*aria-hidden="true"/);
});

test("a finding sets its numbers in the numeric face, grouped and rounded", () => {
  const out = html(<FindingText finding={["Weekend alerts wait ", 8.34, " times as long, across ", 1234567, " alerts, similarity ", 0.981]} />);
  assert.equal(out.replace(/<[^>]+>/g, ""), "Weekend alerts wait 8.3 times as long, across 12,34,567 alerts, similarity 0.98");
  assert.equal(out.match(/class="num font-medium"/g)?.length, 3);
});

test("a quantity keeps numerals and units in separate spans", () => {
  const out = html(<Quantity parts={parts("", mins(130))} />);
  assert.equal(out.replace(/<[^>]+>/g, ""), "2h10m");
  assert.equal(out.match(/class="num"/g)?.length, 2);
  assert.equal(out.match(/font-sans/g)?.length, 2);
  assert.equal(text(<Quantity parts={parts("", frac(0, 38))} />), "0of38");
});

test("a failed claim draws its variance on the claim's own number line", () => {
  const gap = row(pct(100), pct(61), { status: "gap", claim: { ref: "1.1", attested: pct(100) } } as Partial<ClaimEvaluation>);
  const out = html(<GapTrack evaluation={gap} major delayMs={0} />);
  assert.match(out, /data-testid="gap-track-1.1"/);
  assert.match(out, />0%<\/span><span[^>]*>100%</);
  // The red bar spans from the evidence at 61% to the claim at 100%.
  assert.match(out, /style="left:61%;width:39%"><div class="[^"]*bg-gap/);
  assert.match(text(<GapTrack evaluation={gap} major delayMs={0} />), /−39pts/);
  assert.match(out, /title="Attested 100%"/);
  assert.match(out, /title="Recomputed 61%"/);
});

test("an untestable claim draws no evidence mark", () => {
  const untested = row(pct(95), null, { status: "insufficient_evidence", claim: { ref: "3.1", attested: pct(95) } } as Partial<ClaimEvaluation>);
  const out = html(<GapTrack evaluation={untested} major={false} delayMs={0} />);
  assert.match(out, /data-testid="gap-track-3.1"/);
  assert.match(out, /Cannot be recomputed/);
  assert.doesNotMatch(out, /Recomputed \d/);
  assert.doesNotMatch(out, /bg-gap/);
});
